// Supabase Edge Function: send-push
// Triggered by database webhook when a new message (client→trainer) or
// a new check-in (client INSERT) is inserted.
//
// Web-push (VAPID) for the trainer web app.
// Also sends email to trainer if email_enabled for the event type.
// Parallel: send-client-push handles Expo push for the client mobile app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<{ ok: boolean; status?: number }> {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.unitlift.com'
  const secret = Deno.env.get('PUSH_SECRET') || ''

  try {
    const res = await fetch(`${appUrl}/api/push/send-internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': secret,
      },
      body: JSON.stringify({ sub, payload }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: data.ok === true, status: data.status }
  } catch {
    return { ok: false }
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'UnitLift <obavijesti@unitlift.com>',
        to,
        subject,
        html,
      }),
    })
  } catch { /* best-effort */ }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildMessageEmail(trainerFirstName: string, clientName: string, message: string, chatUrl: string): string {
  const safeTrainer = escHtml(trainerFirstName)
  const safeClient  = escHtml(clientName)
  const safeMsg     = escHtml(message.length > 300 ? message.slice(0, 300) + '…' : message)
  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">💬 Nova poruka</p>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b;"><strong style="color:#0f172a;">${safeClient}</strong> ti je poslao/la poruku.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Bok <strong style="color:#0f172a;">${safeTrainer}</strong>,</p>
          <div style="background:#f1f5f9;border-left:3px solid #7c3aed;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">${safeClient}</p>
            <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.5;">${safeMsg}</p>
          </div>
          <div style="margin-top:24px;text-align:center;">
            <a href="${chatUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Otvori chat</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildCheckinEmail(trainerFirstName: string, clientName: string, checkinDate: string, checkinUrl: string): string {
  const safeTrainer = escHtml(trainerFirstName)
  const safeClient  = escHtml(clientName)
  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">📋 Novi check-in</p>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b;"><strong style="color:#0f172a;">${safeClient}</strong> je predao/la tjedni check-in.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Bok <strong style="color:#0f172a;">${safeTrainer}</strong>,</p>
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.55;">
              Klijent <strong>${safeClient}</strong> je predao/la tjedni check-in za <strong>${escHtml(checkinDate)}</strong>.
            </p>
          </div>
          <div style="margin-top:24px;text-align:center;">
            <a href="${checkinUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Pregledaj check-in</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function getClientFirstName(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
): Promise<string> {
  const { data } = await supabase
    .from('clients')
    .select('profiles!clients_user_id_fkey(full_name)')
    .eq('id', clientId)
    .maybeSingle()
  const fullName = (data?.profiles as any)?.full_name as string | undefined
  return fullName?.split(' ')[0] || 'Klijent'
}

Deno.serve(async (req) => {
  // Reject requests without the shared webhook secret — function runs with JWT verification off
  const expectedSecret = Deno.env.get('WEBHOOK_SECRET') || ''
  const providedSecret = req.headers.get('x-webhook-secret') || ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response('Forbidden', { status: 403 })
  }

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
  let notifType: 'message' | 'checkin' = 'message'

  // ── 1. New message from client ──────────────────────────────────────────
  if (record.trainer_id && record.client_id && record.sender_id) {
    if (record.sender_id === record.trainer_id) {
      return new Response('Trainer sent — skipped', { status: 200 })
    }

    trainer_id = record.trainer_id
    notifType = 'message'
    const name = await getClientFirstName(supabase, record.client_id)
    title = `💬 ${name}`
    notifBody = record.content?.length > 80 ? record.content.slice(0, 80) + '…' : (record.content ?? '')
    url = '/dashboard/chat'
    tag = `message-${record.client_id}`
  }

  // ── 2. New check-in submitted by client ──────────────────────────────────
  if (!trainer_id && record.trainer_id && record.client_id && record.date !== undefined) {
    trainer_id = record.trainer_id
    notifType = 'checkin'
    const name = await getClientFirstName(supabase, record.client_id)
    title = `📋 ${name} — novi check-in`
    notifBody = 'Klijent je predao tjedni check-in'
    url = '/dashboard/checkins'
    tag = `checkin-${record.client_id}`
  }

  if (!trainer_id) return new Response('No trainer — skipped', { status: 200 })

  const appUrl = Deno.env.get('APP_URL') || 'https://app.unitlift.com'

  // ── Fetch notification prefs + trainer profile in parallel ──────────────
  const [prefResult, profileResult] = await Promise.all([
    supabase
      .from('trainer_notification_prefs')
      .select('push_enabled, email_enabled')
      .eq('trainer_id', trainer_id)
      .eq('type', notifType)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', trainer_id)
      .maybeSingle(),
  ])

  const pref = prefResult.data
  // Default: push ON, email OFF
  const pushEnabled  = pref ? pref.push_enabled  : true
  const emailEnabled = pref ? pref.email_enabled : false

  const trainerEmail     = profileResult.data?.email as string | null
  const trainerFirstName = (profileResult.data?.full_name as string | undefined)?.split(' ')[0] || 'Trener'

  // ── Send email if enabled ────────────────────────────────────────────────
  if (emailEnabled && trainerEmail) {
    if (notifType === 'message') {
      const clientName = await getClientFirstName(supabase, record.client_id)
      const msgContent = record.content ?? ''
      const html = buildMessageEmail(
        trainerFirstName,
        clientName,
        msgContent,
        `${appUrl}/dashboard/chat`,
      )
      await sendEmail(trainerEmail, `💬 Nova poruka od ${clientName}`, html)
    } else if (notifType === 'checkin') {
      const clientName = await getClientFirstName(supabase, record.client_id)
      const html = buildCheckinEmail(
        trainerFirstName,
        clientName,
        record.date ?? '',
        `${appUrl}/dashboard/checkins`,
      )
      await sendEmail(trainerEmail, `📋 Novi check-in — ${clientName}`, html)
    }
  }

  if (!pushEnabled) return new Response('Push disabled by pref — skipped', { status: 200 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('trainer_id', trainer_id)

  if (!subs?.length) return new Response('No subscriptions', { status: 200 })

  const payload = JSON.stringify({ title, body: notifBody, url, tag, icon: '/apple-touch-icon.png' })
  const results = await Promise.all(subs.map(sub => sendWebPush(sub, payload)))

  // Clean up expired/invalid subscriptions (410 Gone or 404)
  const expiredEndpoints = subs
    .filter((_, i) => {
      const r = results[i]
      return !r.ok && (r.status === 410 || r.status === 404)
    })
    .map(s => s.endpoint)

  if (expiredEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  const sent = results.filter(r => r.ok).length
  return new Response(JSON.stringify({ sent, total: subs.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
