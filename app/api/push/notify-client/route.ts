import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sends a manual push notification to a client's mobile app.
// Called by the trainer from the dashboard.

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

  // Verify the client belongs to this trainer
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', client_id)
    .eq('trainer_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Call the Edge Function
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-client-push`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ type: 'manual', client_id, message }),
    },
  )

  if (!res.ok) return NextResponse.json({ error: 'Push failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
