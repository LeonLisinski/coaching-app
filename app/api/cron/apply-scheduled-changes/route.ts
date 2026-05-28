import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'
import { PLAN_META, getClientLimit, type Plan } from '@/lib/plans'
import { sendResendEmail } from '@/lib/resend-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Hourly cron — applies any scheduled plan downgrades whose
 * scheduled_plan_change_at <= now. If the trainer added clients in the
 * meantime and now exceeds the target plan's limit, the downgrade is
 * CANCELLED (cleared from DB) and an email notification is sent.
 *
 * Runs hourly because Stripe periods can end at any minute, and we want
 * the downgrade to apply close to the actual period boundary.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  if (!secret) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
  } else if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const stripe = createStripeClient()

  const nowIso = new Date().toISOString()

  // Find subs whose downgrade is due (within the last 6h to also catch any
  // backlog if cron was skipped).
  const { data: due } = await supabase
    .from('subscriptions')
    .select('trainer_id, stripe_subscription_id, plan, scheduled_plan_change, scheduled_plan_change_at')
    .not('scheduled_plan_change', 'is', null)
    .lte('scheduled_plan_change_at', nowIso)
    .not('is_ambassador', 'eq', true)

  let applied = 0
  let cancelled = 0
  const errors: string[] = []

  for (const row of due ?? []) {
    const targetPlan = row.scheduled_plan_change as Plan
    const targetMeta = PLAN_META[targetPlan]
    if (!targetMeta?.stripePriceId) {
      errors.push(`${row.trainer_id}: target plan ${targetPlan} not configured`)
      continue
    }

    try {
      // Re-check active client count against the target limit. If exceeded,
      // cancel the scheduled downgrade and notify the trainer.
      const { count: activeClients } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', row.trainer_id)
        .eq('active', true)

      const targetLimit = getClientLimit(targetPlan)
      if (targetPlan !== 'scale' && (activeClients ?? 0) > targetLimit) {
        // Abort: clear the schedule and email the trainer
        await supabase.from('subscriptions').update({
          scheduled_plan_change:    null,
          scheduled_plan_change_at: null,
          updated_at:               nowIso,
        }).eq('trainer_id', row.trainer_id)

        const { data: profile } = await supabase
          .from('profiles').select('full_name, email').eq('id', row.trainer_id).maybeSingle()
        if (profile?.email) {
          const firstName = profile.full_name?.split(' ')[0] || 'Trener'
          await sendResendEmail({
            to: profile.email,
            subject: `UnitLift: zakazana promjena plana nije primijenjena`,
            html: `<p>Bok ${firstName},</p>
<p>Zakazana promjena plana na <strong>${targetMeta.label}</strong> nije primijenjena jer trenutno imaš <strong>${activeClients}</strong> aktivnih klijenata, a ${targetMeta.label} dopušta najviše <strong>${targetLimit}</strong>.</p>
<p>Ostao si na trenutnom planu. Možeš ponovno zakazati promjenu nakon što deaktiviraš višak klijenata.</p>`,
          })
        }
        cancelled++
        continue
      }

      // Apply the change in Stripe (no proration — clean cutover at period end)
      const stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
      const baseItem = stripeSub.items.data.find(i => i.price.id !== PLAN_META['scale'].stripeOveragePriceId)
      if (!baseItem) {
        errors.push(`${row.trainer_id}: base item not found`)
        continue
      }

      const items: Stripe.SubscriptionUpdateParams.Item[] = [
        { id: baseItem.id, price: targetMeta.stripePriceId! },
      ]
      const overageItem = stripeSub.items.data.find(i => i.price.id === PLAN_META['scale'].stripeOveragePriceId)
      if (overageItem && targetPlan !== 'scale') {
        items.push({ id: overageItem.id, deleted: true })
      }
      if (targetPlan === 'scale' && !overageItem && targetMeta.stripeOveragePriceId) {
        items.push({ price: targetMeta.stripeOveragePriceId })
      }

      const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
        items,
        proration_behavior: 'none',
        metadata: { plan: targetPlan, client_limit: String(targetMeta.clientLimit ?? '') },
      })
      const u = updated as any

      await supabase.from('subscriptions').update({
        plan:                     targetPlan,
        client_limit:             targetMeta.clientLimit,
        current_period_start:     u.current_period_start != null ? new Date(u.current_period_start * 1000).toISOString() : null,
        current_period_end:       u.current_period_end   != null ? new Date(u.current_period_end   * 1000).toISOString() : null,
        scheduled_plan_change:    null,
        scheduled_plan_change_at: null,
        updated_at:               nowIso,
      }).eq('trainer_id', row.trainer_id)

      applied++
    } catch (e: any) {
      errors.push(`${row.trainer_id}: ${e?.message}`)
    }
  }

  return NextResponse.json({ ok: true, applied, cancelled, errors: errors.length ? errors : undefined })
}
