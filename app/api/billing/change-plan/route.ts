import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { PLAN_META, PUBLIC_PLANS, getClientLimit, type Plan } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { new_plan } = await req.json()
  if (!new_plan || !PUBLIC_PLANS.includes(new_plan as Plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const newPlanKey = new_plan as Plan
  const newPlanMeta = PLAN_META[newPlanKey]
  const newPriceId = newPlanMeta.stripePriceId
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
    .select('stripe_subscription_id, plan, status, is_ambassador')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (sub?.is_ambassador) {
    return NextResponse.json({ error: 'Ambassador račun ne može mijenjati plan.' }, { status: 403 })
  }

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  if (sub.plan === new_plan) {
    return NextResponse.json({ error: 'Already on this plan' }, { status: 400 })
  }

  if (!['active', 'trialing'].includes(sub.status)) {
    return NextResponse.json({ error: 'Pretplata nije aktivna.' }, { status: 400 })
  }

  // Block downgrade if active client count exceeds new plan limit
  const newLimit = getClientLimit(newPlanKey)
  const { count: activeClientCount } = await supabaseAdmin
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', user.id)
    .eq('active', true)

  if ((activeClientCount ?? 0) > newLimit) {
    return NextResponse.json({
      error: `Ne možeš prijeći na ${newPlanMeta.label} plan — imaš ${activeClientCount} aktivnih klijenata, a limit je ${newLimit}.`,
    }, { status: 400 })
  }

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const baseItem   = stripeSub.items.data.find(i => i.price.id !== newPlanMeta.stripeOveragePriceId)
  const itemId     = baseItem?.id

  if (!itemId) {
    return NextResponse.json({ error: 'Subscription item not found' }, { status: 500 })
  }

  // Build items update: replace base price, keep/add overage for scale
  const items: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: itemId, price: newPriceId },
  ]

  // Remove overage item if downgrading away from scale
  const overageItem = stripeSub.items.data.find(i => i.price.id === PLAN_META['scale'].stripeOveragePriceId)
  if (overageItem && newPlanKey !== 'scale') {
    items.push({ id: overageItem.id, deleted: true })
  }

  // Add overage item if upgrading to scale and it doesn't exist
  if (newPlanKey === 'scale' && !overageItem && newPlanMeta.stripeOveragePriceId) {
    items.push({ price: newPlanMeta.stripeOveragePriceId, quantity: 0 })
  }

  let updated: Stripe.Subscription
  try {
    updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items,
      proration_behavior: 'create_prorations',
      metadata: { plan: new_plan, client_limit: String(newLimit) },
    })
  } catch (err: any) {
    console.error('[change-plan] Stripe update failed:', err?.message)
    return NextResponse.json({ error: 'Greška pri promjeni plana.' }, { status: 502 })
  }

  const u = updated as any
  await supabaseAdmin.from('subscriptions').update({
    plan:                    new_plan,
    client_limit:            newPlanMeta.clientLimit,
    current_period_start:    u.current_period_start != null ? new Date(u.current_period_start * 1000).toISOString() : null,
    current_period_end:      u.current_period_end   != null ? new Date(u.current_period_end   * 1000).toISOString() : null,
    cancel_at_period_end:    updated.cancel_at_period_end,
    updated_at:              new Date().toISOString(),
  }).eq('trainer_id', user.id)

  return NextResponse.json({
    success: true,
    new_plan,
    client_limit: newPlanMeta.clientLimit,
  })
}
