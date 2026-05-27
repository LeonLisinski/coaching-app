import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { PLAN_META } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily cron: report current Scale overage usage to Stripe.
 *
 * Extra blocks = ceil(max(0, activeClients - 75) / 25)
 * Each block = €10/mo.
 *
 * Uses stripe.subscriptionItems.createUsageRecord with action='set' and
 * aggregate_usage='max' on the price — Stripe keeps the highest value reported
 * during the billing period and charges that at the end of the month.
 * This means a trainer is billed for the peak they reached, not the current
 * count at the moment of invoicing.
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

  const overagePriceId = PLAN_META['scale'].stripeOveragePriceId
  if (!overagePriceId) {
    return NextResponse.json({ ok: true, skipped: 'No overage price configured' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

  const { data: scaleSubs } = await supabase
    .from('subscriptions')
    .select('trainer_id, stripe_subscription_id')
    .eq('plan', 'scale')
    .eq('status', 'active')
    .not('is_ambassador', 'eq', true)

  let updated = 0
  const errors: string[] = []

  for (const sub of scaleSubs ?? []) {
    try {
      const { count: activeClients } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', sub.trainer_id)
        .eq('active', true)

      const count = activeClients ?? 0
      const limit = PLAN_META['scale'].clientLimit ?? 75
      const blockSize = PLAN_META['scale'].overageBlockSize ?? 25
      const extraBlocks = Math.max(0, Math.ceil((count - limit) / blockSize))

      // Find the overage subscription item
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      const overageItem = stripeSub.items.data.find(i => i.price.id === overagePriceId)

      if (overageItem) {
        // Report current usage — Stripe aggregates as MAX over the billing period.
        // action='set' means "this is the current quantity right now".
        // The price must be created with aggregate_usage='max' in Stripe Dashboard.
        await stripe.subscriptionItems.createUsageRecord(overageItem.id, {
          quantity:  extraBlocks,
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
