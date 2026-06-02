import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { PLAN_META, BILLABLE_PLANS, type Plan } from '@/lib/plans'

// Simple per-instance rate limiter (5 attempts per 10 minutes per IP)
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000
const ipAttempts = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_WINDOW_MS
  const attempts = (ipAttempts.get(ip) ?? []).filter(t => t > windowStart)
  attempts.push(now)
  ipAttempts.set(ip, attempts)
  return attempts.length > RATE_LIMIT
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Previše pokušaja registracije. Pokušaj ponovo za 10 minuta.' },
      { status: 429 },
    )
  }

  const {
    full_name,
    display_name,
    email: rawEmail,
    plan,
    buyer_type,
    buyer_name,
    oib,
    address,
  } = await req.json()

  if (!full_name?.trim() || !rawEmail?.trim()) {
    return NextResponse.json({ error: 'Sva polja su obavezna.' }, { status: 400 })
  }

  const email = rawEmail.trim().toLowerCase()

  if (buyer_type === 'business') {
    if (!buyer_name?.trim()) {
      return NextResponse.json({ error: 'Naziv tvrtke je obavezan.' }, { status: 400 })
    }
    if (!/^\d{11}$/.test((oib ?? '').trim())) {
      return NextResponse.json({ error: 'OIB mora imati točno 11 znamenki.' }, { status: 400 })
    }
  }

  const resolvedPlan = (BILLABLE_PLANS.includes(plan as Plan) ? plan : 'starter') as Plan
  const priceId = PLAN_META[resolvedPlan].stripePriceId
  if (!priceId) {
    return NextResponse.json({ error: 'Plan nije konfiguriran.' }, { status: 500 })
  }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Check for duplicate email — give actionable guidance
  const { data: existingProfile } = await adminDb
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    const message = existingProfile.role === 'trainer'
      ? 'Već postoji trenerski račun s ovom email adresom. Pokušaj se prijaviti, ili koristi opciju "Zaboravljena lozinka".'
      : 'Ova email adresa već postoji u UnitLift sustavu kao klijentski račun. Za trenerski račun koristi drugu adresu ili kontaktiraj podrska@unitlift.com.'
    return NextResponse.json({ error: message }, { status: 409 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Konfiguracijska greška. Kontaktiraj podršku.' }, { status: 500 })
  }

  let stripe: Stripe
  try {
    stripe = createStripeClient()
  } catch (e) {
    console.error('[register/start] Stripe init error:', e)
    return NextResponse.json({ error: 'Konfiguracijska greška. Kontaktiraj podršku.' }, { status: 500 })
  }

  // Promo eligibility — all new registrations get promo while founding period is active
  const promoEnd = process.env.NEXT_PUBLIC_FOUNDING_PROMO_END
  const grantPromo = !!process.env.STRIPE_COUPON_FOUNDING &&
    !!promoEnd && Date.now() < new Date(promoEnd).getTime()

  // Trial: all new registrations get 14 days
  const grantTrial = true
  const applyCouponNow = grantPromo && !grantTrial

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'

  let checkoutUrl: string
  try {
    // Find or create Stripe customer by email
    let customerId: string
    const existing = await stripe.customers.list({ email, limit: 1 })
    if (existing.data.length > 0) {
      customerId = existing.data[0].id
      await stripe.customers.update(customerId, {
        name: (display_name || full_name).trim(),
        metadata: { pending_registration: '1' },
      })
    } else {
      const customer = await stripe.customers.create({
        email,
        name: (display_name || full_name).trim(),
        metadata: { pending_registration: '1' },
      })
      customerId = customer.id
    }

    const planMeta = PLAN_META[resolvedPlan]
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: priceId, quantity: 1 }]
    if (resolvedPlan === 'scale' && planMeta.stripeOveragePriceId) {
      lineItems.push({ price: planMeta.stripeOveragePriceId })
    }

    const session = await stripe.checkout.sessions.create({
      customer:                  customerId,
      mode:                      'subscription',
      payment_method_types:      ['card'],
      payment_method_collection: 'always',
      line_items:                lineItems,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          plan:          resolvedPlan,
          // No supabase_user_id yet — will be set in webhook after account creation
          buyer_type:    buyer_type   ?? 'private',
          buyer_name:    buyer_name   ?? full_name,
          buyer_oib:     oib          ?? '',
          buyer_address: address      ?? '',
          buyer_email:   email,
          display_name:  (display_name || full_name).trim(),
          pending_email: email,
        },
      },
      ...(applyCouponNow ? {
        discounts: [{ coupon: process.env.STRIPE_COUPON_FOUNDING! }],
      } : {}),
      metadata: {
        plan:             resolvedPlan,
        registration:     '1',           // flag: webhook should create account
        buyer_type:       buyer_type   ?? 'private',
        buyer_name:       buyer_name   ?? full_name,
        buyer_oib:        oib          ?? '',
        buyer_address:    address      ?? '',
        buyer_email:      email,
        display_name:     (display_name || full_name).trim(),
        granted_trial:    '1',
        promo_granted:    grantPromo   ? '1' : '0',
        pending_email:    email,
      },
      success_url: `${appUrl}/register/success`,
      cancel_url:  `${appUrl}/register?plan=${resolvedPlan}`,
    })

    checkoutUrl = session.url!
  } catch (stripeErr: any) {
    console.error('[register/start] Stripe error:', stripeErr?.message)
    return NextResponse.json({ error: 'Greška pri kreiranju pretplate. Pokušaj ponovo.' }, { status: 500 })
  }

  return NextResponse.json({ checkout_url: checkoutUrl })
}
