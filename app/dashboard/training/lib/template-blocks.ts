// ─── Template block data model ────────────────────────────────────────────────
// workout_templates.exercises is a JSONB array of TemplateItem[].
// Old records have no `kind` field and are treated as 'exercise' (backward compat).

export type ExerciseOption = {
  id: string
  name: string
  category: string
  primary_muscles?: string[]
  muscle_group?: string
  video_url?: string
  exercise_type?: string
  section?: 'main' | 'warmup'
  media_type?: 'youtube' | 'video' | 'image' | null
  media_path?: string | null
}

export type TemplateExercise = {
  kind?: 'exercise'
  exercise_id: string
  name: string
  sets: number            // 0 = inherit block.rounds when inside a block
  reps: string
  rest_seconds: number
  notes: string
  extras?: Record<string, string>
  video_url?: string
  section?: 'main' | 'warmup'
  media_type?: 'youtube' | 'video' | 'image' | null
  media_path?: string | null
}

export type TemplateBlock = {
  kind: 'block'
  block_id: string
  label?: string
  rounds: number
  rest_between_exercises: number  // seconds between exercises in a round
  rest_between_rounds: number     // seconds after completing one full round
  notes?: string
  exercises: TemplateExercise[]   // 2..N
}

export type TemplateItem = TemplateExercise | TemplateBlock

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isBlock(item: TemplateItem): item is TemplateBlock {
  return (item as TemplateBlock).kind === 'block'
}

export function isExercise(item: TemplateItem): item is TemplateExercise {
  return !isBlock(item)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all leaf exercises, unwrapping blocks. Used for summary counts. */
export function flattenExercises(items: TemplateItem[]): TemplateExercise[] {
  const result: TemplateExercise[] = []
  for (const item of items) {
    if (isBlock(item)) {
      result.push(...item.exercises)
    } else {
      result.push(item)
    }
  }
  return result
}

/** All exercise IDs in use (root + inside blocks). Used to avoid duplicates. */
export function getAllUsedExerciseIds(items: TemplateItem[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (isBlock(item)) {
      item.exercises.forEach(e => ids.add(e.exercise_id))
    } else {
      ids.add(item.exercise_id)
    }
  }
  return ids
}

/** Stable DnD ID for a root-level item. */
export function getItemDndId(item: TemplateItem): string {
  return isBlock(item) ? item.block_id : item.exercise_id
}

/** Creates a new empty block with sensible defaults. */
export function createEmptyBlock(existingBlockCount: number): TemplateBlock {
  const letter = String.fromCharCode(65 + (existingBlockCount % 26)) // A, B, C…
  return {
    kind: 'block',
    block_id: crypto.randomUUID(),
    label: `Superset ${letter}`,
    rounds: 3,
    rest_between_exercises: 15,
    rest_between_rounds: 90,
    exercises: [],
  }
}

/** Cast legacy exercise arrays (no `kind` field) to the new union type. No-op at runtime. */
export function migrateLegacy(items: any[]): TemplateItem[] {
  return items as TemplateItem[]
}

/** Build a new TemplateExercise from an ExerciseOption with given defaults. */
export function exerciseFromOption(
  opt: ExerciseOption,
  defaults: { sets: number; reps: string; rest_seconds: number },
  forBlock = false,
): TemplateExercise {
  return {
    exercise_id: opt.id,
    name: opt.name,
    sets: forBlock ? 0 : defaults.sets,
    reps: defaults.reps,
    rest_seconds: forBlock ? 0 : defaults.rest_seconds,
    notes: '',
    extras: {},
    video_url: opt.video_url || '',
    section: (opt.section as 'main' | 'warmup') || 'main',
    media_type: opt.media_type ?? null,
    media_path: opt.media_path ?? null,
  }
}
