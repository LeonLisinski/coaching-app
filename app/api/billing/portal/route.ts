import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await adminDb.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await adminDb
    .from('subscriptions')
    .select('stripe_customer_id, is_ambassador')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (sub?.is_ambassador || !sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe subscription to manage.' }, { status: 400 })
  }

  const stripe = createStripeClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'

  let portalSession: Stripe.BillingPortal.Session
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: `${appUrl}/dashboard/billing`,
    })
  } catch (e: any) {
    console.error('[billing/portal] Stripe portal create failed:', e?.message)
    return NextResponse.json({ error: 'Stripe greška. Pokušaj ponovo.' }, { status: 502 })
  }

  return NextResponse.json({ url: portalSession.url })
}
