/// <reference path="./deno.d.ts" />
/**
 * Password reset email for clients only — link must point at /client-auth (web).
 * Sent via Resend; same secrets as client-invite-email.ts.
 */

export function buildClientPasswordRecoveryHtml(opts: {
  clientName: string
  actionLink: string
}): string {
  const { clientName, actionLink } = opts
  const safeName = escapeHtml(clientName || 'there')
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
                Resetiranje lozinke
              </h1>
              <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.55;">
                Zatražio/la si novu lozinku za mobilnu aplikaciju.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
                Bok <strong style="color:#fff;">${safeName}</strong>,<br/><br/>
                Klikni gumb ispod da postaviš novu lozinku na sigurnoj stranici UnitLifta.
              </p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${safeLink}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#ffffff !important;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 8px 24px rgba(91,33,182,0.35);">
                  Postavi novu lozinku
                </a>
              </div>
              <p style="margin:0 0 20px 0;font-size:12px;color:#71717a;line-height:1.5;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
                <strong style="color:#a1a1aa;">English</strong><br/>
                You requested a password reset for the <strong>UnitLift</strong> mobile app. Use the button above to set a new password on our secure page.
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

export async function sendClientPasswordRecoveryEmail(opts: {
  to: string
  clientName: string
  actionLink: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured for the send-client-password-reset function')
  }

  const from = Deno.env.get('RESEND_FROM') ?? 'UnitLift <no-reply@unitlift.com>'
  const subject =
    Deno.env.get('CLIENT_PASSWORD_RESET_EMAIL_SUBJECT') ?? 'Resetiranje lozinke – UnitLift'

  const html = buildClientPasswordRecoveryHtml({
    clientName: opts.clientName,
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
