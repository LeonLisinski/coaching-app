import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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
  const stripe    = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
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

    // ── Checkout completed → create subscription (new register flow) ─────────
    case 'checkout.session.completed': {
      const session    = event.data.object as Stripe.Checkout.Session
      const userId     = session.metadata?.supabase_user_id
      if (!userId) break // Legacy flow — subscription created by /api/register instead

      const subId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as any)?.id
      if (!subId) break

      const sub  = await stripe.subscriptions.retrieve(subId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subA = sub as any
      const plan = session.metadata?.plan ?? sub.metadata?.plan ?? 'starter'

      let status: string = sub.status
      if (status !== 'trialing' && status !== 'active') status = 'trialing'

      const customerId = typeof session.customer === 'string'
        ? session.customer
        : (session.customer as any)?.id

      const { error: insertErr } = await db.from('subscriptions').upsert({
        trainer_id:             userId,
        stripe_customer_id:     customerId,
        stripe_subscription_id: subId,
        plan,
        status,
        client_limit:           CLIENT_LIMITS[plan] ?? 15,
        trial_start:            subA.trial_start != null          ? new Date(subA.trial_start          * 1000).toISOString() : null,
        trial_end:              subA.trial_end != null            ? new Date(subA.trial_end            * 1000).toISOString() : null,
        current_period_start:   subA.current_period_start != null ? new Date(subA.current_period_start * 1000).toISOString() : null,
        current_period_end:     subA.current_period_end != null   ? new Date(subA.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end:   sub.cancel_at_period_end,
        locked_at:              null,
        created_at:             new Date().toISOString(),
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'trainer_id' })
      if (insertErr) {
        console.error('[stripe webhook] checkout.session.completed insert failed:', insertErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }

      // Update Stripe customer metadata with supabase_user_id (in case not set)
      if (customerId) {
        await stripe.customers.update(customerId, {
          metadata: { supabase_user_id: userId },
        })
      }
      break
    }

    // ── Invoice paid → sync period dates (only flip to active if Stripe says active) ──
    case 'invoice.payment_succeeded': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subId) break

      const sub  = await stripe.subscriptions.retrieve(subId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subA = sub as any
      const plan = sub.metadata?.plan ?? 'starter'

      // Do NOT flip 'trialing' → 'active' here ($0 trial invoice fires this event too).
      // Only set active when Stripe itself reports active status.
      const newStatus = sub.status === 'active' ? 'active' : sub.status === 'trialing' ? 'trialing' : null
      if (!newStatus) break // incomplete, unpaid, etc — let subscription.updated handle it

      const { error: updateErr } = await db.from('subscriptions').update({
        status:               newStatus,
        plan,
        client_limit:         CLIENT_LIMITS[plan] ?? 15,
        current_period_start: subA.current_period_start != null ? new Date(subA.current_period_start * 1000).toISOString() : null,
        current_period_end:   subA.current_period_end   != null ? new Date(subA.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        locked_at:            null,
        updated_at:           new Date().toISOString(),
      }).eq('stripe_subscription_id', subId)
      if (updateErr) {
        console.error('[stripe webhook] invoice.payment_succeeded update failed:', updateErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }
      break
    }

    // ── Invoice failed → past_due, schedule locking ─────────────────────────
    case 'invoice.payment_failed': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subId) break

      const lockAt = new Date(Date.now() + GRACE_MS).toISOString()
      const { error: failErr } = await db.from('subscriptions').update({
        status:     'past_due',
        locked_at:  lockAt,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subId)
      if (failErr) {
        console.error('[stripe webhook] invoice.payment_failed update failed:', failErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }

      // Notify trainer via in-app (update status is enough — dashboard reads it)
      // Could also send email here via Resend if needed
      break
    }

    // ── Subscription deleted → canceled ─────────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { error: delErr } = await db.from('subscriptions').update({
        status:     'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id)
      if (delErr) {
        console.error('[stripe webhook] subscription.deleted update failed:', delErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }
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
          trial_start:          subB.trial_start != null ? new Date(subB.trial_start * 1000).toISOString() : null,
          trial_end:            subB.trial_end   != null ? new Date(subB.trial_end   * 1000).toISOString() : null,
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
