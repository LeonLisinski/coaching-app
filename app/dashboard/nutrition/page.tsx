'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import FoodsTab from '@/app/dashboard/nutrition/tabs/foods-tab'
import RecipesTab from '@/app/dashboard/nutrition/tabs/recipes-tab'
import PlansTab from '@/app/dashboard/nutrition/tabs/plans-tab'

export default function NutritionPage() {
  const t = useTranslations('nutrition.page')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="foods">
        <TabsList>
          <TabsTrigger value="foods">{t('tabs.foods')}</TabsTrigger>
          <TabsTrigger value="recipes">{t('tabs.recipes')}</TabsTrigger>
          <TabsTrigger value="plans">{t('tabs.plans')}</TabsTrigger>
        </TabsList>
        <TabsContent value="foods" className="mt-6">
          <FoodsTab />
        </TabsContent>
        <TabsContent value="recipes" className="mt-6">
          <RecipesTab />
        </TabsContent>
        <TabsContent value="plans" className="mt-6">
          <PlansTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
