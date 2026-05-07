import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    if (!authHeader) return json(401, { error: 'No authorization header' })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Validate caller
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !callerUser) return json(401, { error: 'Unauthorized' })

    let body: { client_id?: string; new_email?: string }
    try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON body' }) }

    const { client_id, new_email: rawEmail } = body
    if (!client_id) return json(400, { error: 'client_id is required' })
    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim())
      return json(400, { error: 'new_email is required' })

    const newEmail = rawEmail.trim().toLowerCase()

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return json(400, { error: 'INVALID_EMAIL' })
    }

    // Verify the caller is the trainer for this client
    const { data: clientRow, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('user_id, trainer_id')
      .eq('id', client_id)
      .maybeSingle()

    if (clientErr || !clientRow) return json(404, { error: 'Client not found' })
    if (clientRow.trainer_id !== callerUser.id) return json(403, { error: 'Forbidden' })

    const { user_id: clientUserId } = clientRow

    // Check if new email is already taken by another account
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle()

    if (existing && existing.id !== clientUserId) {
      return json(409, { error: 'EMAIL_TAKEN' })
    }

    // Update email in Supabase Auth (email_confirm: true skips confirmation email)
    const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
      clientUserId,
      { email: newEmail, email_confirm: true }
    )
    if (authUpdateErr) throw authUpdateErr

    // Keep profiles.email in sync
    const { error: profileUpdateErr } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', clientUserId)

    if (profileUpdateErr) {
      console.error('[update-client-email] profiles sync failed:', profileUpdateErr.message)
    }

    return json(200, { success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[update-client-email] error:', message)
    return json(400, { error: message })
  }
})
