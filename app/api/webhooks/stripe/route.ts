import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { PLAN_META, BILLABLE_PLANS, type Plan } from '@/lib/plans'
import { sendResendEmail } from '@/lib/resend-server'
import { buildTrainerWelcomeEmail } from '@/lib/email-templates'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Coerce any incoming plan string to a safe billable plan. Never 'ambassador'. */
function safePlan(raw: unknown): Plan {
  return BILLABLE_PLANS.includes(raw as Plan) ? (raw as Plan) : 'starter'
}

function clientLimitForPlan(plan: Plan): number | null {
  return PLAN_META[plan]?.clientLimit ?? 10
}

const GRACE_MS = 3 * 24 * 60 * 60 * 1000

// ── KPP helper ────────────────────────────────────────────────────────────────

interface KppPayload {
  kupac:            string
  oib_kupca:        string | null
  buyer_type:       'private' | 'business'
  opis:             string
  nacin_placanja:   string
  iznos:            number
  datum:            string
  stripe_payment_id: string | null
}

async function createKppEntry(db: SupabaseClient, payload: KppPayload) {
  try {
    const year = new Date(payload.datum).getFullYear()
    const yy   = String(year % 100).padStart(2, '0')

    // Get next seq (use DB function)
    const { data: seqData } = await db.rpc('next_kpp_seq', { p_year: year })
    const seq = (seqData as number | null) ?? 1
    const seqPad = String(seq).padStart(3, '0')

    const rbr         = `${yy}-${seqPad}-01`
    const broj_racuna = `UL-${yy}-${seqPad}`

    const { error } = await db.from('kpp_entries').insert({
      rbr,
      broj_racuna,
      kupac:           payload.kupac || 'N/A',
      oib_kupca:       payload.oib_kupca || null,
      buyer_type:      payload.buyer_type,
      opis:            payload.opis,
      nacin_placanja:  payload.nacin_placanja,
      iznos:           payload.iznos,
      datum:           payload.datum,
      kategorija:      'app',
      stripe_payment_id: payload.stripe_payment_id || null,
    })

    if (error) {
      if ((error as any).code === '23505') {
        console.warn('[kpp] Duplicate stripe_payment_id — skipping', payload.stripe_payment_id)
      } else {
        console.error('[kpp] Failed to insert kpp_entry:', error)
      }
    } else {
      console.debug('[kpp] Created entry', rbr, 'iznos:', payload.iznos, 'EUR')
    }
  } catch (e) {
    console.error('[kpp] Unexpected error creating entry:', e)
  }
}

/** Check-only: returns true if the event was already successfully processed. No insert. */
async function isEventProcessed(db: SupabaseClient, eventId: string): Promise<boolean> {
  const { data } = await db
    .from('processed_webhook_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .maybeSingle()
  return !!data
}

/**
 * Record event as successfully processed. Call ONLY after the handler
 * completes without error. Silently ignores duplicate-key conflicts
 * (race condition where two retries land simultaneously).
 */
async function markEventProcessed(db: SupabaseClient, eventId: string, eventType: string): Promise<void> {
  const { error } = await db
    .from('processed_webhook_events')
    .insert({ stripe_event_id: eventId, event_type: eventType, processed_at: new Date().toISOString() })
  if (error && (error as any).code !== '23505') {
    console.error('[webhook] markEventProcessed failed:', error)
  }
}

// ── Account creation for new registrations ───────────────────────────────────
// Called from checkout.session.completed when session.metadata.registration === '1'.
// Creates the Supabase trainer account and returns the activation link.
// Idempotent: skips creation if the email is already in profiles.

async function provisionNewTrainerAccount(
  db: SupabaseClient,
  opts: {
    email:       string
    displayName: string
    planLabel:   string
  }
): Promise<{ userId: string; actionLink: string | null } | null> {
  const { email, displayName, planLabel } = opts

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'

  // Check if profile already exists (idempotency)
  const { data: existing } = await db
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  let userId: string

  if (existing?.id) {
    userId = existing.id
    console.debug('[register webhook] account already exists for', email, '— skipping creation')
    return { userId, actionLink: null }
  }

  // Generate invite link (creates user + returns one-time link)
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type:    'invite',
    email,
    options: {
      redirectTo: `${appUrl}/reset-password`,
      data:       { full_name: displayName },
    },
  })

  if (linkErr || !linkData?.user) {
    console.error('[register webhook] generateLink(invite) error:', linkErr?.message)
    return null
  }

  userId = linkData.user.id
  const actionLink = linkData.properties?.action_link ?? null

  // Wait for DB trigger to create profiles row
  const pollStart = Date.now()
  while (Date.now() - pollStart < 4000) {
    const { data: p } = await db.from('profiles').select('id').eq('id', userId).maybeSingle()
    if (p?.id) break
    await new Promise(r => setTimeout(r, 300))
  }

  // Upsert profile
  await db.from('profiles').upsert({
    id:        userId,
    full_name: displayName,
    role:      'trainer',
    email:     email.toLowerCase(),
  }, { onConflict: 'id' })

  await db.from('trainer_profiles').upsert(
    { id: userId },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  return { userId, actionLink }
}

export async function POST(req: NextRequest) {
  const stripe    = createStripeClient()
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

  // Deduplicate: check if already successfully processed BEFORE doing any work.
  // The claim (INSERT) happens only AFTER successful processing (see end of handler).
  // This ensures Stripe retries after a 500 will re-process the event.
  if (await isEventProcessed(db, event.id)) {
    return NextResponse.json({ received: true, deduped: true })
  }

  switch (event.type) {

    // ── Checkout completed → create/update subscription row ──────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      // ── New registration: create Supabase account first ───────────────────
      // When registration='1', no Supabase user exists yet. Provision it now.
      let userId = session.metadata?.supabase_user_id
      const isNewRegistration = session.metadata?.registration === '1'

      if (isNewRegistration && !userId) {
        const email       = session.metadata?.pending_email ?? session.customer_details?.email ?? ''
        const displayName = session.metadata?.display_name  ?? session.customer_details?.name  ?? ''
        const planLabel   = (session.metadata?.plan ?? 'starter').toUpperCase()

        if (!email) {
          console.error('[register webhook] No email in session metadata for new registration', session.id)
          return NextResponse.json({ error: 'missing email' }, { status: 500 })
        }

        const provision = await provisionNewTrainerAccount(db, { email, displayName, planLabel })
        if (!provision) {
          console.error('[register webhook] Failed to provision account for', email)
          return NextResponse.json({ error: 'provision failed' }, { status: 500 })
        }
        userId = provision.userId

        // Update Stripe customer metadata with new user ID
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : (session.customer as any)?.id
        if (customerId) {
          await stripe.customers.update(customerId, {
            metadata: { supabase_user_id: provision.userId },
          })
        }

        // Send welcome + activation email — we need sub data for trial info,
        // so retrieve it now (lightweight, just needs trial_start/trial_end/status)
        if (provision.actionLink) {
          try {
            const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'
            const subIdRaw = typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as any)?.id
            let isTrialing = false; let trialDays = 14; let trialEndStr = ''
            if (subIdRaw) {
              const subPreview = await stripe.subscriptions.retrieve(subIdRaw)
              if (subPreview.status === 'trialing' && (subPreview as any).trial_end) {
                isTrialing = true
                const trialEndDate = new Date((subPreview as any).trial_end * 1000)
                trialDays = Math.max(1, Math.ceil((trialEndDate.getTime() - Date.now()) / 86_400_000))
                trialEndStr = trialEndDate.toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })
              }
            }
            const firstName = displayName.split(' ')[0] || displayName || 'Trener'
            const html = buildTrainerWelcomeEmail({
              trainerFirstName: firstName,
              planLabel,
              actionLink: provision.actionLink,
              appUrl,
              isTrialing,
              trialDays,
              trialEndStr,
            })
            const sendResult = await sendResendEmail({
              to:      email,
              subject: isTrialing
                ? `Aktiviraj UnitLift račun — tvoj ${trialDays}-dnevni trial počinje`
                : `Aktiviraj UnitLift račun — ${planLabel} plan`,
              html,
            })
            if (!sendResult.ok) console.error('[register webhook] welcome email failed:', (sendResult as any).logHint)
            else console.debug('[register webhook] welcome email sent to', email)
          } catch (e) {
            console.error('[register webhook] welcome email error:', e)
          }
        }
      }

      if (!userId) return NextResponse.json({ error: 'no userId' }, { status: 500 })

      const subId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as any)?.id
      if (!subId) return NextResponse.json({ error: 'no subscription id' }, { status: 500 })

      const sub  = await stripe.subscriptions.retrieve(subId)
      const subA = sub as any
      const plan = safePlan(session.metadata?.plan ?? sub.metadata?.plan)
      const status: string = sub.status
      const customerId = typeof session.customer === 'string'
        ? session.customer
        : (session.customer as any)?.id

      const promoGranted = session.metadata?.promo_granted === '1'

      const subPayload: Record<string, unknown> = {
        stripe_customer_id:     customerId,
        stripe_subscription_id: subId,
        plan,
        status,
        client_limit:           clientLimitForPlan(plan),
        trial_start:            subA.trial_start != null          ? new Date(subA.trial_start          * 1000).toISOString() : null,
        trial_end:              subA.trial_end   != null          ? new Date(subA.trial_end            * 1000).toISOString() : null,
        current_period_start:   subA.current_period_start != null ? new Date(subA.current_period_start * 1000).toISOString() : null,
        current_period_end:     subA.current_period_end   != null ? new Date(subA.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end:   sub.cancel_at_period_end,
        first_failed_at:        null,
        locked_at:              null,
        updated_at:             new Date().toISOString(),
      }

      // If promo was granted, record it. Only set once — never overwrite.
      if (promoGranted) {
        subPayload.promo_granted_at = new Date().toISOString()
      }

      const { data: existing } = await db
        .from('subscriptions')
        .select('id, is_ambassador, promo_granted_at')
        .eq('trainer_id', userId)
        .maybeSingle()

      if (existing?.is_ambassador) {
        console.warn('[stripe webhook] checkout.session.completed for ambassador trainer — refusing to overwrite', userId)
        break
      }

      // Never overwrite existing promo_granted_at if already set (idempotency)
      if (existing?.promo_granted_at) {
        delete subPayload.promo_granted_at
      }

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

      // Mark trial as used so the account never gets a second trial.
      if (subA.trial_start != null) {
        await db.rpc('mark_trial_used_once', {
          p_user_id: userId,
          p_at: new Date(subA.trial_start * 1000).toISOString(),
        })
      }

      // Update Stripe customer metadata (defensive)
      if (customerId) {
        await stripe.customers.update(customerId, {
          metadata: { supabase_user_id: userId },
        })
      }

      // For new registrations: also patch the subscription metadata with supabase_user_id
      // so that future invoice.payment_succeeded webhooks can find the user
      if (isNewRegistration && subId) {
        try {
          await (stripe.subscriptions.update as any)(subId, {
            metadata: {
              ...sub.metadata,
              supabase_user_id: userId,
            },
          })
        } catch (e) {
          console.warn('[register webhook] Could not patch subscription metadata:', e)
        }
      }

      // ── KPP entry: only for non-trial first payments ──────────────────────
      // For trialing subs, the first real payment happens later (invoice.payment_succeeded).
      // For non-trial subs, checkout.session.completed IS the first payment.
      // We detect "paid now" by checking amount_total > 0 and payment_status == 'paid'.
      if (
        session.payment_status === 'paid' &&
        (session.amount_total ?? 0) > 0
      ) {
        await createKppEntry(db, {
          kupac:       session.metadata?.buyer_name ?? 'N/A',
          oib_kupca:   session.metadata?.buyer_oib  || null,
          buyer_type:  (session.metadata?.buyer_type as 'private' | 'business') ?? 'private',
          opis:        `UnitLift ${plan.toUpperCase()} pretplata`,
          nacin_placanja: 'kartica',
          iznos:       (session.amount_total ?? 0) / 100,
          datum:       new Date().toISOString().slice(0, 10),
          stripe_payment_id: session.payment_intent
            ? (typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as any)?.id)
            : session.id,
        })
      }
      break
    }

    // ── First paid invoice draft → apply promo coupon (only for trial users) ─
    // For trial users we deferred the coupon at checkout to avoid Stripe counting
    // trial days toward the 12-month repeating coupon. Stripe's `repeating`
    // duration starts at the moment of application, so we must apply the coupon
    // exactly when the first paid invoice is generated.
    //
    // Stripe sequence at end of trial:
    //   1. invoice.created          ← we apply the coupon here (status='draft')
    //   2. invoice.finalized        (Stripe automatically applies the discount
    //                                that's now on the subscription)
    //   3. invoice.payment_succeeded
    //
    // We DO NOT use customer.subscription.trial_will_end because that fires
    // ~3 days before the trial ends, which would make the Stripe coupon expire
    // ~3 days before promo_ends_at — creating a DB/Stripe mismatch on the very
    // last (12th) paid invoice.
    //
    // For users WITHOUT a trial, the coupon was already applied at checkout
    // (subscription_create is itself the first paid invoice) so we do nothing here.
    case 'invoice.created': {
      const invoice = event.data.object as any
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subId) break

      // Only the first regular monthly invoice after trial. Never on:
      //   • subscription_create  (no trial → coupon already applied at checkout)
      //   • subscription_update  (prorated upgrade/downgrade)
      //   • manual / other       (never apply mid-period)
      if (invoice.billing_reason !== 'subscription_cycle') break

      // Only when invoice is still a draft so Stripe re-evaluates discounts when finalizing.
      if (invoice.status !== 'draft') break

      const { data: dbSub } = await db
        .from('subscriptions')
        .select('trainer_id, promo_granted_at, promo_paid_period_started_at, promo_lost_at, is_ambassador')
        .eq('stripe_subscription_id', subId)
        .maybeSingle()

      if (!dbSub || dbSub.is_ambassador) break
      if (!dbSub.promo_granted_at) break
      if (dbSub.promo_paid_period_started_at) break
      if (dbSub.promo_lost_at) break
      if (!process.env.STRIPE_COUPON_FOUNDING) break

      try {
        // `coupon` was removed from SubscriptionUpdateParams in newer SDK types;
        // it is still accepted at runtime by the pinned API version.
        await (stripe.subscriptions.update as any)(subId, {
          coupon: process.env.STRIPE_COUPON_FOUNDING,
        })
        console.debug('[stripe webhook] invoice.created: founding coupon applied to', subId)
      } catch (e) {
        console.error('[stripe webhook] invoice.created: failed to apply coupon:', e)
        // Non-fatal — if this fails the trial user simply doesn't get the discount.
        // The DB still shows promo_granted_at; we will NOT set promo_paid_period_started_at
        // because invoice.payment_succeeded will not find a Stripe discount to copy from.
      }
      break
    }

    // ── Invoice paid → clear failure tracking, sync period dates ─────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as any
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subId) break

      const sub  = await stripe.subscriptions.retrieve(subId)
      const subA = sub as any
      const plan = safePlan(sub.metadata?.plan)

      const newStatus = sub.status === 'active' ? 'active' : sub.status === 'trialing' ? 'trialing' : null
      if (!newStatus) break

      // Reset max_overage_blocks ONLY at the start of a genuinely new billing period.
      // subscription_cycle = regular monthly renewal.
      // subscription_create = initial invoice when subscription is first created.
      // subscription_update = prorated invoice from upgrade/downgrade → do NOT reset.
      const billingReason: string = invoice.billing_reason ?? ''
      const isNewPeriod = billingReason === 'subscription_cycle' || billingReason === 'subscription_create'

      const updatePayload: Record<string, unknown> = {
        status:               newStatus,
        plan,
        client_limit:         clientLimitForPlan(plan),
        current_period_start: subA.current_period_start != null ? new Date(subA.current_period_start * 1000).toISOString() : null,
        current_period_end:   subA.current_period_end   != null ? new Date(subA.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        first_failed_at:      null,
        locked_at:            null,
        ...(isNewPeriod ? { max_overage_blocks: 0 } : {}),
        updated_at:           new Date().toISOString(),
      }

      // Mark promo period start on first PAID invoice.
      // CRITICAL: We do NOT compute promo_ends_at as `period_start + 12 months`.
      // Instead we read the ACTUAL Stripe discount.end timestamp from the
      // subscription. This guarantees DB and Stripe never disagree on when
      // the coupon expires, regardless of:
      //   • whether the coupon was applied at checkout (no trial) or
      //     by invoice.created webhook (trial)
      //   • timezone / rounding differences in Stripe's repeating-coupon math
      //   • any future plan changes that touch the discount
      const amountPaid: number = invoice.amount_paid ?? 0
      if (amountPaid > 0) {
        const custId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id
        const { data: dbSub } = await db
          .from('subscriptions')
          .select('promo_granted_at, promo_paid_period_started_at, promo_lost_at')
          .or(`stripe_subscription_id.eq.${subId},stripe_customer_id.eq.${custId}`)
          .not('is_ambassador', 'eq', true)
          .maybeSingle()

        if (
          dbSub?.promo_granted_at &&
          !dbSub.promo_paid_period_started_at &&
          !dbSub.promo_lost_at
        ) {
          // Read the real Stripe discount.end. Try the modern `discounts` array
          // first (API 2025-02-24.acacia returns it as either a list of IDs or
          // expanded objects), then fall back to the legacy single `discount`.
          let stripeDiscountEnd: number | null = null

          const discountsField: any = (subA.discounts && Array.isArray(subA.discounts)) ? subA.discounts : null
          if (discountsField && discountsField.length > 0) {
            const first = discountsField[0]
            if (typeof first === 'string') {
              // Discounts returned as IDs — fetch the first one.
              try {
                const fetched: any = await (stripe as any).discounts?.retrieve?.(first)
                if (fetched?.end) stripeDiscountEnd = fetched.end
              } catch { /* fall through */ }
            } else if (first?.end) {
              stripeDiscountEnd = first.end
            }
          }
          if (!stripeDiscountEnd && (subA as any).discount?.end) {
            stripeDiscountEnd = (subA as any).discount.end
          }

          // Only mark promo as started if Stripe actually has an active discount.
          // If invoice.created failed to apply the coupon, we deliberately skip
          // setting promo_paid_period_started_at so the user can be retried later.
          if (stripeDiscountEnd) {
            const periodStart = subA.current_period_start != null
              ? new Date(subA.current_period_start * 1000)
              : new Date()
            updatePayload.promo_paid_period_started_at = periodStart.toISOString()
            updatePayload.promo_ends_at                = new Date(stripeDiscountEnd * 1000).toISOString()
          } else {
            console.warn('[stripe webhook] invoice.payment_succeeded: promo granted but no Stripe discount on subscription', subId)
          }
        }
      }

      const custId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id
      const { error: updateErr } = await db.from('subscriptions').update(updatePayload)
        .eq('stripe_subscription_id', subId)
        .not('is_ambassador', 'eq', true)
      if (updateErr) {
        console.error('[stripe webhook] invoice.payment_succeeded update failed:', updateErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }

      // ── KPP entry for recurring/trial-end payments ────────────────────────
      // subscription_create without prior checkout.session.completed KPP entry
      // covers the case where checkout was free-trial → first real invoice fires here.
      // subscription_cycle covers monthly renewals.
      // We always create KPP for amountPaid > 0 — the unique stripe_payment_id
      // (invoice.payment_intent) deduplicates if we ever process the same invoice twice.
      if ((invoice.amount_paid ?? 0) > 0) {
        const piId = typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : (invoice.payment_intent as any)?.id ?? null

        // Try to recover buyer info from subscription metadata
        const buyerName   = (sub.metadata as any)?.buyer_name   ?? ''
        const buyerOib    = (sub.metadata as any)?.buyer_oib    ?? ''
        const buyerType   = ((sub.metadata as any)?.buyer_type  ?? 'private') as 'private' | 'business'
        const invoiceDatum = invoice.period_start
          ? new Date(invoice.period_start * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)

        await createKppEntry(db, {
          kupac:            buyerName || 'N/A',
          oib_kupca:        buyerOib || null,
          buyer_type:       buyerType,
          opis:             `UnitLift ${safePlan(sub.metadata?.plan).toUpperCase()} pretplata`,
          nacin_placanja:   'kartica',
          iznos:            (invoice.amount_paid ?? 0) / 100,
          datum:            invoiceDatum,
          stripe_payment_id: piId,
        })
      }
      break
    }

    // ── Invoice failed → past_due + first-failure-anchored lock ─────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as any
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (!subId) break

      const { data: existing } = await db
        .from('subscriptions')
        .select('first_failed_at, is_ambassador')
        .eq('stripe_subscription_id', subId)
        .maybeSingle()
      if (existing?.is_ambassador) break

      const now = new Date()
      const firstFailedAt = existing?.first_failed_at ?? now.toISOString()
      const lockAt = new Date(new Date(firstFailedAt).getTime() + GRACE_MS).toISOString()

      const { error: failErr } = await db.from('subscriptions').update({
        status:          'past_due',
        first_failed_at: firstFailedAt,
        locked_at:       lockAt,
        updated_at:      now.toISOString(),
      }).eq('stripe_subscription_id', subId)
      if (failErr) {
        console.error('[stripe webhook] invoice.payment_failed update failed:', failErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }
      break
    }

    // ── Subscription deleted → canceled + promo permanently lost ─────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const now = new Date().toISOString()

      const { data: dbSub } = await db
        .from('subscriptions')
        .select('promo_granted_at, promo_lost_at')
        .eq('stripe_subscription_id', sub.id)
        .not('is_ambassador', 'eq', true)
        .maybeSingle()

      const updateFields: Record<string, unknown> = {
        status:     'canceled',
        updated_at: now,
      }

      // Promo is permanently lost on cancellation — even if global promo date
      // has not yet passed, this account can never get promo again.
      if (dbSub?.promo_granted_at && !dbSub.promo_lost_at) {
        updateFields.promo_lost_at = now
      }

      const { error: delErr } = await db.from('subscriptions').update(updateFields)
        .eq('stripe_subscription_id', sub.id)
        .not('is_ambassador', 'eq', true)
      if (delErr) {
        console.error('[stripe webhook] subscription.deleted update failed:', delErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }
      break
    }

    // ── Subscription updated → sync status, plan, dates ─────────────────────
    case 'customer.subscription.updated': {
      const sub  = event.data.object as Stripe.Subscription
      const subB = sub as any
      const plan = safePlan(sub.metadata?.plan)

      let status: string = sub.status
      if (status === 'past_due' || status === 'unpaid') status = 'past_due'

      let updErr
      if (status === 'active' || status === 'trialing') {
        const { error } = await db.from('subscriptions').update({
          status,
          plan,
          client_limit:         clientLimitForPlan(plan),
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_start: subB.current_period_start ? new Date(subB.current_period_start * 1000).toISOString() : null,
          current_period_end:   subB.current_period_end   ? new Date(subB.current_period_end   * 1000).toISOString() : null,
          trial_start:          subB.trial_start != null ? new Date(subB.trial_start * 1000).toISOString() : null,
          trial_end:            subB.trial_end   != null ? new Date(subB.trial_end   * 1000).toISOString() : null,
          first_failed_at:      null,
          locked_at:            null,
          updated_at:           new Date().toISOString(),
        })
          .eq('stripe_subscription_id', sub.id)
          .not('is_ambassador', 'eq', true)
        updErr = error
      } else {
        const { error } = await db.from('subscriptions').update({
          status,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at:           new Date().toISOString(),
        })
          .eq('stripe_subscription_id', sub.id)
          .not('is_ambassador', 'eq', true)
        updErr = error
      }
      if (updErr) {
        console.error('[stripe webhook] subscription.updated DB failed:', updErr)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
      }
      break
    }

    default:
      console.debug(`[stripe webhook] Unhandled event: ${event.type}`)
  }

  // Claim the event ONLY after all processing succeeded.
  // Any 500 return above bypasses this line, so Stripe retries will re-process.
  await markEventProcessed(db, event.id, event.type)
  return NextResponse.json({ received: true })
}
