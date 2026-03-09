'use client'

import { useEffect, useState } from 'react'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Dumbbell, X } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddPlanDialog from '@/app/dashboard/training/dialogs/add-plan-dialog'
import EditPlanDialog from '@/app/dashboard/training/dialogs/edit-plan-dialog'
import { useTranslations, useLocale } from 'next-intl'

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
  exercises: PlanExercise[]
}



export default function ClientWorkoutPlans({ clientId }: Props) {
  const tCommon = useTranslations('common')
  const locale = useLocale()

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
        .order('name'),
      supabase
        .from('exercises')
        .select('id, name, category')
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
      ...d, exercises: [...d.exercises, { exercise_id: ex.id, name: ex.name, sets: 3, reps: '10', rest_seconds: 60, notes: '' }]
    }))
    setAssignExSearch(prev => ({ ...prev, [dayIdx]: '' }))
  }

  const assignPlan = async () => {
    if (!selectedPlanId) return
    setAssigning(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
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
                      Dodijeljeno {new Date(assigned.assigned_at).toLocaleDateString(locale)}
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

              {/* Days */}
              {days.length > 0 && (
                <div className="border-t border-gray-100 pb-2">
                  {days.map((day: any, dayIdx: number) => (
                    <div key={dayIdx} className="mt-3">
                      {/* Day label */}
                      <div className="flex items-center gap-2 px-1 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                        <span className="text-xs font-semibold text-gray-600">{day.name}</span>
                        <span className="text-xs text-gray-400">{day.exercises?.length || 0} vježbi</span>
                      </div>
                      {/* Exercises */}
                      {(day.exercises || []).map((ex: any, exIdx: number) => (
                        <div
                          key={ex.exercise_id}
                          className="flex items-center justify-between py-2 px-1 border-b border-gray-50 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-300 w-4 text-right tabular-nums">{exIdx + 1}</span>
                            <span className="text-sm text-gray-800">{ex.name}</span>
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums">
                            {ex.sets}×{ex.reps}{ex.rest_seconds ? ` · ${ex.rest_seconds}s` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

            </CardContent>
          </Card>
        )
      })}

      {/* ── ASSIGN DIALOG ── */}
      <Dialog
        open={showAssignDialog}
        onOpenChange={v => {
          setShowAssignDialog(v)
          if (!v) { setSelectedPlanId(''); setAssignDays([]); setAssignNotes('') }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodijeli plan klijentu</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
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

                      {/* Exercises */}
                      <div className="py-2 space-y-2">
                        {day.exercises.map((ex, exIdx) => (
                          <div key={ex.exercise_id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{exIdx + 1}. {ex.name}</span>
                              <Button variant="ghost" size="sm" onClick={() => removeAssignEx(dayIdx, ex.exercise_id)}>
                                <X size={12} className="text-gray-400" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs text-gray-500">Serije</Label>
                                <Input
                                  type="number"
                                  value={ex.sets}
                                  onChange={e => updateAssignEx(dayIdx, ex.exercise_id, 'sets', parseInt(e.target.value) || 0)}
                                  className="h-8 text-sm mt-0.5"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500">Ponav.</Label>
                                <Input
                                  value={ex.reps}
                                  onChange={e => updateAssignEx(dayIdx, ex.exercise_id, 'reps', e.target.value)}
                                  className="h-8 text-sm mt-0.5"
                                  placeholder="10 ili 8-12"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500">Odmor (s)</Label>
                                <Input
                                  type="number"
                                  value={ex.rest_seconds}
                                  onChange={e => updateAssignEx(dayIdx, ex.exercise_id, 'rest_seconds', parseInt(e.target.value) || 0)}
                                  className="h-8 text-sm mt-0.5"
                                />
                              </div>
                            </div>
                            <Input
                              value={ex.notes}
                              onChange={e => updateAssignEx(dayIdx, ex.exercise_id, 'notes', e.target.value)}
                              placeholder="Bilješka (opcionalno)"
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}

                        {/* Add exercise search */}
                        <div className="relative">
                          <Input
                            value={assignExSearch[dayIdx] || ''}
                            onChange={e => setAssignExSearch(prev => ({ ...prev, [dayIdx]: e.target.value }))}
                            placeholder="+ Dodaj vježbu..."
                            className="h-8 text-sm"
                          />
                          {assignExSearch[dayIdx] && (
                            <div className="absolute top-full left-0 right-0 z-30 bg-white border border-gray-200 rounded-lg shadow-lg mt-0.5 max-h-40 overflow-y-auto">
                              {allExercises
                                .filter(e =>
                                  e.name.toLowerCase().includes(assignExSearch[dayIdx].toLowerCase()) &&
                                  !day.exercises.find(de => de.exercise_id === e.id)
                                )
                                .slice(0, 8)
                                .map(e => (
                                  <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => addAssignEx(dayIdx, e)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm border-b border-gray-50 last:border-0"
                                  >
                                    <span>{e.name}</span>
                                    <Badge variant="outline" className="text-xs">{e.category}</Badge>
                                  </button>
                                ))
                              }
                              {allExercises.filter(e => e.name.toLowerCase().includes(assignExSearch[dayIdx].toLowerCase())).length === 0 && (
                                <p className="text-xs text-gray-400 px-3 py-2">Nema rezultata</p>
                              )}
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
                Napomena <span className="text-gray-400 font-normal text-xs">(opcionalno)</span>
              </Label>
              <Input
                value={assignNotes}
                onChange={e => setAssignNotes(e.target.value)}
                placeholder="npr. Počni od sljedećeg tjedna"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)} className="flex-1">
                Odustani
              </Button>
              <Button onClick={assignPlan} disabled={!selectedPlanId || assigning} className="flex-1">
                {assigning ? 'Sprema...' : 'Dodijeli plan'}
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
