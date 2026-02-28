'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ExercisesTab from './tabs/exercises-tab'
import TemplatesTab from './tabs/templates-tab'
import PlansTab from './tabs/plans-tab'

export default function TrainingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Treninzi</h1>
        <p className="text-gray-500">Vježbe, predlošci i planovi treninga</p>
      </div>

      <Tabs defaultValue="exercises">
        <TabsList>
          <TabsTrigger value="exercises">Vježbe</TabsTrigger>
          <TabsTrigger value="templates">Predlošci</TabsTrigger>
          <TabsTrigger value="plans">Planovi</TabsTrigger>
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