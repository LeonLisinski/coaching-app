import Stripe from 'stripe'

/**
 * Returns a Stripe client pinned to 2025-02-24.acacia — the last API version
 * that supports the legacy `createUsageRecord` endpoint used for Scale overage
 * (aggregate_usage='max'). The cast to `any` is required because the SDK's
 * TypeScript types only expose the current latest version string.
 */
export function createStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: '2025-02-24.acacia' as any,
  })
}
