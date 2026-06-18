import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const expected = process.env.PUSH_SECRET
  if (!expected) {
    // Hard-fail when env is missing — refuse to silently match an empty string.
    console.error('[push/send-internal] PUSH_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const provided = req.headers.get('x-push-secret')
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sub, payload } = await req.json()
  if (!sub?.endpoint || !payload) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const statusCode: number = err.statusCode ?? 500
    console.error('[push/send-internal] sendNotification error:', statusCode, err.message)

    // Auto-remove expired/revoked subscriptions so they don't accumulate
    if (statusCode === 410 || statusCode === 404) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } catch (cleanupErr) {
        console.error('[push/send-internal] expired sub cleanup failed:', cleanupErr)
      }
    }

    return NextResponse.json({ ok: false, status: statusCode }, { status: 200 })
  }
}
