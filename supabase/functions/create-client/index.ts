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
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('client_limit, plan, status')
      .eq('trainer_id', trainer_id)
      .maybeSingle()

    const activeStatuses = ['active', 'trialing', 'past_due']
    if (!subscription || !activeStatuses.includes(subscription.status)) {
      return json(403, {
        error: 'CLIENT_LIMIT_REACHED',
        current: 0,
        limit: 0,
        plan: subscription?.plan ?? null,
      })
    }

    const { count: clientCount } = await supabaseAdmin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('trainer_id', trainer_id)

    if (clientCount !== null && clientCount >= subscription.client_limit) {
      return json(403, {
        error: 'CLIENT_LIMIT_REACHED',
        current: clientCount,
        limit: subscription.client_limit,
        plan: subscription.plan,
      })
    }

    // ── Trainer name (used in both invite and notification emails) ───────────
    const { data: trainerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', trainer_id)
      .maybeSingle()

    const trainerName = trainerProfile?.full_name?.trim() || 'Tvoj trener'

    const clientFields = {
      trainer_id,
      goal: goal || null,
      date_of_birth: date_of_birth || null,
      weight: weight || null,
      height: height || null,
      gender: gender || null,
      notes: notes || null,
      activity_level: activity_level || null,
    }

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

        const { error: reactivateErr } = await supabaseAdmin
          .from('clients')
          .update(reactivateUpdate)
          .eq('id', existingRel.id)

        if (reactivateErr) throw reactivateErr

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
      const { data: newRel, error: relErr } = await supabaseAdmin
        .from('clients')
        .insert({ ...clientFields, user_id: userId })
        .select('id')
        .single()

      if (relErr) throw relErr

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
        client_id: newRel?.id,
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

    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({ ...clientFields, user_id: newUser.id })
      .select('id')
      .single()

    if (clientError) throw clientError

    await sendClientInviteEmail({
      to: email,
      clientName: full_name || email.split('@')[0] || 'klijent',
      trainerName,
      actionLink,
    })

    return json(200, {
      success: true,
      user_id: newUser.id,
      client_id: clientData?.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[create-client] error:', message)
    return json(400, { error: message })
  }
})
