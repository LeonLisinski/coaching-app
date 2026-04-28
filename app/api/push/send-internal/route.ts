import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

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
    return NextResponse.json({ error: err.message, status: err.statusCode }, { status: 200 })
  }
}
