/**
 * Kratki podsjetnik na check-in — svijetla plava kartica (slično transakcijskim mailovima), bez gumba i linkova.
 */

import { escapeHtml } from '@/lib/html-escape'

export function buildCheckinReminderEmailHtml(opts: {
  clientName: string
  /** Već escapiran HTML (npr. odlomci s <br/>) */
  bodyHtml: string
  title: string
  subtitle?: string
}): string {
  const safeName = escapeHtml(opts.clientName || 'korisniče')
  const title = escapeHtml(opts.title)
  const subtitle = opts.subtitle ? escapeHtml(opts.subtitle) : ''

  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UnitLift</title>
</head>
<body style="margin:0;background:#e8eef5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8eef5;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #dbe4f0;box-shadow:0 2px 8px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 12px 24px;text-align:center;">
              <div style="display:inline-block;padding:8px 14px;border-radius:12px;background:#2563eb;">
                <span style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">UnitLift</span>
              </div>
              <h1 style="margin:14px 0 6px 0;font-size:19px;font-weight:700;color:#0f172a;line-height:1.3;">
                ${title}
              </h1>
              ${subtitle ? `<p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${subtitle}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 24px 26px 24px;">
              <p style="margin:0 0 12px 0;font-size:15px;color:#334155;line-height:1.55;">
                Bok <strong style="color:#0f172a;">${safeName}</strong>,
              </p>
              <div style="margin:0;font-size:15px;color:#334155;line-height:1.55;">
                ${opts.bodyHtml}
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">
          © UnitLift · unitlift.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
