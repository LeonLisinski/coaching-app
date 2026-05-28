import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendClientInviteEmail, sendClientAddedEmail } from '../_shared/client-invite-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/**
 * Immediately report a Scale overage block count to Stripe via the legacy
 * metered usage-records API (action='set', aggregate_usage='max').
 *
 * Called right after a confirmed tier crossing so Stripe's max aggregation
 * captures the peak even if the trainer deactivates the client before the
 * daily cron runs. Non-fatal — the cron will reconcile on failure.
 */
async function reportOverageToStripe(
  stripeSecretKey: string,
  stripeSubscriptionId: string,
  overagePriceId: string,
  blocks: number,
): Promise<void> {
  const subResp = await fetch(
    `https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
  )
  if (!subResp.ok) return
  const sub = await subResp.json()
  const overageItem = (sub.items?.data ?? []).find((i: any) => i.price?.id === overagePriceId)
  if (!overageItem) return

  const body = new URLSearchParams()
  body.append('quantity', String(blocks))
  body.append('action', 'set')
  body.append('timestamp', String(Math.floor(Date.now() / 1000)))

  await fetch(
    `https://api.stripe.com/v1/subscription_items/${overageItem.id}/usage_records`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json(401, { error: 'No authorization header' })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Validate JWT and extract caller identity
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !callerUser) {
      return json(401, { error: 'Unauthorized' })
    }

    let body: any
    try { body = await req.json() } catch {
      return json(400, { error: 'Invalid JSON body' })
    }

    const {
      trainer_id,
      email: rawEmail,
      full_name,
      goal,
      date_of_birth,
      weight,
      height,
      gender,
      notes,
      activity_level,
      confirm_overage,
    } = body

    if (typeof rawEmail !== 'string' || !rawEmail.trim()) {
      return json(400, { error: 'Email is required' })
    }
    const email = rawEmail.trim().toLowerCase()

    // Ensure the caller is the trainer they claim to be
    if (callerUser.id !== trainer_id) {
      return json(403, { error: 'Forbidden' })
    }

    // ── Subscription gate ────────────────────────────────────────────────────
    // promo_ends_at / promo_lost_at are needed so the Scale overage confirmation
    // modal can show the correct (50%-discounted) total during the user's
    // 12-month promo period. Both base and overage are halved together because
    // they are two prices inside the same UnitLift Scale Stripe product.
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('client_limit, plan, status, is_ambassador, stripe_subscription_id, promo_ends_at, promo_lost_at')
      .eq('trainer_id', trainer_id)
      .maybeSingle()

    // confirmedOverageBlocks is set when a Scale tier crossing is confirmed so
    // we can immediately report the peak to Stripe after the DB write.
    let confirmedOverageBlocks: number | null = null

    // Ambassador accounts have unlimited clients and always have access
    if (!subscription?.is_ambassador) {
      const activeStatuses = ['active', 'trialing']
      if (!subscription || !activeStatuses.includes(subscription.status)) {
        return json(403, {
          error: 'CLIENT_LIMIT_REACHED',
          current: 0,
          limit: 0,
          plan: subscription?.plan ?? null,
        })
      }

      // Active count only
      const { count: activeClientCount } = await supabaseAdmin
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainer_id)
        .eq('active', true)
      const currentCount = activeClientCount ?? 0
      const newCount = currentCount + 1

      // Starter / Pro: hard limit
      if (subscription.plan !== 'scale' && subscription.client_limit !== null) {
        if (currentCount >= subscription.client_limit) {
          return json(403, {
            error: 'CLIENT_LIMIT_REACHED',
            current: currentCount,
            limit: subscription.client_limit,
            plan: subscription.plan,
          })
        }
      }

      // Scale: overage tier crossing requires explicit confirmation
      if (subscription.plan === 'scale') {
        const SCALE_LIMIT = 75
        const BLOCK_SIZE  = 25
        const SCALE_BASE  = 99
        const BLOCK_PRICE = 10
        const currentBlocks = Math.max(0, Math.ceil((currentCount - SCALE_LIMIT) / BLOCK_SIZE))
        const newBlocks     = Math.max(0, Math.ceil((newCount     - SCALE_LIMIT) / BLOCK_SIZE))
        if (newBlocks > currentBlocks) {
          if (!confirm_overage) {
            // Promo-aware pricing — the founding coupon (50%) applies to the
            // entire UnitLift Scale product, which means BOTH the base price
            // AND the metered overage price are halved during promo.
            const inPromo = !!(
              subscription.promo_ends_at &&
              !subscription.promo_lost_at &&
              Date.now() < new Date(subscription.promo_ends_at).getTime()
            )
            const additionalRegular = newBlocks * BLOCK_PRICE
            const totalRegular      = SCALE_BASE + additionalRegular
            const baseEur       = inPromo ? SCALE_BASE        * 0.5 : SCALE_BASE
            const additionalEur = inPromo ? additionalRegular * 0.5 : additionalRegular
            const newTotalEur   = inPromo ? totalRegular      * 0.5 : totalRegular
            return json(402, {
              error: 'OVERAGE_CONFIRMATION_REQUIRED',
              currentBlocks,
              newBlocks,
              baseEur,
              additionalEur,
              newTotalEur,
              newCount,
              inPromo,
            })
          }
          // Tier crossing confirmed — the atomic RPCs below (set_active_with_overage_peak /
          // insert_client_with_overage_peak) will update max_overage_blocks AND activate/insert
          // the client in a single transaction. No separate peak-only update needed here.
          confirmedOverageBlocks = newBlocks
        }
      }
    }

    // ── Trainer name (used in both invite and notification emails) ───────────
    const { data: trainerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', trainer_id)
      .maybeSingle()

    const trainerName = trainerProfile?.full_name?.trim() || 'Tvoj trener'

    // ── Find existing identity by email (find-or-invite) ─────────────────────
    // We do NOT touch profiles.role or profiles.full_name on existing accounts.
    // This preserves trainer accounts that get added as a client elsewhere.
    // We deliberately do NOT read `role` here — capability is derived from
    // existence of clients/trainer_profiles rows, not from the mutable role flag.
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      const userId = existingProfile.id

      // Block: caller is trying to add themselves as a client of themselves.
      if (userId === trainer_id) {
        return json(409, {
          error: 'SELF_AS_CLIENT',
          message: 'Ne možeš dodati sam sebe kao klijenta.',
        })
      }

      const friendlyName =
        existingProfile.full_name?.trim() || full_name || email.split('@')[0] || 'klijent'

      // Run both relationship lookups in parallel — they're independent.
      const [
        { data: existingRel },
        { data: otherActive },
      ] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('id, active')
          .eq('trainer_id', trainer_id)
          .eq('user_id', userId)
          .maybeSingle(),
        supabaseAdmin
          .from('clients')
          .select('id, trainer_id')
          .eq('user_id', userId)
          .eq('active', true)
          .neq('trainer_id', trainer_id)
          .limit(1)
          .maybeSingle(),
      ])

      // Already an active client of THIS trainer.
      if (existingRel?.active) {
        return json(409, {
          error: 'ALREADY_CLIENT',
          message: 'Ova osoba je već tvoj aktivni klijent.',
          client_id: existingRel.id,
        })
      }

      // Active with another trainer — block both new insert AND reactivation
      // (the partial unique index would also fail the UPDATE, but checking
      // here lets us return a friendly error code instead of a cryptic
      // constraint-violation message).
      if (otherActive) {
        return json(409, {
          error: 'HAS_ACTIVE_TRAINER',
          message: 'Ova osoba trenutno aktivno trenira s drugim trenerom. Mora završiti tu suradnju prije nego ti može pristupiti.',
        })
      }

      // Has an inactive row for this trainer → reactivate it (keep id stable
      // so historical messages/checkins/plans stay linked). Only overwrite
      // measurement fields the trainer explicitly typed; leave nulls untouched
      // so we don't wipe out existing valuable history.
      if (existingRel && !existingRel.active) {
        const reactivateUpdate: Record<string, unknown> = { active: true }
        if (goal)           reactivateUpdate.goal = goal
        if (date_of_birth)  reactivateUpdate.date_of_birth = date_of_birth
        if (weight)         reactivateUpdate.weight = weight
        if (height)         reactivateUpdate.height = height
        if (gender)         reactivateUpdate.gender = gender
        if (notes)          reactivateUpdate.notes = notes
        if (activity_level) reactivateUpdate.activity_level = activity_level

        // Non-active fields first (no atomicity concern for measurement fields)
        const nonActiveUpdate = { ...reactivateUpdate }
        delete nonActiveUpdate.active
        if (Object.keys(nonActiveUpdate).length > 0) {
          await supabaseAdmin.from('clients').update(nonActiveUpdate).eq('id', existingRel.id)
        }

        // Atomic: flip active=true + update max_overage_blocks in one transaction
        const { error: reactivateErr } = await supabaseAdmin.rpc('set_active_with_overage_peak', {
          p_trainer_id: trainer_id,
          p_client_id:  existingRel.id,
          p_blocks:     confirmedOverageBlocks ?? 0,
        })
        if (reactivateErr) throw reactivateErr

        // Immediately report overage peak to Stripe if a tier was crossed
        if (confirmedOverageBlocks !== null && subscription?.stripe_subscription_id) {
          const overagePriceId = Deno.env.get('STRIPE_PRICE_SCALE_OVERAGE')
          const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
          if (overagePriceId && stripeKey) {
            reportOverageToStripe(stripeKey, subscription.stripe_subscription_id, overagePriceId, confirmedOverageBlocks)
              .catch((e) => console.error('[create-client] immediate overage report (reactivate) failed:', e))
          }
        }

        await sendClientAddedEmail({
          to: email,
          clientName: friendlyName,
          trainerName,
        }).catch((e) => {
          console.error('[create-client] sendClientAddedEmail (reactivate) failed:', e)
        })

        return json(200, {
          success: true,
          user_id: userId,
          client_id: existingRel.id,
          reactivated: true,
        })
      }

      // No prior relationship with this trainer → insert a new clients row.
      // Profile (role, full_name, email) is left untouched.
      // Atomic: INSERT + max_overage_blocks update in a single transaction.
      const { data: newRelId, error: relErr } = await supabaseAdmin.rpc('insert_client_with_overage_peak', {
        p_trainer_id:     trainer_id,
        p_user_id:        userId,
        p_goal:           goal || null,
        p_date_of_birth:  date_of_birth || null,
        p_weight:         weight || null,
        p_height:         height || null,
        p_gender:         gender || null,
        p_notes:          notes || null,
        p_activity_level: activity_level || null,
        p_blocks:         confirmedOverageBlocks ?? 0,
      })

      if (relErr) throw relErr

      // Immediately report overage peak to Stripe if a tier was crossed
      if (confirmedOverageBlocks !== null && subscription?.stripe_subscription_id) {
        const overagePriceId = Deno.env.get('STRIPE_PRICE_SCALE_OVERAGE')
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (overagePriceId && stripeKey) {
          reportOverageToStripe(stripeKey, subscription.stripe_subscription_id, overagePriceId, confirmedOverageBlocks)
            .catch((e) => console.error('[create-client] immediate overage report (new rel) failed:', e))
        }
      }

      await sendClientAddedEmail({
        to: email,
        clientName: friendlyName,
        trainerName,
      }).catch((e) => {
        console.error('[create-client] sendClientAddedEmail (existing) failed:', e)
      })

      return json(200, {
        success: true,
        user_id: userId,
        client_id: newRelId,
        existing_account: true,
      })
    }

    // ── Branch B — brand new identity: invite flow ───────────────────────────
    const clientAuthRedirect =
      Deno.env.get('CLIENT_AUTH_REDIRECT_URL') ?? 'https://app.unitlift.com/client-auth'

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: clientAuthRedirect,
        data: {
          full_name,
          role: 'client',
        },
      },
    })

    if (linkError) throw linkError

    const actionLink = linkData?.properties?.action_link
    const newUser = linkData?.user
    if (!actionLink || !newUser?.id) {
      throw new Error('generateLink did not return action_link or user id')
    }

    // Wait for the handle_new_user trigger to insert the profile row.
    const pollStart = Date.now()
    while (Date.now() - pollStart < 4000) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', newUser.id)
        .maybeSingle()
      if (p?.id) break
      await new Promise((r) => setTimeout(r, 300))
    }

    // Set full_name (the trigger only stores raw_user_meta_data->>'full_name'
    // which may be empty here). role: 'client' is passed as a safety net in
    // case the trigger somehow didn't fire — it's a no-op in the normal path.
    await supabaseAdmin
      .from('profiles')
      .upsert(
        { id: newUser.id, full_name, email, role: 'client' },
        { onConflict: 'id' }
      )

    // Atomic: INSERT client + max_overage_blocks update in a single transaction.
    const { data: clientId, error: clientError } = await supabaseAdmin.rpc('insert_client_with_overage_peak', {
      p_trainer_id:     trainer_id,
      p_user_id:        newUser.id,
      p_goal:           goal || null,
      p_date_of_birth:  date_of_birth || null,
      p_weight:         weight || null,
      p_height:         height || null,
      p_gender:         gender || null,
      p_notes:          notes || null,
      p_activity_level: activity_level || null,
      p_blocks:         confirmedOverageBlocks ?? 0,
    })

    if (clientError) throw clientError

    // Immediately report overage peak to Stripe if a tier was crossed
    if (confirmedOverageBlocks !== null && subscription?.stripe_subscription_id) {
      const overagePriceId = Deno.env.get('STRIPE_PRICE_SCALE_OVERAGE')
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (overagePriceId && stripeKey) {
        reportOverageToStripe(stripeKey, subscription.stripe_subscription_id, overagePriceId, confirmedOverageBlocks)
          .catch((e) => console.error('[create-client] immediate overage report (invite) failed:', e))
      }
    }

    await sendClientInviteEmail({
      to: email,
      clientName: full_name || email.split('@')[0] || 'klijent',
      trainerName,
      actionLink,
    })

    return json(200, {
      success: true,
      user_id: newUser.id,
      client_id: clientId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[create-client] error:', message)
    return json(400, { error: message })
  }
})
