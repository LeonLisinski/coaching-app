import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function supabaseServer(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { subscription } = body
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Missing subscription' }, { status: 400 })
  if (!subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Missing subscription keys' }, { status: 400 })
  }

  const supabase = supabaseServer(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      trainer_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    }, { onConflict: 'trainer_id,endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { endpoint } = body
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  const supabase = supabaseServer(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('trainer_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
