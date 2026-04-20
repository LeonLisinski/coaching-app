/**
 * Server-only Resend helper (same API as edge functions).
 * Normalizes `from` so invalid RESEND_FROM env values don't break sends or leak raw API errors to clients.
 */

const DEFAULT_FROM = 'UnitLift <onboarding@resend.dev>'

/** Resend: `email@x` or `Name <email@x>`. Invalid values fall back to DEFAULT_FROM. */
export function normalizeResendFrom(raw: string | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return DEFAULT_FROM

  if (/^[^\s<>]+@[^\s<>]+$/.test(s)) {
    return `UnitLift <${s}>`
  }

  const m = /^([^<]+)<([^>]+)>$/.exec(s)
  if (m) {
    const addr = m[2].trim()
    if (/^[^\s<>]+@[^\s<>]+$/.test(addr)) return s
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[resend] RESEND_FROM invalid, using default:', raw?.slice(0, 40))
  }
  return DEFAULT_FROM
}

export type ResendErrorKey = 'missing_key' | 'send_failed'

export async function sendResendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: true } | { ok: false; errorKey: ResendErrorKey; logHint?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, errorKey: 'missing_key' }

  const from = normalizeResendFrom(process.env.RESEND_FROM)

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
    const text = await res.text().catch(() => '')
    let logHint: string | undefined
    try {
      const j = JSON.parse(text) as { message?: string }
      logHint = j?.message || text.slice(0, 200)
    } catch {
      logHint = text || res.statusText
    }
    if (process.env.NODE_ENV === 'development' && logHint) {
      console.warn('[resend]', res.status, logHint)
    }
    return { ok: false, errorKey: 'send_failed', logHint }
  }
  return { ok: true }
}
