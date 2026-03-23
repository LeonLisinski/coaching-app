import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const CLIENT_LIMITS: Record<string, number> = { starter: 15, pro: 50, scale: 150 }

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

  const PLAN_PRICE_MAP: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro:     process.env.STRIPE_PRICE_PRO,
    scale:   process.env.STRIPE_PRICE_SCALE,
  }
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { new_plan } = await req.json()
  if (!new_plan || !PLAN_PRICE_MAP[new_plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const newPriceId = PLAN_PRICE_MAP[new_plan]
  if (!newPriceId) {
    return NextResponse.json({ error: `Price not configured for: ${new_plan}` }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id, plan, status')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  if (sub.plan === new_plan) {
    return NextResponse.json({ error: 'Already on this plan' }, { status: 400 })
  }

  if (!['active', 'trialing'].includes(sub.status)) {
    return NextResponse.json({ error: 'Pretplata nije aktivna.' }, { status: 400 })
  }

  // Server-side: block downgrade if current client count exceeds new plan limit
  const newLimit = CLIENT_LIMITS[new_plan] ?? 0
  const { count: clientCount } = await supabaseAdmin
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', user.id)
  if ((clientCount ?? 0) > newLimit) {
    return NextResponse.json({
      error: `Ne možeš prijeći na ${new_plan} plan — imaš ${clientCount} klijenata, a limit je ${newLimit}.`,
    }, { status: 400 })
  }

  // Retrieve current subscription to get item ID
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const itemId    = stripeSub.items.data[0]?.id

  if (!itemId) {
    return NextResponse.json({ error: 'Subscription item not found' }, { status: 500 })
  }

  let updated: Stripe.Subscription
  try {
    updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
      metadata: { plan: new_plan, client_limit: String(CLIENT_LIMITS[new_plan]) },
    })
  } catch (err: any) {
    console.error('[change-plan] Stripe update failed:', err?.message)
    return NextResponse.json({ error: 'Greška pri promjeni plana.' }, { status: 502 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = updated as any
  await supabaseAdmin.from('subscriptions').update({
    plan:                    new_plan,
    client_limit:            CLIENT_LIMITS[new_plan],
    current_period_start:    u.current_period_start != null ? new Date(u.current_period_start * 1000).toISOString() : null,
    current_period_end:      u.current_period_end   != null ? new Date(u.current_period_end   * 1000).toISOString() : null,
    cancel_at_period_end:    updated.cancel_at_period_end,
    updated_at:              new Date().toISOString(),
  }).eq('trainer_id', user.id)

  return NextResponse.json({
    success: true,
    new_plan,
    client_limit: CLIENT_LIMITS[new_plan],
  })
}
