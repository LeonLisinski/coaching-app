import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/resend-server'
import { escapeHtml } from '@/lib/html-escape'
import { buildCheckinReminderEmailHtml } from '@/lib/email-checkin-reminder-html'
import {
  manualReminderEmail,
  parseReminderLocale,
  reminderGreetingLine,
} from '@/lib/reminder-email-copy'

// Manual reminder: Resend email + optional push (Edge Function) in parallel.

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

  const { client_id, message, locale: localeRaw } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
  const locale = parseReminderLocale(localeRaw)
  const copy = manualReminderEmail[locale]

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
  const firstNameRaw = profile?.full_name?.split(' ')[0] || ''
  const safeMsg = escapeHtml(message || copy.defaultMessage)
  const greeting = reminderGreetingLine(locale, firstNameRaw)
  const bodyInner = `<p style="margin:0 0 10px 0;font-size:15px;color:#334155;line-height:1.55;">${greeting}</p><p style="margin:0;font-size:15px;color:#334155;line-height:1.55;">${safeMsg.replace(/\n/g, '<br/>')}</p>`
  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-client-push`

  const html = clientEmail
    ? buildCheckinReminderEmailHtml({
        lang: locale,
        title: copy.title,
        bodyHtml: bodyInner,
      })
    : ''

  let emailSent = false
  let emailErrorKey: 'missing_key' | 'send_failed' | null = null
  let pushSent = false

  if (clientEmail) {
    const [emailR, pushOk] = await Promise.all([
      sendResendEmail({
        to: clientEmail,
        subject: copy.subject,
        html,
      }),
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
    if (emailR.ok) emailSent = true
    else emailErrorKey = emailR.errorKey
    pushSent = pushOk
  } else {
    pushSent = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ type: 'manual', client_id, message }),
    })
      .then(res => res.ok)
      .catch(() => false)
  }

  if (!emailSent && !pushSent) {
    let errorKey: 'no_client_email' | 'email_config' | 'send_failed'
    if (!clientEmail) errorKey = 'no_client_email'
    else if (emailErrorKey === 'missing_key') errorKey = 'email_config'
    else errorKey = 'send_failed'

    return NextResponse.json(
      {
        ok: false,
        emailSent: false,
        pushSent: false,
        errorKey,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    emailSent,
    pushSent,
  })
}
