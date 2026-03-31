import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { CLIENT_LIMITS } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json()
  const resolvedPlan = ['starter', 'pro', 'scale'].includes(plan) ? plan : null
  if (!resolvedPlan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const PLAN_PRICES: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro:     process.env.STRIPE_PRICE_PRO,
    scale:   process.env.STRIPE_PRICE_SCALE,
  }
  const priceId = PLAN_PRICES[resolvedPlan as string]
  if (!priceId) return NextResponse.json({ error: 'Plan nije konfiguriran.' }, { status: 500 })

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await adminDb.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check existing subscription record (any status)
  const { data: existingSub } = await adminDb
    .from('subscriptions')
    .select('status, stripe_customer_id')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (existingSub?.status === 'active' || existingSub?.status === 'trialing') {
    return NextResponse.json({ error: 'Već imaš aktivnu pretplatu.' }, { status: 409 })
  }

  // Trial only if user never had any subscription record (abandoned registration before Stripe)
  // Returning users with expired/cancelled subscriptions pay immediately
  const isFirstTimeBuyer = !existingSub

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

  // Reuse existing Stripe customer if possible
  let customerId = existingSub?.stripe_customer_id
  if (!customerId) {
    const { data: profile } = await adminDb
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    // Double-check by email in Stripe to prevent trial abuse
    const existingCustomers = await stripe.customers.list({ email: profile?.email || user.email || '', limit: 1 })
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email || '',
        name:  profile?.full_name || '',
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
    }
  }

  // Check Stripe for any prior subscriptions on this customer (extra safety)
  const priorSubs = await stripe.subscriptions.list({ customer: customerId, limit: 10, status: 'all' })
  const hasHadTrialBefore = priorSubs.data.some(s => (s as any).trial_start != null)
  const grantTrial = isFirstTimeBuyer && !hasHadTrialBefore

  const appUrl = 'https://app.unitlift.com'

  const session = await stripe.checkout.sessions.create({
    customer:                  customerId,
    mode:                      'subscription',
    payment_method_types:      ['card'],
    payment_method_collection: 'always',
    line_items:                [{ price: priceId, quantity: 1 }],
    subscription_data: {
      ...(grantTrial ? { trial_period_days: 14 } : {}),
      metadata: { plan: resolvedPlan, supabase_user_id: user.id },
    },
    metadata: { plan: resolvedPlan, supabase_user_id: user.id },
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard?setup=pending`,
    cancel_url:  `${appUrl}/choose-plan`,
  })

  return NextResponse.json({ checkout_url: session.url })
}
