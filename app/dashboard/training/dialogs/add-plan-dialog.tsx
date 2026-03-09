'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  onSuccessWithId?: (planId: string, days: any[]) => void // novo — za auto-assign
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

export default function AddPlanDialog({ open, onClose, onSuccess, onSuccessWithId }: Props) {
  const t = useTranslations('training.dialogs.plan')
  const tCommon = useTranslations('common')
  const tTemplate = useTranslations('training.dialogs.template')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState<PlanDay[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      fetchData()
      setName('')
      setDescription('')
      setDays([])
      setError('')
    }
  }, [open])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: tmpl }, { data: exer }] = await Promise.all([
      supabase.from('workout_templates').select('id, name, exercises').eq('trainer_id', user.id).order('name'),
      supabase.from('exercises').select('id, name, category').order('name'),
    ])
    if (tmpl) setTemplates(tmpl)
    if (exer) setExercises(exer)
  }

  const addDay = () => {
    setDays([...days, {
      day_number: days.length + 1,
      name: `${t('form.dayLabel')} ${days.length + 1}`,
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
        const normalized = (template?.exercises || []).map((e: any) => ({
          exercise_id: e.exercise_id ?? e.id,
          name: e.name ?? '',
          sets: e.sets ?? 3,
          reps: e.reps ?? '10',
          rest_seconds: e.rest_seconds ?? 60,
          notes: e.notes ?? '',
        }))
        return { ...d, template_id: value || null, exercises: normalized }
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
          sets: 3, reps: '10', rest_seconds: 60, notes: ''
        }]
      }
    }))
    setExerciseSearch({ ...exerciseSearch, [dayIndex]: '' })
  }

  const updateExercise = (dayIndex: number, exerciseId: string, field: string, value: any) => {
    setDays(days.map((d, i) => {
      if (i !== dayIndex) return d
      return { ...d, exercises: d.exercises.map(e => e.exercise_id === exerciseId ? { ...e, [field]: value } : e) }
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

    const { data: created, error } = await supabase
      .from('workout_plans')
      .insert({ trainer_id: user.id, name, description: description || null, days })
      .select('id')
      .single()

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)

    if (onSuccessWithId && created) {
      onSuccessWithId(created.id, days)
    } else {
      onSuccess()
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('form.name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('form.namePlaceholder')} required />
            </div>
            <div className="space-y-2">
              <Label>{t('form.description')}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.descriptionPlaceholder')} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('form.trainingDays')} ({days.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDay} className="flex items-center gap-1">
                <Plus size={12} />
                {t('form.addDayLabel')}
              </Button>
            </div>

            {days.map((day, index) => (
              <div key={index} className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{t('form.dayLabel')} {day.day_number}</span>
                  <button type="button" onClick={() => removeDay(index)}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('form.dayName')}</Label>
                  <Input
                    value={day.name}
                    onChange={(e) => updateDayField(index, 'name', e.target.value)}
                    placeholder="Push, Pull, Legs..."
                    className="h-8 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  {(['template', 'custom'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateDayField(index, 'mode', mode)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        day.mode === mode
                          ? 'bg-black text-white border-black font-semibold'
                          : 'text-gray-500 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {mode === 'template' ? t('form.template') : t('form.createWorkout')}
                    </button>
                  ))}
                </div>

                {/* Template select — samo u template modu */}
                {day.mode === 'template' && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('form.template')}</Label>
                    <select
                      value={day.template_id || ''}
                      onChange={(e) => updateDayField(index, 'template_id', e.target.value || null)}
                      className="w-full border rounded-md px-3 py-1.5 text-sm h-8"
                    >
                      <option value="">{t('form.noTemplate')}</option>
                      {templates.map(tmpl => (
                        <option key={tmpl.id} value={tmpl.id}>{tmpl.name} ({tmpl.exercises?.length || 0} {t('form.exerciseCountSuffix')})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Vježbe — uvijek editable, u oba moda */}
                <div className="space-y-2">
                  {day.exercises.map((ex, exIndex) => (
                    <div key={ex.exercise_id} className="border rounded-md p-3 space-y-2 bg-gray-50/40">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">{exIndex + 1}. {ex.name}</span>
                        <button type="button" onClick={() => removeExercise(index, ex.exercise_id)}>
                          <X size={12} className="text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">{tTemplate('sets')}</Label>
                          <Input type="number" value={ex.sets} onChange={(e) => updateExercise(index, ex.exercise_id, 'sets', parseInt(e.target.value) || 0)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">{tTemplate('reps')}</Label>
                          <Input value={ex.reps} onChange={(e) => updateExercise(index, ex.exercise_id, 'reps', e.target.value)} className="h-7 text-xs" placeholder="10 ili 8-12" />
                        </div>
                        <div>
                          <Label className="text-xs">{tTemplate('rest')}</Label>
                          <Input type="number" value={ex.rest_seconds} onChange={(e) => updateExercise(index, ex.exercise_id, 'rest_seconds', parseInt(e.target.value) || 0)} className="h-7 text-xs" />
                        </div>
                      </div>
                      <Input value={ex.notes} onChange={(e) => updateExercise(index, ex.exercise_id, 'notes', e.target.value)} placeholder={tTemplate('notes')} className="h-7 text-xs" />
                    </div>
                  ))}
                  {day.exercises.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      {day.mode === 'template' ? 'Odaberi predložak ili dodaj vježbu ispod' : t('form.emptyDays')}
                    </p>
                  )}

                  {/* Search — uvijek dostupno */}
                  <div className="relative">
                    <Input
                      value={exerciseSearch[index] || ''}
                      onChange={(e) => setExerciseSearch({ ...exerciseSearch, [index]: e.target.value })}
                      placeholder="+ Dodaj vježbu..."
                      className="h-8 text-sm border-dashed"
                    />
                    {exerciseSearch[index] && (
                      <div className="absolute top-full left-0 right-0 z-20 border rounded-md max-h-36 overflow-y-auto bg-white shadow-md mt-0.5">
                        {exercises
                          .filter(e =>
                            e.name.toLowerCase().includes((exerciseSearch[index] || '').toLowerCase()) &&
                            !day.exercises.find(de => de.exercise_id === e.id)
                          )
                          .slice(0, 8)
                          .map(e => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => addExerciseToDay(index, e)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm border-b last:border-0"
                            >
                              <span>{e.name}</span>
                              <Badge variant="outline" className="text-xs">{e.category}</Badge>
                            </button>
                          ))
                        }
                        {exercises.filter(e => e.name.toLowerCase().includes((exerciseSearch[index] || '').toLowerCase())).length === 0 && (
                          <p className="text-xs text-gray-400 px-3 py-2">Nema rezultata</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {days.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">{t('form.emptyDays')}</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" disabled={loading || days.length === 0} className="flex-1">
              {loading ? tCommon('saving') : t('form.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
