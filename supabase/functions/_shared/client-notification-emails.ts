/// <reference path="./deno.d.ts" />
/**
 * Client notification email templates + Resend sender.
 * Used by send-client-push (event-driven) and client-reminders (scheduled).
 * All emails use the consistent UnitLift light design.
 */

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function baseTemplate(opts: {
  title: string
  subtitle?: string
  bodyHtml: string
  ctaHref?: string
  ctaLabel?: string
  preheader?: string
}): string {
  const { title, subtitle, bodyHtml, ctaHref, ctaLabel, preheader } = opts

  const ctaBlock = ctaHref && ctaLabel
    ? `<div style="margin-top:24px;text-align:center;">
        <a href="${esc(ctaHref)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">${esc(ctaLabel)}</a>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>UnitLift</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
          </td>
        </tr>
        <!-- Title -->
        <tr>
          <td style="padding:28px 32px 0;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">${esc(title)}</p>
            ${subtitle ? `<p style="margin:6px 0 0;font-size:14px;color:#64748b;">${esc(subtitle)}</p>` : ''}
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:20px 32px 32px;">
            ${bodyHtml}
            ${ctaBlock}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** 1. Trainer sent a new message */
export function buildNewMessageHtml(opts: { clientName: string; trainerName: string; messagePreview: string }): string {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(opts.clientName)}</strong>,
      tvoj trener <strong style="color:#0f172a;">${esc(opts.trainerName)}</strong> ti je poslao/la poruku.
    </p>
    <div style="background:#f1f5f9;border-left:3px solid #7c3aed;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">${esc(opts.trainerName)}</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.5;">${esc(opts.messagePreview)}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">Otvori aplikaciju za odgovor.</p>`
  return baseTemplate({ title: '💬 Nova poruka od trenera', preheader: `${opts.trainerName}: ${opts.messagePreview}`, bodyHtml: body })
}

/** 2. Trainer commented on a check-in */
export function buildCheckinCommentHtml(opts: { clientName: string; trainerName: string; comment: string }): string {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(opts.clientName)}</strong>,
      tvoj trener <strong style="color:#0f172a;">${esc(opts.trainerName)}</strong> je ostavio/la komentar na tvoj check-in.
    </p>
    <div style="background:#f0fdf4;border-left:3px solid #22c55e;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.5;">${esc(opts.comment)}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">Otvori aplikaciju za pregled svog check-ina.</p>`
  return baseTemplate({ title: '📋 Komentar na check-in', preheader: opts.comment.slice(0, 60), bodyHtml: body })
}

/** 3. Check-in reminder — day before */
export function buildCheckinDayBeforeHtml(opts: { clientName: string; trainerName: string }): string {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(opts.clientName)}</strong>,<br/>
      sutra je tvoj dan za tjedni check-in.
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.55;">
        Pripremi se — izmjeri se, prikupi sve podatke i otvori app sutra ujutro.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">Tvoj trener: <strong style="color:#334155;">${esc(opts.trainerName)}</strong></p>`
  return baseTemplate({ title: '📋 Sutra je check-in dan', preheader: 'Pripremi se za tjedni check-in', bodyHtml: body })
}

/** 4. Check-in reminder — day of */
export function buildCheckinDayOfHtml(opts: { clientName: string; trainerName: string }): string {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(opts.clientName)}</strong>,<br/>
      danas je tvoj dan za tjedni check-in!
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.55;">
        Otvori aplikaciju i pošalji check-in svom treneru.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">Tvoj trener: <strong style="color:#334155;">${esc(opts.trainerName)}</strong></p>`
  return baseTemplate({ title: '💪 Danas je check-in dan!', preheader: 'Ne zaboravi danas poslati check-in', bodyHtml: body })
}

/** 5. Daily log reminder (22:00) */
export function buildDailyLogHtml(opts: { clientName: string }): string {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(opts.clientName)}</strong>,
    </p>
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.55;">
        Još nisi unio/la dnevni log za danas. Zapisi što si jeo/la i kako si se osjećao/la — treba samo minuta!
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">Otvori aplikaciju i unesi dnevni log.</p>`
  return baseTemplate({ title: '📝 Nisi unio/la dnevni log', preheader: 'Unesi dnevni log za danas', bodyHtml: body })
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
