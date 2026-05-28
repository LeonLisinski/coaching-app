/**
 * One-time script: cancel all Stripe test-mode subscriptions before going live.
 *
 * Run ONCE before switching STRIPE_SECRET_KEY from test to live key:
 *   npx tsx scripts/cancel-test-stripe-subs.ts
 *
 * Requires:
 *   STRIPE_SECRET_KEY=sk_test_... (test mode key, NOT live)
 *
 * The script lists all subscriptions in test mode and cancels them.
 * It logs each cancellation so you can verify.
 * After running, the DB migration (billing_rework) has already migrated
 * all trainers to ambassador plan so they won't lose access.
 */

import Stripe from 'stripe'

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('ERROR: STRIPE_SECRET_KEY not set')
    process.exit(1)
  }
  if (!key.startsWith('sk_test_')) {
    console.error('ERROR: This script must only run with a TEST mode key (sk_test_...)')
    console.error('Current key prefix:', key.slice(0, 12))
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' as any })

  console.log('Fetching all test-mode subscriptions...')
  let canceled = 0
  let skipped = 0

  for await (const sub of stripe.subscriptions.list({ limit: 100, status: 'all' })) {
    if (sub.status === 'canceled') { skipped++; continue }

    try {
      await stripe.subscriptions.cancel(sub.id)
      console.log(`Canceled: ${sub.id} (${sub.status}) — customer: ${sub.customer}`)
      canceled++
    } catch (e: any) {
      console.error(`Failed to cancel ${sub.id}:`, e.message)
    }
  }

  console.log(`\nDone. Canceled: ${canceled}, Already canceled/skipped: ${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) })
