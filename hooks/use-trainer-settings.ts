import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type TrainerSettings = {
  nutritionFields: string[]
  exerciseFields: string[]
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
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('trainer_profiles')
        .select('nutrition_fields, exercise_fields')
        .eq('id', user.id)
        .single()
      if (data) {
        setSettings({
          nutritionFields: data.nutrition_fields || [],
          exerciseFields: data.exercise_fields || [],
        })
      }
      setLoading(false)
    }
    fetch()
  }, [])

  return { settings, loading }
}
