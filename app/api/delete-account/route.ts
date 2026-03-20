import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  // Verify the user is authenticated via Bearer token or cookie
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const adminDb      = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Resolve the user from token or session cookie
  let userId: string | undefined

  if (token) {
    const { data: { user } } = await adminDb.auth.getUser(token)
    userId = user?.id
  }

  if (!userId) {
    const supabaseSSR = await createSupabaseServerClient()
    const { data: { user } } = await supabaseSSR.auth.getUser()
    userId = user?.id
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cancel Stripe subscription if exists
  try {
    const { data: sub } = await adminDb
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('trainer_id', userId)
      .maybeSingle()

    if (sub?.stripe_subscription_id) {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
      await stripe.subscriptions.cancel(sub.stripe_subscription_id)
    }
  } catch (e) {
    console.error('[delete-account] Stripe cancel error:', e)
  }

  // Hard delete the auth user (cascades to profiles via DB trigger)
  const { error } = await adminDb.auth.admin.deleteUser(userId)
  if (error) {
    console.error('[delete-account] deleteUser error:', error.message)
    return NextResponse.json({ error: 'Greška pri brisanju računa.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
