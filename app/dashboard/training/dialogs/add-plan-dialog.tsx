'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type Template = {
  id: string
  name: string
  exercises: any[]
}

type Exercise = {
  id: string
  name: string
  category: string
}

type PlanExercise = {
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes: string
}

type PlanDay = {
  day_number: number
  name: string
  template_id: string | null
  exercises: PlanExercise[]
  mode: 'template' | 'custom'
}

export default function AddPlanDialog({ open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState<PlanDay[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) fetchData()
  }, [open])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: tmpl }, { data: exer }] = await Promise.all([
      supabase.from('workout_templates').select('id, name, exercises').eq('trainer_id', user.id).order('name'),
      supabase.from('exercises').select('id, name, category').eq('trainer_id', user.id).order('name'),
    ])
    if (tmpl) setTemplates(tmpl)
    if (exer) setExercises(exer)
  }

  const addDay = () => {
    setDays([...days, {
      day_number: days.length + 1,
      name: `Dan ${days.length + 1}`,
      template_id: null,
      exercises: [],
      mode: 'template'
    }])
  }

  const removeDay = (index: number) => {
    setDays(days.filter((_, i) => i !== index).map((d, i) => ({ ...d, day_number: i + 1 })))
  }

  const updateDayField = (index: number, field: string, value: any) => {
    setDays(days.map((d, i) => {
      if (i !== index) return d
      if (field === 'template_id') {
        const template = templates.find(t => t.id === value)
        return { ...d, template_id: value || null, exercises: template?.exercises || [] }
      }
      if (field === 'mode') {
        return { ...d, mode: value, template_id: null, exercises: [] }
      }
      return { ...d, [field]: value }
    }))
  }

  const addExerciseToDay = (dayIndex: number, exercise: Exercise) => {
    setDays(days.map((d, i) => {
      if (i !== dayIndex) return d
      if (d.exercises.find(e => e.exercise_id === exercise.id)) return d
      return {
        ...d,
        exercises: [...d.exercises, {
          exercise_id: exercise.id,
          name: exercise.name,
          sets: 3,
          reps: '10',
          rest_seconds: 60,
          notes: ''
        }]
      }
    }))
    setExerciseSearch({ ...exerciseSearch, [dayIndex]: '' })
  }

  const updateExercise = (dayIndex: number, exerciseId: string, field: string, value: any) => {
    setDays(days.map((d, i) => {
      if (i !== dayIndex) return d
      return {
        ...d,
        exercises: d.exercises.map(e =>
          e.exercise_id === exerciseId ? { ...e, [field]: value } : e
        )
      }
    }))
  }

  const removeExercise = (dayIndex: number, exerciseId: string) => {
    setDays(days.map((d, i) => {
      if (i !== dayIndex) return d
      return { ...d, exercises: d.exercises.filter(e => e.exercise_id !== exerciseId) }
    }))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('workout_plans').insert({
      trainer_id: user.id,
      name,
      description: description || null,
      days,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
    setName('')
    setDescription('')
    setDays([])
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novi plan treninga</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Naziv plana</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PPL Program, Full Body..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="3 dana tjedno, srednja razina..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Dani treninga ({days.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDay} className="flex items-center gap-1">
                <Plus size={12} />
                Dodaj dan
              </Button>
            </div>

            {days.map((day, index) => (
              <div key={index} className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Dan {day.day_number}</span>
                  <button type="button" onClick={() => removeDay(index)}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Naziv dana</Label>
                  <Input
                    value={day.name}
                    onChange={(e) => updateDayField(index, 'name', e.target.value)}
                    placeholder="Push, Pull, Legs..."
                    className="h-8 text-sm"
                  />
                </div>

                {/* Mode switcher */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateDayField(index, 'mode', 'template')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      day.mode === 'template'
                        ? 'bg-black text-white border-black font-semibold'
                        : 'text-gray-500 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Iz predloška
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDayField(index, 'mode', 'custom')}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      day.mode === 'custom'
                        ? 'bg-black text-white border-black font-semibold'
                        : 'text-gray-500 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Kreiraj trening
                  </button>
                </div>

                {day.mode === 'template' ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Predložak</Label>
                    <select
                      value={day.template_id || ''}
                      onChange={(e) => updateDayField(index, 'template_id', e.target.value || null)}
                      className="w-full border rounded-md px-3 py-1.5 text-sm h-8"
                    >
                      <option value="">Bez predloška</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.exercises?.length || 0} vježbi)</option>
                      ))}
                    </select>
                    {day.exercises.length > 0 && (
                      <p className="text-xs text-gray-400">✓ {day.exercises.length} vježbi iz predloška</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={exerciseSearch[index] || ''}
                      onChange={(e) => setExerciseSearch({ ...exerciseSearch, [index]: e.target.value })}
                      placeholder="Pretraži vježbe..."
                      className="h-8 text-sm"
                    />
                    {exerciseSearch[index] && (
                      <div className="border rounded-md max-h-32 overflow-y-auto">
                        {exercises
                          .filter(e =>
                            e.name.toLowerCase().includes((exerciseSearch[index] || '').toLowerCase()) &&
                            !day.exercises.find(de => de.exercise_id === e.id)
                          )
                          .map(e => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => addExerciseToDay(index, e)}
                              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between text-sm"
                            >
                              <span>{e.name}</span>
                              <Badge variant="outline" className="text-xs">{e.category}</Badge>
                            </button>
                          ))
                        }
                      </div>
                    )}

                    {day.exercises.map((ex, exIndex) => (
                      <div key={ex.exercise_id} className="border rounded-md p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{exIndex + 1}. {ex.name}</span>
                          <button type="button" onClick={() => removeExercise(index, ex.exercise_id)}>
                            <X size={12} className="text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Serije</Label>
                            <Input
                              type="number"
                              value={ex.sets}
                              onChange={(e) => updateExercise(index, ex.exercise_id, 'sets', parseInt(e.target.value))}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Ponavljanja</Label>
                            <Input
                              value={ex.reps}
                              onChange={(e) => updateExercise(index, ex.exercise_id, 'reps', e.target.value)}
                              className="h-7 text-xs"
                              placeholder="10 ili 8-12"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Odmor (sek)</Label>
                            <Input
                              type="number"
                              value={ex.rest_seconds}
                              onChange={(e) => updateExercise(index, ex.exercise_id, 'rest_seconds', parseInt(e.target.value))}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                        <Input
                          value={ex.notes}
                          onChange={(e) => updateExercise(index, ex.exercise_id, 'notes', e.target.value)}
                          placeholder="Napomena..."
                          className="h-7 text-xs"
                        />
                      </div>
                    ))}

                    {day.exercises.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-1">Pretraži i dodaj vježbe iznad</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {days.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Dodaj dane treninga klikom na gumb iznad</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading || days.length === 0} className="flex-1">
              {loading ? 'Spremanje...' : 'Spremi plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}