import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      throw new Error('No authorization header')
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

    const { trainer_id, email, full_name, goal, date_of_birth, weight, height, password } = await req.json()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || Math.random().toString(36).slice(-8) + 'Aa1!',
      email_confirm: true,
      user_metadata: {
        full_name,
        role: 'client'
      }
    })

    if (authError) throw authError

    // Pričekaj da trigger kreira profil, pa update
    await new Promise(resolve => setTimeout(resolve, 500))

    await supabaseAdmin
      .from('profiles')
      .update({ full_name, role: 'client' })
      .eq('id', authData.user.id)

    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        trainer_id,
        user_id: authData.user.id,
        goal: goal || null,
        date_of_birth: date_of_birth || null,
        weight: weight || null,
        height: height || null,
      })

    if (clientError) throw clientError

    return new Response(
      JSON.stringify({ success: true, user_id: authData.user.id }),
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