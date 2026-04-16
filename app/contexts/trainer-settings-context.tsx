'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

// ── Shared types & constants ──────────────────────────────────────────────────

export type WorkoutDefaults = {
  sets: number
  reps: string
  rest_seconds: number
  [key: string]: any
}

export const DEFAULT_WORKOUT_DEFAULTS: WorkoutDefaults = {
  sets: 3,
  reps: '10',
  rest_seconds: 60,
}

export type TrainerSettings = {
  nutritionFields: string[]
  exerciseFields: string[]
  workoutDefaults: WorkoutDefaults
}

export const NUTRITION_FIELD_OPTIONS = [
  { key: 'fiber',         label: 'Vlakna',         unit: 'g' },
  { key: 'sugar',         label: 'Šećeri',         unit: 'g' },
  { key: 'sodium',        label: 'Natrij',         unit: 'mg' },
  { key: 'salt',          label: 'Sol',            unit: 'g' },
  { key: 'potassium',     label: 'Kalij',          unit: 'mg' },
  { key: 'saturated_fat', label: 'Zasićene masti', unit: 'g' },
  { key: 'cholesterol',   label: 'Kolesterol',     unit: 'mg' },
  { key: 'vitamin_c',     label: 'Vitamin C',      unit: 'mg' },
  { key: 'calcium',       label: 'Kalcij',         unit: 'mg' },
  { key: 'iron',          label: 'Željezo',        unit: 'mg' },
]

export const EXERCISE_FIELD_OPTIONS: { key: string; label: string; desc: string; unit?: string }[] = [
  { key: 'rir',      label: 'RIR',      desc: 'Reps In Reserve' },
  { key: 'rpe',      label: 'RPE',      desc: 'Rate of Perceived Exertion' },
  { key: 'tempo',    label: 'Tempo',    desc: 'Tempo' },
  { key: 'duration', label: 'Duration', desc: 'Duration', unit: 'min' },
  { key: 'distance', label: 'Distance', desc: 'Distance', unit: 'km/m' },
]

// ── Context ───────────────────────────────────────────────────────────────────

type TrainerSettingsContextType = {
  userId: string | null
  settings: TrainerSettings
  loading: boolean
  refresh: () => Promise<void>
}

const DEFAULT_SETTINGS: TrainerSettings = {
  nutritionFields: [],
  exerciseFields: [],
  workoutDefaults: DEFAULT_WORKOUT_DEFAULTS,
}

const TrainerSettingsContext = createContext<TrainerSettingsContextType>({
  userId: null,
  settings: DEFAULT_SETTINGS,
  loading: true,
  refresh: async () => {},
})

export function TrainerSettingsProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [settings, setSettings] = useState<TrainerSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async (uid: string) => {
    // Use select('*') so the query never fails if a new column (e.g. workout_defaults)
    // hasn't been added via migration yet — the key will simply be undefined.
    const { data, error } = await supabase
      .from('trainer_profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) console.error('[TrainerSettings] load error:', error.message)
    if (data) {
      const wd = { ...DEFAULT_WORKOUT_DEFAULTS, ...(data.workout_defaults || {}) }
      console.log('[TrainerSettings] loaded workout_defaults from DB:', data.workout_defaults, '→ merged:', wd)
      setSettings({
        nutritionFields: data.nutrition_fields || [],
        exerciseFields:  data.exercise_fields  || [],
        workoutDefaults: wd,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // getSession() reads from local storage — no network request, no auth lock
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      if (uid) {
        loadSettings(uid)
      } else {
        setLoading(false)
      }
    })

    // Keep in sync when auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      if (uid) loadSettings(uid)
    })
    return () => subscription.unsubscribe()
  }, [loadSettings])

  const refresh = useCallback(async () => {
    if (userId) await loadSettings(userId)
  }, [userId, loadSettings])

  return (
    <TrainerSettingsContext.Provider value={{ userId, settings, loading, refresh }}>
      {children}
    </TrainerSettingsContext.Provider>
  )
}

export function useTrainerSettingsContext() {
  return useContext(TrainerSettingsContext)
}
