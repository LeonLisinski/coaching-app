'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, ClipboardList, History, BarChart2, Settings2 } from 'lucide-react'
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
  const t = useTranslations('checkins')
  const tCommon = useTranslations('common')

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

  if (loading) return <p className="text-gray-500 text-sm p-8">{tCommon('loading')}</p>
  if (!client) return <p className="text-gray-500 text-sm p-8">Klijent nije pronađen</p>

  const initials = client.full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="rounded-2xl overflow-hidden border border-teal-100 shadow-sm">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-500 px-6 py-5 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft size={15} className="text-white" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg leading-tight truncate">{client.full_name}</h1>
            <p className="text-teal-100/70 text-xs mt-0.5">Checkini i napredak</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-gray-100/80">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <ClipboardList size={13} />
            {t('detail.tabs.checkin')}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History size={13} />
            {t('detail.tabs.history')}
          </TabsTrigger>
          <TabsTrigger value="graphs" className="flex items-center gap-1.5">
            <BarChart2 size={13} />
            {t('detail.tabs.graphs')}
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-1.5">
            <Settings2 size={13} />
            {t('detail.tabs.config')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          <CheckinOverview clientId={id as string} />
        </TabsContent>
        <TabsContent value="history" className="mt-5">
          <CheckinHistory clientId={id as string} />
        </TabsContent>
        <TabsContent value="graphs" className="mt-5">
          <CheckinGraphs clientId={id as string} />
        </TabsContent>
        <TabsContent value="config" className="mt-5">
          <CheckinConfig clientId={id as string} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
