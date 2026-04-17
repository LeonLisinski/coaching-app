import { assignmentForDate, assignmentOverlapsWeek, dateOnly } from '@/lib/client-tracking-week'
import { planIdMatchesAssignment, setsWithLoggedData, volumeFromSets } from '@/lib/workout-log-sets'

export type TrainingAssignment = {
  id: string
  active: boolean
  assigned_at: string
  ended_at: string | null
  days: any[] | null
  workout_plan: { id: string; name: string; days: any[] }
}

export type TrainingWorkoutLog = {
  id: string
  date: string
  day_name: string
  plan_id: string | null
  exercises: { name: string; exercise_id: string; sets: unknown[] }[]
}

export function logVolume(log: TrainingWorkoutLog) {
  return (log.exercises || []).reduce((acc, ex) => {
    const cs = setsWithLoggedData(ex.sets as unknown[])
    return acc + volumeFromSets(cs)
  }, 0)
}

function effectiveDays(a: TrainingAssignment) {
  const d = a.days?.length ? a.days : a.workout_plan?.days
  return Array.isArray(d) ? d : []
}

export function mondayKeyOfDateStr(iso: string): string {
  const dt = new Date(iso.slice(0, 10))
  const day = dt.getDay()
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(dt)
  mon.setDate(diff)
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
}

export function volumeByWeek(logs: TrainingWorkoutLog[]): Map<string, number> {
  const m = new Map<string, number>()
  logs.forEach(log => {
    const k = mondayKeyOfDateStr(log.date)
    m.set(k, (m.get(k) || 0) + logVolume(log))
  })
  return m
}

/** Per-exercise: chronological sessions with max weight & volume per session */
export function exerciseSessionSeries(logs: TrainingWorkoutLog[]) {
  const map = new Map<string, { date: string; maxW: number; vol: number }[]>()
  logs.forEach(log => {
    log.exercises?.forEach(ex => {
      const cs = setsWithLoggedData(ex.sets as unknown[])
      if (!cs.length) return
      const maxW = Math.max(...cs.map(s => s.weight))
      const vol = volumeFromSets(cs)
      if (!map.has(ex.name)) map.set(ex.name, [])
      map.get(ex.name)!.push({ date: log.date, maxW, vol })
    })
  })
  map.forEach(v => v.sort((a, b) => a.date.localeCompare(b.date)))
  return map
}

export type TrendKind = 'up' | 'down' | 'flat'

export function volumeTrendThisVsLast(
  logs: TrainingWorkoutLog[],
  thisWeekStart: string,
  thisWeekEnd: string,
  lastWeekStart: string,
  lastWeekEnd: string,
): { thisVol: number; lastVol: number; pct: number | null; trend: TrendKind } {
  let thisVol = 0
  let lastVol = 0
  logs.forEach(log => {
    const d = log.date.slice(0, 10)
    const v = logVolume(log)
    if (d >= thisWeekStart && d <= thisWeekEnd) thisVol += v
    if (d >= lastWeekStart && d <= lastWeekEnd) lastVol += v
  })
  if (lastVol <= 0 && thisVol <= 0) return { thisVol, lastVol, pct: null, trend: 'flat' }
  if (lastVol <= 0) return { thisVol, lastVol, pct: null, trend: 'up' }
  const pct = ((thisVol - lastVol) / lastVol) * 100
  let trend: TrendKind = 'flat'
  if (pct > 5) trend = 'up'
  else if (pct < -5) trend = 'down'
  return { thisVol, lastVol, pct, trend }
}

/** Most recent PR event (latest date when any exercise set a new max). */
export function latestPrEvent(logs: TrainingWorkoutLog[]): {
  exerciseName: string
  weight: number
  date: string
} | null {
  const series = exerciseSessionSeries(logs)
  const events: { exerciseName: string; weight: number; date: string }[] = []
  series.forEach((sessions, name) => {
    let maxSoFar = 0
    sessions.forEach(s => {
      if (s.maxW > maxSoFar) {
        maxSoFar = s.maxW
        events.push({ exerciseName: name, weight: s.maxW, date: s.date })
      }
    })
  })
  if (!events.length) return null
  return events.sort((a, b) => b.date.localeCompare(a.date))[0]
}

/** Global trend from last 4 weeks avg volume vs previous 4 weeks avg (if enough data). */
export function longTrendFromWeeklyVolumes(volByWeek: Map<string, number>): TrendKind {
  const keys = [...volByWeek.keys()].sort()
  if (keys.length < 4) return 'flat'
  const last4 = keys.slice(-4)
  const prev4 = keys.slice(-8, -4)
  if (prev4.length < 4) return 'flat'
  const avg = (ks: string[]) => ks.reduce((a, k) => a + (volByWeek.get(k) || 0), 0) / ks.length
  const aLast = avg(last4)
  const aPrev = avg(prev4)
  if (aPrev <= 0) return 'flat'
  const pct = ((aLast - aPrev) / aPrev) * 100
  if (pct > 5) return 'up'
  if (pct < -5) return 'down'
  return 'flat'
}

export type PlannedRow = {
  key: string
  assignmentId: string
  planName: string
  trainingDayName: string
  dayNumber: number
  log: TrainingWorkoutLog | null
  isOrphan?: boolean
}

export function buildPlannedRows(
  weekStart: string,
  weekEnd: string,
  assignments: TrainingAssignment[],
  workouts: TrainingWorkoutLog[],
  dayNumberLabel: (n: number) => string,
  findPlanName: (planId: string | null) => string,
  otherDayLabel: string,
  legacyPlanLabel: string,
): PlannedRow[] {
  const logsInWeek = workouts.filter(w => w.date >= weekStart && w.date <= weekEnd)
  const overlapping = assignments.filter(a => assignmentOverlapsWeek(a, weekStart, weekEnd))
  const rows: PlannedRow[] = []
  const matchedLogIds = new Set<string>()

  overlapping
    .sort((a, b) => a.assigned_at.localeCompare(b.assigned_at))
    .forEach(a => {
      const days = effectiveDays(a)
      days.forEach((day: any, idx: number) => {
        const trainingDayName = (day.name && String(day.name).trim()) || dayNumberLabel(idx + 1)
        const dayNumber = typeof day.day_number === 'number' ? day.day_number : idx + 1
        const candidates = logsInWeek.filter(w => {
          if (!planIdMatchesAssignment(w.plan_id, a)) return false
          if (
            w.day_name !== trainingDayName &&
            !(w.day_name && w.day_name.trim() === trainingDayName)
          ) {
            return false
          }
          const cover = assignmentForDate(w.date.slice(0, 10), assignments)
          return cover?.id === a.id
        })
        const log =
          candidates.length === 0
            ? null
            : candidates.sort((x, y) => y.date.localeCompare(x.date))[0]
        if (log) matchedLogIds.add(log.id)
        rows.push({
          key: `plan-${a.id}-${trainingDayName}-${dayNumber}`,
          assignmentId: a.id,
          planName: a.workout_plan.name,
          trainingDayName,
          dayNumber,
          log,
        })
      })
    })

  logsInWeek.forEach(w => {
    if (matchedLogIds.has(w.id)) return
    const day = dateOnly(w.date)
    const cover = assignmentForDate(day, assignments)
    const planName =
      cover?.workout_plan?.name ??
      (w.plan_id ? findPlanName(w.plan_id) : legacyPlanLabel)
    rows.push({
      key: `orphan-${w.id}`,
      assignmentId: cover?.id ?? w.plan_id ?? '',
      planName,
      trainingDayName: w.day_name || otherDayLabel,
      dayNumber: 0,
      log: w,
      isOrphan: true,
    })
  })

  return rows.sort((a, b) => {
    if (a.isOrphan !== b.isOrphan) return a.isOrphan ? 1 : -1
    if (a.isOrphan && b.isOrphan && a.log && b.log) {
      return a.log.date.localeCompare(b.log.date)
    }
    const ai = assignments.find(x => x.id === a.assignmentId)?.assigned_at || ''
    const bi = assignments.find(x => x.id === b.assignmentId)?.assigned_at || ''
    if (ai !== bi) return ai.localeCompare(bi)
    return a.dayNumber - b.dayNumber
  })
}

export function countPlannedVsDone(rows: PlannedRow[]) {
  const planned = rows.filter(r => !r.isOrphan)
  const done = planned.filter(r => r.log)
  return { planned: planned.length, done: done.length }
}

export function logsForAssignment(
  a: TrainingAssignment,
  allAssignments: TrainingAssignment[],
  allLogs: TrainingWorkoutLog[],
): TrainingWorkoutLog[] {
  return allLogs.filter(w => {
    const cover = assignmentForDate(w.date.slice(0, 10), allAssignments)
    return cover?.id === a.id
  })
}

export type ExerciseProgressRow = {
  name: string
  improvement: number
  firstMax: number
  lastMax: number
  sessionCount: number
  status: 'up' | 'flat' | 'down'
}

/** Sort by improvement descending; stagnation (≈0) marked flat. */
export function exerciseProgressRows(logs: TrainingWorkoutLog[]): ExerciseProgressRow[] {
  const series = exerciseSessionSeries(logs)
  const rows: ExerciseProgressRow[] = []
  const EPS = 0.25
  series.forEach((sessions, name) => {
    if (!sessions.length) return
    const first = sessions[0]
    const last = sessions[sessions.length - 1]
    const improvement = last.maxW - first.maxW
    let status: ExerciseProgressRow['status'] = 'flat'
    if (improvement > EPS) status = 'up'
    else if (improvement < -EPS) status = 'down'
    rows.push({
      name,
      improvement,
      firstMax: first.maxW,
      lastMax: last.maxW,
      sessionCount: sessions.length,
      status,
    })
  })
  return rows.sort((a, b) => b.improvement - a.improvement)
}

/** Name used in logs for this exercise id (matches keys in exerciseSessionSeries). */
export function logSeriesNameForExerciseId(
  logs: TrainingWorkoutLog[],
  exerciseId: string,
  fallbackName: string,
): string {
  for (const log of logs) {
    for (const ex of log.exercises || []) {
      if (ex.exercise_id === exerciseId && String(ex.name || '').trim()) {
        return ex.name.trim()
      }
    }
  }
  return fallbackName.trim()
}
