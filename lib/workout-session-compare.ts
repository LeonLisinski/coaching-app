import { TrainingWorkoutLog } from '@/lib/training-metrics'
import { setsWithLoggedData, volumeFromSets } from '@/lib/workout-log-sets'

const WEIGHT_EPS = 0.05
const VOL_EPS = 0.5

/** Same training slot: same day name + same plan link (or both without plan). */
export function isSameTrainingSlot(a: TrainingWorkoutLog, b: TrainingWorkoutLog): boolean {
  const na = (a.day_name || '').trim()
  const nb = (b.day_name || '').trim()
  if (na !== nb) return false
  if (!a.plan_id && !b.plan_id) return true
  return a.plan_id === b.plan_id
}

/** Latest log before `current` that matches the same training slot (same day + plan). */
export function findPreviousSameTrainingLog(
  current: TrainingWorkoutLog,
  allLogs: TrainingWorkoutLog[],
): TrainingWorkoutLog | null {
  const candidates = allLogs.filter(w => {
    if (w.id === current.id) return false
    if (w.date >= current.date) return false
    return isSameTrainingSlot(current, w)
  })
  if (!candidates.length) return null
  return candidates.sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function findExerciseMatch(
  log: TrainingWorkoutLog | null | undefined,
  name: string,
  exerciseId: string,
) {
  if (!log?.exercises?.length) return null
  if (exerciseId) {
    const byId = log.exercises.find(e => e.exercise_id === exerciseId)
    if (byId) return byId
  }
  const n = name.trim().toLowerCase()
  return log.exercises.find(e => (e.name || '').trim().toLowerCase() === n) ?? null
}

export function maxWeightInExercise(ex: { sets: unknown[] }) {
  const sets = setsWithLoggedData(ex.sets as unknown[])
  if (!sets.length) return null
  return Math.max(...sets.map(s => s.weight))
}

export function volumeInExercise(ex: { sets: unknown[] }) {
  return volumeFromSets(setsWithLoggedData(ex.sets as unknown[]))
}

export type MaxDeltaKind = 'up' | 'down' | 'flat' | 'first'

export function maxWeightDeltaKind(
  currentMax: number | null,
  previousMax: number | null,
): MaxDeltaKind {
  if (previousMax == null || currentMax == null) return 'first'
  const d = currentMax - previousMax
  if (d > WEIGHT_EPS) return 'up'
  if (d < -WEIGHT_EPS) return 'down'
  return 'flat'
}

export type SessionVerdict = 'better' | 'worse' | 'same'

export function sessionVolumeVerdict(
  currentVol: number,
  previousVol: number | null,
): SessionVerdict | null {
  if (previousVol == null) return null
  const d = currentVol - previousVol
  if (d > VOL_EPS) return 'better'
  if (d < -VOL_EPS) return 'worse'
  return 'same'
}

export { VOL_EPS }
