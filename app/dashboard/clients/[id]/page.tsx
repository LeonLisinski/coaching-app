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
import ClientHistory from '@/app/dashboard/clients/[id]/components/client-history'
import { useTranslations, useLocale } from 'next-intl'

type Client = {
  id: string; full_name: string; email: string
  goal: string | null; weight: number | null; height: number | null
  date_of_birth: string | null; start_date: string | null; active: boolean
}

export default function ClientDetailPage() {
  const t = useTranslations('clients.detail')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const { id } = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  const noName = t('noName')

  useEffect(() => { fetchClient() }, [id])

  const fetchClient = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`id, goal, weight, height, date_of_birth, start_date, active,
        profiles!clients_user_id_fkey (full_name, email)`)
      .eq('id', id).single()

    if (data) {
      setClient({
        id: data.id,
        full_name: (data.profiles as any)?.full_name || noName,
        email: (data.profiles as any)?.email || '',
        goal: data.goal, weight: data.weight, height: data.height,
        date_of_birth: data.date_of_birth, start_date: data.start_date, active: data.active,
      })
    }
    setLoading(false)
  }

  if (loading) return <p className="text-gray-500 text-sm p-8">{tCommon('loading')}</p>
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
                <p className="text-xs text-gray-400">{t('stats.goal')}</p>
                <p className="text-sm font-medium">{client.goal}</p>
              </div>
            )}
            {client.weight && (
              <div>
                <p className="text-xs text-gray-400">{t('stats.weight')}</p>
                <p className="text-sm font-medium">{client.weight} kg</p>
              </div>
            )}
            {client.height && (
              <div>
                <p className="text-xs text-gray-400">{t('stats.height')}</p>
                <p className="text-sm font-medium">{client.height} cm</p>
              </div>
            )}
            {client.date_of_birth && (
              <div>
                <p className="text-xs text-gray-400">{t('stats.dateOfBirth')}</p>
                <p className="text-sm font-medium">{new Date(client.date_of_birth).toLocaleDateString(locale)}</p>
              </div>
            )}
            {client.start_date && (
              <div>
                <p className="text-xs text-gray-400">{t('stats.startDate')}</p>
                <p className="text-sm font-medium">{new Date(client.start_date).toLocaleDateString(locale)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">{t('stats.status')}</p>
              <p className={`text-sm font-medium ${client.active ? 'text-green-600' : 'text-red-500'}`}>
                {client.active ? tCommon('active') : tCommon('inactive')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pracenje">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pracenje">{t('tabs.pracenje')}</TabsTrigger>
          <TabsTrigger value="checkin">{t('tabs.weeklyCheckin')}</TabsTrigger>
          <TabsTrigger value="slike">{t('tabs.slike')}</TabsTrigger>
          <TabsTrigger value="graphs">{t('tabs.graphs')}</TabsTrigger>
          <TabsTrigger value="treninzi">{t('tabs.training')}</TabsTrigger>
          <TabsTrigger value="prehrana">{t('tabs.nutrition')}</TabsTrigger>
          <TabsTrigger value="checkin-config">{t('tabs.checkinSettings')}</TabsTrigger>
          <TabsTrigger value="paketi">{t('tabs.packages')}</TabsTrigger>
        </TabsList>

        <TabsContent value="pracenje" className="mt-6">
          <ClientHistory clientId={id as string} />
        </TabsContent>
        <TabsContent value="checkin" className="mt-6">
          <CheckinOverview clientId={id as string} />
        </TabsContent>
        <TabsContent value="slike" className="mt-6">
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
