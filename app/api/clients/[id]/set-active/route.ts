import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { PLAN_META, scaleOverageBlocks, scaleOverageTierIncreases, getClientLimit, type Plan } from '@/lib/plans'

/**
 * Server-side gate for activating / deactivating a client. Must be used
 * instead of direct supabase.from('clients').update({ active }) so that
 * plan limits and Scale overage tier confirmation can never be bypassed.
 *
 * Overage reliability: when a Scale tier crossing is confirmed, we first
 * update subscriptions.max_overage_blocks = GREATEST(current, newBlocks) in
 * the database. This is the fatal gate — if it fails the client is NOT
 * activated. We then attempt an immediate Stripe usage-record report, but
 * that call is best-effort: if it fails the daily cron will reconcile using
 * the stored max_overage_blocks value.
 *
 * Body:
 *   { active: boolean, confirm_overage?: boolean }
 *
 * Responses:
 *   200 { success: true, ... }
 *   402 { error: 'UPGRADE_REQUIRED', plan, current, limit }      → at limit, need upgrade
 *   402 { error: 'OVERAGE_CONFIRMATION_REQUIRED',
 *         currentBlocks, newBlocks, baseEur, additionalEur,
 *         newTotalEur, newCount, inPromo }                       → Scale tier crossing
 *         (all prices are already promo-discounted when inPromo=true)
 *   403 { error: 'NOT_OWNER' }
 *   403 { error: 'CLIENT_NOT_FOUND' }
 *   400 / 401 / 500 standard
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await ctx.params
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active, confirm_overage } = await req.json().catch(() => ({}))
  if (typeof active !== 'boolean') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await adminDb.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: client } = await adminDb
    .from('clients')
    .select('id, trainer_id, active')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'CLIENT_NOT_FOUND' }, { status: 404 })
  if (client.trainer_id !== user.id) return NextResponse.json({ error: 'NOT_OWNER' }, { status: 403 })

  // No-op if already at target state
  if (client.active === active) {
    return NextResponse.json({ success: true, noop: true })
  }

  // ── Deactivation: always allowed ─────────────────────────────────────────
  if (active === false) {
    const { error } = await adminDb.from('clients').update({ active: false }).eq('id', clientId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Activation: enforce limit + overage rules ─────────────────────────────
  const { data: sub } = await adminDb
    .from('subscriptions')
    .select('plan, status, client_limit, is_ambassador, stripe_subscription_id, max_overage_blocks, promo_ends_at, promo_lost_at')
    .eq('trainer_id', user.id)
    .maybeSingle()

  // Ambassador or unlimited: skip checks
  if (sub?.is_ambassador) {
    const { error } = await adminDb.from('clients').update({ active: true }).eq('id', clientId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (!sub || !['active', 'trialing'].includes(sub.status)) {
    return NextResponse.json({ error: 'SUBSCRIPTION_INACTIVE' }, { status: 402 })
  }

  // Count current ACTIVE clients (excluding the one we're about to activate)
  const { count: activeNow } = await adminDb
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', user.id)
    .eq('active', true)

  const currentCount = activeNow ?? 0
  const newCount = currentCount + 1
  const plan = sub.plan as Plan

  // For Starter/Pro: hard limit
  if (plan !== 'scale') {
    const limit = getClientLimit(plan)
    if (currentCount >= limit) {
      return NextResponse.json({
        error: 'UPGRADE_REQUIRED',
        plan,
        current: currentCount,
        limit,
      }, { status: 402 })
    }
  }

  // For Scale: check overage tier crossing — require explicit confirmation
  if (plan === 'scale') {
    if (scaleOverageTierIncreases(currentCount, newCount) && !confirm_overage) {
      const newBlocks       = scaleOverageBlocks(newCount)
      const scaleBase       = PLAN_META['scale'].basePriceEur          // 99
      const additionalRegular = newBlocks * 10                          // €10 / block / month
      const totalRegular      = scaleBase + additionalRegular

      // The founding promo coupon is configured in Stripe to apply to the
      // ENTIRE UnitLift Scale product, which means BOTH the base price and
      // the metered overage price are discounted by 50% during the user's
      // 12-month promo period. So both the base and the additional cost
      // are halved when computing what we show in the confirmation modal.
      const inPromo = !!(sub?.promo_ends_at && !sub?.promo_lost_at && Date.now() < new Date(sub.promo_ends_at).getTime())

      const baseEur       = inPromo ? scaleBase         * 0.5 : scaleBase
      const additionalEur = inPromo ? additionalRegular * 0.5 : additionalRegular
      const newTotalEur   = inPromo ? totalRegular      * 0.5 : totalRegular

      return NextResponse.json({
        error: 'OVERAGE_CONFIRMATION_REQUIRED',
        currentBlocks: scaleOverageBlocks(currentCount),
        newBlocks,
        baseEur,
        additionalEur,
        newTotalEur,
        newCount,
        inPromo,
      }, { status: 402 })
    }
  }

  // Atomic activation: set_active_with_overage_peak updates max_overage_blocks AND
  // flips clients.active in a single DB transaction. p_blocks=0 is a no-op for the
  // peak column (GREATEST(current, 0)) so we can always use this RPC.
  const tierCrossing = plan === 'scale' && confirm_overage && scaleOverageTierIncreases(currentCount, newCount)
  const newBlocks = tierCrossing ? scaleOverageBlocks(newCount) : 0

  const { error: activateErr } = await adminDb.rpc('set_active_with_overage_peak', {
    p_trainer_id: user.id,
    p_client_id:  clientId,
    p_blocks:     newBlocks,
  })
  if (activateErr) {
    console.error('[set-active] atomic activation failed:', activateErr)
    return NextResponse.json({ error: activateErr.message }, { status: 500 })
  }

  // Best-effort immediate Stripe report — the daily cron will reconcile if this fails.
  // The DB peak (max_overage_blocks) is the source of truth; Stripe is the billing executor.
  if (tierCrossing && sub.stripe_subscription_id) {
    const overagePriceId = PLAN_META['scale'].stripeOveragePriceId
    if (overagePriceId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
        const overageItem = stripeSub.items.data.find(i => i.price.id === overagePriceId)
        if (overageItem) {
          // SDK types no longer expose createUsageRecord (legacy metered API);
          // runtime endpoint is still functional under apiVersion '2025-02-24.acacia'.
          await (stripe.subscriptionItems as any).createUsageRecord(overageItem.id, {
            quantity:  newBlocks,
            action:    'set',
            timestamp: Math.floor(Date.now() / 1000),
          })
        }
      } catch (e) {
        // Non-fatal: peak is already persisted in DB; cron will retry.
        console.error('[set-active] immediate Stripe overage report failed (cron will reconcile):', e)
      }
    }
  }

  return NextResponse.json({ success: true })
}
