/**
 * Shared HTML email templates for UnitLift.
 * Light card layout — consistent with the "Nova prijava" style.
 */

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Base wrapper — light background, white card, purple gradient header.
 */
function baseEmail(opts: {
  title: string
  subtitle?: string
  bodyHtml: string
  ctaHref?: string
  ctaLabel?: string
}): string {
  const { title, subtitle, bodyHtml, ctaHref, ctaLabel } = opts

  const ctaBlock = ctaHref && ctaLabel
    ? `<div style="margin-top:28px;text-align:center;">
        <a href="${esc(ctaHref)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">
          ${esc(ctaLabel)}
        </a>
      </div>`
    : ''

  const subtitleBlock = subtitle
    ? `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${subtitle}</p>`
    : ''

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
        <!-- Title block -->
        <tr>
          <td style="padding:28px 32px 0;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">${esc(title)}</p>
            ${subtitleBlock ? `<p style="margin:6px 0 0;font-size:14px;color:#64748b;">${subtitle}</p>` : ''}
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
  const urgencyBg    = daysLeft === 0 ? '#fef2f2' : daysLeft <= 3 ? '#fff7ed' : '#fefce8'
  const urgencyBorder = daysLeft === 0 ? '#fca5a5' : daysLeft <= 3 ? '#fdba74' : '#fde047'

  const expiryText = daysLeft === 0
    ? `Paket <strong style="color:#0f172a;">${esc(packageName)}</strong> za klijenta <strong style="color:#0f172a;">${esc(clientName)}</strong> <strong style="color:${urgencyColor};">istječe danas</strong>.`
    : `Paket <strong style="color:#0f172a;">${esc(packageName)}</strong> za klijenta <strong style="color:#0f172a;">${esc(clientName)}</strong> istječe za <strong style="color:${urgencyColor};">${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}</strong> <span style="color:#64748b;">(${esc(endDate)})</span>.`

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(trainerFirstName)}</strong>,
    </p>
    <div style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.65;">${expiryText}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.55;">
      Otvori profil klijenta kako bi produžio/la ili dodijelio/la novi paket.
    </p>`

  const icon = daysLeft === 0 ? '🔴' : daysLeft <= 3 ? '🟠' : '🟡'
  const titleText = daysLeft === 0 ? 'Paket istječe danas' : `Paket istječe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}`

  return baseEmail({
    title: `${icon} ${titleText}`,
    subtitle: `Klijent: ${esc(clientName)}`,
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
      <td style="padding:10px 16px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">${esc(i.clientName)}</td>
      <td style="padding:10px 16px;font-size:14px;color:#7c3aed;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;">${i.amount}€</td>
    </tr>`).join('')

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(trainerFirstName)}</strong>,
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:#64748b;line-height:1.55;">
      Imaš <strong style="color:#0f172a;">${items.length} ${items.length === 1 ? 'otvorenu uplatu' : 'otvorenih uplata'}</strong> koje čekaju na potvrdu:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;letter-spacing:0.05em;text-transform:uppercase;">Klijent</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#94a3b8;text-align:right;letter-spacing:0.05em;text-transform:uppercase;">Iznos</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      ${total > 0 ? `<tfoot>
        <tr style="background:#f5f3ff;">
          <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#64748b;">Ukupno</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:800;color:#7c3aed;text-align:right;">${total}€</td>
        </tr>
      </tfoot>` : ''}
    </table>`

  return baseEmail({
    title: `💰 ${items.length} ${items.length === 1 ? 'otvorena uplata' : 'otvorenih uplata'}`,
    subtitle: 'Tjedni pregled čekajućih plaćanja',
    bodyHtml,
    ctaHref: financeUrl,
    ctaLabel: 'Otvori financije',
  })
}

/**
 * Trainer welcome + account activation email.
 * Sent after checkout when a new trainer registers.
 * When isTrialing is true, includes trial duration and end date.
 */
export function buildTrainerWelcomeEmail(opts: {
  trainerFirstName: string
  planLabel: string
  actionLink: string
  appUrl: string
  isTrialing?: boolean
  trialDays?: number
  trialEndStr?: string
}): string {
  const { trainerFirstName, planLabel, actionLink, appUrl, isTrialing, trialDays, trialEndStr } = opts

  const trialBadge = isTrialing ? `
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#7c3aed;font-weight:700;">🎉 ${trialDays}-dnevni besplatni trial je aktiviran</p>
      ${trialEndStr ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b;">Trial traje do <strong>${esc(trialEndStr)}</strong> — naplata počinje tek tada.</p>` : ''}
    </div>` : ''

  const steps = `
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Kako početi</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <span style="font-size:18px;">👥</span>
            <div>
              <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">Dodaj prvog klijenta</p>
              <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Idi na <strong>Klijenti</strong> i pozovi svog prvog klijenta na mobilnu app.</p>
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <span style="font-size:18px;">📋</span>
            <div>
              <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">Kreiraj plan treninga</p>
              <p style="margin:2px 0 0;font-size:13px;color:#64748b;">U tabu <strong>Trening</strong> postavi predloške i planove te ih dodijeli klijentima.</p>
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <span style="font-size:18px;">📝</span>
            <div>
              <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">Postavi prijavnu formu</p>
              <p style="margin:2px 0 0;font-size:13px;color:#64748b;">U tabu <strong>Prijave</strong> kreiraj formu i podijeli link potencijalnim klijentima.</p>
            </div>
          </div>
        </td>
      </tr>
    </table>`

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(trainerFirstName)}</strong>,<br/>
      plan <strong style="color:#7c3aed;">${esc(planLabel)}</strong> je uspješno aktiviran. Klikni gumb ispod da postaviš lozinku i pristupiš dashboardu.
    </p>
    ${trialBadge}
    <div style="margin-bottom:24px;text-align:center;">
      <a href="${esc(actionLink)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">
        Aktiviraj račun i postavi lozinku →
      </a>
    </div>
    <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;line-height:1.5;">
      Link je valjan 24 sata. Ako gumb ne radi: <a href="${esc(actionLink)}" style="color:#7c3aed;word-break:break-all;">${esc(actionLink)}</a>
    </p>
    <div style="border-top:1px solid #f1f5f9;margin-top:24px;padding-top:20px;">
      ${steps}
    </div>`

  return baseEmail({
    title: `Dobro došao/la, ${esc(trainerFirstName)}! 🎉`,
    subtitle: `Plan ${esc(planLabel)} je aktiviran`,
    bodyHtml,
  })
}

/**
 * Trial started notification — sent when a trainer's Stripe subscription
 * enters the 'trialing' state (i.e. trial start, not account activation).
 * Complements the activation email by focusing on what to expect during trial.
 */
export function buildTrialStartedEmail(opts: {
  trainerFirstName: string
  planLabel: string
  trialDays: number
  trialEndStr: string
  dashboardUrl: string
  billingUrl: string
}): string {
  const { trainerFirstName, planLabel, trialDays, trialEndStr, dashboardUrl, billingUrl } = opts

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(trainerFirstName)}</strong>,
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:18px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:32px;font-weight:800;color:#7c3aed;">${trialDays}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#64748b;">dana besplatnog triala na planu <strong style="color:#0f172a;">${esc(planLabel)}</strong></p>
      <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">Naplata počinje <strong style="color:#0f172a;">${esc(trialEndStr)}</strong></p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">
      Iskoristi trial da upoznaš sve mogućnosti platforme — bez ograničenja:
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
      ${['Dodaj neograničen broj klijenata', 'Kreiraj planove treninga i prehrane', 'Prati tjedne check-inove i napredak', 'Postavi prijavnu formu za nove klijente'].map(item =>
        `<tr><td style="padding:6px 0;font-size:14px;color:#334155;line-height:1.5;">✅ &nbsp;${item}</td></tr>`
      ).join('')}
    </table>
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
      Pretplatu možeš otkazati u bilo kojem trenutku prije <strong>${esc(trialEndStr)}</strong> bez naplate. 
      Upravljaj pretplatom u <a href="${esc(billingUrl)}" style="color:#7c3aed;">postavkama naplate</a>.
    </p>`

  return baseEmail({
    title: '🚀 Tvoj trial je počeo!',
    subtitle: `${trialDays} dana besplatno · Plan ${esc(planLabel)}`,
    bodyHtml,
    ctaHref: dashboardUrl,
    ctaLabel: 'Otvori dashboard',
  })
}

/** Trial ending reminder sent to trainer */
export function buildTrialEndingEmail(opts: {
  trainerFirstName: string
  daysLeft: number
  planLabel: string
  trialEndStr: string
  billingUrl: string
}): string {
  const { trainerFirstName, daysLeft, planLabel, trialEndStr, billingUrl } = opts

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
      Bok <strong style="color:#0f172a;">${esc(trainerFirstName)}</strong>,
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.65;">
        Tvoj 14-dnevni besplatni trial istječe <strong style="color:#0f172a;">${esc(trialEndStr)}</strong>.
        Nakon toga počinje redovita naplata za plan <strong style="color:#7c3aed;">${esc(planLabel)}</strong>.
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.55;">
      Ako želiš prilagoditi ili otkazati pretplatu, to možeš napraviti u postavkama naplate.
    </p>`

  return baseEmail({
    title: `⏳ Trial istječe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}`,
    subtitle: `Plan: ${esc(planLabel)}`,
    bodyHtml,
    ctaHref: billingUrl,
    ctaLabel: 'Upravljaj pretplatom',
  })
}
