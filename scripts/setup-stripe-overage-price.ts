/**
 * One-time setup script: create the Scale Overage metered price in Stripe
 * using the legacy metered billing API pinned to version 2025-02-24.acacia.
 *
 * IMPORTANT: The overage price is the SECOND price attached to the existing
 * UnitLift Scale product (STRIPE_PRODUCT_SCALE). It is NOT a separate product.
 * This is intentional so the founding-promo coupon — which applies_to the
 * UnitLift Scale product — automatically discounts BOTH the base recurring
 * price (99 €/mo) AND this metered overage price during the promo period.
 *
 * WHY THIS SCRIPT EXISTS:
 *   As of Stripe API version 2025-03-31.basil, you can no longer create a
 *   price with usage_type='metered' via the Dashboard UI or the new API
 *   without backing it by a Billing Meter. Stripe's newer Billing Meters
 *   do not support 'max' aggregation (only sum/count/last_during_period).
 *   UnitLift needs 'max' to bill for the PEAK reached in a period, so the
 *   legacy API is intentionally used and this script pins version
 *   2025-02-24.acacia to ensure the request goes through.
 *
 * USAGE:
 *   1. Set env vars in .env.local (test mode first):
 *        STRIPE_SECRET_KEY=sk_test_...
 *        STRIPE_PRODUCT_SCALE=prod_...   (the existing UnitLift Scale product)
 *   2. Run: npx tsx scripts/setup-stripe-overage-price.ts
 *   3. Copy the printed price ID (price_...) into your env vars:
 *        STRIPE_PRICE_SCALE_OVERAGE=price_...
 *   4. Repeat in live mode with sk_live_... and the live STRIPE_PRODUCT_SCALE.
 *
 * The script is idempotent in the sense that running it twice creates a second
 * price — you can archive the duplicate in the Stripe Dashboard if needed.
 */

import 'dotenv/config'
import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY
const scaleProductId = process.env.STRIPE_PRODUCT_SCALE

if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY is not set.')
  process.exit(1)
}
if (!scaleProductId) {
  console.error('STRIPE_PRODUCT_SCALE is not set. Create the Scale product first and set its ID.')
  process.exit(1)
}

const isLive = stripeKey.startsWith('sk_live_')
console.log(`Using ${isLive ? 'LIVE' : 'TEST'} mode key.`)
console.log(`Scale product ID: ${scaleProductId}`)

// CRITICAL: pin to 2025-02-24.acacia — the LAST version that supports
// creating a metered price with aggregate_usage='max'.
// Do NOT change this version without first migrating to a different billing model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any })

async function main() {
  console.log('\nCreating Scale Overage metered price...')

  const price = await (stripe as any).prices.create({
    product:    scaleProductId,
    currency:   'eur',
    unit_amount: 1000,   // €10.00 in cents
    recurring: {
      interval:       'month',
      usage_type:     'metered',
      aggregate_usage: 'max',
    },
    nickname: 'Scale Overage +€10/25 clients (max aggregation)',
  })

  console.log('\n✓ Scale Overage price created successfully.')
  console.log(`  Price ID: ${price.id}`)
  console.log(`  Amount: €${(price.unit_amount / 100).toFixed(2)} / month`)
  console.log(`  Aggregation: ${price.recurring?.aggregate_usage}`)
  console.log('\nAdd this to your env vars:')
  console.log(`  STRIPE_PRICE_SCALE_OVERAGE=${price.id}`)

  if (!isLive) {
    console.log('\nYou are in TEST mode. Remember to repeat this for LIVE mode.')
  }
}

main().catch((err) => {
  console.error('\n✗ Failed to create price:', err.message)
  if (err.message?.includes('aggregate_usage')) {
    console.error(
      '\nHint: Stripe rejected the aggregate_usage parameter. This may mean your',
      '\nStripe account is on an API version that no longer supports legacy metered',
      '\nprices. Ensure this script is pinned to 2025-02-24.acacia (check the stripe',
      '\nclient initialization above) and that you have not globally upgraded your',
      '\nStripe Dashboard API version past 2025-02-24.acacia.',
    )
  }
  process.exit(1)
})
