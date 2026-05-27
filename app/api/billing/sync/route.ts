import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { PLAN_META, type Plan } from '@/lib/plans'

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

  const { data: existingSub } = await adminDb
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status, locked_at, is_ambassador')
    .eq('trainer_id', user.id)
    .maybeSingle()

  // Ambassador accounts always have access — no Stripe sync needed
  if (existingSub?.is_ambassador) {
    return NextResponse.json({ hasAccess: true, status: 'active' })
  }

  if (!existingSub?.stripe_subscription_id) {
    return NextResponse.json({ hasAccess: false, status: null })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

  let sub: Stripe.Subscription
  try {
    sub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)
  } catch (stripeErr: any) {
    console.error('[billing/sync] Stripe retrieve failed:', stripeErr?.message)
    return NextResponse.json({ error: 'Stripe unavailable' }, { status: 502 })
  }
  const subA = sub as any

  const plan = (sub.metadata?.plan ?? 'starter') as Plan
  const planMeta = PLAN_META[plan] ?? PLAN_META['starter']
  const status = sub.status

  const isHealthy = status === 'active' || status === 'trialing'

  const { error: syncErr } = await adminDb.from('subscriptions').update({
    status,
    plan,
    client_limit:         planMeta.clientLimit,
    trial_start:          subA.trial_start != null          ? new Date(subA.trial_start          * 1000).toISOString() : null,
    trial_end:            subA.trial_end != null            ? new Date(subA.trial_end            * 1000).toISOString() : null,
    current_period_start: subA.current_period_start != null ? new Date(subA.current_period_start * 1000).toISOString() : null,
    current_period_end:   subA.current_period_end != null   ? new Date(subA.current_period_end   * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    ...(isHealthy ? { locked_at: null } : {}),
    updated_at:           new Date().toISOString(),
  }).eq('trainer_id', user.id)

  if (syncErr) {
    console.error('[billing/sync] DB update failed:', syncErr)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  const now = new Date()
  const hasAccess =
    status === 'active' ||
    (status === 'trialing' && (!subA.trial_end || new Date(subA.trial_end * 1000) > now)) ||
    (status === 'past_due' && (!existingSub.locked_at || new Date(existingSub.locked_at) > now))

  return NextResponse.json({ hasAccess, status })
}
