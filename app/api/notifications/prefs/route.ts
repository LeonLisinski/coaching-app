import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TYPES = ['message', 'checkin', 'package', 'lead'] as const

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * GET /api/notifications/prefs
 * Returns per-type notification preferences for the current trainer.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('trainer_notification_prefs')
    .select('type, in_app_enabled, push_enabled, email_enabled')
    .eq('trainer_id', user.id)

  const prefsMap = Object.fromEntries((data ?? []).map(r => [r.type, r]))
  const result = TYPES.reduce<Record<string, { in_app_enabled: boolean; push_enabled: boolean; email_enabled: boolean }>>((acc, t) => {
    // Default email_enabled: true only for 'package' (matches cron + UI initial state)
    acc[t] = prefsMap[t] ?? { in_app_enabled: true, push_enabled: true, email_enabled: t === 'package' }
    return acc
  }, {})

  return NextResponse.json(result)
}

/**
 * PATCH /api/notifications/prefs
 * Body: { message?: {...}, checkin?: {...}, package?: {...}, lead?: {...} }
 */
export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const rows = TYPES.filter(t => body[t]).map(t => ({
    trainer_id: user.id,
    type: t,
    in_app_enabled: body[t].in_app_enabled ?? true,
    push_enabled:   body[t].push_enabled   ?? true,
    email_enabled:  body[t].email_enabled  ?? false,
  }))

  if (!rows.length) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('trainer_notification_prefs')
    .upsert(rows, { onConflict: 'trainer_id,type' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
