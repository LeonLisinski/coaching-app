import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const CLIENT_LIMITS: Record<string, number> = { starter: 15, pro: 50, scale: 150 }

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

  // Get existing subscription row
  const { data: existingSub } = await adminDb
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (!existingSub?.stripe_subscription_id) {
    return NextResponse.json({ hasAccess: false, status: null })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

  // Pull fresh data directly from Stripe
  const sub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)
  const subA = sub as any

  const plan = sub.metadata?.plan ?? 'starter'
  const status = sub.status // 'active' | 'trialing' | 'past_due' | 'canceled' | etc.

  // Sync to Supabase
  await adminDb.from('subscriptions').update({
    status,
    plan,
    client_limit:         CLIENT_LIMITS[plan] ?? 15,
    trial_start:          subA.trial_start != null          ? new Date(subA.trial_start          * 1000).toISOString() : null,
    trial_end:            subA.trial_end != null            ? new Date(subA.trial_end            * 1000).toISOString() : null,
    current_period_start: subA.current_period_start != null ? new Date(subA.current_period_start * 1000).toISOString() : null,
    current_period_end:   subA.current_period_end != null   ? new Date(subA.current_period_end   * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    locked_at:            null,
    updated_at:           new Date().toISOString(),
  }).eq('trainer_id', user.id)

  const now = new Date()
  const hasAccess =
    status === 'active' ||
    (status === 'trialing' && (!subA.trial_end || new Date(subA.trial_end * 1000) > now)) ||
    (status === 'past_due' && (!subA.locked_at || new Date(subA.locked_at) > now))

  return NextResponse.json({ hasAccess, status })
}
