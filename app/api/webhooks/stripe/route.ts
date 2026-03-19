import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const CLIENT_LIMITS: Record<string, number> = { starter: 15, pro: 50, scale: 150 }

// Grace period before locking: 3 days in ms
const GRACE_MS = 3 * 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[stripe webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = supabaseAdmin()

  switch (event.type) {

    // ── Invoice paid → active ────────────────────────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subId) break

      const sub  = await stripe.subscriptions.retrieve(subId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subA = sub as any
      const plan = sub.metadata?.plan ?? 'starter'

      await db.from('subscriptions').update({
        status:               'active',
        plan,
        client_limit:         CLIENT_LIMITS[plan] ?? 15,
        current_period_start: subA.current_period_start ? new Date(subA.current_period_start * 1000).toISOString() : null,
        current_period_end:   subA.current_period_end   ? new Date(subA.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        locked_at:            null,
        updated_at:           new Date().toISOString(),
      }).eq('stripe_subscription_id', subId)
      break
    }

    // ── Invoice failed → past_due, schedule locking ─────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subId) break

      await db.from('subscriptions').update({
        status:     'past_due',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subId)

      // Schedule lock after grace period — set locked_at = now + 3 days
      const lockAt = new Date(Date.now() + GRACE_MS).toISOString()
      await db.from('subscriptions').update({
        locked_at:  lockAt,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subId)

      // Notify trainer via in-app (update status is enough — dashboard reads it)
      // Could also send email here via Resend if needed
      break
    }

    // ── Subscription deleted → canceled ─────────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await db.from('subscriptions').update({
        status:     'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    // ── Subscription updated → sync status + cancel_at_period_end ───────────
    case 'customer.subscription.updated': {
      const sub  = event.data.object as Stripe.Subscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subB = sub as any
      const plan = sub.metadata?.plan ?? 'starter'

      let status: string = sub.status
      if (status === 'past_due' || status === 'unpaid') status = 'past_due'
      if (status === 'active' || status === 'trialing') {
        // Clear lock if payment recovered
        await db.from('subscriptions').update({
          status,
          plan,
          client_limit:         CLIENT_LIMITS[plan] ?? 15,
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_start: subB.current_period_start ? new Date(subB.current_period_start * 1000).toISOString() : null,
          current_period_end:   subB.current_period_end   ? new Date(subB.current_period_end   * 1000).toISOString() : null,
          trial_end:            subB.trial_end ? new Date(subB.trial_end * 1000).toISOString() : null,
          locked_at:            null,
          updated_at:           new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)
      } else {
        await db.from('subscriptions').update({
          status,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at:           new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)
      }
      break
    }

    // ── Trial ending soon (optional: notify trainer 3 days before) ──────────
    case 'customer.subscription.trial_will_end': {
      const sub   = event.data.object as Stripe.Subscription
      const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      // Could send email notification via Resend here
      console.log(`[stripe webhook] Trial ending soon for customer ${custId}`)
      break
    }

    default:
      console.log(`[stripe webhook] Unhandled event: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
