/// <reference path="./deno.d.ts" />
/**
 * Custom invite email for clients (separate from trainer / default Supabase templates).
 * Sent via Resend — set RESEND_API_KEY and RESEND_FROM on the edge function.
 */

export function buildClientInviteHtml(opts: {
  clientName: string
  trainerName: string
  actionLink: string
}): string {
  const { clientName, trainerName, actionLink } = opts
  const safeName = escapeHtml(clientName || 'there')
  const safeTrainer = escapeHtml(trainerName)
  const safeLink = escapeHtml(actionLink)

  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UnitLift</title>
</head>
<body style="margin:0;background:#0b0a12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0a12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:linear-gradient(180deg,#15131f 0%,#0e0c16 100%);border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;">
              <div style="display:inline-block;padding:10px 14px;border-radius:14px;background:#5b21b6;margin-bottom:16px;">
                <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em;">UnitLift</span>
              </div>
              <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#f4f4f5;line-height:1.25;">
                Poziv u UnitLift
              </h1>
              <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.55;">
                <strong style="color:#e4e4e7;">${safeTrainer}</strong> te je dodao/la kao klijenta.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
                Bok <strong style="color:#fff;">${safeName}</strong>,<br/><br/>
                Za korištenje <strong>mobilne aplikacije UnitLift</strong> trebaš postaviti lozinku. Klikni gumb ispod — otvorit će se sigurna stranica na kojoj odabireš lozinku.
              </p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${safeLink}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#ffffff !important;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 8px 24px rgba(91,33,182,0.35);">
                  Postavi lozinku
                </a>
              </div>
              <p style="margin:0 0 20px 0;font-size:12px;color:#71717a;line-height:1.5;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
                <strong style="color:#a1a1aa;">English</strong><br/>
                <strong>${safeTrainer}</strong> added you as a client. To use the <strong>UnitLift mobile app</strong>, set your password using the button above.
              </p>
              <p style="margin:0;font-size:11px;color:#52525b;word-break:break-all;">
                Ako gumb ne radi, kopiraj ovaj link u preglednik:<br/>
                <a href="${safeLink}" style="color:#a78bfa;">${safeLink}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:11px;color:#52525b;text-align:center;">
          © UnitLift · unitlift.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendClientInviteEmail(opts: {
  to: string
  clientName: string
  trainerName: string
  actionLink: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured for the create-client function')
  }

  const from = Deno.env.get('RESEND_FROM') ?? 'UnitLift <no-reply@unitlift.com>'
  const subject =
    Deno.env.get('CLIENT_INVITE_EMAIL_SUBJECT') ?? 'Postavi svoju UnitLift lozinku'

  const html = buildClientInviteHtml({
    clientName: opts.clientName,
    trainerName: opts.trainerName,
    actionLink: opts.actionLink,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error ${res.status}: ${text}`)
  }
}

/**
 * Notification email for users who already have a UnitLift account
 * (existing identity that was just linked to a new trainer).
 * No invite/setup link — they already have credentials. They open the app
 * and log in (or use the forgot-password flow if needed).
 */
export function buildClientAddedHtml(opts: {
  clientName: string
  trainerName: string
}): string {
  const { clientName, trainerName } = opts
  const safeName = escapeHtml(clientName || 'there')
  const safeTrainer = escapeHtml(trainerName)

  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UnitLift</title>
</head>
<body style="margin:0;background:#0b0a12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0a12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:linear-gradient(180deg,#15131f 0%,#0e0c16 100%);border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;">
              <div style="display:inline-block;padding:10px 14px;border-radius:14px;background:#5b21b6;margin-bottom:16px;">
                <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em;">UnitLift</span>
              </div>
              <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#f4f4f5;line-height:1.25;">
                Imaš novog trenera
              </h1>
              <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.55;">
                <strong style="color:#e4e4e7;">${safeTrainer}</strong> te je dodao/la kao klijenta.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
                Bok <strong style="color:#fff;">${safeName}</strong>,<br/><br/>
                Već imaš UnitLift račun s ovom email adresom. Otvori mobilnu aplikaciju i prijavi se sa svojom postojećom lozinkom kako bi vidio/la nove planove i započeo/la check-in.
              </p>
              <p style="margin:0 0 16px 0;font-size:13px;color:#a1a1aa;line-height:1.55;">
                Ne sjećaš se lozinke? U aplikaciji odaberi <strong>Zaboravljena lozinka</strong> — dobit ćeš link za reset.
              </p>
              <p style="margin:0 0 20px 0;font-size:12px;color:#71717a;line-height:1.5;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
                <strong style="color:#a1a1aa;">English</strong><br/>
                <strong>${safeTrainer}</strong> added you as a client. You already have a UnitLift account with this email — open the mobile app and sign in with your existing password.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:11px;color:#52525b;text-align:center;">
          © UnitLift · unitlift.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendClientAddedEmail(opts: {
  to: string
  clientName: string
  trainerName: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured for the create-client function')
  }

  const from = Deno.env.get('RESEND_FROM') ?? 'UnitLift <no-reply@unitlift.com>'
  const subject =
    Deno.env.get('CLIENT_ADDED_EMAIL_SUBJECT') ?? 'Imaš novog trenera na UnitLift-u'

  const html = buildClientAddedHtml({
    clientName: opts.clientName,
    trainerName: opts.trainerName,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error ${res.status}: ${text}`)
  }
}
