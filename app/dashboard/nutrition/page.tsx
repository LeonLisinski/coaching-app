'use client'
import MobileUnavailable from '@/app/components/mobile-unavailable'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { usePersistedTab } from '@/app/contexts/tab-state'
import {
  DndContext, DragOverlay, pointerWithin,
  useSensor, useSensors, PointerSensor,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import FoodsTab from './tabs/foods-tab'
import RecipesTab from './tabs/recipes-tab'
import PlansTab from './tabs/plans-tab'
import { UtensilsCrossed, BookOpen, CalendarDays } from 'lucide-react'

type ActiveDrag = {
  type: 'food' | 'recipe'
  id: string
  name: string
  subtitle?: string
  payload: any
}

function NutritionPageContent() {
  const t = useTranslations('nutrition.page')
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [activeType, setActiveType] = useState<'food' | 'recipe' | null>(null)
  const [foodRefreshKey, setFoodRefreshKey] = useState(0)
  const [recipeRefreshKey, setRecipeRefreshKey] = useState(0)
  const [planRefreshKey, setPlanRefreshKey] = useState(0)
  const [mobileTab, setMobileTab] = usePersistedTab('nutrition_tab', 'foods')

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

    // ── Food → Recipe (add as ingredient with 100g) ──────────────────────────
    if (drag.type === 'food' && drop.type === 'recipe-drop') {
      const food = drag.payload
      const recipeId = drop.recipeId

      const { data: recipe } = await supabase
        .from('recipes')
        .select('ingredients')
        .eq('id', recipeId)
        .single()

      if (recipe) {
        const existing: any[] = recipe.ingredients || []
        if (!existing.find(i => i.food_id === food.id)) {
          const newIngredient = {
            food_id: food.id, name: food.name, grams: 100,
            calories: food.calories_per_100g,
            protein: food.protein_per_100g,
            carbs: food.carbs_per_100g,
            fat: food.fat_per_100g,
          }
          const newIngredients = [...existing, newIngredient]
          const totals = newIngredients.reduce((acc, i) => ({
            calories: acc.calories + i.calories,
            protein: acc.protein + i.protein,
            carbs: acc.carbs + i.carbs,
            fat: acc.fat + i.fat,
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

          await supabase.from('recipes').update({
            ingredients: newIngredients,
            total_calories: totals.calories,
            total_protein: totals.protein,
            total_carbs: totals.carbs,
            total_fat: totals.fat,
          }).eq('id', recipeId)

          setRecipeRefreshKey(k => k + 1)
        }
      }
    }

    // ── Recipe → Plan (add as meal slot with recipe reference) ───────────────
    if (drag.type === 'recipe' && drop.type === 'plan-drop') {
      const recipe = drag.payload
      const planId = drop.planId

      const { data: plan } = await supabase
        .from('meal_plans')
        .select('meals')
        .eq('id', planId)
        .single()

      if (plan) {
        const existing: any[] = plan.meals || []
        const newMeal = {
          _id: `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          meal_type: 'Obrok',
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          calories: recipe.total_calories ?? 0,
          protein: recipe.total_protein ?? 0,
          carbs: recipe.total_carbs ?? 0,
          fat: recipe.total_fat ?? 0,
          custom_ingredients: [],
        }
        await supabase.from('meal_plans').update({ meals: [...existing, newMeal] }).eq('id', planId)
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
          <div className={`flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-2xl text-sm font-medium text-gray-800 select-none pointer-events-none rotate-2 scale-105 border-2 ${
            activeDrag.type === 'recipe' ? 'border-rose-400' : 'border-orange-400'
          }`}>
            {activeDrag.type === 'recipe'
              ? <BookOpen size={14} className="text-rose-500 shrink-0" />
              : <UtensilsCrossed size={14} className="text-orange-500 shrink-0" />
            }
            <div>
              <p className="leading-tight">{activeDrag.name}</p>
              {activeDrag.subtitle && <p className="text-xs text-gray-400 font-normal">{activeDrag.subtitle}</p>}
            </div>
          </div>
        )}
      </DragOverlay>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-4 lg:p-8 gap-3">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>

        {/* Hint bar while dragging */}
        {activeDrag?.type === 'food' && (
          <div className="shrink-0 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-2 text-xs font-medium flex items-center gap-2">
            {t('dragHintFood')}
          </div>
        )}
        {activeDrag?.type === 'recipe' && (
          <div className="shrink-0 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl px-4 py-2 text-xs font-medium flex items-center gap-2">
            {t('dragHintRecipe')}
          </div>
        )}

        {/* Desktop: 3 panels always visible side by side */}
        <div className="hidden xl:grid xl:grid-cols-3 xl:gap-5 flex-1 min-h-0">

          {/* Namirnice */}
          <div className="flex flex-col min-h-0 rounded-2xl shadow-sm overflow-hidden border border-orange-200">
            <div className={`px-4 py-3 shrink-0 bg-gradient-to-r from-orange-500 to-amber-400 transition-all ${activeType === 'recipe' ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <UtensilsCrossed size={13} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{t('foodsColumn')}</h3>
                </div>
                <span className="text-[10px] text-orange-100/80 font-medium">{t('dragToRecipe')}</span>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <FoodsTab activeType={activeType} refreshKey={foodRefreshKey} onFoodCreated={() => setFoodRefreshKey(k => k + 1)} />
            </div>
          </div>

          {/* Recepti */}
          <div className={`flex flex-col min-h-0 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
            activeType === 'food' ? 'border-2 border-rose-400 ring-2 ring-rose-400/20' : 'border border-rose-200'
          }`}>
            <div className={`px-4 py-3 shrink-0 bg-gradient-to-r from-rose-500 to-pink-400 transition-all ${activeType === 'recipe' ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <BookOpen size={13} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{t('recipesColumn')}</h3>
                </div>
                {activeType === 'food'
                  ? <span className="text-[10px] text-white font-bold animate-pulse">{t('dropHereFood')}</span>
                  : <span className="text-[10px] text-rose-100/80 font-medium">{t('acceptsFoods')}</span>
                }
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <RecipesTab key={recipeRefreshKey} activeType={activeType} onFoodCreated={() => setFoodRefreshKey(k => k + 1)} />
            </div>
          </div>

          {/* Planovi prehrane */}
          <div className={`flex flex-col min-h-0 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
            activeType === 'recipe' ? 'border-2 border-purple-400 ring-2 ring-purple-400/20' : 'border border-purple-200'
          }`}>
            <div className="px-4 py-3 shrink-0 bg-gradient-to-r from-purple-600 to-violet-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <CalendarDays size={13} className="text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{t('plansColumn')}</h3>
                </div>
                {activeType === 'recipe'
                  ? <span className="text-[10px] text-white font-bold animate-pulse">{t('dropHereRecipe')}</span>
                  : <span className="text-[10px] text-purple-100/80 font-medium">{t('acceptsRecipes')}</span>
                }
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <PlansTab activeType={activeType} refreshKey={planRefreshKey} />
            </div>
          </div>

        </div>

        {/* Mobile/tablet: tabs */}
        <div className="xl:hidden flex-1 min-h-0 overflow-y-auto">
          <Tabs value={mobileTab} onValueChange={setMobileTab}>
            <TabsList>
              <TabsTrigger value="foods">{t('tabs.foods')}</TabsTrigger>
              <TabsTrigger value="recipes">{t('tabs.recipes')}</TabsTrigger>
              <TabsTrigger value="plans">{t('tabs.plans')}</TabsTrigger>
            </TabsList>
            <TabsContent value="foods" className="mt-4">
              <FoodsTab activeType={activeType} refreshKey={foodRefreshKey} onFoodCreated={() => setFoodRefreshKey(k => k + 1)} />
            </TabsContent>
            <TabsContent value="recipes" className="mt-4">
              <RecipesTab key={recipeRefreshKey} activeType={activeType} onFoodCreated={() => setFoodRefreshKey(k => k + 1)} />
            </TabsContent>
            <TabsContent value="plans" className="mt-4">
              <PlansTab activeType={activeType} refreshKey={planRefreshKey} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DndContext>
  )
}

function NutritionPageMobileTitle() {
  const t = useTranslations('nutrition.page')
  return <MobileUnavailable title={t('mobileUnavailable')} />
}

export default function NutritionPage() {
  return (
    <>
      <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0"><NutritionPageContent /></div>
      <div className="lg:hidden"><NutritionPageMobileTitle /></div>
    </>
  )
}
