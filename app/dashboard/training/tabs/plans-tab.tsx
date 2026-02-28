'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import AddPlanDialog from '../dialogs/add-plan-dialog'
import EditPlanDialog from '../dialogs/edit-plan-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type WorkoutPlan = {
  id: string
  name: string
  description: string
  days: any[]
  created_at: string
}

export default function PlansTab() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editPlan, setEditPlan] = useState<WorkoutPlan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setPlans(data)
    setLoading(false)
  }

  const deletePlan = async (id: string) => {
    await supabase.from('workout_plans').delete().eq('id', id)
    setPlans(plans.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const filtered = plans.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{plans.length} planova</p>
        <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
          <Plus size={14} />
          Novi plan
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Pretraži planove..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {search ? 'Nema rezultata' : 'Još nemaš planova treninga. Kreiraj prvi!'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((plan) => (
            <Card
              key={plan.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onDoubleClick={() => setEditPlan(plan)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{plan.name}</p>
                  {plan.description && (
                    <p className="text-xs text-gray-500">{plan.description}</p>
                  )}
                  <p className="text-xs text-gray-400">{plan.days?.length || 0} dana</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditPlan(plan) }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(plan.id) }}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddPlanDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchPlans}
      />

      {editPlan && (
        <EditPlanDialog
          plan={editPlan}
          open={!!editPlan}
          onClose={() => setEditPlan(null)}
          onSuccess={() => {
            setEditPlan(null)
            fetchPlans()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Obriši plan"
        description="Sigurno želiš obrisati ovaj plan? Ova radnja se ne može poništiti."
        onConfirm={() => confirmDelete && deletePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
    </div>
  )
}