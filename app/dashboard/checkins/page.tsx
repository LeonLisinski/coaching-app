'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ClientsCheckinTab from '@/app/dashboard/checkins/tabs/clients-tab'
import ParametersTab from '@/app/dashboard/checkins/tabs/parameters-tab'

export default function CheckinsPage() {
  const t = useTranslations('checkins')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-gray-500">{t('page.subtitle')}</p>
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">{t('page.tabs.clients')}</TabsTrigger>
          <TabsTrigger value="parameters">{t('page.tabs.parameters')}</TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-6">
          <ClientsCheckinTab />
        </TabsContent>
        <TabsContent value="parameters" className="mt-6">
          <ParametersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
