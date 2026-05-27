import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { PLAN_META, PUBLIC_PLANS, type Plan } from '@/lib/plans'
import { isFoundingPromoActive } from '@/lib/founding'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json()
  const resolvedPlan = PUBLIC_PLANS.includes(plan as Plan) ? (plan as Plan) : null
  if (!resolvedPlan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const planMeta = PLAN_META[resolvedPlan]
  const priceId = planMeta.stripePriceId
  if (!priceId) return NextResponse.json({ error: 'Plan nije konfiguriran.' }, { status: 500 })

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await adminDb.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Block ambassador accounts from going through checkout
  const { data: existingSub } = await adminDb
    .from('subscriptions')
    .select('status, stripe_customer_id, is_ambassador')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (existingSub?.is_ambassador) {
    return NextResponse.json({ error: 'Ambassador račun ne može mijenjati plan.' }, { status: 403 })
  }

  if (existingSub?.status === 'active' || existingSub?.status === 'trialing') {
    return NextResponse.json({ error: 'Već imaš aktivnu pretplatu.' }, { status: 409 })
  }

  const isFirstTimeBuyer = !existingSub

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

  let customerId = existingSub?.stripe_customer_id
  if (!customerId) {
    const { data: profile } = await adminDb
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

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

  const priorSubs = await stripe.subscriptions.list({ customer: customerId, limit: 10, status: 'all' })
  const hasHadTrialBefore = priorSubs.data.some(s => (s as any).trial_start != null)
  const grantTrial = isFirstTimeBuyer && !hasHadTrialBefore

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'

  // Founding promo: apply 50% forever coupon if active
  const useFoundingPromo = isFoundingPromoActive() && !!process.env.STRIPE_COUPON_FOUNDING

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: priceId, quantity: 1 }]

  // For scale: add overage metered item at quantity 0
  if (resolvedPlan === 'scale' && planMeta.stripeOveragePriceId) {
    lineItems.push({ price: planMeta.stripeOveragePriceId, quantity: 0 })
  }

  const session = await stripe.checkout.sessions.create({
    customer:                  customerId,
    mode:                      'subscription',
    payment_method_types:      ['card'],
    payment_method_collection: 'always',
    line_items:                lineItems,
    subscription_data: {
      ...(grantTrial ? { trial_period_days: 14 } : {}),
      metadata: { plan: resolvedPlan, supabase_user_id: user.id },
    },
    ...(useFoundingPromo ? {
      discounts: [{ coupon: process.env.STRIPE_COUPON_FOUNDING! }],
    } : {
      allow_promotion_codes: true,
    }),
    metadata: { plan: resolvedPlan, supabase_user_id: user.id },
    success_url: `${appUrl}/dashboard?setup=pending`,
    cancel_url:  `${appUrl}/choose-plan`,
  })

  return NextResponse.json({ checkout_url: session.url })
}
