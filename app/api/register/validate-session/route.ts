import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ valid: false, error: 'Missing session_id' })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })

    // Session must be completed (payment/trial setup succeeded)
    if (session.status !== 'complete') {
      return NextResponse.json({ valid: false, error: 'Session not complete' })
    }

    // Check no trainer already registered with this session
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_customer_id', customerId ?? '')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ valid: false, error: 'Account already exists for this checkout session' })
    }

    const customer = session.customer as Stripe.Customer | null
    return NextResponse.json({
      valid: true,
      customer_email: customer?.email ?? session.customer_details?.email ?? '',
      plan: session.metadata?.plan ?? '',
    })
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message })
  }
}
