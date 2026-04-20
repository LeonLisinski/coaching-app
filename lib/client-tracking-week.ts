/** Shared week bounds for Tracking (nutrition + training) — aligned with check-in week. */

/** Koliko tjedana u prošlost UI smije ići (klizni prozor). */
export const MAX_WEEK_OFFSET_BACK = -12

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Pronalazi weekOffset (≤ 0) tako da getWeekDays(checkinDay, w) sadrži target datum.
 * Za „jučer“, „pred 2 dana“ itd. da bi korisnik vidio isti tjedan kao i za prehranu.
 */
export function findWeekOffsetForDate(
  checkinDay: number,
  target: Date,
  maxBackWeeks = 52,
): number | null {
  const t = new Date(target)
  t.setHours(12, 0, 0, 0)
  const targetIso = isoDate(t)
  for (let w = 0; w >= -maxBackWeeks; w--) {
    const days = getWeekDays(checkinDay, w)
    const start = isoDate(days[0])
    const end = isoDate(days[6])
    if (targetIso >= start && targetIso <= end) return w
  }
  return null
}

export function getWeekDays(checkinDay: number, weekOffset: number): Date[] {
  const today = new Date()
  const daysUntil = (checkinDay - today.getDay() + 7) % 7
  const baseEnd = new Date(today)
  baseEnd.setDate(today.getDate() + daysUntil + weekOffset * 7)
  baseEnd.setHours(23, 59, 59, 999)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseEnd)
    d.setDate(baseEnd.getDate() - 6 + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

/** Assignment covering calendar date (YYYY-MM-DD). */
export function assignmentForDate<T extends { assigned_at: string; ended_at: string | null }>(
  isoDay: string,
  assignments: T[],
): T | null {
  const hits = assignments.filter(a => {
    const s = dateOnly(a.assigned_at)
    const e = a.ended_at ? dateOnly(a.ended_at) : '9999-12-31'
    return isoDay >= s && isoDay <= e
  })
  if (hits.length === 0) return null
  if (hits.length === 1) return hits[0]
  return hits.sort((a, b) => b.assigned_at.localeCompare(a.assigned_at))[0]
}

/** True if assignment interval intersects [weekStart, weekEnd] (inclusive, date strings). */
export function assignmentOverlapsWeek(
  a: { assigned_at: string; ended_at: string | null },
  weekStart: string,
  weekEnd: string,
): boolean {
  const s = dateOnly(a.assigned_at)
  const e = a.ended_at ? dateOnly(a.ended_at) : '9999-12-31'
  return !(e < weekStart || s > weekEnd)
}

export { dateOnly }
