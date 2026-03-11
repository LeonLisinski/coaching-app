'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ClientsCheckinTab from '@/app/dashboard/checkins/tabs/clients-tab'
import ParametersTab from '@/app/dashboard/checkins/tabs/parameters-tab'
import { ClipboardList, Settings2 } from 'lucide-react'

export default function CheckinsPage() {
  const t = useTranslations('checkins')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-gray-500">{t('page.subtitle')}</p>
      </div>

      <Tabs defaultValue="clients">
        <TabsList className="bg-gray-100/80">
          <TabsTrigger value="clients" className="flex items-center gap-1.5">
            <ClipboardList size={13} />
            {t('page.tabs.clients')}
          </TabsTrigger>
          <TabsTrigger value="parameters" className="flex items-center gap-1.5">
            <Settings2 size={13} />
            {t('page.tabs.parameters')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-5">
          <ClientsCheckinTab />
        </TabsContent>
        <TabsContent value="parameters" className="mt-5">
          <ParametersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
