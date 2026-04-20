/**
 * Server-only Resend helper (same API as edge functions).
 */

export async function sendResendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY missing' }

  const from = process.env.RESEND_FROM ?? 'UnitLift <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    return { ok: false, error: errText || String(res.status) }
  }
  return { ok: true }
}
