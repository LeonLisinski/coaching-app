import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Called by Supabase Edge Function — protected by secret header
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-push-secret')
  if (secret !== (process.env.PUSH_SECRET || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sub, payload } = await req.json()
  if (!sub?.endpoint || !payload) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // 410 Gone = subscription expired, should be removed from DB
    return NextResponse.json({ error: err.message, status: err.statusCode }, { status: 200 })
  }
}
