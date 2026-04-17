'use client'

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Dumbbell, X, ChevronDown, ChevronUp, BarChart2, BookMarked } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddPlanDialog from '@/app/dashboard/training/dialogs/add-plan-dialog'
import EditPlanDialog from '@/app/dashboard/training/dialogs/edit-plan-dialog'
import { useTranslations, useLocale } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTrainerSettings } from '@/hooks/use-trainer-settings'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import SortableExerciseCard from '@/app/dashboard/training/components/sortable-exercise-card'

type Props = { clientId: string }

type WorkoutPlan = {
  id: string
  name: string
  description: string | null
  days: any[]
}

type AssignedPlan = {
  id: string
  active: boolean
  assigned_at: string
  ended_at: string | null
  notes: string | null
  days: any[] | null
  workout_plan: WorkoutPlan
}

type Exercise = {
  id: string
  name: string
  category: string
  exercise_type?: string
  primary_muscles?: string[]
  secondary_muscles?: string[]
}

type PlanExercise = {
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes: string
  exercise_type?: 'strength' | 'endurance'
}

type PlanDay = {
  day_number: number
  name: string
  exercises: PlanExercise[]
}



function DayAccordion({
  days,
  trackedExerciseIds,
  onToggleTracked,
  togglingId,
}: {
  days: any[]
  trackedExerciseIds: string[]
  onToggleTracked: (exerciseId: string) => void
  togglingId: string | null
}) {
  const t = useTranslations('clients.workoutPlans')
  const [openDays, setOpenDays] = useState<Record<number, boolean>>({})
  const toggle = (i: number) => setOpenDays(prev => ({ ...prev, [i]: !(prev[i] ?? false) }))
  const tracked = new Set(trackedExerciseIds)
  const atLimit = trackedExerciseIds.length >= 10
  return (
    <div className="border-t border-gray-100 divide-y divide-gray-50">
      {days.map((day: any, dayIdx: number) => (
        <div key={dayIdx}>
          <button
            type="button"
            onClick={() => toggle(dayIdx)}
            className="w-full flex items-center gap-2 px-2 py-2 hover:bg-gray-50 transition-colors text-left"
          >
            {openDays[dayIdx] ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
            <span className="text-xs font-semibold text-gray-600">{day.name}</span>
            <span className="text-xs text-gray-400 ml-1">{t('exerciseCountBadge', { count: day.exercises?.length || 0 })}</span>
          </button>
          {openDays[dayIdx] && (
            <div className="px-2 pb-2">
              {(day.exercises || []).map((ex: any, exIdx: number) => {
                const isOn = tracked.has(ex.exercise_id)
                const disabled = !isOn && atLimit
                return (
                  <div
                    key={ex.exercise_id}
                    className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-gray-300 w-4 text-right tabular-nums shrink-0">{exIdx + 1}</span>
                      <span className="text-sm text-gray-800 truncate">{ex.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0 hidden sm:inline">
                      {ex.sets}×{ex.reps}{ex.rest_seconds ? ` · ${ex.rest_seconds}s` : ''}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-gray-400 max-w-[72px] leading-tight text-right hidden sm:block">
                        {t('trackInAnalyticsShort')}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        aria-label={t('trackInAnalyticsAria')}
                        disabled={disabled || togglingId === ex.exercise_id}
                        title={disabled ? t('trackLimitReached') : isOn ? t('trackRemoveHint') : t('trackAddHint')}
                        onClick={e => {
                          e.stopPropagation()
                          onToggleTracked(ex.exercise_id)
                        }}
                        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                          isOn ? 'bg-violet-600' : 'bg-gray-200'
                        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            isOn ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ClientWorkoutPlans({ clientId }: Props) {
  const t = useTranslations('clients.workoutPlans')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const { settings: trainerSettings } = useTrainerSettings()

  const [assignedPlans, setAssignedPlans] = useState<AssignedPlan[]>([])
  const [availablePlans, setAvailablePlans] = useState<WorkoutPlan[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [assignDays, setAssignDays] = useState<PlanDay[]>([])
  const [assignNotes, setAssignNotes] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignExSearch, setAssignExSearch] = useState<Record<number, string>>({})
  const [saveToDb, setSaveToDb] = useState(false)
  const [assignSearchFocused, setAssignSearchFocused] = useState<Record<number, boolean>>({})
  const assignBlurTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const assignSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<AssignedPlan | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [planExpanded, setPlanExpanded] = useState<Record<string, boolean>>({})

  const [renameTarget, setRenameTarget] = useState<AssignedPlan | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [trackedExerciseIds, setTrackedExerciseIds] = useState<string[]>([])
  const [togglingTrackedId, setTogglingTrackedId] = useState<string | null>(null)

  // Conflict: trying to activate a plan while another is already active
  const [activateConflict, setActivateConflict] = useState<{
    existingName: string
    execute: () => Promise<void>
  } | null>(null)

  // Initialise expanded state once plans load: active = open, inactive = closed
  useEffect(() => {
    if (!assignedPlans.length) return
    setPlanExpanded(prev => {
      const next = { ...prev }
      assignedPlans.forEach(p => { if (!(p.id in next)) next[p.id] = p.active })
      return next
    })
  }, [assignedPlans])

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const [{ data: assigned }, { data: available }, { data: trainerEx }, { data: defaultEx }] = await Promise.all([
      supabase
        .from('client_workout_plans')
        .select(`id, active, assigned_at, ended_at, notes, days, workout_plan:workout_plans(id, name, description, days)`)
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('workout_plans')
        .select('id, name, description, days')
        .eq('trainer_id', user.id)
        .eq('is_template', true)
        .order('name'),
      supabase
        .from('exercises')
        .select('id, name, category, exercise_type, primary_muscles, secondary_muscles')
        .eq('trainer_id', user.id)
        .order('name'),
      supabase
        .from('exercises')
        .select('id, name, category, exercise_type, primary_muscles, secondary_muscles')
        .eq('is_default', true)
        .order('name'),
    ])
    // Merge trainer exercises + defaults; trainer overrides default if same id
    const exercises = [...(defaultEx || []), ...(trainerEx || [])]

    if (assigned) setAssignedPlans(assigned as any)
    if (available) setAvailablePlans(available)
    if (exercises) setAllExercises(exercises)

    const { data: trackedRows, error: trackedErr } = await supabase
      .from('client_tracked_exercises')
      .select('exercise_id')
      .eq('client_id', clientId)
      .order('sort_order', { ascending: true })
    if (!trackedErr) {
      setTrackedExerciseIds((trackedRows || []).map((r: { exercise_id: string }) => r.exercise_id))
    } else {
      setTrackedExerciseIds([])
    }

    setLoading(false)
  }

  const toggleTrackedExercise = async (exerciseId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const isOn = trackedExerciseIds.includes(exerciseId)
    setTogglingTrackedId(exerciseId)
    try {
      if (isOn) {
        const { error } = await supabase
          .from('client_tracked_exercises')
          .delete()
          .eq('client_id', clientId)
          .eq('exercise_id', exerciseId)
        if (!error) setTrackedExerciseIds(prev => prev.filter(id => id !== exerciseId))
      } else {
        if (trackedExerciseIds.length >= 10) return
        const { error } = await supabase.from('client_tracked_exercises').insert({
          client_id: clientId,
          exercise_id: exerciseId,
          sort_order: trackedExerciseIds.length,
        })
        if (error) {
          if (
            error.message?.includes('client_tracked_exercises_limit') ||
            error.code === '23514' ||
            error.code === 'P0001'
          ) {
            setSavedMsg(t('trackLimitToast'))
            setTimeout(() => setSavedMsg(null), 4000)
          }
          return
        }
        setTrackedExerciseIds(prev => [...prev, exerciseId])
      }
    } finally {
      setTogglingTrackedId(null)
    }
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    const plan = availablePlans.find(p => p.id === planId)
    if (!plan) { setAssignDays([]); return }
    setAssignDays((plan.days || []).map((d: any, i: number) => ({
      day_number: i + 1,
      name: d.name ?? `Dan ${i + 1}`,
      exercises: (d.exercises || []).map((e: any) => ({
        exercise_id: e.exercise_id ?? e.id,
        name: e.name ?? '',
        sets: e.sets ?? 3,
        reps: String(e.reps ?? '10'),
        rest_seconds: e.rest_seconds ?? 60,
        notes: e.notes ?? '',
        exercise_type: e.exercise_type || 'strength',
      }))
    })))
  }

  const updateAssignEx = (dayIdx: number, exId: string, field: string, value: any) => {
    setAssignDays(prev => prev.map((d, i) => i !== dayIdx ? d : {
      ...d, exercises: d.exercises.map(e => e.exercise_id !== exId ? e : { ...e, [field]: value })
    }))
  }

  const removeAssignEx = (dayIdx: number, exId: string) => {
    setAssignDays(prev => prev.map((d, i) => i !== dayIdx ? d : {
      ...d, exercises: d.exercises.filter(e => e.exercise_id !== exId)
    }))
  }

  const addAssignEx = (dayIdx: number, ex: Exercise) => {
    console.log('[addAssignEx] workoutDefaults:', trainerSettings.workoutDefaults)
    const { sets, reps, rest_seconds, ...optionalDefaults } = trainerSettings.workoutDefaults
    const optionalFields: Record<string, string> = {}
    trainerSettings.exerciseFields.forEach(key => {
      if (optionalDefaults[key]) optionalFields[key] = String(optionalDefaults[key])
    })
    setAssignDays(prev => prev.map((d, i) => i !== dayIdx ? d : {
      ...d, exercises: [...d.exercises, {
        exercise_id: ex.id, name: ex.name, sets,
        reps: ex.exercise_type === 'endurance' ? '5min' : reps,
        rest_seconds, notes: '',
        exercise_type: (ex.exercise_type as 'strength' | 'endurance') || 'strength',
        ...optionalFields,
      }]
    }))
    setAssignExSearch(prev => ({ ...prev, [dayIdx]: '' }))
    setAssignSearchFocused(prev => ({ ...prev, [dayIdx]: false }))
  }

  const reorderAssignEx = (dayIdx: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setAssignDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d
      const oldIdx = d.exercises.findIndex(e => e.exercise_id === active.id)
      const newIdx = d.exercises.findIndex(e => e.exercise_id === over.id)
      return { ...d, exercises: arrayMove(d.exercises, oldIdx, newIdx) }
    }))
  }

  // Deactivate all other plans for this client, then run the provided action
  const nowIso = () => new Date().toISOString()

  const deactivateOthersAndRun = async (exceptId: string | null, action: () => Promise<void>) => {
    const others = assignedPlans.filter(p => p.active && p.id !== exceptId)
    for (const p of others) {
      await supabase.from('client_workout_plans').update({ active: false, ended_at: nowIso() }).eq('id', p.id)
    }
    await action()
    fetchData()
  }

  const assignPlan = async () => {
    if (!selectedPlanId) return

    const currentActive = assignedPlans.find(p => p.active)
    const doInsert = async () => {
      setAssigning(true)
      const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
      if (!user) return
      if (saveToDb) {
        const planName = availablePlans.find(p => p.id === selectedPlanId)?.name || 'Plan'
        await supabase.from('workout_plans').insert({ trainer_id: user.id, name: `${planName} (kopija)`, days: assignDays })
      }
      await supabase.from('client_workout_plans').insert({
        trainer_id: user.id, client_id: clientId,
        workout_plan_id: selectedPlanId, days: assignDays,
        notes: assignNotes || null, active: true,
      })
      setAssigning(false)
      setShowAssignDialog(false)
      setSelectedPlanId(''); setAssignDays([]); setAssignNotes(''); setSaveToDb(false)
    }

    if (currentActive) {
      setActivateConflict({
        existingName: currentActive.workout_plan.name,
        execute: () => deactivateOthersAndRun(null, doInsert),
      })
    } else {
      await doInsert()
      fetchData()
    }
  }

  const handleNewPlanCreated = async (planId: string, days: any[]) => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const currentActive = assignedPlans.find(p => p.active)
    const doInsert = async () => {
      await supabase.from('client_workout_plans').insert({
        trainer_id: user.id, client_id: clientId,
        workout_plan_id: planId, days: days || [], active: true,
      })
      setShowCreateDialog(false)
    }

    if (currentActive) {
      setActivateConflict({
        existingName: currentActive.workout_plan.name,
        execute: () => deactivateOthersAndRun(null, doInsert),
      })
    } else {
      await doInsert()
      fetchData()
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    // Deactivating — always allowed
    if (current) {
      const ended = nowIso()
      await supabase.from('client_workout_plans').update({ active: false, ended_at: ended }).eq('id', id)
      setAssignedPlans(prev => prev.map(p => p.id === id ? { ...p, active: false, ended_at: ended } : p))
      return
    }
    // Activating — check if another plan is already active
    const currentActive = assignedPlans.find(p => p.active && p.id !== id)
    if (currentActive) {
      setActivateConflict({
        existingName: currentActive.workout_plan.name,
        execute: () => deactivateOthersAndRun(id, async () => {
          await supabase.from('client_workout_plans').update({ active: true, ended_at: null }).eq('id', id)
        }),
      })
    } else {
      await supabase.from('client_workout_plans').update({ active: true, ended_at: null }).eq('id', id)
      setAssignedPlans(prev => prev.map(p => p.id === id ? { ...p, active: true, ended_at: null } : p))
    }
  }

  const deletePlan = async (id: string) => {
    const { count } = await supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('plan_id', id)
    if (count && count > 0) {
      await supabase.from('client_workout_plans').update({ active: false, ended_at: nowIso() }).eq('id', id)
    } else {
      await supabase.from('client_workout_plans').delete().eq('id', id)
      setAssignedPlans(prev => prev.filter(p => p.id !== id))
    }
    setConfirmDeleteId(null)
    fetchData()
  }

  const renamePlan = async () => {
    if (!renameTarget || !renameName.trim()) return
    setRenaming(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
      if (!user) return
      const original = renameTarget.workout_plan
      const { data: copy, error } = await supabase
        .from('workout_plans')
        .insert({ trainer_id: user.id, name: renameName.trim(), description: original.description, days: original.days, is_template: false })
        .select('id')
        .single()
      if (error || !copy) { alert('Greška pri preimenovanju.'); return }
      await supabase.from('client_workout_plans').update({ workout_plan_id: copy.id }).eq('id', renameTarget.id)
      setAssignedPlans(prev => prev.map(p => p.id === renameTarget.id
        ? { ...p, workout_plan: { ...original, id: copy.id, name: renameName.trim() } }
        : p
      ))
      setRenameTarget(null)
    } finally {
      setRenaming(false)
    }
  }

  const saveAsTemplate = async (assigned: AssignedPlan) => {
    setSavingTemplate(assigned.id)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setSavingTemplate(null); return }
    const effectiveDays = assigned.days?.length ? assigned.days : assigned.workout_plan.days || []
    const templateName  = `${assigned.workout_plan.name} (predložak)`
    await supabase.from('workout_plans').insert({
      trainer_id: user.id,
      name: templateName,
      description: assigned.workout_plan.description,
      is_template: true,
      days: effectiveDays,
    })
    setSavingTemplate(null)
    setSavedMsg(`Dodano u predloške kao „${templateName}"`)
    setTimeout(() => setSavedMsg(null), 3500)
  }

  if (loading) return <p className="text-sm text-gray-500">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">

      {savedMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 16 16"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {savedMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {assignedPlans.length === 0 ? t('noAssignedPlans') : t('assigned', { count: assignedPlans.length })}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
            <Plus size={14} /> {t('createNew')}
          </Button>
          <Button size="sm" onClick={() => setShowAssignDialog(true)} className="flex items-center gap-2">
            <Plus size={14} /> {t('assignExisting')}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {assignedPlans.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell size={24} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">{t('clientNoPlans')}</p>
            <button onClick={() => setShowAssignDialog(true)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
              {t('assignFirst')}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Plan cards — each with inline per-plan analysis */}
      {(() => {
        const exerciseMap = new Map(allExercises.map(e => [e.id, e]))
        return [...assignedPlans].sort((a, b) => Number(b.active) - Number(a.active)).map(assigned => {
          const days = assigned.days?.length ? assigned.days : assigned.workout_plan.days || []
          const isPersonalized = !!(assigned.days?.length)
          const isOpen = planExpanded[assigned.id] ?? assigned.active

          // Compute per-plan stats
          const setsByDay: Array<{ name: string; sets: number }> = []
          const muscleMap: Record<string, { primary: number; secondary: number }> = {}
          days.forEach((day: any, idx: number) => {
            let daySets = 0
            ;(day.exercises || []).forEach((ex: any) => {
              const info = exerciseMap.get(ex.exercise_id)
              const sets = Number(ex.sets) || 0
              daySets += sets
              ;(info?.primary_muscles?.length ? info.primary_muscles : (info?.category ? [info.category] : [])).forEach((m: string) => {
                if (!muscleMap[m]) muscleMap[m] = { primary: 0, secondary: 0 }
                muscleMap[m].primary += sets
              })
              ;(info?.secondary_muscles || []).forEach((m: string) => {
                if (!muscleMap[m]) muscleMap[m] = { primary: 0, secondary: 0 }
                muscleMap[m].secondary += sets
              })
            })
            setsByDay.push({ name: day.name || `Dan ${idx + 1}`, sets: daySets })
          })
          const muscleData = Object.entries(muscleMap)
            .map(([name, { primary, secondary }]) => ({ name, primary, secondary }))
            .sort((a, b) => (b.primary + b.secondary) - (a.primary + a.secondary))
          const totalSets      = setsByDay.reduce((s, d) => s + d.sets, 0)
          const totalExercises = days.reduce((sum: number, d: any) => sum + (d.exercises?.length || 0), 0)
          const maxSets        = Math.max(...setsByDay.map(d => d.sets), 1)
          const muscleChartH   = Math.max(120, muscleData.length * 32 + 16)
          const dayChartH      = Math.max(100, setsByDay.length * 32 + 16)
          const hasAnalysis    = totalSets > 0

          return (
            <Card key={assigned.id} className={`transition-shadow ${!assigned.active ? 'opacity-70' : ''}`}>
              <CardContent className="py-0">

                {/* ── Header — click = expand/collapse ── */}
                <div
                  className="py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-gray-50/50 rounded-t-xl transition-colors"
                  onClick={() => setPlanExpanded(prev => ({ ...prev, [assigned.id]: !isOpen }))}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isOpen
                      ? <ChevronUp size={13} className="text-gray-400 shrink-0" />
                      : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${assigned.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{assigned.workout_plan.name}</span>
                          {isPersonalized && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                            {t('personalizedBadge')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t('days', { count: days.length })} · {t('exerciseCountBadge', { count: totalExercises })} · {new Date(assigned.assigned_at).toLocaleDateString(locale)}
                        {assigned.notes && <> · {assigned.notes}</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm"
                      onClick={() => toggleActive(assigned.id, assigned.active)}
                      className={`text-xs h-7 px-3 rounded-full border ${
                        assigned.active
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}>
                      {assigned.active ? t('activeStatusLabel') : t('inactiveStatusLabel')}
                    </Button>
                    <Button variant="ghost" size="sm" title={t('renameTooltip')} onClick={() => { setRenameTarget(assigned); setRenameName(assigned.workout_plan.name) }}>
                      <span className="text-[11px] text-gray-400">Abc</span>
                    </Button>
                    <Button variant="ghost" size="sm" title={t('saveAsTemplateTooltip')}
                      onClick={() => saveAsTemplate(assigned)}
                      disabled={savingTemplate === assigned.id}>
                      <BookMarked size={14} className="text-violet-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(assigned)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(assigned.id)}>
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* ── Expandable body ── */}
                {isOpen && (
                  <>
                    {/* Days accordion */}
                    {days.length > 0 && (
                      <DayAccordion
                        days={days}
                        trackedExerciseIds={trackedExerciseIds}
                        onToggleTracked={toggleTrackedExercise}
                        togglingId={togglingTrackedId}
                      />
                    )}

                    {/* Per-plan analysis */}
                    {hasAnalysis && (
                      <div className="border-t border-gray-50 bg-gradient-to-br from-slate-50/70 to-white px-4 pt-4 pb-5 rounded-b-xl">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${accentHex}18` }}>
                            <BarChart2 size={11} style={{ color: accentHex }} />
                          </div>
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{t('analysisTitle')}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left: mini stats + sets per day */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: t('analysisDays'),      value: days.length },
                                { label: t('analysisExercises'), value: totalExercises },
                                { label: t('analysisSets'),      value: totalSets },
                              ].map(({ label, value }) => (
                                <div key={label} className="rounded-lg px-2 py-2 text-center" style={{ backgroundColor: `${accentHex}0d` }}>
                                  <p className="text-base font-black" style={{ color: accentHex }}>{value}</p>
                                  <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                                </div>
                              ))}
                            </div>
                            <ResponsiveContainer width="100%" height={dayChartH}>
                              <BarChart data={setsByDay} layout="vertical" margin={{ top: 0, right: 36, left: 4, bottom: 0 }} barCategoryGap="28%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                                <XAxis type="number" domain={[0, maxSets + 2]} tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} cursor={{ fill: `${accentHex}0a` } as any} />
                                <Bar dataKey="sets" fill={accentHex} fillOpacity={0.9} radius={[0, 6, 6, 0]}>
                                  <LabelList dataKey="sets" position="right" style={{ fontSize: 11, fontWeight: 600, fill: accentHex }} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Right: muscle groups stacked */}
                          {muscleData.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{t('muscleGroupsTitle')}</p>
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: accentHex }} />
                                    {t('primaryLegend')}
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: accentHex, opacity: 0.3 }} />
                                    {t('secondaryLegend')}
                                  </span>
                                </div>
                              </div>
                              <ResponsiveContainer width="100%" height={muscleChartH}>
                                <BarChart data={muscleData} layout="vertical" margin={{ top: 0, right: 40, left: 4, bottom: 0 }} barCategoryGap="28%">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                                  <XAxis type="number" tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                                  <Tooltip
                                    content={({ active, payload, label }: any) => {
                                      if (!active || !payload?.length) return null
                                      const pri = payload.find((p: any) => p.dataKey === 'primary')?.value ?? 0
                                      const sec = payload.find((p: any) => p.dataKey === 'secondary')?.value ?? 0
                                      return (
                                        <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-xs space-y-0.5">
                                          <p className="font-bold text-gray-800 mb-1">{label}</p>
                                          {pri > 0 && <p style={{ color: accentHex }} className="font-semibold">{t('primaryTooltip', { count: pri })}</p>}
                                          {sec > 0 && <p style={{ color: accentHex, opacity: 0.6 }} className="font-semibold">{t('secondaryTooltip', { count: sec })}</p>}
                                        </div>
                                      )
                                    }}
                                    cursor={{ fill: `${accentHex}0a` } as any}
                                  />
                                  <Bar dataKey="primary" stackId="m" fill={accentHex} fillOpacity={0.9} radius={[0, 0, 0, 0]}>
                                    <LabelList content={({ x, y, width, height, value, index }: any) => {
                                      const sec = muscleData[index]?.secondary ?? 0
                                      if (sec > 0) return null
                                      return value > 0 ? <text x={Number(x)+Number(width)+6} y={Number(y)+Number(height)/2} dominantBaseline="middle" fill={accentHex} fontSize={11} fontWeight={600}>{value}</text> : null
                                    }} />
                                  </Bar>
                                  <Bar dataKey="secondary" stackId="m" fill={accentHex} fillOpacity={0.28} radius={[0, 5, 5, 0]}>
                                    <LabelList content={({ x, y, width, height, value, index }: any) => {
                                      const pri = muscleData[index]?.primary ?? 0
                                      const total = pri + (value ?? 0)
                                      return total > 0 && Number(width) > 0 ? <text x={Number(x)+Number(width)+6} y={Number(y)+Number(height)/2} dominantBaseline="middle" fill="#9ca3af" fontSize={11} fontWeight={600}>{total}</text> : null
                                    }} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })
      })()}

      {/* ── (analysis now lives inside each plan card) ── */}
      {false && (() => {
        const exerciseMap = new Map(allExercises.map(e => [e.id, e]))
        const activeDays = assignedPlans
          .filter(p => p.active)
          .flatMap(p => (p.days?.length ? p.days : p.workout_plan.days || []))

        // Sets per training day
        const setsByDay: Array<{ name: string; sets: number }> = []
        // Muscle groups: primary in full color, secondary in faded
        const muscleMap: Record<string, { primary: number; secondary: number }> = {}

        activeDays.forEach((day: any, idx: number) => {
          let daySets = 0
          ;(day.exercises || []).forEach((ex: any) => {
            const info = exerciseMap.get(ex.exercise_id)
            const sets = Number(ex.sets) || 0
            daySets += sets
            ;(info?.primary_muscles?.length ? info.primary_muscles : (info?.category ? [info.category] : [])).forEach((m: string) => {
              if (!muscleMap[m]) muscleMap[m] = { primary: 0, secondary: 0 }
              muscleMap[m].primary += sets
            })
            ;(info?.secondary_muscles || []).forEach((m: string) => {
              if (!muscleMap[m]) muscleMap[m] = { primary: 0, secondary: 0 }
              muscleMap[m].secondary += sets
            })
          })
          setsByDay.push({ name: day.name || `Dan ${idx + 1}`, sets: daySets })
        })

        const muscleData = Object.entries(muscleMap)
          .map(([name, { primary, secondary }]) => ({ name, primary, secondary }))
          .sort((a, b) => (b.primary + b.secondary) - (a.primary + a.secondary))

        const MuscleTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null
          const primary   = payload.find((p: any) => p.dataKey === 'primary')?.value ?? 0
          const secondary = payload.find((p: any) => p.dataKey === 'secondary')?.value ?? 0
          return (
            <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-xs space-y-0.5">
              <p className="font-bold text-gray-800 mb-1">{label}</p>
              {primary > 0 && <p style={{ color: accentHex }} className="font-semibold">Primarni: {primary} ser.</p>}
              {secondary > 0 && <p style={{ color: accentHex, opacity: 0.55 }} className="font-semibold">Sekundarni: {secondary} ser.</p>}
            </div>
          )
        }

        const DayTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null
          return (
            <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-xs">
              <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
              <p className="font-bold" style={{ color: accentHex }}>{payload[0].value} serija</p>
            </div>
          )
        }

        if (muscleData.length === 0 && setsByDay.every(d => d.sets === 0)) return null

        // Summary stats
        const totalSets      = setsByDay.reduce((s, d) => s + d.sets, 0)
        const totalExercises = activeDays.reduce((s: number, d: any) => s + (d.exercises?.length || 0), 0)
        const totalDays      = activeDays.length
        const maxSets        = Math.max(...setsByDay.map(d => d.sets), 1)

        // Dynamic height for muscle chart and day chart
        const muscleChartH = Math.max(160, muscleData.length * 34 + 20)
        const dayChartH    = Math.max(140, setsByDay.length * 34 + 20)

        return (
          <div className="mt-4 rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}18` }}>
                <BarChart2 size={14} style={{ color: accentHex }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Analiza opterećenja</h3>
                <p className="text-[11px] text-gray-400">Aktivni planovi · serije po grupi mišića</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: summary stats + horizontal sets-per-day */}
              {setsByDay.some(d => d.sets > 0) && (
                <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col gap-4">
                  {/* Mini stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Dana', value: totalDays },
                      { label: 'Vježbi', value: totalExercises },
                      { label: 'Serija', value: totalSets },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg px-3 py-2 text-center" style={{ backgroundColor: `${accentHex}0d` }}>
                        <p className="text-lg font-black" style={{ color: accentHex }}>{value}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Horizontal bar chart — serije po danu */}
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Serije po treningu</p>
                    <ResponsiveContainer width="100%" height={dayChartH}>
                      <BarChart data={setsByDay} layout="vertical" margin={{ top: 0, right: 40, left: 4, bottom: 0 }} barCategoryGap="28%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                        <XAxis type="number" domain={[0, maxSets + 2]} tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                        <Tooltip content={<DayTooltip />} cursor={{ fill: `${accentHex}0a` } as any} />
                        <Bar dataKey="sets" fill={accentHex} fillOpacity={0.9} radius={[0, 6, 6, 0]}>
                          <LabelList dataKey="sets" position="right" style={{ fontSize: 11, fontWeight: 600, fill: accentHex }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Muscle groups — stacked horizontal: primary (full) + secondary (faded) */}
              {muscleData.length > 0 && (
                <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Grupe mišića</p>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: accentHex }} />
                        Primarni
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: accentHex, opacity: 0.3 }} />
                        Sekundarni
                      </span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={muscleChartH}>
                    <BarChart data={muscleData} layout="vertical" margin={{ top: 0, right: 40, left: 4, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip content={<MuscleTooltip />} cursor={{ fill: `${accentHex}0a` } as any} />
                      {/* Primary — full accent color */}
                      <Bar dataKey="primary" stackId="m" fill={accentHex} fillOpacity={0.9} radius={[0, 0, 0, 0]}>
                        <LabelList
                          content={({ x, y, width, height, value, index }: any) => {
                            const sec = muscleData[index]?.secondary ?? 0
                            if (sec > 0) return null // label only when no secondary
                            return value > 0 ? (
                              <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="middle"
                                fill={accentHex} fontSize={11} fontWeight={600}>{value}</text>
                            ) : null
                          }}
                        />
                      </Bar>
                      {/* Secondary — same color, heavily faded */}
                      <Bar dataKey="secondary" stackId="m" fill={accentHex} fillOpacity={0.28} radius={[0, 5, 5, 0]}>
                        <LabelList
                          content={({ x, y, width, height, value, index }: any) => {
                            const pri = muscleData[index]?.primary ?? 0
                            const total = pri + (value ?? 0)
                            return total > 0 && Number(width) > 0 ? (
                              <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="middle"
                                fill="#9ca3af" fontSize={11} fontWeight={600}>{total}</text>
                            ) : null
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── ASSIGN DIALOG ── */}
      <Dialog
        open={showAssignDialog}
        onOpenChange={v => {
          setShowAssignDialog(v)
          if (!v) { setSelectedPlanId(''); setAssignDays([]); setAssignNotes(''); setSaveToDb(false) }
        }}
      >
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0" showCloseButton={false}>
          <DialogTitle className="sr-only">{t('assignDialogTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('assignDialogTitle')}</DialogDescription>

          {/* Gradient header */}
          <div className="px-6 py-4 shrink-0 flex items-center gap-3 rounded-t-lg" style={{ background: `linear-gradient(135deg, ${accentHex}ee, ${accentHex}cc)` }}>
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Dumbbell size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base">{t('assignDialogTitle')}</h2>
              <p className="text-white/60 text-xs">{t('assignDialogSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAssignDialog(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="space-y-5 pt-4">
            {/* Plan select */}
            <div className="space-y-1.5">
              <Label>{t('planLabel')}</Label>
              <Select value={selectedPlanId} onValueChange={handleSelectPlan}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectPlanPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {availablePlans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      <span className="text-gray-400 text-xs ml-1">· {t('days', { count: p.days?.length || 0 })}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Editable days */}
            {assignDays.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('customizeLabel')}</p>
                {assignDays.map((day, dayIdx) => (
                  <Card key={dayIdx}>
                    <CardContent className="py-0">
                      {/* Day header */}
                      <div className="py-3 flex items-center gap-2 border-b border-gray-100">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                        <span className="text-sm font-medium">{day.name}</span>
                        <span className="text-xs text-gray-400">{t('exerciseCountBadge', { count: day.exercises.length })}</span>
                      </div>

                      {/* Exercises with DnD */}
                      <div className="py-2 space-y-2">
                        <DndContext sensors={assignSensors} collisionDetection={closestCenter}
                          onDragEnd={ev => reorderAssignEx(dayIdx, ev)}>
                          <SortableContext items={day.exercises.map(e => e.exercise_id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {day.exercises.map((ex, exIdx) => (
                                <SortableExerciseCard
                                  key={ex.exercise_id} ex={ex} index={exIdx}
                                  onUpdate={(field, val) => updateAssignEx(dayIdx, ex.exercise_id, field, val)}
                                  onRemove={() => removeAssignEx(dayIdx, ex.exercise_id)}
                                  labelSets={t('labelSets')} labelRest={t('labelRest')} labelNotes={t('labelNotes')}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>

                        {/* Add exercise search — inline dropdown */}
                        <div className="space-y-1">
                          <Input
                            value={assignExSearch[dayIdx] || ''}
                            onChange={e => setAssignExSearch(prev => ({ ...prev, [dayIdx]: e.target.value }))}
                            onFocus={() => { if (assignBlurTimers.current[dayIdx]) clearTimeout(assignBlurTimers.current[dayIdx]); setAssignSearchFocused(prev => ({ ...prev, [dayIdx]: true })) }}
                            onBlur={() => { assignBlurTimers.current[dayIdx] = setTimeout(() => setAssignSearchFocused(prev => ({ ...prev, [dayIdx]: false })), 150) }}
                            placeholder={t('addExercisePlaceholder')}
                            className="h-8 text-sm border-dashed"
                          />
                          {!!(assignSearchFocused[dayIdx] || assignExSearch[dayIdx]) && (
                            <div className="border rounded-md bg-white shadow-sm overflow-y-auto max-h-44"
                              onWheel={e => e.stopPropagation()}>
                              {allExercises
                                .filter(e =>
                                  e.name.toLowerCase().includes((assignExSearch[dayIdx] || '').toLowerCase()) &&
                                  !day.exercises.find(de => de.exercise_id === e.id)
                                )
                                .slice(0, 20)
                                .map(e => (
                                  <button key={e.id} type="button"
                                    onMouseDown={ev => ev.preventDefault()}
                                    onClick={() => addAssignEx(dayIdx, e)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm border-b last:border-0">
                                    <span>{e.name}</span>
                                    <div className="flex items-center gap-1">
                                      {e.exercise_type === 'endurance' && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">{t('enduranceLabel')}</span>}
                                      <Badge variant="outline" className="text-xs">{e.category}</Badge>
                                    </div>
                                  </button>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>
                {t('noteLabel')} <span className="text-gray-400 font-normal text-xs">({tCommon('optional')})</span>
              </Label>
              <Input
                value={assignNotes}
                onChange={e => setAssignNotes(e.target.value)}
                placeholder={t('assignNotePlaceholder')}
              />
            </div>
          </div>
          </div>

          {/* ── Sticky footer: checkbox + actions ── */}
          <div className="px-6 py-4 border-t bg-white shrink-0 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveToDb}
                onChange={e => setSaveToDb(e.target.checked)}
                className="rounded border-gray-300 text-gray-900 w-4 h-4"
              />
              <span className="text-sm text-gray-700">{t('saveToDb')}</span>
              <span className="text-xs text-gray-400">{t('saveToDbHint')}</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)} className="flex-1">
                {tCommon('cancel')}
              </Button>
              <Button onClick={assignPlan} disabled={!selectedPlanId || assigning} className="flex-1">
                {assigning ? t('assigning') : t('assign')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create new plan */}
      <AddPlanDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => { setShowCreateDialog(false); fetchData() }}
        onSuccessWithId={handleNewPlanCreated}
        isTemplate={false}
      />

      {/* Edit client copy */}
      {editTarget && (
        <EditPlanDialog
          open={!!editTarget}
          plan={{
            ...editTarget.workout_plan,
            description: editTarget.workout_plan.description ?? '',
            days: editTarget.days?.length ? editTarget.days : editTarget.workout_plan.days,
          }}
          clientAssignId={editTarget.id}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); fetchData() }}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t('removePlanTitle')}
        description={t('removePlanConfirm')}
        onConfirm={() => confirmDeleteId && deletePlan(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        confirmLabel={tCommon('remove')}
        destructive
      />

      {/* Conflict: another plan is already active */}
      <ConfirmDialog
        open={activateConflict !== null}
        title={t('replacePlanTitle')}
        description={t('replacePlanConfirm', { name: activateConflict?.existingName || '' })}
        onConfirm={async () => {
          if (activateConflict) await activateConflict.execute()
          setActivateConflict(null)
        }}
        onCancel={() => setActivateConflict(null)}
        confirmLabel={t('replaceConfirmBtn')}
        cancelLabel={tCommon('cancel')}
      />

      {/* Rename plan (for this client only — creates a copy) */}
      <Dialog open={!!renameTarget} onOpenChange={open => { if (!open) setRenameTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('renamePlanTitle')}</DialogTitle>
            <DialogDescription>{t('renamePlanDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('renamePlanNameLabel')}</Label>
              <Input
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
                placeholder={t('renamePlaceholder')}
                onKeyDown={e => { if (e.key === 'Enter') renamePlan() }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRenameTarget(null)}>{tCommon('cancel')}</Button>
              <Button className="flex-1" disabled={!renameName.trim() || renaming} onClick={renamePlan}>
                {renaming ? t('renameSaving') : t('renameSave')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
