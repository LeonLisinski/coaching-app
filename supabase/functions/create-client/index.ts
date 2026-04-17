import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendClientInviteEmail } from '../_shared/client-invite-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Validate JWT and extract caller identity
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { trainer_id, email, full_name, goal, date_of_birth, weight, height, gender, notes, activity_level } = await req.json()

    // Ensure the caller is the trainer they claim to be
    if (callerUser.id !== trainer_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check subscription client limit before creating
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('client_limit, plan')
      .eq('trainer_id', trainer_id)
      .single()

    if (subscription) {
      const { count: clientCount } = await supabaseAdmin
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainer_id)

      if (clientCount !== null && clientCount >= subscription.client_limit) {
        return new Response(
          JSON.stringify({
            error: 'CLIENT_LIMIT_REACHED',
            current: clientCount,
            limit: subscription.client_limit,
            plan: subscription.plan,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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

    const { data: trainerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', trainer_id)
      .maybeSingle()

    const trainerName = trainerProfile?.full_name?.trim() || 'Tvoj trener'

    // Pričekaj da trigger kreira profil, pa update
    await new Promise(resolve => setTimeout(resolve, 500))

    await supabaseAdmin
      .from('profiles')
      .update({ full_name, role: 'client' })
      .eq('id', newUser.id)

    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        trainer_id,
        user_id: newUser.id,
        goal: goal || null,
        date_of_birth: date_of_birth || null,
        weight: weight || null,
        height: height || null,
        gender: gender || null,
        notes: notes || null,
        activity_level: activity_level || null,
      })
      .select('id')
      .single()

    if (clientError) throw clientError

    await sendClientInviteEmail({
      to: email,
      clientName: full_name || email.split('@')[0] || 'klijent',
      trainerName,
      actionLink,
    })

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.id, client_id: clientData?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
  
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
