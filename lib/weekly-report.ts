import type { SupabaseClient } from '@supabase/supabase-js'

import {
  isoDate,
} from '@/lib/client-tracking-week'
import {
  buildPlannedRows,
  logVolume,
  type TrainingAssignment,
  type TrainingWorkoutLog,
} from '@/lib/training-metrics'
import { exerciseDeltaKind, findExerciseMatch, findPreviousSameTrainingLog } from '@/lib/workout-session-compare'
import { setsWithLoggedData, volumeFromSets } from '@/lib/workout-log-sets'

// ─────────────────────────────────────────────────────────────────────────────
// Types — what gets persisted in client_weekly_reports.snapshot
// ─────────────────────────────────────────────────────────────────────────────

export type WeeklyReportRange = {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
  isPartial: boolean // < 7 days
  days: number       // inclusive day count
}

export type WeeklyReportSummary = {
  workoutsCompletedCount: number
  workoutsPlannedCount: number
  nutritionConfirmedDays: number
  nutritionTotalDays: number
  avgCalories: number | null
  avgProtein: number | null
  weightStart: number | null
  weightEnd: number | null
  weightDelta: number | null
  totalVolumeKg: number
}

export type WeeklySessionSummary = {
  id: string
  date: string
  dayName: string
  exerciseCount: number
  totalSetsCompleted: number
  totalVolumeKg: number
  topProgression: {
    exerciseName: string
    kind: 'up' | 'down' | 'flat'
    weightDelta: number | null
    repsDelta: number | null
  } | null
}

export type ExerciseHighlight = {
  exerciseName: string
  sessionDate: string
  weightDelta: number | null // can be 0 when reps drove the change
  repsDelta: number | null
  kind: 'up' | 'down' | 'flat'
}

export type WeeklyTrainings = {
  sessions: WeeklySessionSummary[]
  plannedDays: { date: string; dayName: string; logged: boolean; logId: string | null }[]
  bestProgressions: ExerciseHighlight[]
  biggestRegressions: ExerciseHighlight[]
  totalVolumeKg: number
  avgSessionVolumeKg: number | null
}

export type WeeklyNutritionDay = {
  date: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  confirmed: boolean
}

export type WeeklyNutrition = {
  days: WeeklyNutritionDay[]
  avgCalories: number | null
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  confirmedDays: number
  totalDays: number
  targets: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null
  bestDay: { date: string; calories: number } | null
  worstDay: { date: string; calories: number } | null
}

export type CheckinParameterSnapshot = {
  paramId: string
  paramName: string
  paramUnit: string | null
  paramType: string
  /** For weekly params: latest value within range. For daily params: most recent in range. */
  currentValue: unknown
  currentValueDate: string | null
  /** Numeric daily params get a small series for sparkline. Empty for non-numeric. */
  series: { date: string; value: number }[]
  /** Average of numeric daily params over range. Null when not applicable. */
  avgValue: number | null
}

export type CheckinPhotoEntry = {
  position: string
  /** Storage path within the `checkin-images` bucket. Sign-on-render. */
  storagePath: string
}

export type WeeklyPhotoSet = {
  checkinId: string
  date: string
  photos: CheckinPhotoEntry[]
}

export type WeeklyReportSnapshot = {
  schemaVersion: 1
  range: WeeklyReportRange
  client: {
    name: string
    goal: string | null
    weight: number | null
    height: number | null
  }
  trainer: {
    name: string
  } | null
  summary: WeeklyReportSummary
  trainings: WeeklyTrainings
  nutrition: WeeklyNutrition
  parameters: CheckinParameterSnapshot[]
  photoSets: WeeklyPhotoSet[]
  trainerNotes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Default range computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default range when trainer clicks "Kreiraj":
 *   - If today is checkin_day AND a checkin was submitted today
 *     → range = (penultimate_checkin + 1) .. ultimate_checkin (full last completed week)
 *   - Else if there is at least one prior checkin
 *     → range = (last_checkin + 1) .. today (partial since last checkin)
 *   - Else if there's a client.start_date
 *     → range = max(start_date, today-6) .. today
 *   - Else → range = today-6 .. today (rolling 7)
 */
export function computeDefaultRange(args: {
  today: string                     // ISO date
  checkinDay: number | null         // 0-6 (JS getDay)
  checkinDates: string[]            // ISO, any order
  clientStartDate?: string | null
}): WeeklyReportRange {
  const today = args.today
  const sorted = [...args.checkinDates]
    .filter(Boolean)
    .map(d => d.slice(0, 10))
    .sort() // ascending

  const todayDow = new Date(today + 'T12:00:00Z').getUTCDay()
  const todayIsCheckinDay = args.checkinDay != null && todayDow === args.checkinDay
  const todayHasCheckin = sorted.includes(today)

  if (todayIsCheckinDay && todayHasCheckin && sorted.length >= 2) {
    const last = sorted[sorted.length - 1]
    const penultimate = sorted[sorted.length - 2]
    const start = addDays(penultimate, 1)
    return makeRange(start, last)
  }

  const priorCheckins = sorted.filter(d => d < today)
  if (priorCheckins.length > 0) {
    const lastBeforeToday = priorCheckins[priorCheckins.length - 1]
    const start = addDays(lastBeforeToday, 1)
    if (start > today) return makeRange(today, today)
    return makeRange(start, today)
  }

  if (args.clientStartDate) {
    const sd = args.clientStartDate.slice(0, 10)
    const fallbackStart = addDays(today, -6)
    const start = sd > fallbackStart ? sd : fallbackStart
    return makeRange(start, today)
  }

  return makeRange(addDays(today, -6), today)
}

/** Pairs of consecutive checkin dates for the picker dropdown. */
export function checkinPairs(checkinDates: string[]): Array<{ start: string; end: string }> {
  const sorted = [...checkinDates].map(d => d.slice(0, 10)).sort()
  const out: Array<{ start: string; end: string }> = []
  for (let i = 1; i < sorted.length; i++) {
    out.push({ start: addDays(sorted[i - 1], 1), end: sorted[i] })
  }
  return out.reverse() // newest first
}

export function makeRange(start: string, end: string): WeeklyReportRange {
  const days = daysBetween(start, end) + 1
  return {
    start,
    end,
    isPartial: days < 7,
    days,
  }
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return isoDate(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00Z').getTime()
  const db = new Date(b + 'T12:00:00Z').getTime()
  return Math.round((db - da) / 86400000)
}

export function rangeDates(range: { start: string; end: string }): string[] {
  const out: string[] = []
  let cur = range.start
  while (cur <= range.end) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregator — builds the full WeeklyReportSnapshot
// ─────────────────────────────────────────────────────────────────────────────

type BuildOpts = {
  trainerNotes?: string | null
}

export async function buildWeeklyReportSnapshot(
  supabase: SupabaseClient,
  clientId: string,
  range: WeeklyReportRange,
  opts: BuildOpts = {},
): Promise<WeeklyReportSnapshot> {
  const { start, end } = range

  // Round 1 — fetch in parallel everything not depending on plan ids
  const [
    clientRes,
    workoutLogsRes,
    nutritionRes,
    checkinsRes,
    dailyLogsRes,
    paramsRes,
    workoutAssignmentsRes,
    mealAssignmentsRes,
    prevWorkoutLogsRes, // for exercise comparison vs previous same training
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, goal, weight, height, start_date, profile:user_id(full_name)')
      .eq('id', clientId)
      .maybeSingle(),
    supabase
      .from('workout_logs')
      .select('id, date, day_name, plan_id, exercises, trainer_id')
      .eq('client_id', clientId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
    supabase
      .from('nutrition_logs')
      .select('id, date, calories, protein, carbs, fat, confirmed, plan_id')
      .eq('client_id', clientId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
    supabase
      .from('checkins')
      .select('id, date, values, photo_urls, trainer_comment')
      .eq('client_id', clientId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
    supabase
      .from('daily_logs')
      .select('id, date, values')
      .eq('client_id', clientId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
    supabase
      .from('checkin_parameters')
      .select('id, name, type, unit, frequency, order_index'),
    supabase
      .from('client_workout_plans')
      .select('id, active, assigned_at, ended_at, days, workout_plan:workout_plans(id, name, days)')
      .eq('client_id', clientId),
    supabase
      .from('client_meal_plans')
      .select('id, active, assigned_at, plan_type, calories_target, protein_target, carbs_target, fat_target')
      .eq('client_id', clientId)
      .eq('active', true),
    // Previous workout logs (for exercise comparison): grab a generous window
    supabase
      .from('workout_logs')
      .select('id, date, day_name, plan_id, exercises')
      .eq('client_id', clientId)
      .lt('date', start)
      .order('date', { ascending: false })
      .limit(60),
  ])

  const clientRow = clientRes.data as
    | { goal: string | null; weight: number | null; height: number | null; start_date: string | null; profile?: { full_name?: string | null } | { full_name?: string | null }[] }
    | null
  const workoutLogs = (workoutLogsRes.data || []) as TrainingWorkoutLog[]
  const prevWorkoutLogs = (prevWorkoutLogsRes.data || []) as TrainingWorkoutLog[]
  const nutritionLogs = (nutritionRes.data || []) as Array<{
    id: string; date: string;
    calories: number | null; protein: number | null;
    carbs: number | null; fat: number | null;
    confirmed: boolean | null;
  }>
  const checkins = (checkinsRes.data || []) as Array<{
    id: string; date: string;
    values: Record<string, unknown> | null;
    photo_urls: Array<{ position: string; url: string }> | null;
    trainer_comment: string | null;
  }>
  const dailyLogs = (dailyLogsRes.data || []) as Array<{
    id: string; date: string; values: Record<string, unknown> | null;
  }>
  const allParams = (paramsRes.data || []) as Array<{
    id: string; name: string; type: string; unit: string | null;
    frequency: string | null; order_index: number | null;
  }>
  // Normalize the Supabase join result into TrainingAssignment shape.
  // workout_plan join can come back as object or single-element array depending on
  // how PostgREST resolves the relation; normalise to always be an object.
  const assignments: TrainingAssignment[] = (workoutAssignmentsRes.data || []).map((row: any) => {
    const wp = Array.isArray(row.workout_plan) ? row.workout_plan[0] : row.workout_plan
    return {
      id: row.id,
      active: row.active,
      assigned_at: row.assigned_at,
      ended_at: row.ended_at ?? null,
      days: row.days ?? null,
      workout_plan: wp ?? { id: '', name: '', days: [] },
    } satisfies TrainingAssignment
  })
  const mealAssignments = (mealAssignmentsRes.data || []) as Array<{
    plan_type: string | null;
    calories_target: number | null; protein_target: number | null;
    carbs_target: number | null; fat_target: number | null;
  }>

  const profileFullName = Array.isArray(clientRow?.profile)
    ? clientRow?.profile[0]?.full_name ?? null
    : clientRow?.profile?.full_name ?? null

  // ── Weight (start vs end) — pull from earliest/latest checkin or daily_log values
  // We can't be sure which parameter is "weight" without per-trainer config. Use a
  // simple heuristic: parameter named matching /tež|kg|weight/i with type 'number'.
  const weightParam = allParams.find(p =>
    p.type === 'number' && /tež|kg|weight/i.test(p.name),
  )
  const weightValuesInRange: { date: string; value: number }[] = []
  if (weightParam) {
    const collect = (rows: { date: string; values: Record<string, unknown> | null }[]) => {
      for (const r of rows) {
        const v = r.values?.[weightParam.id]
        const num = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
        if (!Number.isNaN(num)) weightValuesInRange.push({ date: r.date.slice(0, 10), value: num })
      }
    }
    collect(checkins)
    collect(dailyLogs)
    weightValuesInRange.sort((a, b) => a.date.localeCompare(b.date))
  }
  const weightStart = weightValuesInRange[0]?.value ?? null
  const weightEnd = weightValuesInRange[weightValuesInRange.length - 1]?.value ?? null
  const weightDelta = weightStart != null && weightEnd != null ? round1(weightEnd - weightStart) : null

  // ── Trainings
  const trainings = buildTrainingsSection(workoutLogs, prevWorkoutLogs, assignments, range)

  // ── Nutrition
  const nutrition = buildNutritionSection(nutritionLogs, range, mealAssignments)

  // ── Check-in parameters
  const parameters = buildParametersSection(allParams, checkins, dailyLogs, range)

  // ── Photos
  const photoSets: WeeklyPhotoSet[] = checkins
    .filter(c => Array.isArray(c.photo_urls) && c.photo_urls.length > 0)
    .map(c => ({
      checkinId: c.id,
      date: c.date.slice(0, 10),
      photos: (c.photo_urls || []).map(p => ({
        position: p.position,
        storagePath: p.url,
      })),
    }))

  // ── Summary (TL;DR)
  const summary: WeeklyReportSummary = {
    workoutsCompletedCount: trainings.sessions.length,
    workoutsPlannedCount: trainings.plannedDays.length,
    nutritionConfirmedDays: nutrition.confirmedDays,
    nutritionTotalDays: nutrition.totalDays,
    avgCalories: nutrition.avgCalories,
    avgProtein: nutrition.avgProtein,
    weightStart,
    weightEnd,
    weightDelta,
    totalVolumeKg: trainings.totalVolumeKg,
  }

  return {
    schemaVersion: 1,
    range,
    client: {
      name: profileFullName ?? '—',
      goal: clientRow?.goal ?? null,
      weight: clientRow?.weight ?? null,
      height: clientRow?.height ?? null,
    },
    trainer: null, // optionally populated by caller for a richer header
    summary,
    trainings,
    nutrition,
    parameters,
    photoSets,
    trainerNotes: opts.trainerNotes ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section builders
// ─────────────────────────────────────────────────────────────────────────────

function buildTrainingsSection(
  workoutLogs: TrainingWorkoutLog[],
  prevWorkoutLogs: TrainingWorkoutLog[],
  assignments: TrainingAssignment[],
  range: WeeklyReportRange,
): WeeklyTrainings {
  // Sessions: compute per-session top progression vs previous occurrence of same exercise
  const allLogsForCompare = [...workoutLogs, ...prevWorkoutLogs]

  const sessions: WeeklySessionSummary[] = workoutLogs.map(log => {
    const sets = (log.exercises || []).reduce(
      (n, ex) => n + setsWithLoggedData(ex.sets as unknown[]).length,
      0,
    )
    // Find best/worst exercise progression in this session
    const prevSession = findPreviousSameTrainingLog(
      { ...log, plan_id: log.plan_id ?? null } as TrainingWorkoutLog,
      allLogsForCompare,
    )
    let topProgression: WeeklySessionSummary['topProgression'] = null
    if (prevSession) {
      let bestScore = -Infinity
      for (const ex of log.exercises || []) {
        const prevEx = findExerciseMatch(prevSession, ex.name, ex.exercise_id)
        if (!prevEx) continue
        const delta = exerciseDeltaKind(ex, prevEx)
        if (delta.kind === 'first') continue
        const score =
          delta.kind === 'up'
            ? (delta.weightDelta || 0) * 10 + (delta.repsDelta || 0)
            : delta.kind === 'down'
              ? (delta.weightDelta || 0) * 10 + (delta.repsDelta || 0)
              : 0
        if (score > bestScore) {
          bestScore = score
          topProgression = {
            exerciseName: ex.name,
            kind: delta.kind,
            weightDelta: delta.weightDelta,
            repsDelta: delta.repsDelta,
          }
        }
      }
    }

    return {
      id: log.id,
      date: log.date.slice(0, 10),
      dayName: log.day_name || '',
      exerciseCount: (log.exercises || []).length,
      totalSetsCompleted: sets,
      totalVolumeKg: round1(logVolume(log)),
      topProgression,
    }
  })

  const totalVolume = sessions.reduce((acc, s) => acc + s.totalVolumeKg, 0)
  const avgSession = sessions.length > 0 ? round1(totalVolume / sessions.length) : null

  // Best progressions / regressions across all sessions in range
  type Highlight = ExerciseHighlight & { score: number }
  const highlights: Highlight[] = []
  for (const log of workoutLogs) {
    const prevSession = findPreviousSameTrainingLog(
      { ...log, plan_id: log.plan_id ?? null } as TrainingWorkoutLog,
      allLogsForCompare,
    )
    if (!prevSession) continue
    for (const ex of log.exercises || []) {
      const prevEx = findExerciseMatch(prevSession, ex.name, ex.exercise_id)
      if (!prevEx) continue
      const delta = exerciseDeltaKind(ex, prevEx)
      if (delta.kind === 'first' || delta.kind === 'flat') continue
      // Score = weight delta in kg (primary) + small reps bonus
      const score =
        (delta.weightDelta || 0) * 10 +
        (delta.repsDelta || 0) * 0.5
      highlights.push({
        exerciseName: ex.name,
        sessionDate: log.date.slice(0, 10),
        weightDelta: delta.weightDelta,
        repsDelta: delta.repsDelta,
        kind: delta.kind,
        score,
      })
    }
  }
  // Deduplicate by exercise (keep best |score| per exercise)
  const byEx = new Map<string, Highlight>()
  for (const h of highlights) {
    const cur = byEx.get(h.exerciseName)
    if (!cur || Math.abs(h.score) > Math.abs(cur.score)) byEx.set(h.exerciseName, h)
  }
  const dedup = [...byEx.values()]
  const bestProgressions = dedup
    .filter(h => h.kind === 'up')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _, ...rest }) => rest)
  const biggestRegressions = dedup
    .filter(h => h.kind === 'down')
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map(({ score: _, ...rest }) => rest)

  // Use the same buildPlannedRows logic that the training tracking tab uses.
  // This correctly matches logs by planIdMatchesAssignment + day_name, same as the UI.
  const planRows = buildPlannedRows(
    range.start,
    range.end,
    assignments,
    workoutLogs,
    n => `Dan ${n}`,
    () => '—',
    'Ostalo',
    'Stari plan',
  )
  const plannedDays: WeeklyTrainings['plannedDays'] = planRows
    .filter(r => !r.isOrphan)
    .map(r => ({
      date: r.log?.date?.slice(0, 10) ?? range.start, // planned rows without a log don't have a date
      dayName: r.trainingDayName,
      logged: r.log != null,
      logId: r.log?.id ?? null,
    }))

  return {
    sessions,
    plannedDays,
    bestProgressions,
    biggestRegressions,
    totalVolumeKg: round1(totalVolume),
    avgSessionVolumeKg: avgSession,
  }
}

function buildNutritionSection(
  nutritionLogs: Array<{
    date: string;
    calories: number | null; protein: number | null;
    carbs: number | null; fat: number | null;
    confirmed: boolean | null;
  }>,
  range: WeeklyReportRange,
  mealAssignments: Array<{
    plan_type: string | null;
    calories_target: number | null; protein_target: number | null;
    carbs_target: number | null; fat_target: number | null;
  }>,
): WeeklyNutrition {
  const allDates = rangeDates(range)
  const byDate = new Map(nutritionLogs.map(n => [n.date.slice(0, 10), n]))

  const days: WeeklyNutritionDay[] = allDates.map(d => {
    const row = byDate.get(d)
    return {
      date: d,
      calories: row?.calories ?? null,
      protein: row?.protein ?? null,
      carbs: row?.carbs ?? null,
      fat: row?.fat ?? null,
      confirmed: !!row?.confirmed,
    }
  })

  const confirmedDaysList = days.filter(d => d.confirmed)
  const confirmedNumeric = (key: 'calories' | 'protein' | 'carbs' | 'fat') => {
    const vals = confirmedDaysList.map(d => d[key]).filter((v): v is number => typeof v === 'number')
    if (!vals.length) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  // Targets — prefer 'default' meal plan, otherwise first active
  const targetsRow = mealAssignments.find(m => m.plan_type === 'default' || !m.plan_type) ?? mealAssignments[0] ?? null
  const targets = targetsRow ? {
    calories: targetsRow.calories_target,
    protein: targetsRow.protein_target,
    carbs: targetsRow.carbs_target,
    fat: targetsRow.fat_target,
  } : null

  let bestDay: WeeklyNutrition['bestDay'] = null
  let worstDay: WeeklyNutrition['worstDay'] = null
  if (targets?.calories) {
    let bestDelta = Infinity
    let worstDelta = -Infinity
    for (const d of confirmedDaysList) {
      if (typeof d.calories !== 'number') continue
      const delta = Math.abs(d.calories - targets.calories)
      if (delta < bestDelta) {
        bestDelta = delta
        bestDay = { date: d.date, calories: d.calories }
      }
      if (delta > worstDelta) {
        worstDelta = delta
        worstDay = { date: d.date, calories: d.calories }
      }
    }
  }

  return {
    days,
    avgCalories: confirmedNumeric('calories'),
    avgProtein: confirmedNumeric('protein'),
    avgCarbs: confirmedNumeric('carbs'),
    avgFat: confirmedNumeric('fat'),
    confirmedDays: confirmedDaysList.length,
    totalDays: days.length,
    targets,
    bestDay,
    worstDay,
  }
}

function buildParametersSection(
  allParams: Array<{
    id: string; name: string; type: string; unit: string | null;
    frequency: string | null; order_index: number | null;
  }>,
  checkins: Array<{ date: string; values: Record<string, unknown> | null }>,
  dailyLogs: Array<{ date: string; values: Record<string, unknown> | null }>,
  range: WeeklyReportRange,
): CheckinParameterSnapshot[] {
  return allParams
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(p => {
      const isWeekly = p.frequency === 'weekly'
      const sourceRows = isWeekly ? checkins : dailyLogs
      const valuesInRange: { date: string; value: unknown }[] = []
      for (const r of sourceRows) {
        const raw = r.values?.[p.id]
        if (raw == null || raw === '') continue
        valuesInRange.push({ date: r.date.slice(0, 10), value: raw })
      }
      valuesInRange.sort((a, b) => a.date.localeCompare(b.date))

      const latest = valuesInRange[valuesInRange.length - 1] ?? null

      let series: { date: string; value: number }[] = []
      let avg: number | null = null
      if (p.type === 'number' && valuesInRange.length > 0) {
        const numericVals = valuesInRange
          .map(v => {
            const n = typeof v.value === 'number'
              ? v.value
              : typeof v.value === 'string' ? parseFloat(v.value) : NaN
            return Number.isNaN(n) ? null : { date: v.date, value: n }
          })
          .filter((x): x is { date: string; value: number } => x != null)
        series = numericVals
        if (numericVals.length > 0) {
          avg = round1(numericVals.reduce((a, b) => a + b.value, 0) / numericVals.length)
        }
      }

      return {
        paramId: p.id,
        paramName: p.name,
        paramUnit: p.unit,
        paramType: p.type,
        currentValue: latest?.value ?? null,
        currentValueDate: latest?.date ?? null,
        series,
        avgValue: avg,
      }
    })
    // Drop params with no data in range — keep report focused
    .filter(p => p.currentValue != null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
