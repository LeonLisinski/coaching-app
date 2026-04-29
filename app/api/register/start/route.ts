import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { PLAN_PRICES, Plan } from '@/lib/plans'
import { sendResendEmail } from '@/lib/resend-server'

export async function POST(req: NextRequest) {
  const { full_name, email: rawEmail, password, phone, plan } = await req.json()

  if (!full_name?.trim() || !rawEmail?.trim() || !password) {
    return NextResponse.json({ error: 'Sva polja su obavezna.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Lozinka mora imati najmanje 8 znakova.' }, { status: 400 })
  }

  // Normalize email once at the top so every downstream operation sees the
  // same canonical form. Auth + profiles + Stripe customer must all agree on
  // case to keep case-insensitive lookups (e.g. find-or-invite) working.
  const email = rawEmail.trim().toLowerCase()

  const resolvedPlan = (['starter', 'pro', 'scale'].includes(plan) ? plan : 'starter') as Plan
  const priceId = PLAN_PRICES[resolvedPlan]
  if (!priceId) {
    return NextResponse.json({ error: 'Plan nije konfiguriran.' }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const adminDb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check for duplicate email via profiles table (reliable, no pagination issue).
  // generateLink also returns a clear error if the email exists, but checking here
  // gives a friendlier 409 response without consuming quota.
  // Differentiate trainer vs client accounts so the user gets actionable guidance
  // instead of a generic "already registered" message.
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'

  // Create unconfirmed auth user and generate verification link
  const { data: linkData, error: createError } = await adminDb.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo: `${appUrl}/login?verified=1`,
      data: { full_name: full_name.trim() },
    },
  })

  const user = linkData?.user
  const verifyActionLink = linkData?.properties?.action_link

  if (createError || !user) {
    console.error('[register/start] generateLink(signup) error:', createError?.message)
    const isEmailTaken = createError?.message?.toLowerCase().includes('already registered')
      || createError?.message?.toLowerCase().includes('already been registered')
      || createError?.message?.toLowerCase().includes('user already exists')
    return NextResponse.json({
      error: isEmailTaken
        ? 'Ova email adresa je već registrirana.'
        : 'Greška pri kreiranju računa. Provjeri podatke i pokušaj ponovo.',
    }, { status: 500 })
  }

  if (!verifyActionLink) {
    console.error('[register/start] verification link missing after signup link generation')
    await adminDb.auth.admin.deleteUser(user.id).catch(() => {})
    return NextResponse.json({ error: 'Greška pri pripremi verifikacije emaila. Pokušaj ponovo.' }, { status: 500 })
  }

  const verifyHtml = `
    <div style="font-family:Inter,Arial,sans-serif;padding:24px;background:#f6f7fb;color:#111827">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px">
        <h2 style="margin:0 0 12px 0;font-size:22px;line-height:1.25">Potvrdi svoj email za UnitLift</h2>
        <p style="margin:0 0 16px 0;color:#4b5563">Bok ${full_name.trim()}, prije ulaska u dashboard potvrdi email klikom na gumb ispod.</p>
        <a href="${verifyActionLink}" style="display:inline-block;background:#0066ff;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Potvrdi email</a>
        <p style="margin:16px 0 0 0;color:#6b7280;font-size:13px">Ako gumb ne radi, kopiraj ovaj link u browser:</p>
        <p style="margin:8px 0 0 0;color:#374151;font-size:12px;word-break:break-all">${verifyActionLink}</p>
      </div>
    </div>
  `

  const verifySend = await sendResendEmail({
    to: email,
    subject: 'Potvrdi email adresu - UnitLift',
    html: verifyHtml,
  })

  if (!verifySend.ok) {
    console.error('[register/start] verify email send failed:', verifySend.errorKey, verifySend.logHint || '')
    await adminDb.auth.admin.deleteUser(user.id).catch(() => {})
    return NextResponse.json({ error: 'Ne mogu poslati verifikacijski email. Pokušaj ponovo.' }, { status: 500 })
  }

  // Poll until the DB trigger creates the profiles row (replaces fixed 700ms delay).
  // Trigger is usually instant but can lag under load.
  const pollStart = Date.now()
  while (Date.now() - pollStart < 4000) {
    const { data: p } = await adminDb.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (p?.id) break
    await new Promise(r => setTimeout(r, 300))
  }

  // Update profiles table (upsert handles race where trigger was too slow).
  // Email is already lowercased to match auth.users.email and keep
  // case-insensitive lookups consistent.
  await adminDb.from('profiles').upsert({
    id:        user.id,
    full_name: full_name.trim(),
    role:      'trainer',
    email,
    ...(phone?.trim() ? { phone: phone.trim() } : {}),
  }, { onConflict: 'id' })

  // Ensure trainer_profiles row exists (upsert — safe if trigger already created it)
  await adminDb.from('trainer_profiles').upsert({
    id: user.id,
  }, { onConflict: 'id', ignoreDuplicates: true })

  // Create Stripe customer + checkout session
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[register/start] STRIPE_SECRET_KEY not set')
    return NextResponse.json({ error: 'Konfiguracijska greška. Kontaktiraj podršku.' }, { status: 500 })
  }

  let stripe: Stripe
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  } catch (e) {
    console.error('[register/start] Stripe init error:', e)
    return NextResponse.json({ error: 'Konfiguracijska greška. Kontaktiraj podršku.' }, { status: 500 })
  }

  let checkoutUrl: string
  try {
    const customer = await stripe.customers.create({
      email,
      name:  full_name.trim(),
      metadata: { supabase_user_id: user.id },
    })

    const session = await stripe.checkout.sessions.create({
      customer:                  customer.id,
      mode:                      'subscription',
      payment_method_types:      ['card'],
      payment_method_collection: 'always',
      line_items:                [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { plan: resolvedPlan, supabase_user_id: user.id },
      },
      metadata: { plan: resolvedPlan, supabase_user_id: user.id },
      allow_promotion_codes: true,
      success_url: `${appUrl}/dashboard?setup=pending`,
      cancel_url:  `${appUrl}/register?plan=${resolvedPlan}`,
    })

    checkoutUrl = session.url!
  } catch (stripeErr: any) {
    console.error('[register/start] Stripe error:', stripeErr?.message)
    return NextResponse.json({ error: 'Greška pri kreiranju pretplate. Pokušaj ponovo.' }, { status: 500 })
  }

  return NextResponse.json({ checkout_url: checkoutUrl })
}
