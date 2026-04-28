import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/resend-server'

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

      // Persist Stripe's real status — never coerce unknown statuses to trialing.
      // If Stripe reports incomplete/unpaid/canceled, store that and deny access.
      const status: string = sub.status

      const customerId = typeof session.customer === 'string'
        ? session.customer
        : (session.customer as any)?.id

      const subPayload = {
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
        updated_at:             new Date().toISOString(),
      }

      const { data: existing } = await db
        .from('subscriptions')
        .select('id')
        .eq('trainer_id', userId)
        .maybeSingle()

      let dbErr
      if (existing) {
        const { error } = await db.from('subscriptions').update(subPayload).eq('trainer_id', userId)
        dbErr = error
      } else {
        const { error } = await db.from('subscriptions').insert({ trainer_id: userId, ...subPayload, created_at: new Date().toISOString() })
        dbErr = error
      }

      if (dbErr) {
        console.error('[stripe webhook] checkout.session.completed db failed:', dbErr)
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

      // Try by subscription ID first, fall back to customer ID
      const updatePayload = {
        status:               newStatus,
        plan,
        client_limit:         CLIENT_LIMITS[plan] ?? 15,
        current_period_start: subA.current_period_start != null ? new Date(subA.current_period_start * 1000).toISOString() : null,
        current_period_end:   subA.current_period_end   != null ? new Date(subA.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        locked_at:            null,
        updated_at:           new Date().toISOString(),
      }
      const custId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id
      const { error: updateErr } = await db.from('subscriptions').update(updatePayload)
        .or(`stripe_subscription_id.eq.${subId},stripe_customer_id.eq.${custId}`)
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

      let updErr
      if (status === 'active' || status === 'trialing') {
        // Clear lock if payment recovered
        const { error } = await db.from('subscriptions').update({
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
        updErr = error
      } else {
        const { error } = await db.from('subscriptions').update({
          status,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at:           new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)
        updErr = error
      }
      if (updErr) {
        console.error('[stripe webhook] subscription.updated DB failed:', updErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }
      break
    }

    // ── Trial ending soon → notify trainer 3 days before first charge ────────
    case 'customer.subscription.trial_will_end': {
      const sub    = event.data.object as Stripe.Subscription
      const custId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id
      if (!custId) break

      // Idempotency: skip if this event was already processed (Stripe retries on timeout)
      const { data: alreadySent } = await db
        .from('processed_webhook_events')
        .select('id')
        .eq('stripe_event_id', event.id)
        .maybeSingle()
      if (alreadySent) break

      const { data: subRecord } = await db
        .from('subscriptions')
        .select('trainer_id')
        .eq('stripe_customer_id', custId)
        .maybeSingle()

      if (!subRecord?.trainer_id) break

      const { data: profile } = await db
        .from('profiles')
        .select('full_name, email')
        .eq('id', subRecord.trainer_id)
        .maybeSingle()

      if (!profile?.email) break

      const trialEndTs = (sub as any).trial_end as number | null
      const trialEndDate = trialEndTs ? new Date(trialEndTs * 1000) : null
      const daysLeft = trialEndDate
        ? Math.max(1, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 3

      const firstName = profile.full_name?.split(' ')[0] || 'Trener'
      const plan      = (sub.metadata?.plan ?? 'starter') as string
      const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
      const dateStr   = trialEndDate
        ? trialEndDate.toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })
        : ''
      const appUrl = 'https://app.unitlift.com'

      const html = `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>UnitLift</title></head>
<body style="margin:0;background:#0b0a12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0a12;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:linear-gradient(180deg,#15131f 0%,#0e0c16 100%);border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr><td style="padding:28px 28px 8px 28px;text-align:center;">
          <div style="display:inline-block;padding:10px 14px;border-radius:14px;background:#5b21b6;margin-bottom:16px;">
            <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em;">UnitLift</span>
          </div>
          <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#f4f4f5;line-height:1.25;">
            Tvoj trial istječe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}
          </h1>
          <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.55;">Plan: <strong style="color:#a78bfa;">${planLabel}</strong></p>
        </td></tr>
        <tr><td style="padding:8px 28px 28px 28px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
            Bok <strong style="color:#fff;">${firstName}</strong>,<br/><br/>
            Tvoj 14-dnevni besplatni trial${dateStr ? ` istječe <strong style="color:#e4e4e7;">${dateStr}</strong>` : ' uskoro istječe'}.
            Nakon toga počinje redovita naplata za plan <strong style="color:#a78bfa;">${planLabel}</strong>.<br/><br/>
            Ako želiš prilagoditi ili otkazati pretplatu, to možeš napraviti u postavkama naplate.
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${appUrl}/dashboard/billing" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#ffffff !important;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 8px 24px rgba(91,33,182,0.35);">
              Upravljaj pretplatom
            </a>
          </div>
          <p style="margin:0;font-size:12px;color:#71717a;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;line-height:1.5;">
            Hvala što koristiš UnitLift. Imaš li pitanja, odgovori na ovaj email.
          </p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0 0;font-size:11px;color:#52525b;text-align:center;">© UnitLift · unitlift.com</p>
    </td></tr>
  </table>
</body>
</html>`

      // Mark event as processed BEFORE sending email.
      // If the upsert fails, we skip the send (better to miss once than spam on retries).
      const { error: upsertErr } = await db.from('processed_webhook_events').upsert({
        stripe_event_id: event.id,
        event_type: event.type,
        processed_at: new Date().toISOString(),
      }, { onConflict: 'stripe_event_id', ignoreDuplicates: true })

      if (upsertErr) {
        console.error('[stripe webhook] processed_webhook_events upsert failed:', upsertErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }

      await sendResendEmail({
        to: profile.email,
        subject: `UnitLift: tvoj trial istječe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}`,
        html,
      })

      console.log(`[stripe webhook] Trial ending email sent to ${profile.email} (${daysLeft}d left)`)
      break
    }

    default:
      console.log(`[stripe webhook] Unhandled event: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
