import { NextRequest, NextResponse } from 'next/server'
import { sendResendEmail } from '@/lib/resend-server'
import {
  buildPackageExpiryEmail,
  buildPendingPaymentsEmail,
  buildTrialEndingEmail,
} from '@/lib/email-templates'
import { buildCheckinReminderEmailHtml } from '@/lib/email-checkin-reminder-html'
import { escapeHtml } from '@/lib/html-escape'

const TO = 'leon.lisinski@gmail.com'

const EMAILS: { subject: string; html: () => string }[] = [
  // ── Trener obavijesti ──────────────────────────────────────────────────

  {
    subject: '[TEST] Paket istječe danas',
    html: () => buildPackageExpiryEmail({
      trainerFirstName: 'Leon',
      clientName: 'Petra Korman',
      packageName: 'Premium 3mj.',
      daysLeft: 0,
      endDate: '2026-06-18',
      clientPackageUrl: 'https://app.unitlift.com/dashboard/clients/test?tab=paketi',
    }),
  },
  {
    subject: '[TEST] Paket istječe za 3 dana',
    html: () => buildPackageExpiryEmail({
      trainerFirstName: 'Leon',
      clientName: 'Marko Leko',
      packageName: 'Starter',
      daysLeft: 3,
      endDate: '2026-06-21',
      clientPackageUrl: 'https://app.unitlift.com/dashboard/clients/test?tab=paketi',
    }),
  },
  {
    subject: '[TEST] Paket istječe za 7 dana',
    html: () => buildPackageExpiryEmail({
      trainerFirstName: 'Leon',
      clientName: 'Ana Novak',
      packageName: 'Pro 6mj.',
      daysLeft: 7,
      endDate: '2026-06-25',
      clientPackageUrl: 'https://app.unitlift.com/dashboard/clients/test?tab=paketi',
    }),
  },
  {
    subject: '[TEST] 2 otvorene uplate — tjedni digest',
    html: () => buildPendingPaymentsEmail({
      trainerFirstName: 'Leon',
      items: [
        { clientName: 'Petra Korman', amount: 0 },
        { clientName: 'Marko Leko', amount: 120 },
      ],
      financeUrl: 'https://app.unitlift.com/dashboard/financije',
    }),
  },
  {
    subject: '[TEST] Trial istječe za 7 dana',
    html: () => buildTrialEndingEmail({
      trainerFirstName: 'Leon',
      daysLeft: 7,
      planLabel: 'Starter',
      trialEndStr: '25.06.2026.',
      billingUrl: 'https://app.unitlift.com/dashboard/pretplata',
    }),
  },

  // ── Klijentski check-in podsjetnici ────────────────────────────────────

  {
    subject: '[TEST] Tjedni check-in — dan ranije',
    html: () => buildCheckinReminderEmailHtml({
      lang: 'hr',
      title: 'Sutra je check-in dan 📋',
      bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">Bok <strong style="color:#0f172a;">Petra</strong>,<br/>sutra je tvoj dan za tjedni check-in.</p>
<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px 16px;margin-bottom:16px;"><p style="margin:0;font-size:14px;color:#1e293b;line-height:1.55;">Pripremi se — izmjeri se i otvori app sutra ujutro.</p></div>
<p style="margin:0;font-size:13px;color:#64748b;">Tvoj trener: <strong>Leon</strong></p>`,
    }),
  },
  {
    subject: '[TEST] Tjedni check-in — danas',
    html: () => buildCheckinReminderEmailHtml({
      lang: 'hr',
      title: 'Danas je check-in dan! 💪',
      bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">Bok <strong style="color:#0f172a;">Petra</strong>,<br/>danas je dan za tjedni check-in!</p>
<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px 16px;margin-bottom:16px;"><p style="margin:0;font-size:14px;color:#1e293b;line-height:1.55;">Otvori aplikaciju i pošalji check-in svom treneru.</p></div>
<p style="margin:0;font-size:13px;color:#64748b;">Tvoj trener: <strong>Leon</strong></p>`,
    }),
  },

  // ── Nova prijava ────────────────────────────────────────────────────────

  {
    subject: '[TEST] Nova prijava — Prijava za coaching',
    html: () => {
      const answerLines = [
        ['Ime i prezime', 'Matko Leko'],
        ['Email', 'matko.leko@gmail.com'],
        ['Spol', 'Muško'],
        ['Trenutna kilaža', '82 kg'],
        ['Visina', '182 cm'],
        ['Cilj', 'Mišićna masa'],
        ['Budžet/mj.', '200€'],
      ].map(([k, v]) =>
        `<tr><td style="padding:9px 16px;font-size:13px;color:#64748b;font-weight:500;vertical-align:top;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:9px 16px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${escapeHtml(v)}</td></tr>`
      ).join('')

      return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Nova prijava! 🎉</p>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b;">Netko je upravo popunio tvoju prijavnu formu <strong style="color:#0f172a;">Prijava za coaching</strong>.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#f8fafc;">
                <th colspan="2" style="padding:10px 16px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;letter-spacing:0.05em;text-transform:uppercase;">Odgovori</th>
              </tr>
            </thead>
            <tbody>${answerLines}</tbody>
          </table>
          <div style="margin-top:28px;text-align:center;">
            <a href="https://app.unitlift.com/dashboard/prijave" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Otvori prijave u aplikaciji</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    },
  },

  // ── Aktivacija računa (Stripe welcome) ─────────────────────────────────

  {
    subject: '[TEST] Aktiviraj UnitLift račun — Pro plan',
    html: () => `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Dobro došao/la! 🎉</p>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b;">Plan <strong style="color:#7c3aed;">Pro</strong> je uspješno aktiviran.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
            Bok <strong style="color:#0f172a;">Leon</strong>,<br/>plaćanje je uspješno prihvaćeno. Klikni gumb ispod da aktiviraš račun i postaviš lozinku.
          </p>
          <div style="margin-top:24px;text-align:center;">
            <a href="https://app.unitlift.com/auth?token=test-token-123" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Aktiviraj UnitLift račun</a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
            Link je valjan 24 sata.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },

  // ── Poziv klijenta ──────────────────────────────────────────────────────

  {
    subject: '[TEST] Postavi svoju UnitLift lozinku',
    html: () => `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Poziv u UnitLift 🎉</p>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b;"><strong style="color:#0f172a;">Leon Lisinski</strong> te je dodao/la kao klijenta.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
            Bok <strong style="color:#0f172a;">Petra</strong>,<br/><br/>za korištenje mobilne aplikacije UnitLift trebaš postaviti lozinku.
          </p>
          <div style="margin:24px 0;text-align:center;">
            <a href="https://app.unitlift.com/client-auth?token=test" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Postavi lozinku</a>
          </div>
          <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
            <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-weight:600;">English</p>
            <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Leon Lisinski added you as a client. Set your password using the button above.</p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },

  // ── Reset lozinke ───────────────────────────────────────────────────────

  {
    subject: '[TEST] Resetiranje lozinke – UnitLift',
    html: () => `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">🔑 Resetiranje lozinke</p>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b;">Zatražio/la si novu lozinku za mobilnu aplikaciju.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Bok <strong style="color:#0f172a;">Petra</strong>,<br/>klikni gumb ispod da postaviš novu lozinku.</p>
          <div style="margin:24px 0;text-align:center;">
            <a href="https://app.unitlift.com/client-auth?token=test" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;">Postavi novu lozinku</a>
          </div>
          <div style="border-top:1px solid #f1f5f9;padding-top:16px;">
            <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;font-weight:600;">English</p>
            <p style="margin:0;font-size:13px;color:#64748b;">You requested a password reset. Use the button above.</p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },

  // ── Klijent — komentar trenera na check-in ──────────────────────────────

  {
    subject: '[TEST] Komentar na check-in',
    html: () => `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">📋 Komentar na check-in</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
            Bok <strong style="color:#0f172a;">Petra</strong>, tvoj trener <strong style="color:#0f172a;">Leon</strong> je ostavio/la komentar na tvoj check-in.
          </p>
          <div style="background:#f0fdf4;border-left:3px solid #22c55e;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.5;">Odličan tjedan! Kilaža pada kako treba, nastavi ovako. Za sljedeći tjedan povećaj protein unos na 160g dnevno.</p>
          </div>
          <p style="margin:0;font-size:13px;color:#64748b;">Otvori aplikaciju za pregled svog check-ina.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },

  // ── Klijent — nova poruka od trenera ───────────────────────────────────

  {
    subject: '[TEST] Nova poruka od trenera',
    html: () => `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">💬 Nova poruka od trenera</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
            Bok <strong style="color:#0f172a;">Petra</strong>, tvoj trener <strong style="color:#0f172a;">Leon</strong> ti je poslao/la poruku.
          </p>
          <div style="background:#f1f5f9;border-left:3px solid #7c3aed;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Leon</p>
            <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.5;">Hej, kako si se osjećala ovaj tjedan? Imaš li kakvih pitanja vezanih uz plan ishrane?</p>
          </div>
          <p style="margin:0;font-size:13px;color:#64748b;">Otvori aplikaciju za odgovor.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },

  // ── Dnevni log podsjetnik ───────────────────────────────────────────────

  {
    subject: '[TEST] Nisi unio/la dnevni log',
    html: () => `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.10);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">📝 Nisi unio/la dnevni log</p>
        </td></tr>
        <tr><td style="padding:20px 32px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Bok <strong style="color:#0f172a;">Petra</strong>,</p>
          <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.55;">Još nisi unio/la dnevni log za danas. Zapisi što si jeo/la i kako si se osjećao/la — treba samo minuta!</p>
          </div>
          <p style="margin:0;font-size:13px;color:#64748b;">Otvori aplikaciju i unesi dnevni log.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">UnitLift &bull; Coaching Platform &bull; Automatska obavijest</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
]

const TEST_SECRET = 'ul-test-2026'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== TEST_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { subject: string; ok: boolean; error?: string }[] = []

  for (const email of EMAILS) {
    const r = await sendResendEmail({ to: TO, subject: email.subject, html: email.html() })
    results.push({ subject: email.subject, ok: r.ok, error: r.ok ? undefined : (r as any).logHint })
  }

  const sent  = results.filter(r => r.ok).length
  const fails = results.filter(r => !r.ok)

  return NextResponse.json({ sent, total: EMAILS.length, fails })
}
