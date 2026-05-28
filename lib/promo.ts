import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns true if the founding promo is still open for NEW sign-ups.
 * Existing users who already received their promo right keep it even after
 * this date — this only gates NEW grants.
 */
export function isFoundingPromoActive(): boolean {
  const end = process.env.NEXT_PUBLIC_FOUNDING_PROMO_END
  if (!end) return false
  return Date.now() < new Date(end).getTime()
}

/** Human-readable end date for UI banners */
export function foundingPromoEndDate(locale: string = 'hr'): string | null {
  const end = process.env.NEXT_PUBLIC_FOUNDING_PROMO_END
  if (!end) return null
  try {
    return new Date(end).toLocaleDateString(locale === 'en' ? 'en-GB' : 'hr-HR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return end
  }
}

/**
 * Returns true if the user is currently within their 12-month promo period.
 * Checks the DB-stored promo_ends_at (not Stripe coupon state).
 */
export function isInPromo(sub: {
  promo_ends_at?: string | null
  promo_lost_at?: string | null
} | null | undefined): boolean {
  if (!sub?.promo_ends_at) return false
  if (sub.promo_lost_at) return false
  return Date.now() < new Date(sub.promo_ends_at).getTime()
}

/**
 * Fetch promo state for the given trainer from the DB.
 * Returns null if no subscription row exists.
 */
export async function getPromoState(
  adminDb: SupabaseClient,
  trainerId: string,
): Promise<{
  promo_granted_at: string | null
  promo_paid_period_started_at: string | null
  promo_ends_at: string | null
  promo_lost_at: string | null
} | null> {
  const { data } = await adminDb
    .from('subscriptions')
    .select('promo_granted_at, promo_paid_period_started_at, promo_ends_at, promo_lost_at')
    .eq('trainer_id', trainerId)
    .maybeSingle()
  return data ?? null
}

/**
 * Whether this user is eligible to receive a promo grant right now.
 * Conditions:
 *   1. Global promo date has not passed.
 *   2. User has never been granted promo before (promo_granted_at IS NULL).
 * Once promo_granted_at is set, it is never cleared — even after cancellation.
 */
export async function isPromoEligible(
  adminDb: SupabaseClient,
  trainerId: string,
): Promise<boolean> {
  if (!isFoundingPromoActive()) return false
  const state = await getPromoState(adminDb, trainerId)
  // No subscription row yet = new user, eligible.
  if (!state) return true
  // Already got promo at some point → not eligible again.
  return !state.promo_granted_at
}
