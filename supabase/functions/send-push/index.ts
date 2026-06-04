// Supabase Edge Function: send-push
// Triggered by database webhook when a new message (client→trainer) or
// a new check-in (client INSERT) is inserted.
//
// Web-push (VAPID) for the trainer web app.
// Parallel: send-client-push handles Expo push for the client mobile app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.unitlift.com'
  const secret = Deno.env.get('PUSH_SECRET') || ''

  await fetch(`${appUrl}/api/push/send-internal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-push-secret': secret,
    },
    body: JSON.stringify({ sub, payload }),
  })
}

async function getClientFirstName(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
): Promise<string> {
  // clients.id → clients.user_id → profiles.full_name
  const { data } = await supabase
    .from('clients')
    .select('profiles!clients_user_id_fkey(full_name)')
    .eq('id', clientId)
    .maybeSingle()
  const fullName = (data?.profiles as any)?.full_name as string | undefined
  return fullName?.split(' ')[0] || 'Klijent'
}

Deno.serve(async (req) => {
  const body = await req.json()
  const record = body.record

  if (!record) return new Response('No record', { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let trainer_id: string | null = null
  let title = 'UnitLift'
  let notifBody = ''
  let url = '/dashboard'
  let tag = 'unitlift'

  // ── 1. New message from client ──────────────────────────────────────────
  // Condition: record has trainer_id, client_id, sender_id (messages columns)
  if (record.trainer_id && record.client_id && record.sender_id) {
    // Only notify trainer when CLIENT sends (not when trainer sends)
    if (record.sender_id === record.trainer_id) {
      return new Response('Trainer sent — skipped', { status: 200 })
    }

    trainer_id = record.trainer_id
    const name = await getClientFirstName(supabase, record.client_id)
    title = `💬 ${name}`
    notifBody = record.content?.length > 80 ? record.content.slice(0, 80) + '…' : (record.content ?? '')
    url = '/dashboard/chat'
    tag = `message-${record.client_id}`
  }

  // ── 2. New check-in submitted by client ──────────────────────────────────
  // Condition: record has trainer_id, client_id, date (checkins columns).
  // Was incorrectly gated on record.week_start which doesn't exist.
  if (!trainer_id && record.trainer_id && record.client_id && record.date !== undefined) {
    trainer_id = record.trainer_id
    const name = await getClientFirstName(supabase, record.client_id)
    title = `📋 ${name} — novi check-in`
    notifBody = 'Klijent je predao tjedni check-in'
    url = '/dashboard/checkins'
    tag = `checkin-${record.client_id}`
  }

  if (!trainer_id) return new Response('No trainer — skipped', { status: 200 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('trainer_id', trainer_id)

  if (!subs?.length) return new Response('No subscriptions', { status: 200 })

  const payload = JSON.stringify({ title, body: notifBody, url, tag, icon: '/apple-touch-icon.png' })
  await Promise.all(subs.map(sub => sendWebPush(sub, payload)))

  return new Response(JSON.stringify({ sent: subs.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
