import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const CLIENT_LIMITS: Record<string, number> = { starter: 15, pro: 50, scale: 150 }

export async function POST(req: NextRequest) {
  const { full_name, email, phone, password, session_id, plan } = await req.json()

  if (!full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Sva polja su obavezna.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Lozinka mora imati najmanje 8 znakova.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Greška konfiguracije servera.' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Validate Stripe session ────────────────────────────────────────────────
  let stripeCustomerId: string | null = null
  let stripeSubscriptionId: string | null = null
  let resolvedPlan = plan || 'starter'
  let trialEnd: Date | null = null
  let periodStart: Date | null = null
  let periodEnd: Date | null = null

  if (session_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
      const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['subscription'] })

      if (session.status !== 'complete') {
        return NextResponse.json({ error: 'Stripe sesija nije važeća.' }, { status: 400 })
      }

      stripeCustomerId     = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
      const sub            = session.subscription as Stripe.Subscription | null
      stripeSubscriptionId = sub?.id ?? null
      resolvedPlan         = session.metadata?.plan ?? plan ?? 'starter'

      if (sub?.trial_end)           trialEnd    = new Date(sub.trial_end * 1000)
      if (sub?.current_period_start) periodStart = new Date(sub.current_period_start * 1000)
      if (sub?.current_period_end)   periodEnd   = new Date(sub.current_period_end * 1000)

      // Update Stripe customer email/name to match registration
      if (stripeCustomerId) {
        await stripe.customers.update(stripeCustomerId, {
          name: full_name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone || undefined,
        })
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Stripe greška: ${err.message}` }, { status: 400 })
    }
  }

  // ── Check duplicate email ─────────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Račun s ovim emailom već postoji.' }, { status: 409 })
  }

  // ── Create Supabase user ───────────────────────────────────────────────────
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim(), role: 'trainer', phone: phone || null },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  await new Promise(resolve => setTimeout(resolve, 600))

  // ── Update profile ────────────────────────────────────────────────────────
  await supabaseAdmin.from('profiles').update({
    full_name: full_name.trim(),
    role: 'trainer',
    email: email.trim().toLowerCase(),
  }).eq('id', authData.user.id)

  // ── Create subscription record ────────────────────────────────────────────
  if (stripeCustomerId && stripeSubscriptionId) {
    await supabaseAdmin.from('subscriptions').insert({
      trainer_id:              authData.user.id,
      stripe_customer_id:      stripeCustomerId,
      stripe_subscription_id:  stripeSubscriptionId,
      plan:                    resolvedPlan,
      status:                  'trialing',
      client_limit:            CLIENT_LIMITS[resolvedPlan] ?? 15,
      trial_start:             new Date().toISOString(),
      trial_end:               trialEnd?.toISOString() ?? null,
      current_period_start:    periodStart?.toISOString() ?? null,
      current_period_end:      periodEnd?.toISOString() ?? null,
    })

    // Update Stripe customer metadata with Supabase user ID
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
    await stripe.customers.update(stripeCustomerId, {
      metadata: { supabase_user_id: authData.user.id },
    })
  }

  return NextResponse.json({ success: true, user_id: authData.user.id })
}
