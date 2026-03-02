'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
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
  workout_plan: WorkoutPlan
}

export default function ClientWorkoutPlans({ clientId }: Props) {
  const t = useTranslations('clients.workoutPlans')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [assignedPlans, setAssignedPlans] = useState<AssignedPlan[]>([])
  const [availablePlans, setAvailablePlans] = useState<WorkoutPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState<WorkoutPlan | null>(null)

  useEffect(() => {
    fetchData()
  }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: assigned }, { data: available }] = await Promise.all([
      supabase
        .from('client_workout_plans')
        .select(`
          id, active, assigned_at, notes,
          workout_plan:workout_plans (id, name, description, days)
        `)
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('workout_plans')
        .select('id, name, description, days')
        .eq('trainer_id', user.id)
        .order('name')
    ])

    if (assigned) setAssignedPlans(assigned as any)
    if (available) setAvailablePlans(available)
    setLoading(false)
  }

  const assignPlan = async () => {
    if (!selectedPlanId) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('client_workout_plans').insert({
      trainer_id: user.id,
      client_id: clientId,
      workout_plan_id: selectedPlanId,
      notes: notes || null,
      active: true,
    })

    setSaving(false)
    setShowAdd(false)
    setSelectedPlanId('')
    setNotes('')
    fetchData()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('client_workout_plans').update({ active: !current }).eq('id', id)
    setAssignedPlans(assignedPlans.map(p => p.id === id ? { ...p, active: !current } : p))
  }

  const removePlan = async (id: string) => {
    await supabase.from('client_workout_plans').delete().eq('id', id)
    setAssignedPlans(assignedPlans.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  if (loading) return <p className="text-gray-500 text-sm">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('assigned', { count: assignedPlans.length })}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowCreateNew(true); setShowAdd(false) }}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            {t('createNew')}
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowAdd(!showAdd); setShowCreateNew(false) }}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            {t('assignExisting')}
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="py-4 space-y-3">
            <p className="font-medium text-sm">{t('assignPlan')}</p>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">{t('selectPlan')}</option>
              {availablePlans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({t('days', { count: p.days?.length || 0 })})
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('note')}
              className="w-full border rounded-md px-3 py-2 text-sm min-h-16 resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={assignPlan} disabled={!selectedPlanId || saving}>
                {saving ? tCommon('saving') : t('assign')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {assignedPlans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('noPlans')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {assignedPlans.map((assigned) => (
            <Card
              key={assigned.id}
              className={`transition-shadow cursor-pointer hover:shadow-sm ${!assigned.active ? 'opacity-60' : ''}`}
              onDoubleClick={() => setEditPlan(assigned.workout_plan)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{assigned.workout_plan.name}</p>
                    <Badge variant={assigned.active ? 'default' : 'secondary'} className="text-xs">
                      {assigned.active ? tCommon('active') : tCommon('inactive')}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {t('days', { count: assigned.workout_plan.days?.length || 0 })} •
                    {t('assignedOn')} {new Date(assigned.assigned_at).toLocaleDateString(locale)}
                  </p>
                  {assigned.notes && (
                    <p className="text-xs text-gray-500 mt-1">{assigned.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}
                  >
                    {assigned.active ? tCommon('inactive') : tCommon('active')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setEditPlan(assigned.workout_plan) }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(assigned.id) }}
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddPlanDialog
        open={showCreateNew}
        onClose={() => setShowCreateNew(false)}
        onSuccess={async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          const { data: latestPlan } = await supabase
            .from('workout_plans')
            .select('id')
            .eq('trainer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (latestPlan) {
            await supabase.from('client_workout_plans').insert({
              trainer_id: user.id,
              client_id: clientId,
              workout_plan_id: latestPlan.id,
              active: true,
            })
          }
          setShowCreateNew(false)
          fetchData()
        }}
      />

      {editPlan && (
        <EditPlanDialog
          plan={{
            ...editPlan,
            description: editPlan.description ?? '',
          }}
          open={!!editPlan}
          onClose={() => setEditPlan(null)}
          onSuccess={() => {
            setEditPlan(null)
            fetchData()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={tCommon('remove')}
        description={t('removeConfirm')}
        onConfirm={() => confirmDelete && removePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('remove')}
        destructive
      />
    </div>
  )
}
