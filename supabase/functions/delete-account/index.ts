// Supabase Edge Function: delete-account
// Marks user account for deletion (soft-delete, 30-day grace period)
// If client: notifies trainer via push
// If trainer: marks all clients for deletion + notifies them via push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Get requesting user from JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  // Get profile with role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) return new Response('Profile not found', { status: 404, headers: corsHeaders })

  const now = new Date().toISOString()

  // ── Mark this user for deletion ────────────────────────────────────────────
  await supabase
    .from('profiles')
    .update({ deletion_requested_at: now })
    .eq('id', user.id)

  // ── CLIENT flow ────────────────────────────────────────────────────────────
  if (profile.role === 'client') {
    // Find trainer
    const { data: clientRow } = await supabase
      .from('clients')
      .select('trainer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (clientRow?.trainer_id) {
      await notifyTrainerWeb(supabase, clientRow.trainer_id, profile.full_name)
    }
  }

  // ── TRAINER flow ───────────────────────────────────────────────────────────
  if (profile.role === 'trainer') {
    // Get all clients of this trainer
    const { data: clientRows } = await supabase
      .from('clients')
      .select('id, user_id, profiles!clients_user_id_fkey(full_name)')
      .eq('trainer_id', user.id)

    if (clientRows?.length) {
      const userIds = clientRows.map((r: any) => r.user_id)

      // Mark all clients for deletion too
      await supabase
        .from('profiles')
        .update({ deletion_requested_at: now })
        .in('id', userIds)

      // Send push notification to each client (mobile)
      for (const row of clientRows) {
        await notifyClientMobile(supabase, row.id)
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, scheduled_deletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})

// ── Notify trainer via web push ────────────────────────────────────────────
async function notifyTrainerWeb(supabase: any, trainerId: string, clientName: string) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('trainer_id', trainerId)

  if (!subs?.length) return

  const appUrl = Deno.env.get('APP_URL') || 'https://app.unitlift.com'
  const secret = Deno.env.get('PUSH_SECRET') || ''
  const firstName = clientName?.split(' ')[0] || 'Klijent'

  const payload = JSON.stringify({
    title: `⚠️ ${firstName} briše račun`,
    body: `Klijent ${firstName} zatražio je brisanje računa. Podaci će biti obrisani za 30 dana.`,
    url: '/dashboard/clients',
    tag: `delete-request-${trainerId}`,
    icon: '/apple-touch-icon.png',
  })

  await Promise.all(
    subs.map((sub: any) =>
      fetch(`${appUrl}/api/push/send-internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-push-secret': secret },
        body: JSON.stringify({ sub, payload }),
      })
    ),
  )
}

// ── Notify client via Expo push token ────────────────────────────────────
async function notifyClientMobile(supabase: any, clientId: string) {
  const { data: tokenRows } = await supabase
    .from('expo_push_tokens')
    .select('token')
    .eq('client_id', clientId)

  if (!tokenRows?.length) return

  const messages = tokenRows.map((row: any) => ({
    to: row.token,
    sound: 'default',
    title: '⚠️ Obavijest o računu',
    body: 'Tvoj trener je obrisao račun. Tvoji podaci bit će obrisani za 30 dana.',
    data: { type: 'account_deletion' },
  }))

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })
}
