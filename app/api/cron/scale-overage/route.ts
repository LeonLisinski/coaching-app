import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { PLAN_META } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily cron: sync Scale plan overage quantities to Stripe.
 * Extra blocks = ceil(max(0, activeClients - 75) / 25)
 * Each block = €10/mo on the metered overage price item.
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
      const extraBlocks = Math.max(0, Math.ceil((count - limit) / (PLAN_META['scale'].overageBlockSize ?? 25)))

      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      const overageItem = stripeSub.items.data.find(i => i.price.id === overagePriceId)

      if (overageItem) {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          items: [{ id: overageItem.id, quantity: extraBlocks }],
          proration_behavior: 'none',
        })
        updated++
      }
    } catch (e: any) {
      errors.push(`${sub.trainer_id}: ${e?.message}`)
    }
  }

  return NextResponse.json({ ok: true, updated, errors: errors.length ? errors : undefined })
}
