/**
 * Cron reminders must use the same calendar day + weekday as trainers/clients (e.g. Europe/Zagreb),
 * not raw UTC — otherwise "danas" u HR i u Vercel UTC-u nisu isti dan → nema check-in mailova.
 *
 * Postavi REMINDER_TIMEZONE=npr. Europe/Zagreb na Vercelu ako želiš eksplicitno.
 */

const WEEKDAY_SHORT_TO_JS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function getReminderCalendar(
  now = new Date(),
  timeZone = process.env.REMINDER_TIMEZONE || 'Europe/Zagreb',
): { todayStr: string; todayDow: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = dtf.formatToParts(now)
  let year = ''
  let month = ''
  let day = ''
  let weekday = ''
  for (const p of parts) {
    if (p.type === 'year') year = p.value
    if (p.type === 'month') month = p.value
    if (p.type === 'day') day = p.value
    if (p.type === 'weekday') weekday = p.value
  }
  const todayStr = `${year}-${month}-${day}`
  const todayDow = WEEKDAY_SHORT_TO_JS[weekday] ?? new Date().getDay()
  return { todayStr, todayDow }
}

/** Broj kalendarskih dana od todayYmd do endDateStr (oba YYYY-MM-DD). */
export function daysFromTodayToEndDate(endDateStr: string, todayYmd: string): number {
  const [ey, em, ed] = endDateStr.split('-').map(Number)
  const [ty, tm, td] = todayYmd.split('-').map(Number)
  const end = Date.UTC(ey, em - 1, ed)
  const start = Date.UTC(ty, tm - 1, td)
  return Math.round((end - start) / 86400000)
}

/** ISO tjedan za kalendarski dan todayYmd (stabilan dedupe za plaćanja). */
export function getIsoWeekFromYmd(todayYmd: string): number {
  const [y, m, d] = todayYmd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((+t - +y0) / 86400000 + 1) / 7)
}
