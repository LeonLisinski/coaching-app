'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import {
  DndContext, DragOverlay, pointerWithin,
  useSensor, useSensors, PointerSensor,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ExercisesTab from '@/app/dashboard/training/tabs/exercises-tab'
import TemplatesTab from '@/app/dashboard/training/tabs/templates-tab'
import PlansTab from './tabs/plans-tab'
import { Dumbbell, LayoutList, CalendarDays } from 'lucide-react'

type ActiveDrag = {
  type: 'exercise' | 'template'
  id: string
  name: string
  subtitle?: string
  payload: any
}

export default function TrainingPage() {
  const t = useTranslations('training.page')

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [activeType, setActiveType] = useState<'exercise' | 'template' | null>(null)
  const [exerciseRefreshKey, setExerciseRefreshKey] = useState(0)
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0)
  const [planRefreshKey, setPlanRefreshKey] = useState(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const d = event.active.data.current
    if (!d) return
    setActiveDrag({ type: d.type, id: event.active.id as string, name: d.name, subtitle: d.subtitle, payload: d.payload })
    setActiveType(d.type)
  }

  const handleDragOver = (_event: DragOverEvent) => {}

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDrag(null)
    setActiveType(null)
    if (!over) return

    const drag = active.data.current
    const drop = over.data.current
    if (!drag || !drop) return

    // ── Exercise → Template ────────────────────────────────────────────────
    if (drag.type === 'exercise' && drop.type === 'template-drop') {
      const exercise = drag.payload
      const templateId = drop.templateId

      const { data: tmpl } = await supabase
        .from('workout_templates')
        .select('exercises')
        .eq('id', templateId)
        .single()

      if (tmpl) {
        const existing: any[] = tmpl.exercises || []
        if (!existing.find(e => e.exercise_id === exercise.id)) {
          await supabase
            .from('workout_templates')
            .update({
              exercises: [
                ...existing,
                {
                  exercise_id: exercise.id,
                  name: exercise.name,
                  sets: 3, reps: '10', rest_seconds: 60, notes: '',
                },
              ],
            })
            .eq('id', templateId)
          setTemplateRefreshKey(k => k + 1)
        }
      }
    }

    // ── Template → Plan ────────────────────────────────────────────────────
    if (drag.type === 'template' && drop.type === 'plan-drop') {
      const template = drag.payload
      const planId = drop.planId

      const { data: plan } = await supabase
        .from('workout_plans')
        .select('days')
        .eq('id', planId)
        .single()

      if (plan) {
        const existingDays: any[] = plan.days || []
        const newDay = {
          name: template.name,
          exercises: (template.exercises || []).map((e: any) => ({
            exercise_id: e.exercise_id,
            name: e.name,
            sets: e.sets ?? 3,
            reps: e.reps ?? '10',
            rest_seconds: e.rest_seconds ?? 60,
            notes: e.notes ?? '',
          })),
        }
        await supabase
          .from('workout_plans')
          .update({ days: [...existingDays, newDay] })
          .eq('id', planId)
        setPlanRefreshKey(k => k + 1)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Floating drag overlay */}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeDrag && (
          <div className="flex items-center gap-2 bg-white border-2 border-primary rounded-xl px-3 py-2 shadow-2xl text-sm font-medium text-gray-800 select-none pointer-events-none rotate-2 scale-105">
            {activeDrag.type === 'exercise'
              ? <Dumbbell size={14} className="text-primary shrink-0" />
              : <LayoutList size={14} className="text-indigo-500 shrink-0" />
            }
            <div>
              <p className="leading-tight">{activeDrag.name}</p>
              {activeDrag.subtitle && <p className="text-xs text-gray-400 font-normal">{activeDrag.subtitle}</p>}
            </div>
          </div>
        )}
      </DragOverlay>

      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>

        {/* Hint bar while dragging */}
        {activeDrag && (
          <div className={`border rounded-xl px-4 py-2 text-xs font-medium flex items-center gap-2 ${
            activeDrag.type === 'exercise'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-indigo-50 border-indigo-200 text-indigo-700'
          }`}>
            {activeDrag.type === 'exercise'
              ? '💪 Ispusti vježbu na trening da je dodaš'
              : '📋 Ispusti trening na plan da dodaš novi dan'
            }
          </div>
        )}

        {/* Desktop: 3 panels always visible side by side */}
        <div className="hidden xl:grid xl:grid-cols-3 xl:gap-5" style={{ height: 'calc(100vh - 175px)' }}>

          {/* Vježbe */}
          <div className="flex flex-col min-h-0 rounded-2xl shadow-sm overflow-hidden border border-emerald-200">
            <div className={`px-4 py-3 shrink-0 bg-gradient-to-r from-emerald-600 to-green-500 transition-all ${
              activeType === 'template' ? 'opacity-50' : ''
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <Dumbbell size={13} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{t('tabs.exercises')}</h3>
                </div>
                <span className="text-[10px] text-emerald-100/80 font-medium">povuci u trening →</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-white">
              <ExercisesTab activeType={activeType} refreshKey={exerciseRefreshKey} />
            </div>
          </div>

          {/* Treninzi */}
          <div className={`flex flex-col min-h-0 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
            activeType === 'exercise' ? 'border-2 border-blue-400 ring-2 ring-blue-400/20' : 'border border-blue-200'
          }`}>
            <div className={`px-4 py-3 shrink-0 bg-gradient-to-r from-blue-600 to-blue-500 transition-all ${
              activeType === 'template' ? 'opacity-50' : ''
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <LayoutList size={13} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{t('tabs.templates')}</h3>
                </div>
                {activeType === 'exercise'
                  ? <span className="text-[10px] text-white font-bold animate-pulse">⬇ ispusti ovdje</span>
                  : <span className="text-[10px] text-blue-100/80 font-medium">← prima vježbe · povuci u plan →</span>
                }
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-white">
              <TemplatesTab key={templateRefreshKey} activeType={activeType} onExerciseCreated={() => setExerciseRefreshKey(k => k + 1)} />
            </div>
          </div>

          {/* Planovi */}
          <div className={`flex flex-col min-h-0 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
            activeType === 'template' ? 'border-2 border-indigo-400 ring-2 ring-indigo-400/20' : 'border border-indigo-200'
          }`}>
            <div className={`px-4 py-3 shrink-0 bg-gradient-to-r from-indigo-600 to-violet-500 transition-all ${
              activeType === 'exercise' ? 'opacity-50' : ''
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <CalendarDays size={13} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{t('tabs.plans')}</h3>
                </div>
                {activeType === 'template'
                  ? <span className="text-[10px] text-white font-bold animate-pulse">⬇ ispusti ovdje</span>
                  : <span className="text-[10px] text-indigo-100/80 font-medium">← prima treninge</span>
                }
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-white">
              <PlansTab key={planRefreshKey} activeType={activeType} />
            </div>
          </div>

        </div>

        {/* Mobile/tablet: tabs */}
        <div className="xl:hidden">
          <Tabs defaultValue="exercises">
            <TabsList>
              <TabsTrigger value="exercises">{t('tabs.exercises')}</TabsTrigger>
              <TabsTrigger value="templates">{t('tabs.templates')}</TabsTrigger>
              <TabsTrigger value="plans">{t('tabs.plans')}</TabsTrigger>
            </TabsList>
            <TabsContent value="exercises" className="mt-4">
              <ExercisesTab activeType={activeType} refreshKey={exerciseRefreshKey} />
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              <TemplatesTab key={templateRefreshKey} activeType={activeType} onExerciseCreated={() => setExerciseRefreshKey(k => k + 1)} />
            </TabsContent>
            <TabsContent value="plans" className="mt-4">
              <PlansTab key={planRefreshKey} activeType={activeType} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DndContext>
  )
}

