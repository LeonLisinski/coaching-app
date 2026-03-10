'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Plus, X, ChevronDown, ChevronUp, Copy, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SortableExerciseCard, { type PlanExercise } from '../components/sortable-exercise-card'

/** Wrapper koji poziva useSortable za dan i injektira dragHandleProps via render prop */
function SortableDayWrapper({ id, children }: { id: string; children: (handle: React.HTMLAttributes<HTMLButtonElement>, isDragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      {children({ ...listeners, ...attributes } as any, isDragging)}
    </div>
  )
}

type Props = {
  open: boolean; onClose: () => void; onSuccess: () => void
  onSuccessWithId?: (planId: string, days: any[]) => void
  isTemplate?: boolean
}
type Template = { id: string; name: string; exercises: any[] }
type Exercise  = { id: string; name: string; category: string; exercise_type?: string }
type PlanDay   = { _id: string; day_number: number; name: string; template_id: string | null; exercises: PlanExercise[]; mode: 'template' | 'custom' }

export default function AddPlanDialog({ open, onClose, onSuccess, onSuccessWithId, isTemplate = true }: Props) {
  const t         = useTranslations('training.dialogs.plan')
  const tCommon   = useTranslations('common')
  const tTemplate = useTranslations('training.dialogs.template')

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays]               = useState<PlanDay[]>([])
  const [templates, setTemplates]     = useState<Template[]>([])
  const [exercises, setExercises]     = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState<Record<number, string>>({})
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const [confirmDay, setConfirmDay]   = useState<number | null>(null)
  const [confirmEx, setConfirmEx]     = useState<{ day: number; id: string } | null>(null)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({})
  const [searchFocused, setSearchFocused] = useState<Record<number, boolean>>({})
  const blurTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const daysEndRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const toggleDay      = (i: number) => setExpandedDays(prev => ({ ...prev, [i]: !(prev[i] ?? true) }))
  const isDayExpanded  = (i: number) => expandedDays[i] ?? true

  useEffect(() => {
    if (open) { fetchData(); setName(''); setDescription(''); setDays([]); setError('') }
  }, [open])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: tmpl }, { data: exer }] = await Promise.all([
      supabase.from('workout_templates').select('id, name, exercises').eq('trainer_id', user.id).order('name'),
      supabase.from('exercises').select('id, name, category, exercise_type').order('name'),
    ])
    if (tmpl) setTemplates(tmpl)
    if (exer) setExercises(exer)
  }

  const addDay = () => {
    setDays(prev => {
      const newIdx = prev.length
      setExpandedDays(ed => ({ ...ed, [newIdx]: true }))
      return [...prev, { _id: crypto.randomUUID(), day_number: newIdx + 1, name: `${t('form.dayLabel')} ${newIdx + 1}`, template_id: null, exercises: [], mode: 'template' }]
    })
    setTimeout(() => daysEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }

  const copyDay = (index: number) => {
    setDays(prev => {
      const day = prev[index]
      const newIdx = prev.length
      setExpandedDays(ed => ({ ...ed, [newIdx]: true }))
      return [...prev, {
        ...day, _id: crypto.randomUUID(),
        day_number: newIdx + 1,
        name: `${day.name} (kopija)`,
        exercises: day.exercises.map(e => ({ ...e })),
      }]
    })
    setTimeout(() => daysEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }

  const reorderDays = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setDays(prev => {
      const oldIdx = prev.findIndex(d => d._id === active.id)
      const newIdx = prev.findIndex(d => d._id === over.id)
      return arrayMove(prev, oldIdx, newIdx).map((d, i) => ({ ...d, day_number: i + 1 }))
    })
  }

  const removeDay = (index: number) => {
    setDays(prev => prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, day_number: i + 1 })))
    setConfirmDay(null)
  }

  const updateDayField = (index: number, field: string, value: any) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== index) return d
      if (field === 'template_id') {
        const tmpl = templates.find(t => t.id === value)
        const normalized = (tmpl?.exercises || []).map((e: any) => ({
          exercise_id: e.exercise_id ?? e.id, name: e.name ?? '',
          sets: e.sets ?? 3, reps: e.reps ?? '10', rest_seconds: e.rest_seconds ?? 60, notes: e.notes ?? '',
          exercise_type: e.exercise_type || 'strength',
        }))
        return { ...d, template_id: value || null, exercises: normalized }
      }
      if (field === 'mode') return { ...d, mode: value, template_id: null, exercises: [] }
      return { ...d, [field]: value }
    }))
  }

  const addExerciseToDay = (dayIndex: number, exercise: Exercise) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      if (d.exercises.find(e => e.exercise_id === exercise.id)) return d
      return { ...d, exercises: [...d.exercises, {
        exercise_id: exercise.id, name: exercise.name,
        sets: 3, reps: exercise.exercise_type === 'endurance' ? '5min' : '10',
        rest_seconds: 60, notes: '',
        exercise_type: (exercise.exercise_type as 'strength' | 'endurance') || 'strength',
      }]}
    }))
    setExerciseSearch(prev => ({ ...prev, [dayIndex]: '' }))
    setSearchFocused(prev => ({ ...prev, [dayIndex]: false }))
  }

  const updateExercise = (dayIndex: number, exerciseId: string, field: string, value: any) =>
    setDays(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d, exercises: d.exercises.map(e => e.exercise_id === exerciseId ? { ...e, [field]: value } : e)
    }))

  const removeExercise = (dayIndex: number, exerciseId: string) => {
    setDays(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d, exercises: d.exercises.filter(e => e.exercise_id !== exerciseId)
    }))
    setConfirmEx(null)
  }

  const reorderExercises = (dayIndex: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      const oldIdx = d.exercises.findIndex(e => e.exercise_id === active.id)
      const newIdx = d.exercises.findIndex(e => e.exercise_id === over.id)
      return { ...d, exercises: arrayMove(d.exercises, oldIdx, newIdx) }
    }))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: created, error } = await supabase
      .from('workout_plans')
      .insert({ trainer_id: user.id, name, description: description || null, days, is_template: isTemplate })
      .select('id').single()

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    if (onSuccessWithId && created) onSuccessWithId(created.id, days)
    else onSuccess()
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{t('addTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-2">
            <form id="add-plan-form" onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('form.name')}</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('form.namePlaceholder')} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('form.description')}</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('form.descriptionPlaceholder')} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('form.trainingDays')} ({days.length})</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addDay} className="flex items-center gap-1">
                    <Plus size={12} />{t('form.addDayLabel')}
                  </Button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderDays}>
                  <SortableContext items={days.map(d => d._id)} strategy={verticalListSortingStrategy}>
                {days.map((day, index) => (
                  <SortableDayWrapper key={day._id} id={day._id}>
                  {(dayDragHandle) => (
                  <div className="border rounded-md overflow-hidden">
                    {/* Accordion header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                      <button type="button" {...dayDragHandle} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none" tabIndex={-1}>
                        <GripVertical size={14} />
                      </button>
                      <button type="button" onClick={() => toggleDay(index)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        {isDayExpanded(index) ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                        <span className="font-medium text-sm">{t('form.dayLabel')} {day.day_number}</span>
                        <span className="text-xs text-gray-400 truncate">{day.name !== `${t('form.dayLabel')} ${day.day_number}` ? `· ${day.name}` : ''}</span>
                        {!isDayExpanded(index) && <span className="text-xs text-gray-400 ml-auto shrink-0">{day.exercises.length} vježbi</span>}
                      </button>
                      <button type="button" title="Kopiraj dan" onClick={() => copyDay(index)} className="p-1 text-gray-400 hover:text-gray-600">
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => setConfirmDay(index)} className="p-1">
                        <X size={13} className="text-gray-400 hover:text-red-500" />
                      </button>
                    </div>

                    {isDayExpanded(index) && (
                      <div className="p-3 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">{t('form.dayName')}</Label>
                          <Input value={day.name} onChange={e => updateDayField(index, 'name', e.target.value)} placeholder="Push, Pull, Legs..." className="h-8 text-sm" />
                        </div>

                        <div className="flex gap-2">
                          {(['template', 'custom'] as const).map(mode => (
                            <button key={mode} type="button" onClick={() => updateDayField(index, 'mode', mode)}
                              className={`text-xs px-3 py-1 rounded-full border transition-colors ${day.mode === mode ? 'bg-black text-white border-black font-semibold' : 'text-gray-500 border-gray-300 hover:border-gray-400'}`}>
                              {mode === 'template' ? t('form.template') : t('form.createWorkout')}
                            </button>
                          ))}
                        </div>

                        {day.mode === 'template' && (
                          <div className="space-y-1">
                            <Label className="text-xs">{t('form.template')}</Label>
                            <select value={day.template_id || ''} onChange={e => updateDayField(index, 'template_id', e.target.value || null)}
                              className="w-full border rounded-md px-3 py-1.5 text-sm h-8">
                              <option value="">{t('form.noTemplate')}</option>
                              {templates.map(tmpl => (
                                <option key={tmpl.id} value={tmpl.id}>{tmpl.name} ({tmpl.exercises?.length || 0} {t('form.exerciseCountSuffix')})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Exercises with DnD */}
                        <DndContext sensors={sensors} collisionDetection={closestCenter}
                          onDragEnd={ev => reorderExercises(index, ev)}>
                          <SortableContext items={day.exercises.map(e => e.exercise_id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {day.exercises.map((ex, exIndex) => (
                                <SortableExerciseCard
                                  key={ex.exercise_id} ex={ex} index={exIndex}
                                  onUpdate={(field, val) => updateExercise(index, ex.exercise_id, field, val)}
                                  onRemove={() => setConfirmEx({ day: index, id: ex.exercise_id })}
                                  labelSets={tTemplate('sets')} labelRest={tTemplate('rest')} labelNotes={tTemplate('notes')}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>

                        {day.exercises.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">
                            {day.mode === 'template' ? 'Odaberi predložak ili dodaj vježbu ispod' : t('form.emptyDays')}
                          </p>
                        )}

                        {/* Search */}
                        <div className="space-y-1">
                          <Input
                            value={exerciseSearch[index] || ''}
                            onChange={e => setExerciseSearch(prev => ({ ...prev, [index]: e.target.value }))}
                            onFocus={() => { if (blurTimers.current[index]) clearTimeout(blurTimers.current[index]); setSearchFocused(prev => ({ ...prev, [index]: true })) }}
                            onBlur={() => { blurTimers.current[index] = setTimeout(() => setSearchFocused(prev => ({ ...prev, [index]: false })), 150) }}
                            placeholder="+ Dodaj vježbu..."
                            className="h-8 text-sm border-dashed"
                          />
                          {!!(searchFocused[index] || exerciseSearch[index]) && (
                            <div className="border rounded-md bg-white shadow-sm overflow-y-auto max-h-48" onWheel={e => e.stopPropagation()}>
                              {exercises
                                .filter(e => e.name.toLowerCase().includes((exerciseSearch[index] || '').toLowerCase()) && !day.exercises.find(de => de.exercise_id === e.id))
                                .slice(0, 20)
                                .map(e => (
                                  <button key={e.id} type="button"
                                    onMouseDown={ev => ev.preventDefault()}
                                    onClick={() => addExerciseToDay(index, e)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm border-b last:border-0">
                                    <span>{e.name}</span>
                                    <div className="flex items-center gap-1">
                                      {e.exercise_type === 'endurance' && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">Izdržljivost</span>}
                                      <Badge variant="outline" className="text-xs">{e.category}</Badge>
                                    </div>
                                  </button>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                  </SortableDayWrapper>
                ))}
                  </SortableContext>
                </DndContext>

                {days.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">{t('form.emptyDays')}</p>
                )}
                <div ref={daysEndRef} />
              </div>
            </form>
          </div>

          <div className="px-6 py-4 border-t bg-white shrink-0 flex gap-3">
            {error && <p className="text-red-500 text-sm flex-1">{error}</p>}
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" form="add-plan-form" disabled={loading || days.length === 0} className="flex-1">
              {loading ? tCommon('saving') : t('form.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDay !== null} title="Obriši dan"
        description={`Sigurno želiš ukloniti Dan ${confirmDay !== null ? confirmDay + 1 : ''}? Sve vježbe bit će izgubljene.`}
        onConfirm={() => confirmDay !== null && removeDay(confirmDay)} onCancel={() => setConfirmDay(null)}
        confirmLabel="Obriši" destructive />

      <ConfirmDialog open={confirmEx !== null} title="Ukloni vježbu"
        description="Sigurno želiš ukloniti ovu vježbu iz dana?"
        onConfirm={() => confirmEx && removeExercise(confirmEx.day, confirmEx.id)} onCancel={() => setConfirmEx(null)}
        confirmLabel="Ukloni" destructive />
    </>
  )
}
