// ─── Single source of truth for all plan definitions ─────────────────────────
// Every API route, UI component and edge function must import from here.
// Never hardcode plan limits, prices or Stripe IDs anywhere else.

export const PLANS = ['ambassador', 'starter', 'pro', 'scale'] as const
export type Plan = (typeof PLANS)[number]

export interface PlanMeta {
  label: string
  basePriceEur: number        // 0 for ambassador
  clientLimit: number | null  // null = unlimited (ambassador)
  stripePriceId: string | undefined
  /** Only on 'scale' — metered overage price (+€10 / 25 clients above limit) */
  stripeOveragePriceId?: string
  /** Stripe Product ID — used to restrict the founding-promo coupon to UnitLift
   * Starter / Pro / Scale products. The Scale product contains BOTH the base
   * price and the metered overage price, so the coupon naturally applies to
   * both — that is the intended business behaviour. */
  stripeProductId?: string
  overageBlockSize?: number   // 25 for scale
  /** Hidden plans are not shown in the public choose-plan UI */
  hidden: boolean
}

export const PLAN_META: Record<Plan, PlanMeta> = {
  ambassador: {
    label:               'Ambassador',
    basePriceEur:        0,
    clientLimit:         null,
    stripePriceId:       undefined,
    hidden:              true,
  },
  starter: {
    label:               'Starter',
    basePriceEur:        29,
    clientLimit:         10,
    stripePriceId:       process.env.STRIPE_PRICE_STARTER,
    stripeProductId:     process.env.STRIPE_PRODUCT_STARTER,
    hidden:              false,
  },
  pro: {
    label:               'Pro',
    basePriceEur:        59,
    clientLimit:         30,
    stripePriceId:       process.env.STRIPE_PRICE_PRO,
    stripeProductId:     process.env.STRIPE_PRODUCT_PRO,
    hidden:              false,
  },
  scale: {
    label:               'Scale',
    basePriceEur:        99,
    clientLimit:         75,
    stripePriceId:       process.env.STRIPE_PRICE_SCALE,
    stripeProductId:     process.env.STRIPE_PRODUCT_SCALE,
    stripeOveragePriceId: process.env.STRIPE_PRICE_SCALE_OVERAGE,
    overageBlockSize:    25,
    hidden:              false,
  },
}

/** Plans shown in the public pricing/choose-plan UI (excludes hidden) */
export const PUBLIC_PLANS = (Object.keys(PLAN_META) as Plan[]).filter(
  (p) => !PLAN_META[p].hidden,
)

/** Plans a paying user can ever be on (excludes ambassador). Use for
 *  validating any plan value coming from the outside (webhook metadata,
 *  client request body, etc.). NEVER accept 'ambassador' from an external
 *  source. */
export const BILLABLE_PLANS: Plan[] = ['starter', 'pro', 'scale']

/** Client limit for a plan — for ambassador returns Infinity for comparison */
export function getClientLimit(plan: Plan): number {
  return PLAN_META[plan].clientLimit ?? Infinity
}

/** Whether this subscription has unlimited clients (ambassador) */
export function isUnlimitedPlan(plan: Plan): boolean {
  return PLAN_META[plan].clientLimit === null
}

/** Number of overage blocks for a given active client count on Scale.
 *  0 if at/under the base limit. */
export function scaleOverageBlocks(activeClientCount: number): number {
  const limit = PLAN_META['scale'].clientLimit ?? 75
  const blockSize = PLAN_META['scale'].overageBlockSize ?? 25
  return Math.max(0, Math.ceil((activeClientCount - limit) / blockSize))
}

/** True if going from `fromCount` → `toCount` on Scale would enter a new
 *  overage tier (75→76, 100→101, 125→126, etc.). Used to gate the
 *  add-client / activate confirmation dialog. */
export function scaleOverageTierIncreases(fromCount: number, toCount: number): boolean {
  return scaleOverageBlocks(toCount) > scaleOverageBlocks(fromCount)
}

/** Returns the next-higher plan in the ladder (used for upgrade prompts).
 *  null if already on Scale or ambassador. */
export function nextHigherPlan(plan: Plan): Plan | null {
  if (plan === 'starter') return 'pro'
  if (plan === 'pro')     return 'scale'
  return null
}

// ─── Legacy aliases (deprecated — use PLAN_META directly) ────────────────────
// Kept for backward compatibility during migration of old imports.
export const CLIENT_LIMITS: Record<string, number> = {
  starter: 10,
  pro:     30,
  scale:   75,
}

export const PLAN_PRICES: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  scale:   process.env.STRIPE_PRICE_SCALE,
}
