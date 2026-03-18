import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  const { full_name, email, password } = await req.json()

  if (!full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Sva polja su obavezna.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Lozinka mora imati najmanje 8 znakova.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[register] Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Greška konfiguracije servera. Kontaktirajte administratora.' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Check if email already exists
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Račun s ovim emailom već postoji.' }, { status: 409 })
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim(), role: 'trainer' },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Wait for DB trigger to create profile
  await new Promise(resolve => setTimeout(resolve, 600))

  // Set role and full_name on profile
  await supabaseAdmin
    .from('profiles')
    .update({ full_name: full_name.trim(), role: 'trainer', email: email.trim().toLowerCase() })
    .eq('id', authData.user.id)

  return NextResponse.json({ success: true, user_id: authData.user.id }, { headers: corsHeaders })
}
