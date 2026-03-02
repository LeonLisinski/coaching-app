'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ExercisesTab from '@/app/dashboard/training/tabs/exercises-tab'
import TemplatesTab from '@/app/dashboard/training/tabs/templates-tab'
import PlansTab from './tabs/plans-tab'

export default function TrainingPage() {
  const t = useTranslations('training.page')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="exercises">
        <TabsList>
          <TabsTrigger value="exercises">{t('tabs.exercises')}</TabsTrigger>
          <TabsTrigger value="templates">{t('tabs.templates')}</TabsTrigger>
          <TabsTrigger value="plans">{t('tabs.plans')}</TabsTrigger>
        </TabsList>
        <TabsContent value="exercises" className="mt-6">
          <ExercisesTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-6">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="plans" className="mt-6">
          <PlansTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
