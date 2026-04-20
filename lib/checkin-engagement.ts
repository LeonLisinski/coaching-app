/**
 * Shared check-in engagement: status, weekly rate, and consistency score (0–100).
 * Used by dashboard, clients list, and server-side reminder logic.
 */

export function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type CheckinEngagementStatus = 'submitted' | 'late' | 'neutral'

export function getCheckinStatus(
  checkinDay: number | null,
  lastCheckin: string | null,
  today: Date = new Date(),
): CheckinEngagementStatus {
  if (checkinDay === null) return 'neutral'
  const rawDaysBack = (today.getDay() - checkinDay + 7) % 7

  if (rawDaysBack === 0) {
    if (!lastCheckin) return 'neutral'
    return lastCheckin >= isoDateLocal(today) ? 'submitted' : 'neutral'
  }

  const expected = new Date(today)
  expected.setDate(today.getDate() - rawDaysBack)
  const expectedStr = isoDateLocal(expected)

  if (!lastCheckin) return 'neutral'
  return lastCheckin >= expectedStr ? 'submitted' : 'late'
}

/** Expected weekly check-ins vs weeks since start; capped at 100. */
export function getCheckinRate(totalCheckins: number, startDate: string | null): number {
  if (!startDate) return 0
  const start = new Date(startDate)
  const now = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksActive = Math.max(1, Math.floor((now.getTime() - start.getTime()) / msPerWeek))
  return Math.min(100, Math.round((totalCheckins / weeksActive) * 100))
}

/** Alias: simple 0–100 engagement indicator (same formula as weekly check-in rate). */
export function consistencyScore(totalCheckins: number, startDate: string | null): number {
  return getCheckinRate(totalCheckins, startDate)
}
