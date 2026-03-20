import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const CLIENT_LIMITS: Record<string, number> = { starter: 15, pro: 50, scale: 150 }

const PLAN_PRICES: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  scale:   process.env.STRIPE_PRICE_SCALE,
}

export async function POST(req: NextRequest) {
  const { full_name, email, password, phone, plan } = await req.json()

  if (!full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Sva polja su obavezna.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Lozinka mora imati najmanje 8 znakova.' }, { status: 400 })
  }

  const resolvedPlan = ['starter', 'pro', 'scale'].includes(plan) ? plan : 'starter'
  const priceId = PLAN_PRICES[resolvedPlan]
  if (!priceId) {
    return NextResponse.json({ error: 'Plan nije konfiguriran.' }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const adminDb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check for duplicate email
  const { data: existingUser } = await adminDb.auth.admin.listUsers()
  const emailTaken = existingUser?.users?.some(
    u => u.email?.toLowerCase() === email.trim().toLowerCase()
  )
  if (emailTaken) {
    return NextResponse.json({ error: 'Ova email adresa je već registrirana.' }, { status: 409 })
  }

  // Create Supabase auth user
  const { data: { user }, error: createError } = await adminDb.auth.admin.createUser({
    email:        email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim() },
  })

  if (createError || !user) {
    console.error('[register/start] createUser error:', createError)
    return NextResponse.json({ error: createError?.message || 'Greška pri kreiranju računa.' }, { status: 500 })
  }

  // Wait for DB trigger to create the profile row
  await new Promise(r => setTimeout(r, 700))

  // Update profiles table
  await adminDb.from('profiles').update({
    full_name: full_name.trim(),
    role:      'trainer',
    email:     email.trim(),
    ...(phone?.trim() ? { phone: phone.trim() } : {}),
  }).eq('id', user.id)

  // Sign user in so the auth cookie is set for app.unitlift.com
  const supabaseSSR = await createSupabaseServerClient()
  await supabaseSSR.auth.signInWithPassword({ email: email.trim(), password })

  // Create Stripe customer + checkout session
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

  const customer = await stripe.customers.create({
    email: email.trim(),
    name:  full_name.trim(),
    metadata: { supabase_user_id: user.id },
  })

  const appUrl     = 'https://app.unitlift.com'
  const cancelBase = process.env.NEXT_PUBLIC_LANDING_URL || 'https://unitlift.com'

  const session = await stripe.checkout.sessions.create({
    customer:                customer.id,
    mode:                    'subscription',
    payment_method_types:    ['card'],
    payment_method_collection: 'always',
    line_items:              [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { plan: resolvedPlan, supabase_user_id: user.id },
    },
    metadata: { plan: resolvedPlan, supabase_user_id: user.id },
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard?setup=pending`,
    cancel_url:  `${appUrl}/register?plan=${resolvedPlan}`,
  })

  return NextResponse.json({ checkout_url: session.url })
}
