/// <reference path="./deno.d.ts" />
/**
 * Client notification email templates + Resend sender.
 * Used by send-client-push (event-driven) and client-reminders (scheduled).
 */

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function baseTemplate(title: string, preheader: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>UnitLift</title>
</head>
<body style="margin:0;background:#0b0a12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0a12;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:linear-gradient(180deg,#15131f 0%,#0e0c16 100%);border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;text-align:center;">
          <div style="display:inline-block;padding:10px 14px;border-radius:14px;background:#1e3a5f;margin-bottom:16px;">
            <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em;">UnitLift</span>
          </div>
          <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#f4f4f5;line-height:1.25;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">${bodyHtml}</td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:11px;color:#52525b;text-align:center;">© UnitLift · unitlift.com</p>
    </td></tr>
  </table>
</body>
</html>`
}

/** 1. Trainer sent a new message */
export function buildNewMessageHtml(opts: { clientName: string; trainerName: string; messagePreview: string }): string {
  const body = `
    <p style="margin:0 0 14px;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(opts.clientName)}</strong>,
    </p>
    <div style="background:rgba(255,255,255,0.06);border-left:3px solid #3b82f6;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(opts.trainerName)}</p>
      <p style="margin:0;font-size:14px;color:#e4e4e7;line-height:1.5;">${escapeHtml(opts.messagePreview)}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#6b7280;">Otvori aplikaciju za odgovor.</p>`
  return baseTemplate('Nova poruka od trenera', `${opts.trainerName}: ${opts.messagePreview}`, body)
}

/** 2. Trainer commented on a check-in */
export function buildCheckinCommentHtml(opts: { clientName: string; trainerName: string; comment: string }): string {
  const body = `
    <p style="margin:0 0 14px;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(opts.clientName)}</strong>,<br/>
      tvoj trener <strong>${escapeHtml(opts.trainerName)}</strong> je ostavio/la komentar na tvoj check-in.
    </p>
    <div style="background:rgba(255,255,255,0.06);border-left:3px solid #10b981;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0;font-size:14px;color:#e4e4e7;line-height:1.5;">${escapeHtml(opts.comment)}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#6b7280;">Otvori aplikaciju za pregled svog check-ina.</p>`
  return baseTemplate('Komentar na check-in', opts.comment.slice(0, 60), body)
}

/** 3. Check-in reminder — day before */
export function buildCheckinDayBeforeHtml(opts: { clientName: string; trainerName: string }): string {
  const body = `
    <p style="margin:0 0 14px;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(opts.clientName)}</strong>,<br/>
      sutra je tvoj dan za tjedni check-in.
    </p>
    <p style="margin:0 0 18px;font-size:14px;color:#a1a1aa;line-height:1.6;">
      Pripremi se — izmjeri se, prikupi sve podatke i otvori app sutra ujutro.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Tvoj trener: <strong style="color:#9ca3af;">${escapeHtml(opts.trainerName)}</strong></p>`
  return baseTemplate('Sutra je check-in dan 📋', 'Pripremi se za tjedni check-in', body)
}

/** 4. Check-in reminder — day of */
export function buildCheckinDayOfHtml(opts: { clientName: string; trainerName: string }): string {
  const body = `
    <p style="margin:0 0 14px;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(opts.clientName)}</strong>,<br/>
      danas je tvoj dan za tjedni check-in!
    </p>
    <p style="margin:0 0 18px;font-size:14px;color:#a1a1aa;line-height:1.6;">
      Otvori aplikaciju i pošalji check-in svom treneru.
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Tvoj trener: <strong style="color:#9ca3af;">${escapeHtml(opts.trainerName)}</strong></p>`
  return baseTemplate('Danas je check-in dan! 💪', 'Ne zaboravi danas poslati check-in', body)
}

/** 5. Daily log reminder (22:00) */
export function buildDailyLogHtml(opts: { clientName: string }): string {
  const body = `
    <p style="margin:0 0 14px;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(opts.clientName)}</strong>,
    </p>
    <p style="margin:0 0 18px;font-size:14px;color:#a1a1aa;line-height:1.6;">
      Još nisi unio/la dnevni log za danas. Zapisi što si jeo/la i kako si se osjećao/la — treba samo minuta!
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Otvori aplikaciju i unesi dnevni log.</p>`
  return baseTemplate('Nisi unio/la dnevni log 📝', 'Unesi dnevni log za danas', body)
}

/** Send a single notification email via Resend */
export async function sendClientEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('[sendClientEmail] RESEND_API_KEY not set — skipping email')
    return
  }
  const from = Deno.env.get('RESEND_FROM') ?? 'UnitLift <no-reply@unitlift.com>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`[sendClientEmail] Resend error ${res.status}: ${text}`)
  }
}
