'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Plus, X, ChevronDown, ChevronUp, Copy, GripVertical, CalendarDays, BookOpen, Pencil } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SortableExerciseCard, { type PlanExercise } from '../components/sortable-exercise-card'
import { useTrainerSettings } from '@/hooks/use-trainer-settings'
import AddExerciseDialog, { type CreatedExercise } from './add-exercise-dialog'

/** Custom styled select dropdown — replaces native <select> */
function CustomSelect({ value, onChange, options, onOpen }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => { if (!v) onOpen?.(); return !v })}
        className="w-full flex items-center justify-between border border-blue-200 rounded-md px-3 h-7 text-xs bg-white text-gray-700 hover:border-blue-300 focus:outline-none focus:border-blue-400 transition-colors">
        <span className={selected?.value ? 'text-gray-800 font-medium' : 'text-gray-400'}>{selected?.label}</span>
        <ChevronDown size={12} className={`text-blue-400 transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-blue-100 rounded-xl bg-white shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {options.map(opt => (
              <button key={opt.value} type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs border-b border-gray-50 last:border-0 transition-colors ${
                  opt.value === value ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 hover:bg-blue-50'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SortableDayWrapper({ id, isNew, children }: { id: string; isNew?: boolean; children: (handle: React.HTMLAttributes<HTMLButtonElement>, isDragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`rounded-xl ${isNew ? 'item-added' : ''}`}>
      {children({ ...listeners, ...attributes } as any, isDragging)}
    </div>
  )
}

type Template    = { id: string; name: string; exercises: any[] }
type Exercise    = { id: string; name: string; category: string; exercise_type?: string }
type PlanDay     = { _id: string; day_number: number; name: string; template_id: string | null; exercises: PlanExercise[]; mode: 'template' | 'custom' }
type WorkoutPlan = { id: string; name: string; description: string; days: any[] }

type Props = { plan: WorkoutPlan; open: boolean; onClose: () => void; onSuccess: () => void; clientAssignId?: string }

export default function EditPlanDialog({ plan, open, onClose, onSuccess, clientAssignId }: Props) {
  const t         = useTranslations('training.dialogs.plan')
  const tCommon   = useTranslations('common')
  const tTemplate = useTranslations('training.dialogs.template')
  const { settings: trainerSettings } = useTrainerSettings()

  const [name, setName]               = useState(plan.name)
  const [description, setDescription] = useState(plan.description || '')
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
  const [dropdownKbIndex, setDropdownKbIndex] = useState<Record<number, number>>({})
  const [createExerciseFor, setCreateExerciseFor] = useState<number | null>(null)
  const [createExerciseName, setCreateExerciseName] = useState('')
  const blurTimers   = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const searchRefs   = useRef<Record<number, HTMLInputElement | null>>({})
  const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const daysEndRef   = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const justFocusedSearchRef = useRef<Record<number, boolean>>({})
  const wasAlreadyFocusedSearchRef = useRef<Record<number, boolean>>({})
  const [flashDayId, setFlashDayId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Scroll highlighted dropdown item into view when navigating with arrow keys.
  // Use direct scrollTop manipulation — scrollIntoView scrolls the outer dialog instead.
  useEffect(() => {
    for (const [dayIdx, kbIdx] of Object.entries(dropdownKbIndex)) {
      if (kbIdx < 0) continue
      const container = dropdownRefs.current[Number(dayIdx)]
      if (!container) continue
      const item = container.querySelector(`[data-kb-item="${kbIdx}"]`) as HTMLElement | null
      if (!item) continue
      // item.offsetTop is relative to container because container has position:relative
      const itemTop = item.offsetTop
      const itemBot = itemTop + item.offsetHeight
      if (itemBot > container.scrollTop + container.clientHeight)
        container.scrollTop = itemBot - container.clientHeight
      else if (itemTop < container.scrollTop)
        container.scrollTop = itemTop
    }
  }, [dropdownKbIndex])

  const toggleDay     = (i: number) => setExpandedDays(prev => ({ ...prev, [i]: !(prev[i] ?? true) }))
  const isDayExpanded = (i: number) => expandedDays[i] ?? true

  useEffect(() => {
    if (open) {
      setName(plan.name)
      setDescription(plan.description || '')
      setDays((plan.days || []).map((d: any, i: number) => ({
        ...d,
        _id: d._id || crypto.randomUUID(),
        mode: d.template_id ? 'template' : 'custom',
        exercises: (d.exercises || []).map((e: any) => ({
          ...e,
          exercise_type: e.exercise_type || 'strength',
        })),
      })))
      setExerciseSearch({})
      setError('')
      fetchData()
    }
  }, [open, plan.id])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const [{ data: tmpl }, { data: exer }] = await Promise.all([
      supabase.from('workout_templates').select('id, name, exercises').eq('trainer_id', user.id).order('name'),
      supabase.from('exercises').select('id, name, category, exercise_type').order('name'),
    ])
    if (tmpl) setTemplates(tmpl)
    if (exer) setExercises(exer)
  }

  const addDay = () => {
    const newId = crypto.randomUUID()
    setDays(prev => {
      const newIdx = prev.length
      setExpandedDays(ed => ({ ...ed, [newIdx]: true }))
      return [...prev, { _id: newId, day_number: newIdx + 1, name: `${t('form.dayLabel')} ${newIdx + 1}`, template_id: null, exercises: [], mode: 'template' }]
    })
    setTimeout(() => daysEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    setFlashDayId(newId)
    setTimeout(() => setFlashDayId(null), 1400)
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

  const removeDay = (i: number) => {
    setDays(prev => prev.filter((_, idx) => idx !== i).map((d, idx) => ({ ...d, day_number: idx + 1 })))
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
      if (field === 'mode') {
        if (d.mode === value) return d
        return { ...d, mode: value, template_id: null, exercises: [] }
      }
      return { ...d, [field]: value }
    }))
  }

  const getFilteredExercisesForDay = (dayIndex: number) =>
    exercises
      .filter(e => e.name.toLowerCase().includes((exerciseSearch[dayIndex] || '').toLowerCase())
        && !days[dayIndex]?.exercises.find(de => de.exercise_id === e.id))
      .slice(0, 20)

  const handleExerciseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, dayIndex: number) => {
    const filtered = getFilteredExercisesForDay(dayIndex)
    const kbIdx = dropdownKbIndex[dayIndex] ?? -1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropdownKbIndex(prev => ({ ...prev, [dayIndex]: Math.min(kbIdx + 1, filtered.length - 1) }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropdownKbIndex(prev => ({ ...prev, [dayIndex]: Math.max(kbIdx - 1, 0) }))
    } else if (e.key === 'Enter' && kbIdx >= 0) {
      e.preventDefault()
      addExercise(dayIndex, filtered[kbIdx])
      setDropdownKbIndex(prev => ({ ...prev, [dayIndex]: -1 }))
    } else if (e.key === 'Escape') {
      setSearchFocused(prev => ({ ...prev, [dayIndex]: false }))
      setDropdownKbIndex(prev => ({ ...prev, [dayIndex]: -1 }))
    }
  }

  const addExercise = (dayIndex: number, exercise: Exercise) => {
    console.log('[addExercise] using defaults:', trainerSettings.workoutDefaults)
    const { sets, reps, rest_seconds, ...optionalDefaults } = trainerSettings.workoutDefaults
    const optionalFields: Record<string, string> = {}
    trainerSettings.exerciseFields.forEach(key => {
      if (optionalDefaults[key]) optionalFields[key] = String(optionalDefaults[key])
    })
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      if (d.exercises.find(e => e.exercise_id === exercise.id)) return d
      return { ...d, exercises: [...d.exercises, {
        exercise_id: exercise.id, name: exercise.name,
        sets, reps: exercise.exercise_type === 'endurance' ? '5min' : reps,
        rest_seconds, notes: '',
        exercise_type: (exercise.exercise_type as 'strength' | 'endurance') || 'strength',
        ...optionalFields,
      }]}
    }))
    setExerciseSearch(prev => ({ ...prev, [dayIndex]: '' }))
    setTimeout(() => {
      searchRefs.current[dayIndex]?.focus()
      searchRefs.current[dayIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }

  const updateExercise = (dayIndex: number, exerciseId: string, field: string, value: any) =>
    setDays(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d, exercises: d.exercises.map(e => e.exercise_id === exerciseId ? { ...e, [field]: value } : e)
    }))

  const handleExerciseCreated = (dayIndex: number, exercise: CreatedExercise) => {
    const ex: Exercise = { id: exercise.id, name: exercise.name, category: exercise.category, exercise_type: 'strength' }
    setExercises(prev => [...prev, ex])
    addExerciseToDay(dayIndex, ex)
    setCreateExerciseFor(null)
    setCreateExerciseName('')
  }

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
    const { error } = clientAssignId
      ? await supabase.from('client_workout_plans').update({ days }).eq('id', clientAssignId)
      : await supabase.from('workout_plans').update({ name, description: description || null, days }).eq('id', plan.id)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess(); onClose()
  }

  const isClientEdit = !!clientAssignId

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden" showCloseButton={false}>
          <DialogTitle className="sr-only">
            {isClientEdit ? `${t('editClientTitle')} — ${plan.name}` : t('editTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isClientEdit ? `${t('editClientTitle')} — ${plan.name}` : t('editTitle')}
          </DialogDescription>

          {/* Colored header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-4 shrink-0 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CalendarDays size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base">
                {isClientEdit ? t('editClientTitle') : t('editTitle')}
              </h2>
              <p className="text-indigo-100/70 text-xs truncate">{plan.name}</p>
            </div>
            <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Client edit notice */}
          {isClientEdit && (
            <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 shrink-0">
              <p className="text-xs text-amber-700">
                {t('form.clientEditNotice')}
              </p>
            </div>
          )}

          {/* Fixed: name + description */}
          {!isClientEdit && (
            <div className="px-6 pt-4 pb-3 border-b shrink-0 bg-indigo-50/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">{t('form.name')}</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">{t('form.description')}</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 pb-2">
            <form id="edit-plan-form" onSubmit={handleSubmit} className="space-y-4 py-2">

              <div className="space-y-3">
                <div className="flex items-center justify-between sticky top-0 z-10 bg-white -mx-6 px-6 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-600">{t('form.trainingDays')} ({days.length})</span>
                  <Button type="button" variant="outline" size="sm" onClick={addDay}
                    className="flex items-center gap-1 h-7 text-xs px-2.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    <Plus size={12} /> {t('form.addDayLabel')}
                  </Button>
                </div>

                {days.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">{t('form.emptyDays')}</p>
                )}

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderDays}>
                  <SortableContext items={days.map(d => d._id)} strategy={verticalListSortingStrategy}>
                {days.map((day, index) => (
                  <SortableDayWrapper key={day._id} id={day._id} isNew={flashDayId === day._id}>
                  {(dayDragHandle) => (
                  <div className="border border-blue-300 rounded-xl shadow-sm">
                    {/* Accordion header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-100 border-b border-blue-300 rounded-t-xl">
                      <button type="button" {...dayDragHandle} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none" tabIndex={-1}>
                        <GripVertical size={14} />
                      </button>
                      <button type="button" onClick={() => toggleDay(index)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        {isDayExpanded(index) ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                        <span className="font-medium text-sm">{t('form.dayLabel')} {day.day_number}</span>
                        <span className="text-xs text-gray-400">{day.name !== `${t('form.dayLabel')} ${day.day_number}` ? `· ${day.name}` : ''}</span>
                        {!isDayExpanded(index) && (
                          <span className="text-xs text-gray-400 ml-auto shrink-0">
                            {t('form.exercisesCollapsed', { count: day.exercises.length })}
                          </span>
                        )}
                      </button>
                      <button type="button" title={t('form.copyDayTooltip')} onClick={() => copyDay(index)} className="p-1 text-gray-400 hover:text-gray-600">
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => setConfirmDay(index)} className="p-1">
                        <X size={13} className="text-gray-400 hover:text-red-500" />
                      </button>
                    </div>

                    {isDayExpanded(index) && (
                      <div className="px-2.5 pb-2.5 pt-2 space-y-2">

                        {/* Row 1: name input + segmented mode control */}
                        <div className="flex items-center gap-1.5">
                          <Input value={day.name} onChange={e => updateDayField(index, 'name', e.target.value)}
                            placeholder="Push, Pull, Legs..." className="flex-1 h-7 text-xs" />
                          <div className="flex rounded-md border border-gray-300 overflow-hidden shrink-0 text-xs">
                            {(['template', 'custom'] as const).map((mode, mi) => (
                              <button key={mode} type="button"
                                onClick={() => updateDayField(index, 'mode', mode)}
                                title={mode === 'template' ? t('form.template') : t('form.createWorkout')}
                                className={`flex items-center gap-1 px-2 py-1 h-7 transition-colors ${mi > 0 ? 'border-l border-gray-300' : ''} ${
                                  day.mode === mode
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : 'bg-white text-gray-500 hover:bg-gray-50'
                                }`}>
                                {mode === 'template' ? <BookOpen size={11} /> : <Pencil size={11} />}
                                <span>{mode === 'template' ? t('form.template') : t('form.createWorkout')}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {day.mode === 'template' && (
                          <CustomSelect
                            value={day.template_id || ''}
                            onChange={v => updateDayField(index, 'template_id', v || null)}
                            onOpen={() => {
                              setExerciseSearch(prev => ({ ...prev, [index]: '' }))
                              setSearchFocused(prev => ({ ...prev, [index]: false }))
                            }}
                            options={[
                              { value: '', label: t('form.noTemplate') },
                              ...templates.map(tmpl => ({ value: tmpl.id, label: `${tmpl.name} (${tmpl.exercises?.length || 0} ${t('form.exerciseCountSuffix')})` }))
                            ]}
                          />
                        )}

                        {/* Search */}
                        <div className="relative">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                              <Plus size={12} />
                            </span>
                            <Input
                              ref={el => { searchRefs.current[index] = el }}
                              value={exerciseSearch[index] || ''}
                              onChange={e => { setExerciseSearch(prev => ({ ...prev, [index]: e.target.value })); setDropdownKbIndex(prev => ({ ...prev, [index]: -1 })) }}
                              onMouseDown={() => { wasAlreadyFocusedSearchRef.current[index] = document.activeElement === searchRefs.current[index] }}
                              onFocus={() => {
                                if (blurTimers.current[index]) clearTimeout(blurTimers.current[index])
                                setSearchFocused(prev => ({ ...prev, [index]: true }))
                                setTimeout(() => {
                                  const input = searchRefs.current[index]
                                  const container = scrollContainerRef.current
                                  if (input && container) {
                                    const inputBottom = input.getBoundingClientRect().bottom
                                    const containerBottom = container.getBoundingClientRect().bottom
                                    if (inputBottom + 220 > containerBottom) {
                                      container.scrollBy({ top: inputBottom + 220 - containerBottom, behavior: 'smooth' })
                                    }
                                  }
                                }, 60)
                              }}
                              onBlur={() => { blurTimers.current[index] = setTimeout(() => setSearchFocused(prev => ({ ...prev, [index]: false })), 200) }}
                              onClick={() => {
                                if (wasAlreadyFocusedSearchRef.current[index] && (searchFocused[index] || exerciseSearch[index])) {
                                  setSearchFocused(prev => ({ ...prev, [index]: false }))
                                  setExerciseSearch(prev => ({ ...prev, [index]: '' }))
                                  ;(searchRefs.current[index])?.blur()
                                }
                              }}
                              onKeyDown={e => handleExerciseKeyDown(e, index)}
                              placeholder={t('form.searchExercisePlaceholder')}
                              className="h-7 text-xs pl-7 border-dashed focus:border-solid focus:border-blue-300"
                            />
                          </div>
                          {!!(searchFocused[index] || exerciseSearch[index]) && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-blue-100 rounded-xl bg-white shadow-lg overflow-hidden">
                              <div
                                ref={el => { dropdownRefs.current[index] = el }}
                                className="overflow-y-auto max-h-48"
                                onWheel={e => e.stopPropagation()}
                              >
                                {getFilteredExercisesForDay(index).length === 0 ? (
                                  <p className="px-3 py-2.5 text-xs text-gray-400 text-center">
                                    {exercises.length === 0 ? t('form.loadingExercises') : t('form.noResults', { search: exerciseSearch[index] ? t('form.noResultsFor', { search: exerciseSearch[index] }) : '' })}
                                  </p>
                                ) : getFilteredExercisesForDay(index).map((e, ei) => (
                                  <button key={e.id} type="button"
                                    data-kb-item={ei}
                                    onMouseDown={ev => ev.preventDefault()}
                                    onClick={() => { addExercise(index, e); setDropdownKbIndex(prev => ({ ...prev, [index]: -1 })) }}
                                    onMouseEnter={() => setDropdownKbIndex(prev => ({ ...prev, [index]: ei }))}
                                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 transition-colors ${
                                      (dropdownKbIndex[index] ?? -1) === ei ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'
                                    }`}>
                                    <span className="font-medium">{e.name}</span>
                                    <div className="flex items-center gap-1.5">
                                      {e.exercise_type === 'endurance' && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${(dropdownKbIndex[index] ?? -1) === ei ? 'bg-blue-500 text-white border-blue-400' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{t('form.enduranceBadge')}</span>}
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${(dropdownKbIndex[index] ?? -1) === ei ? 'bg-blue-500 text-white border-blue-400' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{e.category}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <div className="border-t border-blue-50 bg-blue-50/40 px-3 py-2">
                                <button type="button"
                                  onMouseDown={ev => ev.preventDefault()}
                                  onClick={() => { setCreateExerciseName(exerciseSearch[index] || ''); setCreateExerciseFor(index) }}
                                  className="w-full text-left text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 font-medium transition-colors">
                                  <Plus size={12} />
                                  <span>{exerciseSearch[index] ? `Kreiraj vježbu "${exerciseSearch[index]}"` : 'Kreiraj novu vježbu'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

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
                                  activeExerciseFields={trainerSettings.exerciseFields}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>

                        {day.exercises.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">
                            {day.mode === 'template' ? t('form.selectTemplate') : t('form.emptyDays')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                  </SortableDayWrapper>
                ))}
                  </SortableContext>
                </DndContext>

                <div ref={daysEndRef} />
              </div>
            </form>
          </div>

          <div className="px-6 py-4 border-t bg-white shrink-0 flex gap-3">
            {error && <p className="text-red-500 text-sm flex-1">{error}</p>}
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" form="edit-plan-form" disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              {loading ? tCommon('saving') : tCommon('saveChanges')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDay !== null} title={t('form.deleteDayTitle')}
        description={confirmDay !== null ? t('form.deleteDayConfirm', { num: confirmDay + 1 }) : ''}
        onConfirm={() => confirmDay !== null && removeDay(confirmDay)} onCancel={() => setConfirmDay(null)}
        confirmLabel={tCommon('delete')} destructive />

      <ConfirmDialog open={confirmEx !== null} title={t('form.removeExerciseDayTitle')}
        description={t('form.removeExerciseDayConfirm')}
        onConfirm={() => confirmEx && removeExercise(confirmEx.day, confirmEx.id)} onCancel={() => setConfirmEx(null)}
        confirmLabel={tCommon('remove')} destructive />

      <AddExerciseDialog
        open={createExerciseFor !== null}
        onClose={() => { setCreateExerciseFor(null); setCreateExerciseName('') }}
        onSuccess={ex => ex && createExerciseFor !== null && handleExerciseCreated(createExerciseFor, ex)}
        initialName={createExerciseName}
      />
    </>
  )
}

