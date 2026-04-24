import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await params

  // Verify trainer is authenticated
  const supabaseSSR = await createSupabaseServerClient()
  const { data: { user: trainer } } = await supabaseSSR.auth.getUser()
  if (!trainer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Verify this client belongs to the requesting trainer + get user_id
  const { data: clientRow, error: clientErr } = await adminDb
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .eq('trainer_id', trainer.id)
    .single()

  if (clientErr || !clientRow) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!clientRow.user_id) {
    // No auth account linked — nothing to delete
    return NextResponse.json({ ok: true })
  }

  // Hard-delete the auth user (cascades to profiles, clients, and all related rows)
  const { error: deleteErr } = await adminDb.auth.admin.deleteUser(clientRow.user_id)
  if (deleteErr) {
    console.error('[clients/delete] deleteUser error:', deleteErr.message)
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
