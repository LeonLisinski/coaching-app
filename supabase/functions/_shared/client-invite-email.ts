/// <reference path="./deno.d.ts" />
/**
 * Client invite email — sent when a trainer adds a new client.
 * Uses the consistent UnitLift light design.
 */

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildClientInviteHtml(opts: {
  clientName: string
  trainerName: string
  actionLink: string
}): string {
  const safeName    = esc(opts.clientName || 'there')
  const safeTrainer = esc(opts.trainerName)
  const safeLink    = esc(opts.actionLink)

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
            <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Poziv u UnitLift 🎉</p>
            <p style="margin:6px 0 0;font-size:14px;color:#64748b;"><strong style="color:#0f172a;">${safeTrainer}</strong> te je dodao/la kao klijenta.</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:20px 32px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
              Bok <strong style="color:#0f172a;">${safeName}</strong>,<br/><br/>
              tvoj trener koristi <strong>UnitLift mobilnu aplikaciju</strong> za praćenje treninga, prehrane i napretka. Postavi lozinku kako bi pristupio/la svojem profilu.
            </p>
            <div style="margin:24px 0;text-align:center;">
              <a href="${safeLink}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Postavi lozinku →</a>
            </div>
            <!-- What's in the app -->
            <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Što te čeka u aplikaciji</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">💪 &nbsp;Tjedni planovi treninga i vježbi</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">🥗 &nbsp;Personalizirani planovi prehrane</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">📋 &nbsp;Tjedni check-in praćenje napretka</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">💬 &nbsp;Direktna komunikacija s trenerom</td></tr>
              </table>
            </div>
            <div style="border-top:1px solid #f1f5f9;padding-top:20px;margin-top:4px;">
              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-weight:600;">English</p>
              <p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.5;">
                <strong>${safeTrainer}</strong> added you as a client on UnitLift. Set your password using the button above, then download the mobile app to get started.
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;word-break:break-all;">
                Ako gumb ne radi / Button not working: <a href="${safeLink}" style="color:#7c3aed;">${safeLink}</a>
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

export function buildClientAddedHtml(opts: {
  clientName: string
  trainerName: string
}): string {
  const safeName    = esc(opts.clientName || 'there')
  const safeTrainer = esc(opts.trainerName)

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
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Imaš novog trenera 💪</p>
            <p style="margin:6px 0 0;font-size:14px;color:#64748b;"><strong style="color:#0f172a;">${safeTrainer}</strong> te je dodao/la kao klijenta.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
              Bok <strong style="color:#0f172a;">${safeName}</strong>,<br/><br/>
              već imaš UnitLift račun s ovom email adresom. Otvori mobilnu aplikaciju i prijavi se — tvoj novi trener <strong>${safeTrainer}</strong> je spreman za suradnju.
            </p>
            <!-- What's in the app -->
            <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Što te čeka</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">💪 &nbsp;Tjedni planovi treninga i vježbi</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">🥗 &nbsp;Personalizirani planovi prehrane</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">📋 &nbsp;Tjedni check-in praćenje napretka</td></tr>
                <tr><td style="padding:5px 0;font-size:13px;color:#334155;">💬 &nbsp;Direktna komunikacija s trenerom</td></tr>
              </table>
            </div>
            <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
              <p style="margin:0;font-size:13px;color:#1e293b;line-height:1.5;">
                Ne sjećaš se lozinke? U aplikaciji odaberi <strong>Zaboravljena lozinka</strong> i dobit ćeš link za reset.
              </p>
            </div>
            <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-weight:600;">English</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
                <strong>${safeTrainer}</strong> added you as a client. You already have a UnitLift account — open the mobile app and sign in with your existing password. Forgot it? Use <strong>Forgot Password</strong> in the app.
              </p>
            </div>
          </td>
        </tr>
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

export async function sendClientInviteEmail(opts: {
  to: string
  clientName: string
  trainerName: string
  actionLink: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured for the create-client function')

  const from    = Deno.env.get('RESEND_FROM') ?? 'UnitLift <no-reply@unitlift.com>'
  const subject = Deno.env.get('CLIENT_INVITE_EMAIL_SUBJECT') ?? 'Postavi svoju UnitLift lozinku'

  const html = buildClientInviteHtml(opts)
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

export async function sendClientAddedEmail(opts: {
  to: string
  clientName: string
  trainerName: string
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured for the create-client function')

  const from    = Deno.env.get('RESEND_FROM') ?? 'UnitLift <no-reply@unitlift.com>'
  const subject = Deno.env.get('CLIENT_ADDED_EMAIL_SUBJECT') ?? 'Imaš novog trenera na UnitLift-u'

  const html = buildClientAddedHtml(opts)
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
