'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Mail, Target, Weight, Ruler } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ClientDetail = {
  id: string
  full_name: string
  email: string
  goal: string
  active: boolean
  weight: number | null
  height: number | null
  date_of_birth: string | null
  created_at: string
}

export default function ClientDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClient()
  }, [id])

  const fetchClient = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`
        id,
        goal,
        active,
        weight,
        height,
        date_of_birth,
        created_at,
        profiles!clients_user_id_fkey (
          full_name,
          email
        )
      `)
      .eq('id', id)
      .single()

    if (data) {
      setClient({
        id: data.id,
        full_name: (data.profiles as any)?.full_name || 'Bez imena',
        email: (data.profiles as any)?.email || '',
        goal: data.goal || '',
        active: data.active,
        weight: data.weight,
        height: data.height,
        date_of_birth: data.date_of_birth,
        created_at: data.created_at,
      })
    }
    setLoading(false)
  }

  if (loading) return <p className="text-gray-500">Učitavanje...</p>
  if (!client) return <p className="text-gray-500">Klijent nije pronađen</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold">{client.full_name}</h1>
        <Badge variant={client.active ? 'default' : 'secondary'}>
          {client.active ? 'Aktivan' : 'Neaktivan'}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Profil kartica */}
        <Card className="col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="text-2xl bg-blue-100 text-blue-700">
                {client.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{client.full_name}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1 justify-center">
                <Mail size={12} /> {client.email}
              </p>
            </div>
            {client.goal && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Target size={14} />
                <span>{client.goal}</span>
              </div>
            )}
            <div className="w-full border-t pt-4 space-y-2 text-sm">
              {client.weight && (
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Weight size={12} /> Težina</span>
                  <span className="font-medium">{client.weight} kg</span>
                </div>
              )}
              {client.height && (
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Ruler size={12} /> Visina</span>
                  <span className="font-medium">{client.height} cm</span>
                </div>
              )}
              {client.date_of_birth && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Rođen</span>
                  <span className="font-medium">{new Date(client.date_of_birth).toLocaleDateString('hr-HR')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Klijent od</span>
                <span className="font-medium">{new Date(client.created_at).toLocaleDateString('hr-HR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabovi */}
        <div className="col-span-2">
          <Tabs defaultValue="training">
            <TabsList className="w-full">
              <TabsTrigger value="training" className="flex-1">Treninzi</TabsTrigger>
              <TabsTrigger value="nutrition" className="flex-1">Prehrana</TabsTrigger>
              <TabsTrigger value="checkins" className="flex-1">Checkini</TabsTrigger>
            </TabsList>
            <TabsContent value="training">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plan treninga</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 text-sm">Još nema plana treninga.</p>
                  <Button className="mt-4" size="sm">Kreiraj plan</Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="nutrition">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plan prehrane</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 text-sm">Još nema plana prehrane.</p>
                  <Button className="mt-4" size="sm">Kreiraj plan</Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="checkins">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Checkin historija</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 text-sm">Još nema checkin podataka.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}