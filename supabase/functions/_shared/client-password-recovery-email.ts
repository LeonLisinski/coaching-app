/// <reference path="./deno.d.ts" />
/**
 * Password reset email for clients — consistent UnitLift light design.
 */

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildClientPasswordRecoveryHtml(opts: {
  clientName: string
  actionLink: string
}): string {
  const safeName = esc(opts.clientName || 'there')
  const safeLink = esc(opts.actionLink)

  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>UnitLift</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
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
            <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">🔑 Resetiranje lozinke</p>
            <p style="margin:6px 0 0;font-size:14px;color:#64748b;">Zatražio/la si novu lozinku za mobilnu aplikaciju.</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:20px 32px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
              Bok <strong style="color:#0f172a;">${safeName}</strong>,<br/><br/>
              klikni gumb ispod da postaviš novu lozinku na sigurnoj stranici UnitLifta.
            </p>
            <div style="margin:24px 0;text-align:center;">
              <a href="${safeLink}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Postavi novu lozinku</a>
            </div>
            <div style="border-top:1px solid #f1f5f9;padding-top:20px;margin-top:4px;">
              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-weight:600;">English</p>
              <p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.5;">
                You requested a password reset for the <strong>UnitLift</strong> mobile app. Use the button above to set a new password.
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;word-break:break-all;">
                Ako gumb ne radi: <a href="${safeLink}" style="color:#7c3aed;">${safeLink}</a>
              </p>
            </div>
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

export async function sendClientPasswordRecoveryEmail(opts: {
  to: string
  clientName: string
  actionLink: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured for the send-client-password-reset function')

  const from    = Deno.env.get('RESEND_FROM') ?? 'UnitLift <no-reply@unitlift.com>'
  const subject = Deno.env.get('CLIENT_PASSWORD_RESET_EMAIL_SUBJECT') ?? 'Resetiranje lozinke – UnitLift'

  const html = buildClientPasswordRecoveryHtml(opts)
  const res  = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [opts.to], subject, html }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error ${res.status}: ${text}`)
  }
}
