/**
 * Founding promo helpers.
 *
 * Set NEXT_PUBLIC_FOUNDING_PROMO_END to an ISO-8601 date string (e.g. "2026-07-01T00:00:00Z")
 * to define when the 50%-off founding offer expires.
 * Leave unset (or empty) to disable the promo entirely.
 */

export function isFoundingPromoActive(): boolean {
  const end = process.env.NEXT_PUBLIC_FOUNDING_PROMO_END
  if (!end) return false
  return Date.now() < new Date(end).getTime()
}

/** Human-readable end date for displaying in banners (locale-aware) */
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
