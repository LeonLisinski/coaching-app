/**
 * Check-in reminder email — light card, consistent UnitLift design.
 */

import { escapeHtml } from '@/lib/html-escape'

export function buildCheckinReminderEmailHtml(opts: {
  lang: 'hr' | 'en'
  title: string
  subtitle?: string
  /** Safe HTML for the body (greeting + message) */
  bodyHtml: string
}): string {
  const title    = escapeHtml(opts.title)
  const subtitle = opts.subtitle ? escapeHtml(opts.subtitle) : ''
  const { lang }  = opts

  return `<!DOCTYPE html>
<html lang="${lang}">
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
        <!-- Title block -->
        <tr>
          <td style="padding:28px 32px 0;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">${title}</p>
            ${subtitle ? `<p style="margin:6px 0 0;font-size:14px;color:#64748b;">${subtitle}</p>` : ''}
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:20px 32px 32px;">
            ${opts.bodyHtml}
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
