import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendClientPasswordRecoveryEmail } from '../_shared/client-password-recovery-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const rawEmail = typeof body.email === 'string' ? body.email : ''
    const email = rawEmail.trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email' }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    const clientAuthRedirect =
      Deno.env.get('CLIENT_AUTH_REDIRECT_URL') ?? 'https://app.unitlift.com/client-auth'

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: clientAuthRedirect,
      },
    })

    // Same privacy as Supabase recover: no hint whether the address exists
    if (linkError || !linkData?.user?.id || !linkData?.properties?.action_link) {
      return json({ success: true })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', linkData.user.id)
      .maybeSingle()

    if (profile?.role !== 'client') {
      return json({ success: true })
    }

    const displayName =
      profile.full_name?.trim() || email.split('@')[0] || 'klijent'

    await sendClientPasswordRecoveryEmail({
      to: email,
      clientName: displayName,
      actionLink: linkData.properties.action_link,
    })

    return json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 400)
  }
})
