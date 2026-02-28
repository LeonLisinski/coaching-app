'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import FoodsTab from '@/app/dashboard/nutrition/tabs/foods-tab'
import RecipesTab from '@/app/dashboard/nutrition/tabs/recipes-tab'
import PlansTab from '@/app/dashboard/nutrition/tabs/plans-tab'

export default function NutritionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prehrana</h1>
        <p className="text-gray-500">Namirnice, jela i planovi prehrane</p>
      </div>

      <Tabs defaultValue="foods">
        <TabsList>
          <TabsTrigger value="foods">Namirnice</TabsTrigger>
          <TabsTrigger value="recipes">Jela</TabsTrigger>
          <TabsTrigger value="plans">Planovi</TabsTrigger>
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