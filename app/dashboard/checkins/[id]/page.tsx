'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { usePersistedTab } from '@/app/contexts/tab-state'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, ClipboardList, History, BarChart2, Settings2 } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}
import CheckinOverview from '@/app/dashboard/checkins/[id]/components/checkin-overview'
import CheckinHistory from '@/app/dashboard/checkins/[id]/components/checkin-history'
import CheckinGraphs from '@/app/dashboard/checkins/[id]/components/checkin-graphs'
import CheckinConfig from '@/app/dashboard/checkins/[id]/components/checkin-config'

type Client = {
  id: string
  full_name: string
  email: string
  gender: string | null
}

export default function ClientCheckinPage() {
  const { id } = useParams()
  const router = useRouter()
  const t = useTranslations('checkins')
  const tCommon = useTranslations('common')
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isDark = mode === 'dark'

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = usePersistedTab(`checkin_tab_${id as string}`, 'overview')

  useEffect(() => {
    fetchClient()
  }, [id])

  const fetchClient = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`
        id,
        gender,
        profiles!clients_user_id_fkey (full_name, email)
      `)
      .eq('id', id)
      .single()

    if (data) {
      setClient({
        id: data.id,
        full_name: (data.profiles as any)?.full_name || 'Bez imena',
        email: (data.profiles as any)?.email || '',
        gender: (data as any).gender || null,
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
      {(() => {
        const genderColor = client.gender === 'F' ? '#e11d48' : client.gender === 'M' ? '#2563eb' : accentHex
        const avatarGrad = client.gender === 'F'
          ? 'linear-gradient(135deg, #f43f5e, #be123c)'
          : client.gender === 'M'
          ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
          : `linear-gradient(135deg, ${accentHex}, color-mix(in srgb, ${accentHex} 70%, #000))`
        return (
          <div className={`rounded-2xl overflow-hidden border ${isDark ? 'border-white/8 bg-white/[0.04]' : 'border-gray-100 bg-white shadow-sm'}`}
            style={{ background: isDark
              ? `linear-gradient(to right, ${genderColor}14 0%, transparent 55%), oklch(0.195 0.018 264)`
              : `linear-gradient(to right, ${genderColor}08 0%, transparent 60%), white`
            }}>
            <div className="px-5 py-4 flex items-center gap-4">
              <button onClick={() => router.push('/dashboard/checkins')}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${isDark ? 'bg-white/8 hover:bg-white/15 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                <ArrowLeft size={15} />
              </button>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: avatarGrad }}>
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className={`font-bold text-lg leading-tight truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{client.full_name}</h1>
                <p className="text-gray-400 text-xs mt-0.5">{t('page.clientSubtitle')}</p>
              </div>
            </div>
          </div>
        )
      })()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
