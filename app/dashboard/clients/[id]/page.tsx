'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft } from 'lucide-react'
import CheckinOverview from '@/app/dashboard/checkins/[id]/components/checkin-overview'
import CheckinHistory from '@/app/dashboard/checkins/[id]/components/checkin-history'
import CheckinGraphs from '@/app/dashboard/checkins/[id]/components/checkin-graphs'
import CheckinConfig from '@/app/dashboard/checkins/[id]/components/checkin-config'
import ClientWorkoutPlans from '@/app/dashboard/clients/[id]/components/client-workout-plans'
import ClientMealPlans from '@/app/dashboard/clients/[id]/components/client-meal-plans'
import ClientPackages from '@/app/dashboard/clients/[id]/components/client-packages'

type Client = {
  id: string
  full_name: string
  email: string
  goal: string | null
  weight: number | null
  height: number | null
  date_of_birth: string | null
  start_date: string | null
  active: boolean
}

export default function ClientDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClient()
  }, [id])

  const fetchClient = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`
        id, goal, weight, height, date_of_birth, start_date, active,
        profiles!clients_user_id_fkey (full_name, email)
      `)
      .eq('id', id)
      .single()

    if (data) {
      setClient({
        id: data.id,
        full_name: (data.profiles as any)?.full_name || 'Bez imena',
        email: (data.profiles as any)?.email || '',
        goal: data.goal,
        weight: data.weight,
        height: data.height,
        date_of_birth: data.date_of_birth,
        start_date: data.start_date,
        active: data.active,
      })
    }
    setLoading(false)
  }

  if (loading) return <p className="text-gray-500 text-sm p-8">Učitavanje...</p>
  if (!client) return <p className="text-gray-500 text-sm p-8">Klijent nije pronađen</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{client.full_name}</h1>
          <p className="text-gray-500 text-sm">{client.email}</p>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {client.goal && (
              <div>
                <p className="text-xs text-gray-400">Cilj</p>
                <p className="text-sm font-medium">{client.goal}</p>
              </div>
            )}
            {client.weight && (
              <div>
                <p className="text-xs text-gray-400">Težina</p>
                <p className="text-sm font-medium">{client.weight} kg</p>
              </div>
            )}
            {client.height && (
              <div>
                <p className="text-xs text-gray-400">Visina</p>
                <p className="text-sm font-medium">{client.height} cm</p>
              </div>
            )}
            {client.date_of_birth && (
              <div>
                <p className="text-xs text-gray-400">Datum rođenja</p>
                <p className="text-sm font-medium">{new Date(client.date_of_birth).toLocaleDateString('hr-HR')}</p>
              </div>
            )}
            {client.start_date && (
              <div>
                <p className="text-xs text-gray-400">Početak suradnje</p>
                <p className="text-sm font-medium">{new Date(client.start_date).toLocaleDateString('hr-HR')}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <p className={`text-sm font-medium ${client.active ? 'text-green-600' : 'text-red-500'}`}>
                {client.active ? 'Aktivan' : 'Neaktivan'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checkin">
        <TabsList>
          <TabsTrigger value="checkin">Tjedni checkin</TabsTrigger>
          <TabsTrigger value="history">Povijest</TabsTrigger>
          <TabsTrigger value="graphs">Grafovi</TabsTrigger>
          <TabsTrigger value="checkin-config">Checkin postavke</TabsTrigger>
          <TabsTrigger value="treninzi">Treninzi</TabsTrigger>
          <TabsTrigger value="prehrana">Prehrana</TabsTrigger>
          <TabsTrigger value="paketi">Paketi & Plaćanja</TabsTrigger>
        </TabsList>
        <TabsContent value="checkin" className="mt-6">
          <CheckinOverview clientId={id as string} />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <CheckinHistory clientId={id as string} />
        </TabsContent>
        <TabsContent value="graphs" className="mt-6">
          <CheckinGraphs clientId={id as string} />
        </TabsContent>
        <TabsContent value="checkin-config" className="mt-6">
          <CheckinConfig clientId={id as string} />
        </TabsContent>
        <TabsContent value="treninzi" className="mt-6">
          <ClientWorkoutPlans clientId={id as string} />
        </TabsContent>
        <TabsContent value="prehrana" className="mt-6">
          <ClientMealPlans clientId={id as string} />
        </TabsContent>
        <TabsContent value="paketi" className="mt-6">
          <ClientPackages clientId={id as string} />
        </TabsContent>
      </Tabs>
    </div>
  )
}