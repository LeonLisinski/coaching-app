import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  try {
    // Revert cancel_at_period_end
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    })
  } catch (stripeErr: any) {
    console.error('[billing/reactivate] Stripe error:', stripeErr?.message)
    return NextResponse.json({ error: 'Greška pri reaktivaciji Stripe pretplate. Pokušaj ponovo.' }, { status: 502 })
  }

  const { error: dbErr } = await supabaseAdmin.from('subscriptions').update({
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  }).eq('trainer_id', user.id)

  if (dbErr) {
    console.error('[billing/reactivate] DB update failed:', dbErr)
  }

  return NextResponse.json({ success: true })
}
