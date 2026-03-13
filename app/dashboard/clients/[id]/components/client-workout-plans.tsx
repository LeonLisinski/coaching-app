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
import { Plus, Pencil, Trash2, Dumbbell, X, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddPlanDialog from '@/app/dashboard/training/dialogs/add-plan-dialog'
import EditPlanDialog from '@/app/dashboard/training/dialogs/edit-plan-dialog'
import { useTranslations, useLocale } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'

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



function DayAccordion({ days }: { days: any[] }) {
  const [openDays, setOpenDays] = useState<Record<number, boolean>>({})
  const toggle = (i: number) => setOpenDays(prev => ({ ...prev, [i]: !(prev[i] ?? false) }))
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
            <span className="text-xs text-gray-400 ml-1">{day.exercises?.length || 0} vježbi</span>
          </button>
          {openDays[dayIdx] && (
            <div className="px-2 pb-2">
              {(day.exercises || []).map((ex: any, exIdx: number) => (
                <div key={ex.exercise_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-4 text-right tabular-nums">{exIdx + 1}</span>
                    <span className="text-sm text-gray-800">{ex.name}</span>
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {ex.sets}×{ex.reps}{ex.rest_seconds ? ` · ${ex.rest_seconds}s` : ''}
                  </span>
                </div>
              ))}
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

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: assigned }, { data: available }, { data: exercises }] = await Promise.all([
      supabase
        .from('client_workout_plans')
        .select(`id, active, assigned_at, notes, days, workout_plan:workout_plans(id, name, description, days)`)
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
    ])

    if (assigned) setAssignedPlans(assigned as any)
    if (available) setAvailablePlans(available)
    if (exercises) setAllExercises(exercises)
    setLoading(false)
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
    setAssignDays(prev => prev.map((d, i) => i !== dayIdx ? d : {
      ...d, exercises: [...d.exercises, {
        exercise_id: ex.id, name: ex.name, sets: 3,
        reps: ex.exercise_type === 'endurance' ? '5min' : '10',
        rest_seconds: 60, notes: '',
        exercise_type: (ex.exercise_type as 'strength' | 'endurance') || 'strength',
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

  const assignPlan = async () => {
    if (!selectedPlanId) return
    setAssigning(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (saveToDb) {
      const planName = availablePlans.find(p => p.id === selectedPlanId)?.name || 'Plan'
      await supabase.from('workout_plans').insert({
        trainer_id: user.id,
        name: `${planName} (kopija)`,
        days: assignDays,
      })
    }

    await supabase.from('client_workout_plans').insert({
      trainer_id: user.id,
      client_id: clientId,
      workout_plan_id: selectedPlanId,
      days: assignDays,
      notes: assignNotes || null,
      active: true,
    })
    setAssigning(false)
    setShowAssignDialog(false)
    setSelectedPlanId('')
    setAssignDays([])
    setAssignNotes('')
    setSaveToDb(false)
    fetchData()
  }

  const handleNewPlanCreated = async (planId: string, days: any[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('client_workout_plans').insert({
      trainer_id: user.id, client_id: clientId,
      workout_plan_id: planId, days: days || [], active: true,
    })
    setShowCreateDialog(false)
    fetchData()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('client_workout_plans').update({ active: !current }).eq('id', id)
    setAssignedPlans(prev => prev.map(p => p.id === id ? { ...p, active: !current } : p))
  }

  const deletePlan = async (id: string) => {
    await supabase.from('client_workout_plans').delete().eq('id', id)
    setAssignedPlans(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  if (loading) return <p className="text-sm text-gray-500">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {assignedPlans.length === 0 ? 'Nema dodijeljenih planova' : `${assignedPlans.length} ${assignedPlans.length === 1 ? 'plan' : 'planova'}`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
            <Plus size={14} /> Kreiraj novi
          </Button>
          <Button size="sm" onClick={() => setShowAssignDialog(true)} className="flex items-center gap-2">
            <Plus size={14} /> Dodijeli postojeći
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {assignedPlans.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell size={24} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">Klijent nema dodijeljenih trening planova</p>
            <button onClick={() => setShowAssignDialog(true)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
              Dodijeli prvi plan →
            </button>
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      {assignedPlans.map(assigned => {
        const days = assigned.days?.length ? assigned.days : assigned.workout_plan.days || []
        const isPersonalized = !!(assigned.days?.length)
        const totalExercises = days.reduce((sum: number, d: any) => sum + (d.exercises?.length || 0), 0)

        return (
          <Card
            key={assigned.id}
            className={`hover:shadow-sm transition-shadow cursor-pointer ${!assigned.active ? 'opacity-60' : ''}`}
            onDoubleClick={() => setEditTarget(assigned)}
          >
            <CardContent className="py-0">

              {/* Plan header */}
              <div className="py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`mt-[5px] w-2 h-2 rounded-full shrink-0 ${assigned.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{assigned.workout_plan.name}</span>
                      {isPersonalized && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                          Personalizirano
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {days.length} {days.length === 1 ? 'dan' : days.length < 5 ? 'dana' : 'dana'} · {new Date(assigned.assigned_at).toLocaleDateString(locale)}
                      {assigned.notes && <> · {assigned.notes}</>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}
                    className={`text-xs h-7 px-3 rounded-full border ${
                      assigned.active
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {assigned.active ? 'Aktivan' : 'Neaktivan'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => { e.stopPropagation(); setEditTarget(assigned) }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(assigned.id) }}
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                  </div>
              </div>

              {/* Days — collapsible accordion */}
              {days.length > 0 && (
                <DayAccordion days={days} />
              )}

            </CardContent>
          </Card>
        )
      })}

      {/* ── MUSCLE GROUP GRAPHS ── */}
      {assignedPlans.length > 0 && (() => {
        const exerciseMap = new Map(allExercises.map(e => [e.id, e]))
        const activeDays = assignedPlans
          .filter(p => p.active)
          .flatMap(p => (p.days?.length ? p.days : p.workout_plan.days || []))

        const setsByCategory: Record<string, number> = {}
        const setsByDay: Array<{ name: string; sets: number }> = []
        const setsByPrimary: Record<string, number> = {}

        activeDays.forEach((day: any, idx: number) => {
          let daySets = 0
          ;(day.exercises || []).forEach((ex: any) => {
            const info = exerciseMap.get(ex.exercise_id)
            const sets = ex.sets || 0
            setsByCategory[info?.category || 'Ostalo'] = (setsByCategory[info?.category || 'Ostalo'] || 0) + sets
            daySets += sets
            ;(info?.primary_muscles || []).forEach((m: string) => {
              setsByPrimary[m] = (setsByPrimary[m] || 0) + sets
            })
          })
          setsByDay.push({ name: day.name || `Dan ${idx + 1}`, sets: daySets })
        })

        const categoryData = Object.entries(setsByCategory).sort((a, b) => b[1] - a[1]).map(([name, sets]) => ({ name, sets }))
        const primaryData  = Object.entries(setsByPrimary).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, sets]) => ({ name, sets }))

        const PALETTE = [accentHex,'#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6']

        const CustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null
          return (
            <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-xs">
              <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
              <p className="font-bold" style={{ color: accentHex }}>{payload[0].value} serija</p>
            </div>
          )
        }

        if (categoryData.length === 0 && setsByDay.every(d => d.sets === 0)) return null

        return (
          <div className="mt-4 rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}18` }}>
                <BarChart2 size={14} style={{ color: accentHex }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Analiza opterećenja</h3>
                <p className="text-[11px] text-gray-400">Aktivni planovi · serije po kategoriji</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sets per training day */}
              {setsByDay.some(d => d.sets > 0) && (
                <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Serije po treningu</p>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={setsByDay} margin={{ top: 16, right: 4, left: -22, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: `${accentHex}12`, radius: 6 } as any} />
                      <Bar dataKey="sets" radius={[6, 6, 3, 3]} fill={accentHex} fillOpacity={0.9}>
                        <LabelList dataKey="sets" position="top" style={{ fontSize: 11, fill: accentHex, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sets per muscle category — horizontal */}
              {categoryData.length > 0 && (
                <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Grupe mišića</p>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 36, left: 4, bottom: 0 }} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: `${accentHex}12` } as any} />
                      <Bar dataKey="sets" radius={[0, 6, 6, 0]}>
                        <LabelList dataKey="sets" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#6b7280' }} />
                        {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Primary muscles */}
              {primaryData.length > 0 && (
                <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 md:col-span-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Primarni mišići</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={primaryData} margin={{ top: 16, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: `${accentHex}12`, radius: 6 } as any} />
                      <Bar dataKey="sets" radius={[6, 6, 3, 3]}>
                        <LabelList dataKey="sets" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#6b7280' }} />
                        {primaryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />)}
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
          <DialogTitle className="sr-only">Dodijeli plan klijentu</DialogTitle>
          <DialogDescription className="sr-only">Dodijeli plan klijentu</DialogDescription>

          {/* Gradient header */}
          <div className="px-6 py-4 shrink-0 flex items-center gap-3 rounded-t-lg" style={{ background: `linear-gradient(135deg, ${accentHex}ee, ${accentHex}cc)` }}>
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Dumbbell size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base">Dodijeli trening plan</h2>
              <p className="text-white/60 text-xs">Odaberi i prilagodi plan za klijenta</p>
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
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={handleSelectPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Odaberi plan..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePlans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      <span className="text-gray-400 text-xs ml-1">· {p.days?.length || 0} dana</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Editable days */}
            {assignDays.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prilagodi za ovog klijenta</p>
                {assignDays.map((day, dayIdx) => (
                  <Card key={dayIdx}>
                    <CardContent className="py-0">
                      {/* Day header */}
                      <div className="py-3 flex items-center gap-2 border-b border-gray-100">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                        <span className="text-sm font-medium">{day.name}</span>
                        <span className="text-xs text-gray-400">{day.exercises.length} vježbi</span>
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
        title="Ukloni plan"
        description="Sigurno želiš ukloniti ovaj plan od klijenta?"
        onConfirm={() => confirmDeleteId && deletePlan(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        confirmLabel="Ukloni"
        destructive
      />
    </div>
  )
}
