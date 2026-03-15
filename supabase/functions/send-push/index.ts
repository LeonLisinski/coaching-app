// Supabase Edge Function: send-push
// Triggered by database webhook when new message or check-in is inserted

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL   = Deno.env.get('VAPID_EMAIL') || 'mailto:info@unitlift.com'

// Minimal VAPID + web-push implementation for Deno
async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  // Use the web app's /api/push/send endpoint instead of direct push in edge function
  // This avoids needing to implement VAPID signing in Deno from scratch
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

Deno.serve(async (req) => {
  const body = await req.json()
  const record = body.record

  if (!record) return new Response('No record', { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let trainer_id: string | null = null
  let title = 'UnitLift'
  let notifBody = ''
  let url = '/dashboard'
  let tag = 'unitlift'

  // Message: record has trainer_id, client_id, sender_id
  if (record.trainer_id && record.client_id && record.sender_id) {
    // Only notify if CLIENT sent the message (not trainer)
    if (record.sender_id === record.trainer_id) return new Response('Trainer sent', { status: 200 })

    trainer_id = record.trainer_id

    // Get client name
    const { data: client } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', record.client_id)
      .maybeSingle()

    const name = client?.full_name?.split(' ')[0] || 'Klijent'
    title = `💬 ${name}`
    notifBody = record.content?.length > 80 ? record.content.slice(0, 80) + '…' : record.content
    url = `/dashboard/chat`
    tag = `message-${record.client_id}`
  }

  // Check-in: record has trainer_id, client_id, status
  if (record.trainer_id && record.client_id && record.week_start !== undefined) {
    trainer_id = record.trainer_id

    const { data: client } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', record.client_id)
      .maybeSingle()

    const name = client?.full_name?.split(' ')[0] || 'Klijent'
    title = `📋 ${name} — novi check-in`
    notifBody = 'Klijent je predao tjedni check-in'
    url = `/dashboard/checkins`
    tag = `checkin-${record.client_id}`
  }

  if (!trainer_id) return new Response('No trainer', { status: 200 })

  // Get all subscriptions for this trainer
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
