import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily backup/reconciliation cron: reports the peak Scale overage block count
 * for the current billing period to Stripe.
 *
 * IMPORTANT: this cron reads subscriptions.max_overage_blocks (the stored peak),
 * NOT the live active-client count. The peak is written by set-active and
 * create-client immediately when a tier crossing is confirmed, so it captures
 * every threshold crossing even if the trainer deactivates the client before
 * this cron runs.
 *
 * The daily run acts as a retry/reconciliation layer: if the immediate Stripe
 * report inside set-active/create-client failed, this cron will re-send the
 * correct peak value.
 *
 * Stripe aggregates with action='set' + aggregate_usage='max' on the price —
 * the highest value reported during the period is what gets billed.
 *
 * max_overage_blocks is reset to 0 by the webhook on each invoice.payment_succeeded
 * (start of new billing period).
 *
 * NOTE: uses Stripe API version 2025-02-24.acacia — the LAST version that supports
 * the legacy subscriptionItems.createUsageRecord endpoint. This endpoint was
 * removed in 2025-03-31.basil. New Billing Meters do not support max aggregation,
 * so the legacy API is intentionally retained.
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

  const overagePriceId = process.env.STRIPE_PRICE_SCALE_OVERAGE
  if (!overagePriceId) {
    return NextResponse.json({ ok: true, skipped: 'No overage price configured' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const stripe = createStripeClient()

  // Read stored peak overage blocks — NOT live active client count.
  const { data: scaleSubs } = await supabase
    .from('subscriptions')
    .select('trainer_id, stripe_subscription_id, max_overage_blocks')
    .eq('plan', 'scale')
    .eq('status', 'active')
    .not('is_ambassador', 'eq', true)

  let updated = 0
  const errors: string[] = []

  for (const sub of scaleSubs ?? []) {
    try {
      const blocks = sub.max_overage_blocks ?? 0

      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      const overageItem = stripeSub.items.data.find(i => i.price.id === overagePriceId)

      if (overageItem) {
        // The Stripe SDK's TypeScript types no longer expose `createUsageRecord`
        // (it was removed from the types when Stripe deprecated the legacy
        // metered usage API). The runtime endpoint still works as long as the
        // pinned API version (2025-02-24.acacia) is used at request time, so
        // we cast to `any` to bypass the type check.
        await (stripe.subscriptionItems as any).createUsageRecord(overageItem.id, {
          quantity:  blocks,
          action:    'set',
          timestamp: Math.floor(Date.now() / 1000),
        })
        updated++
      }
    } catch (e: any) {
      errors.push(`${sub.trainer_id}: ${e?.message}`)
    }
  }

  return NextResponse.json({ ok: true, updated, errors: errors.length ? errors : undefined })
}
