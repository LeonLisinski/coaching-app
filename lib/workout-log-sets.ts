/**
 * Mobile app saves workout_logs.plan_id as workout_plans.id (template id from active assignment),
 * not client_workout_plans.id — match on either id when linking logs to assignments.
 */

export type PlanIdHolder = {
  id: string
  workout_plan: { id: string; name: string }
}

/** True if log.plan_id refers to this client assignment (by row id or by linked template id). */
export function planIdMatchesAssignment(planId: string | null | undefined, a: PlanIdHolder): boolean {
  if (!planId) return false
  return planId === a.id || planId === a.workout_plan.id
}

export function findAssignmentForPlanId(
  planId: string | null | undefined,
  assignments: PlanIdHolder[],
): PlanIdHolder | undefined {
  if (!planId) return undefined
  return assignments.find(a => planIdMatchesAssignment(planId, a))
}

/**
 * Sets that should be shown / counted: mobile often has reps+weight filled without toggling `completed`.
 */
export function setsWithLoggedData(sets: unknown[] | undefined): { reps: number; weight: number }[] {
  if (!Array.isArray(sets)) return []
  const out: { reps: number; weight: number }[] = []
  for (const raw of sets) {
    const r = raw as { reps?: unknown; weight?: unknown; completed?: boolean }
    const rs = String(r?.reps ?? '').trim()
    const ws = String(r?.weight ?? '').trim()
    const reps = parseInt(rs, 10)
    const weight = parseFloat(ws)
    const completed = !!r?.completed
    if (rs !== '' && ws !== '' && !Number.isNaN(reps) && !Number.isNaN(weight)) {
      out.push({ reps, weight })
    } else if (completed && (rs !== '' || ws !== '')) {
      out.push({
        reps: Number.isNaN(reps) ? 0 : reps,
        weight: Number.isNaN(weight) ? 0 : weight,
      })
    }
  }
  return out
}

export function volumeFromSets(sets: { reps: number; weight: number }[]) {
  return sets.reduce((a, s) => a + s.reps * s.weight, 0)
}
