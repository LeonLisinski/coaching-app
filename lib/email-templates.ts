/**
 * Shared HTML email templates for UnitLift.
 * All emails use the same dark-card layout.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Base wrapper — dark card, UnitLift badge, optional footer CTA */
function baseEmail(opts: {
  iconEmoji?: string
  iconBg?: string
  title: string
  subtitle?: string
  bodyHtml: string
  ctaHref?: string
  ctaLabel?: string
  footerNote?: string
}): string {
  const {
    iconEmoji = '',
    iconBg = '#5b21b6',
    title,
    subtitle,
    bodyHtml,
    ctaHref,
    ctaLabel,
    footerNote,
  } = opts

  const ctaBlock = ctaHref && ctaLabel
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#ffffff !important;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 8px 24px rgba(91,33,182,0.35);">
          ${escapeHtml(ctaLabel)}
        </a>
      </div>`
    : ''

  const subtitleBlock = subtitle
    ? `<p style="margin:8px 0 0 0;font-size:14px;color:#a1a1aa;line-height:1.55;">${subtitle}</p>`
    : ''

  const iconEmojiBlock = iconEmoji
    ? `<div style="font-size:28px;margin-bottom:12px;">${iconEmoji}</div>`
    : ''

  const footerBlock = footerNote
    ? `<p style="margin:0;font-size:12px;color:#71717a;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;line-height:1.5;">${footerNote}</p>`
    : `<p style="margin:0;font-size:12px;color:#71717a;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;line-height:1.5;">Hvala što koristiš UnitLift.</p>`

  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>UnitLift</title>
</head>
<body style="margin:0;background:#0b0a12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0a12;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:linear-gradient(180deg,#15131f 0%,#0e0c16 100%);border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr>
          <td style="padding:28px 28px 8px 28px;text-align:center;">
            <div style="display:inline-block;padding:10px 14px;border-radius:14px;background:${escapeHtml(iconBg)};margin-bottom:16px;">
              <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em;">UnitLift</span>
            </div>
            ${iconEmojiBlock}
            <h1 style="margin:0 0 0 0;font-size:22px;font-weight:800;color:#f4f4f5;line-height:1.25;">${title}</h1>
            ${subtitleBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px 28px;">
            ${bodyHtml}
            ${ctaBlock}
            ${footerBlock}
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0 0;font-size:11px;color:#52525b;text-align:center;">© UnitLift · unitlift.com</p>
    </td></tr>
  </table>
</body>
</html>`
}

/** Package expiry reminder sent to trainer */
export function buildPackageExpiryEmail(opts: {
  trainerFirstName: string
  clientName: string
  packageName: string
  daysLeft: number
  endDate: string
  clientPackageUrl: string
}): string {
  const { trainerFirstName, clientName, packageName, daysLeft, endDate, clientPackageUrl } = opts

  const urgencyColor = daysLeft === 0 ? '#ef4444' : daysLeft <= 3 ? '#f97316' : '#eab308'

  const expiryText =
    daysLeft === 0
      ? `Paket <strong style="color:#f87171;">${escapeHtml(packageName)}</strong> za klijenta <strong style="color:#e4e4e7;">${escapeHtml(clientName)}</strong> <strong style="color:#ef4444;">istječe danas</strong>.`
      : `Paket <strong style="color:#c4b5fd;">${escapeHtml(packageName)}</strong> za klijenta <strong style="color:#e4e4e7;">${escapeHtml(clientName)}</strong> istječe za <strong style="color:${urgencyColor};">${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}</strong> <span style="color:#a1a1aa;">(${escapeHtml(endDate)})</span>.`

  const bodyHtml = `
    <p style="margin:0 0 20px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(trainerFirstName)}</strong>,
    </p>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#d4d4d8;line-height:1.65;">
        ${expiryText}
      </p>
    </div>
    <p style="margin:0 0 8px 0;font-size:14px;color:#a1a1aa;line-height:1.55;">
      Otvori profil klijenta kako bi produžio/la ili dodijelio/la novi paket.
    </p>`

  return baseEmail({
    iconEmoji: daysLeft === 0 ? '🔴' : daysLeft <= 3 ? '🟠' : '🟡',
    title: daysLeft === 0 ? 'Paket istječe danas' : `Paket istječe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}`,
    subtitle: `Klijent: ${escapeHtml(clientName)}`,
    bodyHtml,
    ctaHref: clientPackageUrl,
    ctaLabel: 'Otvori pakete klijenta',
  })
}

/** Pending payments weekly digest sent to trainer */
export function buildPendingPaymentsEmail(opts: {
  trainerFirstName: string
  items: { clientName: string; amount: number }[]
  financeUrl: string
}): string {
  const { trainerFirstName, items, financeUrl } = opts

  const total = items.reduce((s, i) => s + i.amount, 0)

  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 16px;font-size:14px;color:#d4d4d8;border-bottom:1px solid rgba(255,255,255,0.05);">${escapeHtml(i.clientName)}</td>
      <td style="padding:10px 16px;font-size:14px;color:#c4b5fd;font-weight:700;text-align:right;border-bottom:1px solid rgba(255,255,255,0.05);">${i.amount}€</td>
    </tr>`).join('')

  const bodyHtml = `
    <p style="margin:0 0 20px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(trainerFirstName)}</strong>,
    </p>
    <p style="margin:0 0 12px 0;font-size:14px;color:#a1a1aa;line-height:1.55;">
      Imaš <strong style="color:#e4e4e7;">${items.length} ${items.length === 1 ? 'otvorenu uplatu' : 'otvorenih uplata'}</strong> koje čekaju na potvrdu:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
      <thead>
        <tr style="background:rgba(255,255,255,0.06);">
          <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#71717a;text-align:left;letter-spacing:0.05em;text-transform:uppercase;">Klijent</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#71717a;text-align:right;letter-spacing:0.05em;text-transform:uppercase;">Iznos</th>
        </tr>
      </thead>
      <tbody style="background:rgba(255,255,255,0.02);">
        ${rows}
      </tbody>
      ${total > 0 ? `<tfoot>
        <tr style="background:rgba(124,58,237,0.12);">
          <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#a1a1aa;">Ukupno</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:800;color:#c4b5fd;text-align:right;">${total}€</td>
        </tr>
      </tfoot>` : ''}
    </table>`

  return baseEmail({
    iconEmoji: '💰',
    title: `${items.length} ${items.length === 1 ? 'otvorena uplata' : 'otvorenih uplata'}`,
    subtitle: 'Tjedni pregled čekajućih plaćanja',
    bodyHtml,
    ctaHref: financeUrl,
    ctaLabel: 'Otvori financije',
  })
}

/** Trial ending reminder — already styled, migrated here for consistency */
export function buildTrialEndingEmail(opts: {
  trainerFirstName: string
  daysLeft: number
  planLabel: string
  trialEndStr: string
  billingUrl: string
}): string {
  const { trainerFirstName, daysLeft, planLabel, trialEndStr, billingUrl } = opts

  const bodyHtml = `
    <p style="margin:0 0 20px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
      Bok <strong style="color:#fff;">${escapeHtml(trainerFirstName)}</strong>,
    </p>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#d4d4d8;line-height:1.65;">
        Tvoj 14-dnevni besplatni trial istječe <strong style="color:#e4e4e7;">${escapeHtml(trialEndStr)}</strong>.
        Nakon toga počinje redovita naplata za plan <strong style="color:#a78bfa;">${escapeHtml(planLabel)}</strong>.
      </p>
    </div>
    <p style="margin:0 0 8px 0;font-size:14px;color:#a1a1aa;line-height:1.55;">
      Ako želiš prilagoditi ili otkazati pretplatu, to možeš napraviti u postavkama naplate.
    </p>`

  return baseEmail({
    iconEmoji: '⏳',
    title: `Trial istječe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}`,
    subtitle: `Plan: <strong style="color:#a78bfa;">${escapeHtml(planLabel)}</strong>`,
    bodyHtml,
    ctaHref: billingUrl,
    ctaLabel: 'Upravljaj pretplatom',
  })
}
