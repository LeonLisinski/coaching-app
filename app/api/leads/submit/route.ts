import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/resend-server'

// Simple in-memory rate limiter: max 5 submissions per IP per hour
const ipBucket = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = ipBucket.get(ip)
  if (!bucket || now > bucket.resetAt) {
    ipBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { form_id, trainer_id, answers, honeypot } = body

  // Honeypot: if filled, it's a bot
  if (honeypot) return NextResponse.json({ ok: true })

  if (!form_id || !trainer_id || !answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Verify form exists and belongs to this trainer
  const { data: form, error: formErr } = await adminDb
    .from('lead_forms')
    .select('id, trainer_id, title, is_active')
    .eq('id', form_id)
    .eq('trainer_id', trainer_id)
    .eq('is_active', true)
    .single()

  if (formErr || !form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  // Insert submission
  const { data: submission, error: insertErr } = await adminDb
    .from('lead_submissions')
    .insert({ form_id, trainer_id, answers, status: 'new', seen: false })
    .select('id')
    .single()

  if (insertErr || !submission) {
    console.error('[leads/submit] insert error:', insertErr?.message)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }

  // Fetch trainer email for notification
  const { data: trainerProfile } = await adminDb
    .from('profiles')
    .select('email, full_name')
    .eq('id', trainer_id)
    .single()

  const trainerEmail = trainerProfile?.email
  const trainerName = trainerProfile?.full_name || 'Trener'

  // Build a simple answer summary for the email
  const answerLines = Object.entries(answers as Record<string, unknown>)
    .map(([label, value]) => {
      const val = Array.isArray(value) ? value.join(', ') : String(value ?? '')
      return `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#64748b;font-weight:500;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:6px 0;font-size:13px;color:#1e293b;">${val}</td></tr>`
    })
    .join('')

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">UnitLift</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Coaching Platform</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0f172a;">Nova prijava! 🎉</p>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Netko je upravo popunio tvoju prijavnu formu <strong style="color:#0f172a;">${form.title || 'Prijavna forma'}</strong>.</p>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${answerLines}
          </table>
          <div style="margin-top:28px;text-align:center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'}/dashboard/prijave" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;">Otvori prijave u aplikaciji</a>
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

  // Send email + web push in parallel (fire-and-forget, don't block response)
  const tasks: Promise<unknown>[] = []

  if (trainerEmail) {
    tasks.push(
      sendResendEmail({
        to: trainerEmail,
        subject: `Nova prijava — ${form.title || 'Prijavna forma'}`,
        html: emailHtml,
      }).catch((e) => console.error('[leads/submit] email error:', e)),
    )
  }

  // Fetch trainer's web push subscriptions and notify
  tasks.push(
    (async () => {
      const { data: subs } = await adminDb
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('trainer_id', trainer_id)

      if (!subs?.length) return

      const pushSecret = process.env.PUSH_SECRET
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'
      if (!pushSecret) return

      await Promise.all(
        subs.map((sub) =>
          fetch(`${appUrl}/api/push/send-internal`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-push-secret': pushSecret,
            },
            body: JSON.stringify({
              sub,
              payload: JSON.stringify({
                title: 'Nova prijava!',
                body: `Netko je popunio tvoju prijavnu formu.`,
                url: '/dashboard/prijave',
              }),
            }),
          }).catch(() => {}),
        ),
      )
    })(),
  )

  void Promise.all(tasks)

  return NextResponse.json({ ok: true, submission_id: submission.id })
}
