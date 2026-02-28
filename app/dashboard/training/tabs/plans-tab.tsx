'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

type WorkoutPlan = {
  id: string
  name: string
  active: boolean
  start_date: string | null
  client_name: string
}

export default function PlansTab() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('workout_plans')
      .select(`
        id, name, active, start_date,
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
        active: p.active,
        start_date: p.start_date,
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
        <Button size="sm" className="flex items-center gap-2">
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
            {search ? 'Nema rezultata' : 'Još nemaš planova treninga.'}
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
                  <Badge variant={plan.active ? 'default' : 'secondary'}>
                    {plan.active ? 'Aktivan' : 'Neaktivan'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/training/plans/${plan.id}`)}>
                    Otvori
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}