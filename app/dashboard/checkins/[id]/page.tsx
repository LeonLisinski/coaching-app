'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft } from 'lucide-react'
import CheckinOverview from '@/app/dashboard/checkins/[id]/components/checkin-overview'
import CheckinHistory from '@/app/dashboard/checkins/[id]/components/checkin-history'
import CheckinGraphs from '@/app/dashboard/checkins/[id]/components/checkin-graphs'
import CheckinConfig from '@/app/dashboard/checkins/[id]/components/checkin-config'

type Client = {
  id: string
  full_name: string
  email: string
}

export default function ClientCheckinPage() {
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
        id,
        profiles!clients_user_id_fkey (full_name, email)
      `)
      .eq('id', id)
      .single()

    if (data) {
      setClient({
        id: data.id,
        full_name: (data.profiles as any)?.full_name || 'Bez imena',
        email: (data.profiles as any)?.email || '',
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
          <p className="text-gray-500 text-sm">Checkini i napredak</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Tjedni pregled</TabsTrigger>
          <TabsTrigger value="history">Povijest</TabsTrigger>
          <TabsTrigger value="graphs">Grafovi</TabsTrigger>
          <TabsTrigger value="config">Postavke</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <CheckinOverview clientId={id as string} />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <CheckinHistory clientId={id as string} />
        </TabsContent>
        <TabsContent value="graphs" className="mt-6">
          <CheckinGraphs clientId={id as string} />
        </TabsContent>
        <TabsContent value="config" className="mt-6">
          <CheckinConfig clientId={id as string} />
        </TabsContent>
      </Tabs>
    </div>
  )
}