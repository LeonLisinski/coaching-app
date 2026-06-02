import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { PLAN_META, BILLABLE_PLANS, type Plan } from '@/lib/plans'
import { isPromoEligible } from '@/lib/promo'
import { isTrialEligible } from '@/lib/trial'

/**
 * Create a Stripe Checkout session for a logged-in trainer who needs to
 * (re)subscribe. Server-side enforces:
 *  - Plan must be in BILLABLE_PLANS (never 'ambassador').
 *  - Trial granted only once per account (profiles.trial_used_at).
 *  - Promo coupon logic:
 *      • If promo eligible AND no trial → apply coupon immediately at checkout
 *        (subscription_create is the first invoice; 12 months start from day 1).
 *      • If promo eligible AND trial given → do NOT apply coupon at checkout;
 *        the coupon will be applied by the webhook on trial_will_end (3 days
 *        before trial ends) so all 12 months cover PAID invoices, not trial days.
 *      • If not promo eligible → no coupon.
 *  - Stripe API pinned to 2025-02-24.acacia (last version with usage records).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { plan, buyer } = body as {
    plan: string
    buyer?: {
      type: 'private' | 'business'
      name: string
      email: string
      country: string
      address: string
      company: string
      oib: string
      invoiceEmail: string
    }
  }
  const resolvedPlan = BILLABLE_PLANS.includes(plan as Plan) ? (plan as Plan) : null
  if (!resolvedPlan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const planMeta = PLAN_META[resolvedPlan]
  const priceId = planMeta.stripePriceId
  if (!priceId) return NextResponse.json({ error: 'Plan nije konfiguriran.' }, { status: 500 })

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user } } = await adminDb.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existingSub } = await adminDb
    .from('subscriptions')
    .select('status, stripe_customer_id, is_ambassador')
    .eq('trainer_id', user.id)
    .maybeSingle()

  if (existingSub?.is_ambassador) {
    return NextResponse.json({ error: 'Ambassador račun ne može mijenjati plan.' }, { status: 403 })
  }
  if (existingSub?.status === 'active' || existingSub?.status === 'trialing') {
    return NextResponse.json({ error: 'Već imaš aktivnu pretplatu.' }, { status: 409 })
  }

  const stripe = createStripeClient()

  // Customer reuse: cancelled-then-resubscribed trainers must not create duplicate customers.
  let customerId = existingSub?.stripe_customer_id ?? null
  if (!customerId) {
    const { data: profile } = await adminDb
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const candidateEmail = profile?.email || user.email || ''
    if (candidateEmail) {
      const existingCustomers = await stripe.customers.list({ email: candidateEmail, limit: 1 })
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: candidateEmail,
        name:  profile?.full_name || '',
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
    }
  }

  // Trial eligibility — DB-backed, survives cancellation.
  const eligibleByDb = await isTrialEligible(adminDb, user.id)
  let eligibleByStripe = true
  if (eligibleByDb && customerId) {
    const priorSubs = await stripe.subscriptions.list({ customer: customerId, limit: 100, status: 'all' })
    eligibleByStripe = !priorSubs.data.some(s => (s as any).trial_start != null)
  }
  const grantTrial = eligibleByDb && eligibleByStripe

  // Promo eligibility — only for first-time subscribers while global promo date is active.
  // Cancelled users who already received promo are NOT eligible again (promo_granted_at IS NOT NULL).
  const grantPromo = !!(await isPromoEligible(adminDb, user.id)) && !!process.env.STRIPE_COUPON_FOUNDING

  // Coupon application strategy:
  //   • With trial: DEFER coupon to trial_will_end webhook (3 days before trial ends).
  //     Applying it now would make Stripe count trial days toward the 12 promo months.
  //   • Without trial: apply coupon immediately — subscription_create IS the first
  //     paid invoice and the 12 months start correctly from day 1.
  const applyCouponNow = grantPromo && !grantTrial

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: priceId, quantity: 1 }]
  if (resolvedPlan === 'scale' && planMeta.stripeOveragePriceId) {
    lineItems.push({ price: planMeta.stripeOveragePriceId })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unitlift.com'

  const session = await stripe.checkout.sessions.create({
    customer:                  customerId,
    mode:                      'subscription',
    payment_method_types:      ['card'],
    payment_method_collection: 'always',
    line_items:                lineItems,
    subscription_data: {
      ...(grantTrial ? { trial_period_days: 14 } : {}),
      metadata: {
        plan: resolvedPlan,
        supabase_user_id: user.id,
        // Buyer info stored on subscription for future invoice KPP entries
        buyer_type:  buyer?.type ?? 'private',
        buyer_name:  (buyer?.type === 'private' ? buyer?.name : buyer?.company) ?? '',
        buyer_oib:   buyer?.oib ?? '',
      },
    },
    // Promo is controlled SERVER-SIDE only. We never allow manual promotion codes.
    // Founding promo is applied by:
    //   • this checkout (when no trial — subscription_create is the first paid invoice)
    //   • OR the invoice.created webhook (when trial is granted — coupon is applied
    //     onto the first DRAFT paid invoice so the 12-month coupon clock starts
    //     exactly when the first paid period starts).
    ...(applyCouponNow ? {
      discounts: [{ coupon: process.env.STRIPE_COUPON_FOUNDING! }],
    } : {}),
    metadata: {
      plan:          resolvedPlan,
      supabase_user_id: user.id,
      granted_trial: grantTrial  ? '1' : '0',
      promo_granted: grantPromo  ? '1' : '0',
      // Buyer info for KPP entry creation in webhook
      buyer_type:    buyer?.type ?? 'private',
      buyer_name:    (buyer?.type === 'private' ? buyer?.name : buyer?.company) ?? '',
      buyer_oib:     buyer?.oib ?? '',
      buyer_address: buyer?.address ?? '',
      buyer_email:   (buyer?.type === 'business' ? buyer?.invoiceEmail : buyer?.email) ?? '',
    },
    success_url: `${appUrl}/dashboard?setup=pending`,
    cancel_url:  `${appUrl}/choose-plan`,
  })

  return NextResponse.json({ checkout_url: session.url, grantTrial, grantPromo })
}
