import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type WorkoutDefaults = {
  sets: number
  reps: string
  rest_seconds: number
  [key: string]: any // dynamic optional fields: rir, rpe, tempo, duration, distance
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
  { key: 'tempo',    label: 'Tempo',    desc: 'Brzina izvođenja (npr. 3-1-2)' },
  { key: 'duration', label: 'Trajanje', desc: 'Trajanje vježbe (minute)', unit: 'min' },
  { key: 'distance', label: 'Distanca', desc: 'Prijeđena distanca (km/m)', unit: 'km/m' },
]

export function useTrainerSettings() {
  const [settings, setSettings] = useState<TrainerSettings>({
    nutritionFields: [],
    exerciseFields: [],
    workoutDefaults: DEFAULT_WORKOUT_DEFAULTS,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('trainer_profiles')
          .select('nutrition_fields, exercise_fields, workout_defaults')
          .eq('id', user.id)
          .maybeSingle()
        if (data) {
          setSettings({
            nutritionFields: data.nutrition_fields || [],
            exerciseFields: data.exercise_fields || [],
            workoutDefaults: {
              ...DEFAULT_WORKOUT_DEFAULTS,
              ...(data.workout_defaults || {}),
            },
          })
        }
      } catch {
        // Auth lock was taken over by another tab/request — non-fatal
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return { settings, loading }
}
