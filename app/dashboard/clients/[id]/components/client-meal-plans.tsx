'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddMealPlanDialog from '@/app/dashboard/nutrition/dialogs/add-meal-plan-dialog'
import EditMealPlanDialog from '@/app/dashboard/nutrition/dialogs/edit-meal-plan-dialog'

type Props = { clientId: string }

type MealPlan = {
  id: string
  name: string
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  meals: any[]
}

type AssignedPlan = {
  id: string
  active: boolean
  assigned_at: string
  notes: string | null
  meal_plan: MealPlan
}

export default function ClientMealPlans({ clientId }: Props) {
  const [assignedPlans, setAssignedPlans] = useState<AssignedPlan[]>([])
  const [availablePlans, setAvailablePlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState<MealPlan | null>(null)

  useEffect(() => {
    fetchData()
  }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: assigned }, { data: available }] = await Promise.all([
      supabase
        .from('client_meal_plans')
        .select(`
          id, active, assigned_at, notes,
          meal_plan:meal_plans (id, name, calories_target, protein_target, carbs_target, fat_target, meals)
        `)
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('meal_plans')
        .select('id, name, calories_target, protein_target, carbs_target, fat_target, meals')
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

    await supabase.from('client_meal_plans').insert({
      trainer_id: user.id,
      client_id: clientId,
      meal_plan_id: selectedPlanId,
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
    await supabase.from('client_meal_plans').update({ active: !current }).eq('id', id)
    setAssignedPlans(assignedPlans.map(p => p.id === id ? { ...p, active: !current } : p))
  }

  const removePlan = async (id: string) => {
    await supabase.from('client_meal_plans').delete().eq('id', id)
    setAssignedPlans(assignedPlans.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  if (loading) return <p className="text-gray-500 text-sm">Učitavanje...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{assignedPlans.length} dodijeljenih planova</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowCreateNew(true); setShowAdd(false) }}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            Kreiraj novi
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowAdd(!showAdd); setShowCreateNew(false) }}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            Dodijeli postojeći
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="py-4 space-y-3">
            <p className="font-medium text-sm">Dodijeli plan prehrane</p>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Odaberi plan...</option>
              {availablePlans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.calories_target ? ` (${p.calories_target} kcal)` : ''}
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Napomena (opcionalno)..."
              className="w-full border rounded-md px-3 py-2 text-sm min-h-16 resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={assignPlan} disabled={!selectedPlanId || saving}>
                {saving ? 'Dodjela...' : 'Dodijeli'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                Odustani
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {assignedPlans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            Klijentu nije dodijeljen nijedan plan prehrane.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {assignedPlans.map((assigned) => (
            <Card
              key={assigned.id}
              className={`transition-shadow cursor-pointer hover:shadow-sm ${!assigned.active ? 'opacity-60' : ''}`}
              onDoubleClick={() => setEditPlan(assigned.meal_plan)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{assigned.meal_plan.name}</p>
                    <Badge variant={assigned.active ? 'default' : 'secondary'} className="text-xs">
                      {assigned.active ? 'Aktivan' : 'Neaktivan'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    {assigned.meal_plan.calories_target ? `${assigned.meal_plan.calories_target} kcal • ` : ''}
                    {assigned.meal_plan.meals?.length || 0} obroka •
                    Dodijeljeno {new Date(assigned.assigned_at).toLocaleDateString('hr-HR')}
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
                    {assigned.active ? 'Deaktiviraj' : 'Aktiviraj'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setEditPlan(assigned.meal_plan) }}
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

      <AddMealPlanDialog
        open={showCreateNew}
        onClose={() => setShowCreateNew(false)}
        onSuccess={async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          const { data: latestPlan } = await supabase
            .from('meal_plans')
            .select('id')
            .eq('trainer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (latestPlan) {
            await supabase.from('client_meal_plans').insert({
              trainer_id: user.id,
              client_id: clientId,
              meal_plan_id: latestPlan.id,
              active: true,
            })
          }
          setShowCreateNew(false)
          fetchData()
        }}
      />

      {editPlan && (
        <EditMealPlanDialog
          plan={editPlan}
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
        title="Ukloni plan"
        description="Sigurno želiš ukloniti ovaj plan prehrane od klijenta?"
        onConfirm={() => confirmDelete && removePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Ukloni"
        destructive
      />
    </div>
  )
}