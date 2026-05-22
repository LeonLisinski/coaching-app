'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { flattenExercises } from '../lib/template-blocks'
import BlockCard from '../components/block-card'
import {
  type TemplateBlock, type TemplateExercise, type ExerciseOption,
  isBlock, getItemDndId, createEmptyBlock, exerciseFromOption,
} from '../lib/template-blocks'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Plus, X, ChevronDown, ChevronUp, Copy, GripVertical, CalendarDays, BookOpen, Pencil, Layers } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SortableExerciseCard, { type PlanExercise } from '../components/sortable-exercise-card'
import { useTrainerSettings } from '@/hooks/use-trainer-settings'
import AddExerciseDialog, { type CreatedExercise } from './add-exercise-dialog'
import { useAppTheme } from '@/app/contexts/app-theme'

/** Custom styled select dropdown — replaces native <select> */
function CustomSelect({ value, onChange, options, onOpen, isDark }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  onOpen?: () => void
  isDark?: boolean
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
        className={`w-full flex items-center justify-between border rounded-md px-3 h-7 text-xs focus:outline-none transition-colors ${isDark ? 'border-white/10 bg-white/[0.05] text-gray-300 hover:border-white/20 focus:border-blue-500' : 'border-blue-200 bg-white text-gray-700 hover:border-blue-300 focus:border-blue-400'}`}>
        <span className={selected?.value ? (isDark ? 'text-gray-200 font-medium' : 'text-gray-800 font-medium') : 'text-gray-400'}>{selected?.label}</span>
        <ChevronDown size={12} className={`text-blue-400 transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full left-0 right-0 z-50 mt-1 border rounded-xl shadow-lg overflow-hidden ${isDark ? 'border-white/10 bg-[oklch(0.18_0.018_264)]' : 'border-blue-100 bg-white'}`}>
          <div className="max-h-52 overflow-y-auto">
            {options.map(opt => (
              <button key={opt.value} type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs border-b last:border-0 transition-colors ${
                  opt.value === value
                    ? 'bg-blue-600 text-white font-semibold'
                    : isDark ? 'border-white/5 text-gray-300 hover:bg-white/[0.06]' : 'border-gray-50 text-gray-700 hover:bg-blue-50'
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

/** Wrapper koji poziva useSortable za dan i injektira dragHandleProps via render prop */
function SortableDayWrapper({ id, isNew, children }: { id: string; isNew?: boolean; children: (handle: React.HTMLAttributes<HTMLButtonElement>, isDragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`rounded-xl ${isNew ? 'item-added' : ''}`}>
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
type Exercise  = { id: string; name: string; category: string; exercise_type?: string; section?: 'main' | 'warmup' }
type PlanDay   = { _id: string; day_number: number; name: string; template_id: string | null; exercises: (PlanExercise | TemplateBlock)[]; mode: 'template' | 'custom' }

export default function AddPlanDialog({ open, onClose, onSuccess, onSuccessWithId, isTemplate = true }: Props) {
  const t         = useTranslations('training.dialogs.plan')
  const tCommon   = useTranslations('common')
  const tTemplate = useTranslations('training.dialogs.template')
  const { settings: trainerSettings } = useTrainerSettings()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

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
  const [dropdownKbIndex, setDropdownKbIndex] = useState<Record<number, number>>({})
  const [createExerciseFor, setCreateExerciseFor] = useState<number | null>(null)
  const [createExerciseName, setCreateExerciseName] = useState('')
  const blurTimers    = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const searchRefs    = useRef<Record<number, HTMLInputElement | null>>({})
  const dropdownRefs  = useRef<Record<number, HTMLDivElement | null>>({})
  const daysEndRef    = useRef<HTMLDivElement>(null)
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
      const itemTop = item.offsetTop
      const itemBot = itemTop + item.offsetHeight
      if (itemBot > container.scrollTop + container.clientHeight)
        container.scrollTop = itemBot - container.clientHeight
      else if (itemTop < container.scrollTop)
        container.scrollTop = itemTop
    }
  }, [dropdownKbIndex])

  const toggleDay      = (i: number) => setExpandedDays(prev => ({ ...prev, [i]: !(prev[i] ?? true) }))
  const isDayExpanded  = (i: number) => expandedDays[i] ?? true

  useEffect(() => {
    if (open) { fetchData(); setName(''); setDescription(''); setDays([]); setError('') }
  }, [open])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const [{ data: tmpl }, { data: exer }] = await Promise.all([
      supabase.from('workout_templates').select('id, name, exercises').eq('trainer_id', user.id).order('name'),
      supabase.from('exercises').select('id, name, category, exercise_type, section').order('name'),
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
        name: `${day.name} ${t('form.copyDaySuffix')}`,
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
        const normalized: (PlanExercise | TemplateBlock)[] = (tmpl?.exercises || []).map((item: any) => {
          if (item.kind === 'block') return item  // preserve superset block as-is
          return {
            exercise_id: item.exercise_id ?? item.id, name: item.name ?? '',
            sets: item.sets ?? 3, reps: item.reps ?? '10', rest_seconds: item.rest_seconds ?? 60, notes: item.notes ?? '',
            exercise_type: item.exercise_type || 'strength',
          }
        })
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
        && !days[dayIndex]?.exercises.find(de => (de as PlanExercise).exercise_id === e.id))
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
      addExerciseToDay(dayIndex, filtered[kbIdx])
      setDropdownKbIndex(prev => ({ ...prev, [dayIndex]: -1 }))
    } else if (e.key === 'Escape') {
      setSearchFocused(prev => ({ ...prev, [dayIndex]: false }))
      setDropdownKbIndex(prev => ({ ...prev, [dayIndex]: -1 }))
    }
  }

  const addExerciseToDay = (dayIndex: number, exercise: Exercise) => {
    const { sets, reps, rest_seconds, ...optionalDefaults } = trainerSettings.workoutDefaults
    const optionalFields: Record<string, string> = {}
    trainerSettings.exerciseFields.forEach(key => {
      if (optionalDefaults[key]) optionalFields[key] = String(optionalDefaults[key])
    })
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      if (d.exercises.find(e => (e as PlanExercise).exercise_id === exercise.id)) return d
      return { ...d, exercises: [...d.exercises, {
        exercise_id: exercise.id, name: exercise.name,
        sets, reps: exercise.exercise_type === 'endurance' ? '5min' : reps,
        rest_seconds, notes: '',
        exercise_type: (exercise.exercise_type as 'strength' | 'endurance') || 'strength',
        section: (exercise.section as 'main' | 'warmup') || 'main',
        ...optionalFields,
      }]}
    }))
    setExerciseSearch(prev => ({ ...prev, [dayIndex]: '' }))
    setTimeout(() => {
      searchRefs.current[dayIndex]?.focus()
      searchRefs.current[dayIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }

  const addBlockToDay = (dayIndex: number) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      const blockCount = d.exercises.filter(e => isBlock(e as any)).length
      return { ...d, exercises: [...d.exercises, createEmptyBlock(blockCount)] }
    }))
  }

  const updateBlockInDay = (dayIndex: number, blockId: string, field: keyof TemplateBlock, value: any) =>
    setDays(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d, exercises: d.exercises.map(e => isBlock(e as any) && (e as TemplateBlock).block_id === blockId ? { ...e, [field]: value } : e)
    }))

  const addExerciseToBlockInDay = (dayIndex: number, blockId: string, exercise: ExerciseOption) =>
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      return { ...d, exercises: d.exercises.map(e => {
        if (!isBlock(e as any) || (e as TemplateBlock).block_id !== blockId) return e
        const block = e as TemplateBlock
        return { ...block, exercises: [...block.exercises, exerciseFromOption(exercise, trainerSettings.workoutDefaults, true)] }
      })}
    }))

  const updateExerciseInBlockInDay = (dayIndex: number, blockId: string, exerciseId: string, field: string, value: any) =>
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      return { ...d, exercises: d.exercises.map(e => {
        if (!isBlock(e as any) || (e as TemplateBlock).block_id !== blockId) return e
        return { ...(e as TemplateBlock), exercises: (e as TemplateBlock).exercises.map(ex => ex.exercise_id === exerciseId ? { ...ex, [field]: value } : ex) }
      })}
    }))

  const removeExerciseFromBlockInDay = (dayIndex: number, blockId: string, exerciseId: string) =>
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      return { ...d, exercises: d.exercises.map(e => {
        if (!isBlock(e as any) || (e as TemplateBlock).block_id !== blockId) return e
        return { ...(e as TemplateBlock), exercises: (e as TemplateBlock).exercises.filter(ex => ex.exercise_id !== exerciseId) }
      })}
    }))

  const moveExerciseOutOfBlockInDay = (dayIndex: number, blockId: string, exerciseId: string) =>
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      const blockIdx = d.exercises.findIndex(e => isBlock(e as any) && (e as TemplateBlock).block_id === blockId)
      if (blockIdx === -1) return d
      const block = d.exercises[blockIdx] as TemplateBlock
      const ex = block.exercises.find(e => e.exercise_id === exerciseId)
      if (!ex) return d
      const newBlock: TemplateBlock = { ...block, exercises: block.exercises.filter(e => e.exercise_id !== exerciseId) }
      const restored: PlanExercise = {
        exercise_id: ex.exercise_id, name: ex.name,
        sets: trainerSettings.workoutDefaults.sets, reps: ex.reps,
        rest_seconds: trainerSettings.workoutDefaults.rest_seconds, notes: ex.notes || '',
        exercise_type: 'strength',
      }
      const newExercises = [...d.exercises]
      newExercises[blockIdx] = newBlock
      newExercises.splice(blockIdx + 1, 0, restored)
      return { ...d, exercises: newExercises }
    }))

  const updateExercise = (dayIndex: number, exerciseId: string, field: string, value: any) =>
    setDays(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d, exercises: d.exercises.map(e => (e as PlanExercise).exercise_id === exerciseId ? { ...e, [field]: value } : e)
    }))

  const handleExerciseCreated = (dayIndex: number, exercise: CreatedExercise) => {
    const ex: Exercise = { id: exercise.id, name: exercise.name, category: exercise.category, exercise_type: 'strength' }
    setExercises(prev => [...prev, ex])
    addExerciseToDay(dayIndex, ex)
    setCreateExerciseFor(null)
    setCreateExerciseName('')
  }

  const removeItem = (dayIndex: number, itemId: string) => {
    setDays(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d, exercises: d.exercises.filter(e =>
        (e as PlanExercise).exercise_id !== itemId &&
        (e as TemplateBlock).block_id !== itemId
      )
    }))
    setConfirmEx(null)
  }

  const reorderExercises = (dayIndex: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIndex) return d
      const oldIdx = d.exercises.findIndex(e => getItemDndId(e as any) === active.id)
      const newIdx = d.exercises.findIndex(e => getItemDndId(e as any) === over.id)
      if (oldIdx === -1 || newIdx === -1) return d
      return { ...d, exercises: arrayMove(d.exercises, oldIdx, newIdx) }
    }))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
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
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden" showCloseButton={false} style={{ background: isDark ? 'oklch(0.195 0.018 264)' : 'white' }}>
          <DialogTitle className="sr-only">{t('addTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('addTitle')}</DialogDescription>

          {/* Colored header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-4 shrink-0 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CalendarDays size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base">{t('addTitle')}</h2>
              <p className="text-indigo-100/70 text-xs">{t('form.addSubtitle')}</p>
            </div>
            <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Fixed: name + description */}
          <div className={`px-6 pt-4 pb-3 border-b shrink-0 ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-indigo-50/30'}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('form.name')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('form.namePlaceholder')} required className={`h-9 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}`} />
              </div>
              <div className="space-y-1">
                <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('form.description')}</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('form.descriptionPlaceholder')} className={`h-9 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}`} />
              </div>
            </div>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 pb-2">
            <form id="add-plan-form" onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-3">
                <div className={`flex items-center justify-between sticky top-0 z-10 -mx-6 px-6 py-2 border-b ${isDark ? 'bg-[oklch(0.195_0.018_264)] border-white/8' : 'bg-white border-gray-100'}`}>
                  <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('form.trainingDays')} ({days.length})</span>
                  <Button type="button" variant="outline" size="sm" onClick={addDay}
                    className={`flex items-center gap-1 h-7 text-xs px-2.5 ${isDark ? 'border-white/10 text-indigo-400 hover:bg-white/[0.05]' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}>
                    <Plus size={12} />{t('form.addDayLabel')}
                  </Button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderDays}>
                  <SortableContext items={days.map(d => d._id)} strategy={verticalListSortingStrategy}>
                {days.map((day, index) => (
                  <SortableDayWrapper key={day._id} id={day._id} isNew={flashDayId === day._id}>
                  {(dayDragHandle) => (
                  <div className={`border rounded-xl shadow-sm ${isDark ? 'border-white/10' : 'border-blue-300'}`}>
                    {/* Accordion header */}
                    <div className={`flex items-center gap-2 px-3 py-2.5 border-b rounded-t-xl ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-blue-100 border-blue-300'}`}>
                      <button type="button" {...dayDragHandle} className={`cursor-grab active:cursor-grabbing shrink-0 touch-none ${isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'}`} tabIndex={-1}>
                        <GripVertical size={14} />
                      </button>
                      <button type="button" onClick={() => toggleDay(index)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        {isDayExpanded(index) ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                        <span className={`font-medium text-sm ${isDark ? 'text-gray-200' : ''}`}>{t('form.dayLabel')} {day.day_number}</span>
                        <span className="text-xs text-gray-400 truncate">{day.name !== `${t('form.dayLabel')} ${day.day_number}` ? `· ${day.name}` : ''}</span>
                        {!isDayExpanded(index) && (
                          <span className="text-xs text-gray-400 ml-auto shrink-0">
                            {t('form.exercisesCollapsed', { count: flattenExercises(day.exercises as any[]).length })}
                          </span>
                        )}
                      </button>
                      <button type="button" title={t('form.copyDayTooltip')} onClick={() => copyDay(index)} className={`p-1 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => setConfirmDay(index)} className="p-1">
                        <X size={13} className={`${isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`} />
                      </button>
                    </div>

                    {isDayExpanded(index) && (
                      <div className="px-2.5 pb-2.5 pt-2 space-y-2">

                        {/* Row 1: name input + segmented mode control */}
                        <div className="flex items-center gap-1.5">
                          <Input value={day.name} onChange={e => updateDayField(index, 'name', e.target.value)}
                            placeholder="Push, Pull, Legs..." className={`flex-1 h-7 text-xs ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}`} />
                          <div className={`flex rounded-md border overflow-hidden shrink-0 text-xs ${isDark ? 'border-white/10' : 'border-gray-300'}`}>
                            {(['template', 'custom'] as const).map((dayMode, mi) => (
                              <button key={dayMode} type="button"
                                onClick={() => updateDayField(index, 'mode', dayMode)}
                                title={dayMode === 'template' ? t('form.template') : t('form.createWorkout')}
                                className={`flex items-center gap-1 px-2 py-1 h-7 transition-colors ${mi > 0 ? (isDark ? 'border-l border-white/10' : 'border-l border-gray-300') : ''} ${
                                  day.mode === dayMode
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : isDark ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]' : 'bg-white text-gray-500 hover:bg-gray-50'
                                }`}>
                                {dayMode === 'template' ? <BookOpen size={11} /> : <Pencil size={11} />}
                                <span>{dayMode === 'template' ? t('form.template') : t('form.createWorkout')}</span>
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
                            isDark={isDark}
                            options={[
                              { value: '', label: t('form.noTemplate') },
                              ...templates.map(tmpl => ({ value: tmpl.id, label: `${tmpl.name} (${flattenExercises(tmpl.exercises || []).length} ${t('form.exerciseCountSuffix')})` }))
                            ]}
                          />
                        )}

                        {/* Search + Dodaj superset */}
                        <div className="flex gap-1.5 items-start">
                        <div className="relative flex-1">
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
                              className={`h-7 text-xs pl-7 border-dashed focus:border-solid ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600 focus:border-blue-500' : 'focus:border-blue-300'}`}
                            />
                          </div>
                          {!!(searchFocused[index] || exerciseSearch[index]) && (
                            <div className={`absolute top-full left-0 right-0 z-50 mt-1 border rounded-xl shadow-lg overflow-hidden ${isDark ? 'border-white/10 bg-[oklch(0.18_0.018_264)]' : 'border-blue-100 bg-white'}`}>
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
                                    onClick={() => { addExerciseToDay(index, e); setDropdownKbIndex(prev => ({ ...prev, [index]: -1 })) }}
                                    onMouseEnter={() => setDropdownKbIndex(prev => ({ ...prev, [index]: ei }))}
                                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs border-b last:border-0 transition-colors ${
                                      (dropdownKbIndex[index] ?? -1) === ei
                                        ? 'bg-blue-600 text-white'
                                        : isDark ? 'border-white/5 text-gray-300 hover:bg-white/[0.06]' : 'border-gray-50 hover:bg-blue-50'
                                    }`}>
                                    <span className="font-medium">{e.name}</span>
                                    <div className="flex items-center gap-1.5">
                                      {e.exercise_type === 'endurance' && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${(dropdownKbIndex[index] ?? -1) === ei ? 'bg-blue-500 text-white border-blue-400' : isDark ? 'bg-blue-900/30 text-blue-400 border-blue-800/40' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{t('form.enduranceBadge')}</span>}
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${(dropdownKbIndex[index] ?? -1) === ei ? 'bg-blue-500 text-white border-blue-400' : isDark ? 'bg-white/[0.08] text-gray-400 border-white/10' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{e.category}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <div className={`border-t px-3 py-2 ${isDark ? 'border-white/8 bg-white/[0.03]' : 'border-blue-50 bg-blue-50/40'}`}>
                                <button type="button"
                                  onMouseDown={ev => ev.preventDefault()}
                                  onClick={() => { setCreateExerciseName(exerciseSearch[index] || ''); setCreateExerciseFor(index) }}
                                  className="w-full text-left text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 font-medium transition-colors">
                                  <Plus size={12} />
                                  <span>{exerciseSearch[index] ? tTemplate('createExercise', { search: exerciseSearch[index] }) : tTemplate('createNewExercise')}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Dodaj superset button */}
                        <button
                          type="button"
                          onClick={() => addBlockToDay(index)}
                          className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border font-medium transition-colors shrink-0 h-9 ${
                            isDark
                              ? 'border-violet-800/50 text-violet-400 hover:bg-violet-900/30'
                              : 'border-violet-200 text-violet-600 hover:bg-violet-50'
                          }`}
                          title={tTemplate('addBlock')}
                        >
                          <Layers size={12} />
                          SS
                        </button>
                        </div>

                        {/* Exercises with DnD */}
                        <DndContext sensors={sensors} collisionDetection={closestCenter}
                          onDragEnd={ev => reorderExercises(index, ev)}>
                          <SortableContext items={day.exercises.map(e => getItemDndId(e as any))} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {day.exercises.map((item, exIndex) => {
                                if (isBlock(item as any)) {
                                  const block = item as TemplateBlock
                                  const blockIdx = day.exercises.slice(0, exIndex + 1).filter(e => isBlock(e as any)).length - 1
                                  const usedIds = new Set<string>()
                                  day.exercises.forEach(e => {
                                    if (isBlock(e as any)) (e as TemplateBlock).exercises.forEach(ex => usedIds.add(ex.exercise_id))
                                    else usedIds.add((e as PlanExercise).exercise_id)
                                  })
                                  return (
                                    <BlockCard
                                      key={block.block_id}
                                      block={block}
                                      blockIndex={blockIdx}
                                      isDark={isDark}
                                      exerciseOptions={exercises as ExerciseOption[]}
                                      usedExerciseIds={usedIds}
                                      onUpdateBlock={(blockId, field, value) => updateBlockInDay(index, blockId, field, value)}
                                      onAddExerciseToBlock={(blockId, exercise) => addExerciseToBlockInDay(index, blockId, exercise)}
                                      onUpdateExerciseInBlock={(blockId, exerciseId, field, value) => updateExerciseInBlockInDay(index, blockId, exerciseId, field, value)}
                                      onRemoveExerciseFromBlock={(blockId, exerciseId) => removeExerciseFromBlockInDay(index, blockId, exerciseId)}
                                      onRemoveBlock={blockId => setConfirmEx({ day: index, id: blockId })}
                                      onMoveExerciseOut={(blockId, exerciseId) => moveExerciseOutOfBlockInDay(index, blockId, exerciseId)}
                                    />
                                  )
                                }
                                const ex = item as PlanExercise
                                const exVisualIdx = day.exercises.slice(0, exIndex + 1).filter(e => !isBlock(e as any)).length - 1
                                return (
                                  <SortableExerciseCard
                                    key={ex.exercise_id} ex={ex} index={exVisualIdx}
                                    onUpdate={(field, val) => updateExercise(index, ex.exercise_id, field, val)}
                                    onRemove={() => setConfirmEx({ day: index, id: ex.exercise_id })}
                                    labelSets={tTemplate('sets')} labelRest={tTemplate('rest')} labelNotes={tTemplate('notes')}
                                  activeExerciseFields={trainerSettings.exerciseFields}
                                />
                                )
                              })}
                            </div>
                          </SortableContext>
                        </DndContext>

                        {day.exercises.length === 0 && (
                          <p className={`text-xs text-center py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
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

                {days.length === 0 && (
                  <p className={`text-xs text-center py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('form.emptyDays')}</p>
                )}
                <div ref={daysEndRef} />
              </div>
            </form>
          </div>

          <div className={`px-6 py-4 border-t shrink-0 flex gap-3 ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-white'}`}>
            {error && <p className="text-red-500 text-sm flex-1">{error}</p>}
            <Button type="button" variant="outline" onClick={onClose}
              className={`flex-1 ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/[0.05]' : ''}`}>{tCommon('cancel')}</Button>
            <Button type="submit" form="add-plan-form" disabled={loading || days.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              {loading ? tCommon('saving') : t('form.save')}
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
        onConfirm={() => confirmEx && removeItem(confirmEx.day, confirmEx.id)} onCancel={() => setConfirmEx(null)}
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


