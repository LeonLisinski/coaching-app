export const PLANS = ['starter', 'pro', 'scale'] as const
export type Plan = typeof PLANS[number]

export const CLIENT_LIMITS: Record<Plan, number> = {
  starter: 15,
  pro:     50,
  scale:   150,
}

export const PLAN_PRICES: Record<Plan, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  scale:   process.env.STRIPE_PRICE_SCALE,
}
