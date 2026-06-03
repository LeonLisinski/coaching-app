import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * PATCH /api/notifications/mark-read
 * Body: { type?: string; source_ids?: string[]; href?: string }
 * - source_ids: mark specific notifications
 * - href: mark all with this exact href
 * - type: mark all of this type
 * - (none): mark all unread
 */
export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { type, source_ids, href } = body as { type?: string; source_ids?: string[]; href?: string }

  let query = supabase
    .from('trainer_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('trainer_id', user.id)
    .is('read_at', null)

  if (source_ids?.length) {
    query = query.in('source_id', source_ids)
  } else if (href) {
    query = query.eq('href', href)
  } else if (type) {
    query = query.eq('type', type)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
