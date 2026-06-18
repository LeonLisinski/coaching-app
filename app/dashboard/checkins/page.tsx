'use client'
import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import MobileCheckinsView from '@/app/dashboard/checkins/mobile-checkins-view'
import { useIsLg } from '@/hooks/use-mobile'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClipboardList, Settings2, BarChart2 } from 'lucide-react'
import { usePersistedTab } from '@/app/contexts/tab-state'
import { Loader2 } from 'lucide-react'

const TabLoader = () => <div className="flex justify-center items-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>

const ClientsCheckinTab = nextDynamic(() => import('@/app/dashboard/checkins/tabs/clients-tab'), { loading: TabLoader })
const ParametersTab     = nextDynamic(() => import('@/app/dashboard/checkins/tabs/parameters-tab'), { loading: TabLoader })
const CheckinStatsTab   = nextDynamic(() => import('@/app/dashboard/checkins/tabs/stats-tab'), { loading: TabLoader })

const TAB_VALUES = ['clients', 'stats', 'parameters'] as const

function CheckinsPageContent() {
  const t = useTranslations('checkins')
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = usePersistedTab('checkins_tab', 'clients')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && TAB_VALUES.includes(tab as (typeof TAB_VALUES)[number])) {
      setActiveTab(tab)
    }
  }, [searchParams, setActiveTab])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-gray-500">{t('page.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100/80">
          <TabsTrigger value="clients" className="flex items-center gap-1.5">
            <ClipboardList size={13} />
            {t('page.tabs.clients')}
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-1.5">
            <BarChart2 size={13} />
            {t('page.tabs.stats')}
          </TabsTrigger>
          <TabsTrigger value="parameters" className="flex items-center gap-1.5">
            <Settings2 size={13} />
            {t('page.tabs.parameters')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-5">
          <ClientsCheckinTab />
        </TabsContent>
        <TabsContent value="stats" className="mt-5">
          <CheckinStatsTab />
        </TabsContent>
        <TabsContent value="parameters" className="mt-5">
          <ParametersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function CheckinsPage() {
  const isLg = useIsLg()
  if (isLg === undefined) return null
  if (isLg) return (
    <Suspense fallback={<div className="h-40 rounded-xl bg-gray-100 animate-pulse" />}>
      <CheckinsPageContent />
    </Suspense>
  )
  return <MobileCheckinsView />
}
