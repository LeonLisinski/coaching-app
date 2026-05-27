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
    hidden:              false,
  },
  pro: {
    label:               'Pro',
    basePriceEur:        59,
    clientLimit:         30,
    stripePriceId:       process.env.STRIPE_PRICE_PRO,
    hidden:              false,
  },
  scale: {
    label:               'Scale',
    basePriceEur:        99,
    clientLimit:         75,
    stripePriceId:       process.env.STRIPE_PRICE_SCALE,
    stripeOveragePriceId: process.env.STRIPE_PRICE_SCALE_OVERAGE,
    overageBlockSize:    25,
    hidden:              false,
  },
}

/** Plans shown in the public pricing/choose-plan UI (excludes hidden) */
export const PUBLIC_PLANS = (Object.keys(PLAN_META) as Plan[]).filter(
  (p) => !PLAN_META[p].hidden,
)

/** Client limit for a plan — for ambassador returns Infinity for comparison */
export function getClientLimit(plan: Plan): number {
  return PLAN_META[plan].clientLimit ?? Infinity
}

/** Whether this subscription has unlimited clients (ambassador) */
export function isUnlimitedPlan(plan: Plan): boolean {
  return PLAN_META[plan].clientLimit === null
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
