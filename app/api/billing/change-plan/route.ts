import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'
import { PLAN_META, BILLABLE_PLANS, getClientLimit, type Plan } from '@/lib/plans'

/**
 * Change plan flow:
 *  - UPGRADE   → immediate change with proration ('always_invoice' = charge difference now).
 *  - DOWNGRADE → scheduled for current_period_end. Stored in DB columns
 *                scheduled_plan_change + scheduled_plan_change_at, applied
 *                by /api/cron/apply-scheduled-changes. User keeps current
 *                plan and limit until the new period starts.
 *  - Founding coupon is preserved through Stripe natively (sub-level discount).
 *  - Ambassador accounts are rejected.
 */
export async function POST(req: NextRequest) {
  const stripe = createStripeClient()
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { new_plan } = await req.json()
  if (!BILLABLE_PLANS.includes(new_plan as Plan)) {
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
    .select('stripe_subscription_id, plan, status, is_ambassador, current_period_end')
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
  const { count: activeClientCount } = await supabaseAdmin
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', user.id)
    .eq('active', true)

  const currentPlan = sub.plan as Plan
  const currentPrice = PLAN_META[currentPlan].basePriceEur
  const newPrice     = newPlanMeta.basePriceEur
  const isUpgrade    = newPrice > currentPrice

  // For Scale the limit alone isn't a downgrade blocker — overage absorbs excess.
  // But for Starter/Pro the active count must fit BEFORE downgrade is even scheduled.
  if (!isUpgrade && newPlanKey !== 'scale') {
    const newLimit = getClientLimit(newPlanKey)
    if ((activeClientCount ?? 0) > newLimit) {
      return NextResponse.json({
        error: `Ne možeš prijeći na ${newPlanMeta.label} plan — imaš ${activeClientCount} aktivnih klijenata, a limit je ${newLimit}. Deaktiviraj klijente prije promjene.`,
      }, { status: 400 })
    }
  }

  // ─── UPGRADE: apply immediately with proration ─────────────────────────────
  if (isUpgrade) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      const baseItem = stripeSub.items.data.find(i => i.price.id !== PLAN_META['scale'].stripeOveragePriceId)
      if (!baseItem) {
        return NextResponse.json({ error: 'Subscription item not found' }, { status: 500 })
      }

      const items: Stripe.SubscriptionUpdateParams.Item[] = [
        { id: baseItem.id, price: newPriceId },
      ]

      const overageItem = stripeSub.items.data.find(i => i.price.id === PLAN_META['scale'].stripeOveragePriceId)
      if (newPlanKey === 'scale' && !overageItem && newPlanMeta.stripeOveragePriceId) {
        items.push({ price: newPlanMeta.stripeOveragePriceId })
      }

      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items,
        proration_behavior: 'always_invoice',  // charge prorated difference NOW
        metadata: {
          ...stripeSub.metadata,   // preserve supabase_user_id + other existing keys
          plan: newPlanKey,
          client_limit: String(newPlanMeta.clientLimit ?? ''),
        },
      })

      const u = updated as any
      await supabaseAdmin.from('subscriptions').update({
        plan:                    newPlanKey,
        client_limit:            newPlanMeta.clientLimit,
        current_period_start:    u.current_period_start != null ? new Date(u.current_period_start * 1000).toISOString() : null,
        current_period_end:      u.current_period_end   != null ? new Date(u.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end:    updated.cancel_at_period_end,
        // upgrade clears any pending downgrade
        scheduled_plan_change:    null,
        scheduled_plan_change_at: null,
        updated_at:              new Date().toISOString(),
      }).eq('trainer_id', user.id)

      return NextResponse.json({
        success: true,
        applied: 'immediate',
        new_plan: newPlanKey,
        client_limit: newPlanMeta.clientLimit,
      })
    } catch (err: any) {
      console.error('[change-plan] upgrade failed:', err?.message)
      return NextResponse.json({ error: 'Greška pri promjeni plana.' }, { status: 502 })
    }
  }

  // ─── DOWNGRADE: schedule for end of current period ─────────────────────────
  // We DON'T touch Stripe items now — the cron job will do that at period end.
  // User keeps current plan + limit until then.
  if (!sub.current_period_end) {
    return NextResponse.json({ error: 'Trenutni billing period nije poznat.' }, { status: 400 })
  }

  const { error: dbErr } = await supabaseAdmin.from('subscriptions').update({
    scheduled_plan_change:    newPlanKey,
    scheduled_plan_change_at: sub.current_period_end,
    updated_at:               new Date().toISOString(),
  }).eq('trainer_id', user.id)

  if (dbErr) {
    console.error('[change-plan] schedule DB update failed:', dbErr)
    return NextResponse.json({ error: 'Greška pri zakazivanju promjene plana.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    applied: 'scheduled',
    new_plan: newPlanKey,
    scheduled_for: sub.current_period_end,
  })
}
