import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/resend-server'
import { escapeHtml } from '@/lib/html-escape'

// Manual reminder: Resend email + optional push (Edge Function) in parallel for lower latency.

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { client_id, message } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: row, error: rowErr } = await supabase
    .from('clients')
    .select(`
      id,
      profiles!clients_user_id_fkey ( email, full_name )
    `)
    .eq('id', client_id)
    .eq('trainer_id', user.id)
    .single()

  if (rowErr || !row) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rawProf = row.profiles as { email?: string | null; full_name?: string | null } | { email?: string | null; full_name?: string | null }[] | null
  const profile = Array.isArray(rawProf) ? rawProf[0] : rawProf
  const clientEmail = profile?.email?.trim()
  const firstName = escapeHtml(profile?.full_name?.split(' ')[0] || 'korisniče')
  const safeMsg = escapeHtml(message || 'Podsjetnik za check-in.')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://app.unitlift.com'

  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-client-push`

  const html = clientEmail
    ? `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#0b0a12;color:#e4e4e7;padding:24px;">
<p>Bok <strong>${firstName}</strong>,</p>
<p>${safeMsg.replace(/\n/g, '<br/>')}</p>
<p style="margin-top:24px;"><a href="${escapeHtml(appUrl)}" style="color:#a78bfa;">Otvori UnitLift</a></p>
</body></html>`
    : ''

  const [emailOutcome, pushSent] = await Promise.all([
    clientEmail
      ? sendResendEmail({
          to: clientEmail,
          subject: 'Podsjetnik: check-in (UnitLift)',
          html,
        }).then(r => ({ ok: r.ok, error: r.error }))
      : Promise.resolve({ ok: false, error: undefined as string | undefined }),
    fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ type: 'manual', client_id, message }),
    })
      .then(res => res.ok)
      .catch(() => false),
  ])

  const emailSent = emailOutcome.ok
  const emailError = emailOutcome.error

  if (!emailSent && !pushSent) {
    return NextResponse.json(
      {
        ok: false,
        emailSent: false,
        pushSent: false,
        error: clientEmail
          ? (emailError || 'Email nije poslan. Provjeri Resend.')
          : 'Klijent nema email na profilu.',
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    emailSent,
    pushSent,
    ...(emailError && !emailSent ? { warning: emailError } : {}),
  })
}
