'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search } from 'lucide-react'
import AddMealPlanDialog from '@/app/dashboard/nutrition/dialogs/add-meal-plan-dialog'
import { useRouter } from 'next/navigation'

type MealPlan = {
  id: string
  name: string
  calories_target: number | null
  active: boolean
  client_name: string
}

export default function PlansTab() {
  const [plans, setPlans] = useState<MealPlan[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('meal_plans')
      .select(`
        id, name, calories_target, active,
        clients (
          profiles!clients_user_id_fkey (full_name)
        )
      `)
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setPlans(data.map((p: any) => ({
        id: p.id,
        name: p.name,
        calories_target: p.calories_target,
        active: p.active,
        client_name: p.clients?.profiles?.full_name || 'Bez klijenta',
      })))
    }
    setLoading(false)
  }

  const filtered = plans.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name.toLowerCase().includes(search.toLowerCase())
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
            {search ? 'Nema rezultata' : 'Još nemaš planova. Dodaj prvi!'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((plan) => (
            <Card key={plan.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{plan.name}</p>
                  <p className="text-xs text-gray-500">👤 {plan.client_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {plan.calories_target && (
                    <span className="text-xs text-gray-400">{plan.calories_target} kcal</span>
                  )}
                  <Badge variant={plan.active ? 'default' : 'secondary'}>
                    {plan.active ? 'Aktivan' : 'Neaktivan'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/nutrition/plans/${plan.id}`)}>
                    Otvori
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddMealPlanDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchPlans}
      />
    </div>
  )
}