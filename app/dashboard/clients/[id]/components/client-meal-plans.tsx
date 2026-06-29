'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, X, UtensilsCrossed, ChevronDown, ChevronUp, GripVertical, BookMarked, Zap, Check } from 'lucide-react'
import { SupplementsSection, type Supplement } from '@/app/dashboard/nutrition/components/supplements-section'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddMealPlanDialog from '@/app/dashboard/nutrition/dialogs/add-meal-plan-dialog'
import EditMealPlanDialog from '@/app/dashboard/nutrition/dialogs/edit-meal-plan-dialog'
import { useTranslations, useLocale } from 'next-intl'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import { useAppTheme } from '@/app/contexts/app-theme'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = { clientId: string; refreshKey?: number }

type MealPlan = {
  id: string
  name: string
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  meals: any[]
}

type AssignedPlan = {
  id: string
  active: boolean
  assigned_at: string
  notes: string | null
  plan_type: 'default' | 'training_day' | 'rest_day'
  custom_name: string | null
  meals: any[] | null
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  extras_targets: Record<string, number | null> | null
  supplements: { name: string; amount: string; timing: string }[] | null
  meal_plan: MealPlan
}

type Recipe = {
  id: string
  name: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  ingredients: any[]
}

type AssignMeal = {
  id: string
  meal_type: string
  recipe_id: string | null
  recipe_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  custom_ingredients?: any[]
}

function SortableMealCard({
  meal, recipes, onUpdate, onRemove,
}: {
  meal: AssignMeal
  recipes: Recipe[]
  onUpdate: (field: string, val: any) => void
  onRemove: () => void
}) {
  const t = useTranslations('clients.mealPlans')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: meal.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const MEAL_TYPES = ['Doručak', 'Ručak', 'Večera', 'Užina', 'Prije treninga', 'Nakon treninga']

  // Use custom_ingredients if set (edited), otherwise fall back to recipe's ingredients
  const ingredients: any[] =
    meal.custom_ingredients && meal.custom_ingredients.length > 0
      ? meal.custom_ingredients
      : recipes.find(r => r.id === meal.recipe_id)?.ingredients || []

  const [showIngredients, setShowIngredients] = useState(ingredients.length > 0)

  const updateIngredientGrams = (food_id: string, newGrams: number) => {
    const updated = ingredients.map(ing => {
      if (ing.food_id !== food_id) return ing
      const oldGrams = ing.grams || 100
      const ratio = newGrams / oldGrams
      return {
        ...ing,
        grams: newGrams,
        calories: ing.calories * ratio,
        protein: ing.protein * ratio,
        carbs: ing.carbs * ratio,
        fat: ing.fat * ratio,
      }
    })
    const totals = updated.reduce(
      (acc, ing) => ({
        calories: acc.calories + (ing.calories || 0),
        protein:  acc.protein  + (ing.protein  || 0),
        carbs:    acc.carbs    + (ing.carbs    || 0),
        fat:      acc.fat      + (ing.fat      || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )
    onUpdate('custom_ingredients', updated)
    onUpdate('calories', Math.round(totals.calories))
    onUpdate('protein',  Math.round(totals.protein  * 10) / 10)
    onUpdate('carbs',    Math.round(totals.carbs    * 10) / 10)
    onUpdate('fat',      Math.round(totals.fat      * 10) / 10)
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Meal header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50/50">
        <button type="button" {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical size={14} />
        </button>
        <select
          value={meal.meal_type}
          onChange={e => onUpdate('meal_type', e.target.value)}
          className="flex-1 text-sm font-semibold bg-transparent border-none outline-none cursor-pointer text-gray-700"
        >
          {MEAL_TYPES.map(mt => <option key={mt} value={mt}>{mt}</option>)}
        </select>
        <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Recipe select + macros */}
      <div className="px-3 py-3 space-y-2">
        <Select value={meal.recipe_id || '__none__'} onValueChange={v => {
          const realVal = v === '__none__' ? null : v
          const recipe = recipes.find(r => r.id === realVal)
          onUpdate('recipe_id', realVal)
          onUpdate('recipe_name', recipe?.name || '')
          onUpdate('calories', recipe?.total_calories || 0)
          onUpdate('protein', recipe?.total_protein || 0)
          onUpdate('carbs', recipe?.total_carbs || 0)
          onUpdate('fat', recipe?.total_fat || 0)
          const newIngredients = recipe?.ingredients ? [...recipe.ingredients] : []
          onUpdate('custom_ingredients', newIngredients)
          setShowIngredients(newIngredients.length > 0)
        }}>
          <SelectTrigger className="h-8 text-sm border-gray-200">
            <SelectValue placeholder={t('selectRecipePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t('noRecipeOption')}</SelectItem>
            {recipes.map(r => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} · {Math.round(r.total_calories)} kcal
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ingredient list — shown when recipe or custom_ingredients present */}
        {ingredients.length > 0 && (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowIngredients(v => !v)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-50 text-[11px] font-semibold text-gray-500 hover:text-purple-600 transition-colors"
            >
              <span>Namirnice ({ingredients.length})</span>
              {showIngredients ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showIngredients && (
              <div className="divide-y divide-gray-50 px-3 py-1.5 space-y-1">
                {ingredients.map((ing: any) => (
                  <div key={ing.food_id} className="flex items-center gap-2 py-1">
                    <span className="flex-1 text-xs text-gray-700 truncate">{ing.name}</span>
                    <input
                      type="number"
                      value={Math.round(ing.grams) || 0}
                      onChange={e => updateIngredientGrams(ing.food_id, parseFloat(e.target.value) || 0)}
                      className="w-14 h-6 text-xs border border-gray-200 rounded px-1.5 text-center focus:border-purple-300 focus:outline-none"
                    />
                    <span className="text-[10px] text-gray-400 w-3 shrink-0">g</span>
                    <span className="text-[10px] text-gray-400 w-14 text-right shrink-0">{Math.round(ing.calories)} kcal</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual macro inputs */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { key: 'calories', label: t('mealMacroKcal'),  color: 'text-orange-500' },
            { key: 'protein',  label: t('mealMacroProt'),  color: 'text-rose-500'   },
            { key: 'carbs',    label: t('mealMacroCarbs'), color: 'text-amber-500'  },
            { key: 'fat',      label: t('mealMacroFat'),   color: 'text-emerald-500'},
          ].map(f => (
            <div key={f.key}>
              <p className={`text-[10px] font-semibold mb-0.5 ${f.color}`}>{f.label}</p>
              <input
                type="number"
                value={Math.round((meal as any)[f.key]) || 0}
                onChange={e => onUpdate(f.key, parseFloat(e.target.value) || 0)}
                className="w-full h-7 text-xs border border-gray-200 rounded-md px-2 text-center focus:border-purple-300 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const PLAN_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  default:      { color: '#6b7280', bg: '#f3f4f6' },
  training_day: { color: '#2563eb', bg: '#dbeafe' },
  rest_day:     { color: '#7c3aed', bg: '#ede9fe' },
}

const MEAL_TYPES = ['Doručak', 'Ručak', 'Večera', 'Užina', 'Prije treninga', 'Nakon treninga']

function NutritionalSummary({ meals, caloriesTarget, proteinTarget, carbsTarget, fatTarget, activeExtraFields, extrasTargets, isDark }: {
  meals: any[]
  caloriesTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
  activeExtraFields: typeof NUTRITION_FIELD_OPTIONS
  extrasTargets?: Record<string, number | null> | null
  isDark?: boolean
}) {
  const t = useTranslations('clients.mealPlans')
  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein:  acc.protein  + (m.protein  || 0),
    carbs:    acc.carbs    + (m.carbs    || 0),
    fat:      acc.fat      + (m.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  if (totals.calories === 0 && totals.protein === 0) return null

  const items = [
    { label: t('kcalSummaryLabel'),    val: Math.round(totals.calories), target: caloriesTarget, unit: ''  },
    { label: t('proteinSummaryLabel'), val: Math.round(totals.protein),  target: proteinTarget,  unit: 'g' },
    { label: t('carbsSummaryLabel'),   val: Math.round(totals.carbs),    target: carbsTarget,    unit: 'g' },
    { label: t('fatSummaryLabel'),     val: Math.round(totals.fat),      target: fatTarget,      unit: 'g' },
  ]

  const getMealExtra = (m: any, key: string): number => {
    if (m.extras?.[key] != null) return m.extras[key] as number
    return ((m.custom_ingredients || []) as any[]).reduce(
      (s: number, ing: any) => s + ((ing.extras?.[key] as number) || 0), 0
    )
  }
  const extraTotals = activeExtraFields.reduce((acc, f) => {
    acc[f.key] = meals.reduce((sum, m) => sum + getMealExtra(m, f.key), 0)
    return acc
  }, {} as Record<string, number>)

  const visibleExtras = activeExtraFields.filter(f => extraTotals[f.key] > 0)

  return (
    <div
      className="px-3 pt-2.5 pb-3"
      style={isDark ? {
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      } : {
        borderTop: '1px solid #f3f4f6',
        background: 'rgba(249,250,251,0.6)',
      }}
    >
      <div className="grid grid-cols-4 gap-3">
        {items.map(item => {
          const pct    = item.target ? Math.min((item.val / item.target) * 100, 110) : null
          const over   = item.target != null && item.val > item.target
          const barPct = pct != null ? Math.min(pct, 100) : null
          const barColor = pct == null ? (isDark ? 'bg-white/20' : 'bg-gray-300')
            : over             ? 'bg-red-400'
            : pct >= 90        ? 'bg-emerald-500'
            :                    'bg-amber-400'
          return (
            <div key={item.label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{item.label}</span>
                <span className={`text-[10px] font-semibold tabular-nums ${over ? 'text-red-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {item.val}{item.unit}
                  {item.target != null && <span className={`font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>/{item.target}{item.unit}</span>}
                </span>
              </div>
              {barPct != null && (
                <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <div className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${barPct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {visibleExtras.length > 0 && (
        <div className={`flex gap-3 flex-wrap mt-2 pt-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-gray-100'}`}>
          {visibleExtras.map(f => {
            const tgtVal = extrasTargets?.[f.key] ?? null
            const actual = Math.round(extraTotals[f.key] * 10) / 10
            const over = tgtVal != null && actual > tgtVal
            return (
              <span key={f.key} className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                {f.label}: <span className={`font-medium ${over ? 'text-red-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>{actual}{f.unit}</span>
                {tgtVal != null && <span className={`${over ? 'text-red-400' : isDark ? 'text-emerald-500' : 'text-green-600'}`}> / {tgtVal}{f.unit}</span>}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MealAccordion({
  meals, activeExtraFields, recipes = [], isDark,
  isEditing = false, onUpdateIngGrams, onRemoveIng, onAddIng, onUpdateMacros, foods = [],
}: {
  meals: any[]
  activeExtraFields: typeof NUTRITION_FIELD_OPTIONS
  recipes?: Recipe[]
  isDark?: boolean
  isEditing?: boolean
  onUpdateIngGrams?: (mealIdx: number, food_id: string, newGrams: number) => void
  onRemoveIng?: (mealIdx: number, food_id: string) => void
  onAddIng?: (mealIdx: number, food: any) => void
  onUpdateMacros?: (mealIdx: number, field: string, val: number) => void
  foods?: any[]
}) {
  const [openMeals, setOpenMeals] = useState<Record<number, boolean>>({})
  const toggle = (i: number) => setOpenMeals(prev => ({ ...prev, [i]: !(prev[i] ?? false) }))
  const [foodSearch, setFoodSearch] = useState<Record<number, string>>({})
  const [searchFocused, setSearchFocused] = useState<Record<number, boolean>>({})
  const blurTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (isEditing) setOpenMeals(Object.fromEntries(meals.map((_, i) => [i, true])))
  }, [isEditing, meals.length])

  return (
    <div style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' }}>
      {meals.map((meal: any, mIdx: number) => {
        const customIngs: any[] = meal.custom_ingredients || []
        const recipeIngs: any[] = customIngs.length === 0 && meal.recipe_id
          ? (recipes.find(r => r.id === meal.recipe_id)?.ingredients || [])
          : []
        const ingredients: any[] = customIngs.length > 0 ? customIngs : recipeIngs
        const hasIngredients = ingredients.length > 0
        const isOpen = openMeals[mIdx] ?? false
        const canExpand = hasIngredients || isEditing
        return (
          <div key={mIdx} style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f9fafb' }}>
            <button
              type="button"
              onClick={() => canExpand && toggle(mIdx)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${canExpand ? (isDark ? 'hover:bg-white/[0.03] cursor-pointer' : 'hover:bg-gray-50 cursor-pointer') : 'cursor-default'}`}
            >
              {canExpand ? (
                isOpen
                  ? <ChevronUp size={12} className={`shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                  : <ChevronDown size={12} className={`shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className={`text-xs w-4 text-right tabular-nums shrink-0 ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>{mIdx + 1}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{meal.recipe_name || meal.meal_type}</span>
                {meal.recipe_name && <span className={`text-xs ml-1.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{meal.meal_type}</span>}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {meal.calories ? `${Math.round(meal.calories)} kcal` : '—'}
                  {meal.protein ? ` · P: ${Math.round(meal.protein)}g` : ''}
                </div>
                {!isEditing && activeExtraFields.length > 0 && meal.extras && (
                  <div className="flex gap-1.5 justify-end flex-wrap">
                    {activeExtraFields.map(f => {
                      const val = meal.extras?.[f.key]
                      if (!val) return null
                      return <span key={f.key} className={`text-[10px] ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>{f.label}: {Math.round(val * 10) / 10}{f.unit}</span>
                    })}
                  </div>
                )}
              </div>
            </button>

            {/* Expandable ingredient section */}
            {isOpen && (
              <div className="pb-2 px-3">
                {hasIngredients ? (
                  ingredients.map((ing: any, iIdx: number) => (
                    <div
                      key={iIdx}
                      className="flex items-center gap-2 py-1 text-xs"
                      style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f9fafb' }}
                    >
                      <span className={`ml-5 flex-1 min-w-0 truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{ing.name}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number" min={0}
                            value={Math.round(ing.grams || 0)}
                            onFocus={e => e.target.select()}
                            onChange={e => onUpdateIngGrams?.(mIdx, ing.food_id, parseInt(e.target.value) || 0)}
                            className={`w-14 h-5 text-center text-xs rounded border focus:outline-none ${isDark ? 'bg-white/5 border-white/15 text-gray-200 focus:border-blue-500/60' : 'bg-white border-gray-200 focus:border-blue-400'}`}
                          />
                          <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>g</span>
                          <span className={`text-[10px] tabular-nums ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>{Math.round(ing.calories)} kcal</span>
                          <button type="button" onClick={() => onRemoveIng?.(mIdx, ing.food_id)} className="ml-0.5 shrink-0">
                            <X size={10} className="text-red-400/50 hover:text-red-400 transition-colors" />
                          </button>
                        </div>
                      ) : (
                        <span className={`shrink-0 tabular-nums ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{ing.grams}g · {Math.round(ing.calories)} kcal</span>
                      )}
                    </div>
                  ))
                ) : isEditing ? (
                  /* No ingredients — direct macro editing */
                  <div className="py-2">
                    <p className={`text-[10px] mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Unesite makronutrijente direktno:</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([['calories','kcal'],['protein','P'],['carbs','UH'],['fat','M']] as const).map(([field, label]) => (
                        <div key={field} className="text-center">
                          <input
                            type="number" min={0}
                            value={Math.round((meal as any)[field] || 0)}
                            onFocus={e => e.target.select()}
                            onChange={e => onUpdateMacros?.(mIdx, field, parseFloat(e.target.value) || 0)}
                            className={`w-full h-6 text-center text-xs rounded border focus:outline-none ${isDark ? 'bg-white/5 border-white/15 text-gray-200 focus:border-blue-500/60' : 'bg-white border-gray-200 focus:border-blue-400'}`}
                          />
                          <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Add ingredient — only in edit mode */}
                {isEditing && (
                  <div className="relative mt-1.5">
                    <input
                      value={foodSearch[mIdx] || ''}
                      onChange={e => setFoodSearch(prev => ({ ...prev, [mIdx]: e.target.value }))}
                      onFocus={() => {
                        if (blurTimers.current[mIdx]) clearTimeout(blurTimers.current[mIdx])
                        setSearchFocused(prev => ({ ...prev, [mIdx]: true }))
                      }}
                      onBlur={() => {
                        blurTimers.current[mIdx] = setTimeout(() => setSearchFocused(prev => ({ ...prev, [mIdx]: false })), 150)
                      }}
                      placeholder="+ Dodaj namirnicu..."
                      className={`w-full h-7 text-xs rounded-lg border px-3 focus:outline-none transition-colors ${isDark ? 'bg-transparent border-white/10 border-dashed text-gray-400 placeholder:text-gray-700 focus:border-white/25 focus:bg-white/[0.03]' : 'bg-white border-gray-200 border-dashed placeholder:text-gray-400 focus:border-blue-400'}`}
                    />
                    {(searchFocused[mIdx] || !!(foodSearch[mIdx])) && (
                      <div
                        className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-lg overflow-hidden shadow-xl"
                        style={isDark ? { background: 'rgb(12,12,18)', border: '1px solid rgba(255,255,255,0.1)' } : { background: 'white', border: '1px solid #e5e7eb' }}
                      >
                        <div className="max-h-44 overflow-y-auto" onWheel={e => e.stopPropagation()}>
                          {foods
                            .filter(f =>
                              f.name.toLowerCase().includes((foodSearch[mIdx] || '').toLowerCase()) &&
                              !ingredients.find((i: any) => i.food_id === f.id)
                            )
                            .slice(0, 15)
                            .map((f: any) => (
                              <button
                                key={f.id} type="button"
                                onMouseDown={ev => ev.preventDefault()}
                                onClick={() => {
                                  onAddIng?.(mIdx, f)
                                  setFoodSearch(prev => ({ ...prev, [mIdx]: '' }))
                                  setSearchFocused(prev => ({ ...prev, [mIdx]: false }))
                                }}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${isDark ? 'text-gray-300 hover:bg-white/5 border-b border-white/[0.04] last:border-0' : 'text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0'}`}
                              >
                                <span>{f.name}</span>
                                <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{Math.round(f.calories_per_100g)} kcal/100g</span>
                              </button>
                            ))
                          }
                          {foods.filter(f => f.name.toLowerCase().includes((foodSearch[mIdx] || '').toLowerCase())).length === 0 && (
                            <p className={`px-3 py-2.5 text-xs text-center ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>Nema rezultata</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ClientMealPlans({ clientId, refreshKey }: Props) {
  const t = useTranslations('clients.mealPlans')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const { settings } = useTrainerSettings()
  const activeExtraFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  const PLAN_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    default:      { label: t('planTypeDefault'),     ...PLAN_TYPE_COLORS.default },
    training_day: { label: t('planTypeTrainingDay'), ...PLAN_TYPE_COLORS.training_day },
    rest_day:     { label: t('planTypeRestDay'),     ...PLAN_TYPE_COLORS.rest_day },
  }

  const [assignedPlans, setAssignedPlans] = useState<AssignedPlan[]>([])
  const [availablePlans, setAvailablePlans] = useState<MealPlan[]>([])
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  const assignSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Assign dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [assignMeals, setAssignMeals] = useState<AssignMeal[]>([])
  const [assignTargets, setAssignTargets] = useState({ calories: '', protein: '', carbs: '', fat: '' })
  const [assignPlanType, setAssignPlanType] = useState<'default' | 'training_day' | 'rest_day'>('default')
  const [assignNotes, setAssignNotes] = useState('')
  const [assignSupplements, setAssignSupplements] = useState<Supplement[]>([])
  const [assigning, setAssigning] = useState(false)

  // Other
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [editTarget, setEditTarget] = useState<AssignedPlan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingPlanTypeId, setEditingPlanTypeId] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Conflict: another plan of the same type is already active
  const [activateConflict, setActivateConflict] = useState<{
    existingName: string
    typeLabel: string
    execute: () => Promise<void>
  } | null>(null)

  // Quick inline edit state
  const [quickEditMealPlanId, setQuickEditMealPlanId] = useState<string | null>(null)
  const [quickEditMeals, setQuickEditMeals] = useState<any[]>([])
  const [quickEditSaving, setQuickEditSaving] = useState(false)
  const [foods, setFoods] = useState<any[]>([])

  const fetchFoods = async () => {
    if (foods.length > 0) return
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const [{ data: allFoods }, { data: overrides }] = await Promise.all([
      supabase.from('foods')
        .select('id,name,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,is_default,trainer_id')
        .or(`trainer_id.eq.${user.id},is_default.eq.true`)
        .limit(2000)
        .order('name'),
      supabase.from('trainer_overrides').select('default_id').eq('trainer_id', user.id).eq('resource_type', 'food'),
    ])
    const overriddenIds = new Set((overrides || []).map((o: any) => o.default_id))
    const visible = (allFoods || []).filter((f: any) =>
      (!f.is_default && f.trainer_id === user.id) || (f.is_default && !overriddenIds.has(f.id))
    )
    setFoods(visible)
  }

  const enterQuickMealEdit = (assigned: AssignedPlan) => {
    const planMeals = assigned.meals?.length ? assigned.meals : assigned.meal_plan.meals || []
    setQuickEditMeals(JSON.parse(JSON.stringify(planMeals)))
    setQuickEditMealPlanId(assigned.id)
    fetchFoods()
  }

  const cancelQuickMealEdit = () => { setQuickEditMealPlanId(null); setQuickEditMeals([]) }

  const saveQuickMealEdit = async () => {
    if (!quickEditMealPlanId) return
    setQuickEditSaving(true)
    // Recalculate targets from meals
    const totalCal = quickEditMeals.reduce((s, m) => s + (m.calories || 0), 0)
    const totalPro = quickEditMeals.reduce((s, m) => s + (m.protein || 0), 0)
    const totalCarb = quickEditMeals.reduce((s, m) => s + (m.carbs || 0), 0)
    const totalFat = quickEditMeals.reduce((s, m) => s + (m.fat || 0), 0)
    await supabase.from('client_meal_plans').update({
      meals: quickEditMeals,
      calories_target: Math.round(totalCal) || null,
      protein_target: Math.round(totalPro * 10) / 10 || null,
      carbs_target: Math.round(totalCarb * 10) / 10 || null,
      fat_target: Math.round(totalFat * 10) / 10 || null,
    }).eq('id', quickEditMealPlanId)
    setAssignedPlans(prev => prev.map(p => p.id === quickEditMealPlanId ? {
      ...p,
      meals: quickEditMeals,
      calories_target: Math.round(totalCal) || null,
      protein_target: Math.round(totalPro * 10) / 10 || null,
      carbs_target: Math.round(totalCarb * 10) / 10 || null,
      fat_target: Math.round(totalFat * 10) / 10 || null,
    } : p))
    setQuickEditMealPlanId(null)
    setQuickEditMeals([])
    setQuickEditSaving(false)
  }

  const updateIngGrams = (mealIdx: number, food_id: string, newGrams: number) => {
    setQuickEditMeals(prev => prev.map((meal, i) => {
      if (i !== mealIdx) return meal
      const ings = (meal.custom_ingredients || []).map((ing: any) => {
        if (ing.food_id !== food_id) return ing
        const oldGrams = ing.grams || 100
        const ratio = oldGrams > 0 ? newGrams / oldGrams : 0
        return { ...ing, grams: newGrams, calories: ing.calories * ratio, protein: ing.protein * ratio, carbs: ing.carbs * ratio, fat: ing.fat * ratio }
      })
      const totals = ings.reduce((acc: any, ing: any) => ({
        calories: acc.calories + (ing.calories || 0), protein: acc.protein + (ing.protein || 0),
        carbs: acc.carbs + (ing.carbs || 0), fat: acc.fat + (ing.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
      return { ...meal, custom_ingredients: ings, ...{ calories: Math.round(totals.calories), protein: Math.round(totals.protein * 10) / 10, carbs: Math.round(totals.carbs * 10) / 10, fat: Math.round(totals.fat * 10) / 10 } }
    }))
  }

  const removeIng = (mealIdx: number, food_id: string) => {
    setQuickEditMeals(prev => prev.map((meal, i) => {
      if (i !== mealIdx) return meal
      const ings = (meal.custom_ingredients || []).filter((ing: any) => ing.food_id !== food_id)
      const totals = ings.reduce((acc: any, ing: any) => ({
        calories: acc.calories + (ing.calories || 0), protein: acc.protein + (ing.protein || 0),
        carbs: acc.carbs + (ing.carbs || 0), fat: acc.fat + (ing.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
      return { ...meal, custom_ingredients: ings, ...{ calories: Math.round(totals.calories), protein: Math.round(totals.protein * 10) / 10, carbs: Math.round(totals.carbs * 10) / 10, fat: Math.round(totals.fat * 10) / 10 } }
    }))
  }

  const addIng = (mealIdx: number, food: any) => {
    setQuickEditMeals(prev => prev.map((meal, i) => {
      if (i !== mealIdx) return meal
      const currentIngs = meal.custom_ingredients || []
      if (currentIngs.find((ing: any) => ing.food_id === food.id)) return meal
      const newIng = { food_id: food.id, name: food.name, grams: 100, calories: food.calories_per_100g, protein: food.protein_per_100g, carbs: food.carbs_per_100g, fat: food.fat_per_100g }
      const ings = [...currentIngs, newIng]
      const totals = ings.reduce((acc: any, ing: any) => ({
        calories: acc.calories + (ing.calories || 0), protein: acc.protein + (ing.protein || 0),
        carbs: acc.carbs + (ing.carbs || 0), fat: acc.fat + (ing.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
      return { ...meal, custom_ingredients: ings, ...{ calories: Math.round(totals.calories), protein: Math.round(totals.protein * 10) / 10, carbs: Math.round(totals.carbs * 10) / 10, fat: Math.round(totals.fat * 10) / 10 } }
    }))
  }

  const updateMacros = (mealIdx: number, field: string, val: number) => {
    setQuickEditMeals(prev => prev.map((meal, i) => i !== mealIdx ? meal : { ...meal, [field]: val }))
  }

  useEffect(() => { fetchData() }, [clientId, refreshKey])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const [{ data: assigned }, { data: available }, { data: recipes }] = await Promise.all([
      supabase
        .from('client_meal_plans')
        .select(`
          id, active, assigned_at, notes, plan_type, custom_name, meals, supplements,
          calories_target, protein_target, carbs_target, fat_target, extras_targets,
          meal_plan:meal_plans (id, name, calories_target, protein_target, carbs_target, fat_target, meals, extras_targets)
        `)
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('meal_plans')
        .select('id, name, calories_target, protein_target, carbs_target, fat_target, meals')
        .eq('trainer_id', user.id)
        .eq('is_template', true)
        .order('name'),
      supabase
        .from('recipes')
        .select('id, name, total_calories, total_protein, total_carbs, total_fat, ingredients')
        .eq('trainer_id', user.id)
        .limit(1000),
    ])

    // Only fetch foods if any assigned plan has custom ingredients with extras
    const needsExtras = (assigned || []).some((p: any) =>
      (p.meals || []).some((m: any) => (m.custom_ingredients || []).length > 0)
    )
    const foodExtrasMap = new Map<string, Record<string, number>>()
    if (needsExtras) {
      const { data: allFoods } = await supabase.from('foods').select('id, extras').limit(5000)
      ;(allFoods || []).forEach((f: any) => {
        if (f.extras) foodExtrasMap.set(f.id, f.extras)
      })
    }

    // Recompute extras for every meal's ingredients from current food data
    const recomputeMealExtras = (meals: any[] | null) => {
      if (!meals) return meals
      return meals.map((meal: any) => {
        const ings: any[] = meal.custom_ingredients || []
        if (ings.length === 0) return meal
        const updatedIngs = ings.map((ing: any) => {
          const foodExtras = foodExtrasMap.get(ing.food_id)
          if (!foodExtras) return ing
          const ratio = (ing.grams || 100) / 100
          const extras: Record<string, number> = {}
          Object.entries(foodExtras).forEach(([k, v]) => {
            if (v != null) extras[k] = (v as number) * ratio
          })
          return { ...ing, extras }
        })
        const mealExtras: Record<string, number> = {}
        updatedIngs.forEach((ing: any) => {
          if (ing.extras) {
            Object.entries(ing.extras).forEach(([k, v]) => {
              mealExtras[k] = (mealExtras[k] || 0) + (v as number)
            })
          }
        })
        return { ...meal, custom_ingredients: updatedIngs, extras: mealExtras }
      })
    }

    if (assigned) {
      const enriched = (assigned as any[]).map(p => ({
        ...p,
        meals: recomputeMealExtras(p.meals),
        meal_plan: p.meal_plan ? {
          ...p.meal_plan,
          meals: recomputeMealExtras(p.meal_plan.meals),
        } : p.meal_plan,
      }))
      setAssignedPlans(enriched as any)
    }
    if (available) setAvailablePlans(available)
    if (recipes) setAvailableRecipes(recipes)
    setLoading(false)
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    const plan = availablePlans.find(p => p.id === planId)
    if (!plan) { setAssignMeals([]); return }
    setAssignTargets({
      calories: plan.calories_target?.toString() || '',
      protein: plan.protein_target?.toString() || '',
      carbs: plan.carbs_target?.toString() || '',
      fat: plan.fat_target?.toString() || '',
    })
    setAssignMeals((plan.meals || []).map((m: any, i: number) => ({
      id: `meal-${Date.now()}-${i}`,
      meal_type: m.meal_type ?? 'Doručak',
      recipe_id: m.recipe_id ?? null,
      recipe_name: m.recipe_name ?? '',
      calories: m.calories ?? 0,
      protein: m.protein ?? 0,
      carbs: m.carbs ?? 0,
      fat: m.fat ?? 0,
      custom_ingredients: m.custom_ingredients ?? [],
    })))
  }

  const updateAssignMealField = (id: string, field: string, value: any) => {
    setAssignMeals(prev => prev.map(m => m.id !== id ? m : { ...m, [field]: value }))
  }

  const removeAssignMeal = (id: string) => {
    setAssignMeals(prev => prev.filter(m => m.id !== id))
  }

  const addAssignMeal = () => {
    setAssignMeals(prev => [...prev, {
      id: `meal-${Date.now()}-${prev.length}`,
      meal_type: 'Doručak', recipe_id: null, recipe_name: '', calories: 0, protein: 0, carbs: 0, fat: 0,
    }])
  }

  const handleMealDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setAssignMeals(prev => {
      const oldIdx = prev.findIndex(m => m.id === active.id)
      const newIdx = prev.findIndex(m => m.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const assignTotals = assignMeals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),
    fat: acc.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  // Deactivate conflicting plan of same type, then run action
  const deactivateSameTypeAndRun = async (
    planType: string,
    exceptId: string | null,
    action: () => Promise<void>
  ) => {
    const conflict = assignedPlans.find(
      p => p.active && p.plan_type === planType && p.id !== exceptId
    )
    if (conflict) {
      await supabase.from('client_meal_plans').update({ active: false }).eq('id', conflict.id)
    }
    await action()
    fetchData()
  }

  const assignPlan = async () => {
    if (!selectedPlanId) return

    const conflicting = assignedPlans.find(p => p.active && p.plan_type === assignPlanType)
    const doInsert = async () => {
      setAssigning(true)
      const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
      if (!user) return
      await supabase.from('client_meal_plans').insert({
        trainer_id: user.id, client_id: clientId,
        meal_plan_id: selectedPlanId, meals: assignMeals,
        calories_target: assignTargets.calories ? parseInt(assignTargets.calories) : null,
        protein_target:  assignTargets.protein  ? parseInt(assignTargets.protein)  : null,
        carbs_target:    assignTargets.carbs     ? parseInt(assignTargets.carbs)    : null,
        fat_target:      assignTargets.fat       ? parseInt(assignTargets.fat)       : null,
        notes: assignNotes || null, active: true, plan_type: assignPlanType,
        supplements: assignSupplements.map(({ id: _id, ...s }) => s),
      })
      setAssigning(false)
      setShowAssignDialog(false)
      setSelectedPlanId(''); setAssignMeals([])
      setAssignTargets({ calories: '', protein: '', carbs: '', fat: '' })
      setAssignPlanType('default'); setAssignNotes(''); setAssignSupplements([])
    }

    if (conflicting) {
      setActivateConflict({
        existingName: conflicting.meal_plan.name,
        typeLabel: PLAN_TYPE_LABELS[assignPlanType]?.label ?? assignPlanType,
        execute: () => deactivateSameTypeAndRun(assignPlanType, null, doInsert),
      })
    } else {
      await doInsert()
      fetchData()
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    // Deactivating — always allowed
    if (current) {
      await supabase.from('client_meal_plans').update({ active: false }).eq('id', id)
      setAssignedPlans(prev => prev.map(p => p.id === id ? { ...p, active: false } : p))
      return
    }
    // Activating — check same-type conflict
    const thisPlan  = assignedPlans.find(p => p.id === id)
    const planType  = thisPlan?.plan_type ?? 'default'
    const conflicting = assignedPlans.find(p => p.active && p.id !== id && p.plan_type === planType)
    if (conflicting) {
      setActivateConflict({
        existingName: conflicting.meal_plan.name,
        typeLabel: PLAN_TYPE_LABELS[planType]?.label ?? planType,
        execute: () => deactivateSameTypeAndRun(planType, id, async () => {
          await supabase.from('client_meal_plans').update({ active: true }).eq('id', id)
        }),
      })
    } else {
      await supabase.from('client_meal_plans').update({ active: true }).eq('id', id)
      setAssignedPlans(prev => prev.map(p => p.id === id ? { ...p, active: true } : p))
    }
  }

  const changePlanType = async (id: string, newType: 'default' | 'training_day' | 'rest_day') => {
    await supabase.from('client_meal_plans').update({ plan_type: newType }).eq('id', id)
    setAssignedPlans(prev => prev.map(p => p.id === id ? { ...p, plan_type: newType } : p))
    setEditingPlanTypeId(null)
  }

  const removePlan = async (id: string) => {
    await supabase.from('client_meal_plans').delete().eq('id', id)
    setAssignedPlans(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const saveAsTemplate = async (assigned: AssignedPlan) => {
    setSavingTemplate(assigned.id)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setSavingTemplate(null); return }
    const effectiveMeals  = assigned.meals?.length ? assigned.meals : assigned.meal_plan.meals || []
    const effectiveName   = assigned.custom_name || assigned.meal_plan.name
    const templateName    = `${effectiveName} (predložak)`
    await supabase.from('meal_plans').insert({
      trainer_id: user.id,
      name: templateName,
      is_template: true,
      meals: effectiveMeals,
      calories_target: assigned.calories_target ?? assigned.meal_plan.calories_target,
      protein_target:  assigned.protein_target  ?? assigned.meal_plan.protein_target,
      carbs_target:    assigned.carbs_target     ?? assigned.meal_plan.carbs_target,
      fat_target:      assigned.fat_target       ?? assigned.meal_plan.fat_target,
    })
    setSavingTemplate(null)
    setSavedMsg(`Dodano u predloške kao „${templateName}"`)
    setTimeout(() => setSavedMsg(null), 3500)
  }

  const activePlans = assignedPlans.filter(p => p.active)
  const inactivePlans = assignedPlans.filter(p => !p.active)
  const hasTrainingDay = activePlans.some(p => p.plan_type === 'training_day')
  const hasRestDay = activePlans.some(p => p.plan_type === 'rest_day')
  const hasDefault = activePlans.some(p => p.plan_type === 'default')

  if (loading) return <p className="text-gray-500 text-sm">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">

      {savedMsg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${isDark ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 16 16"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {savedMsg}
        </div>
      )}

      {/* Info banneri */}
      {hasTrainingDay && hasRestDay && (
        <div className={`rounded-lg px-4 py-3 text-sm ${isDark ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          {t('infoBannerBoth')}
        </div>
      )}
      {hasDefault && !hasTrainingDay && !hasRestDay && (
        <div className={`rounded-lg px-4 py-3 text-sm ${isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
          {t.rich('infoBannerTip', { strong: (chunks) => <strong>{chunks}</strong> })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('assigned', { count: assignedPlans.length })}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreateNew(true)} className="flex items-center gap-2">
            <Plus size={14} /> {t('createNew')}
          </Button>
          <Button size="sm" onClick={() => setShowAssignDialog(true)} className="flex items-center gap-2">
            <Plus size={14} /> {t('assignExisting')}
          </Button>
        </div>
      </div>

      {/* Empty */}
      {assignedPlans.length === 0 && (
        <div
          className="rounded-xl py-12 text-center"
          style={isDark ? { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' } : { background: 'white', border: '1px solid #e5e7eb' }}
        >
          <UtensilsCrossed size={24} className={`mx-auto mb-3 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
          <p className={`text-sm mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('noPlans')}</p>
          <button onClick={() => setShowAssignDialog(true)} className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
            {t('assignExisting')} →
          </button>
        </div>
      )}

      {/* Active plans */}
      {activePlans.length > 0 && (
        <div className="space-y-2">
          <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('activePlans')}</p>
          {activePlans.map(assigned => {
            const meals = quickEditMealPlanId === assigned.id
              ? quickEditMeals
              : (assigned.meals?.length ? assigned.meals : assigned.meal_plan.meals || [])
            const isPersonalized = !!(assigned.meals?.length)
            const typeInfo = PLAN_TYPE_LABELS[assigned.plan_type || 'default']
            const calories = assigned.calories_target ?? assigned.meal_plan.calories_target
            const protein = assigned.protein_target ?? assigned.meal_plan.protein_target
            const carbs = assigned.carbs_target ?? assigned.meal_plan.carbs_target
            const fat = assigned.fat_target ?? assigned.meal_plan.fat_target
            const extrasTargets = assigned.extras_targets ?? (assigned.meal_plan as any).extras_targets ?? null

            return (
              <div
                key={assigned.id}
                className="rounded-xl overflow-hidden transition-shadow cursor-pointer"
                style={isDark ? {
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.09)',
                } : {
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)',
                }}
                onDoubleClick={() => setEditTarget(assigned)}
              >
                <div className="px-4 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-[5px] w-2 h-2 rounded-full shrink-0 bg-emerald-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{assigned.custom_name || assigned.meal_plan.name}</span>
                        {assigned.custom_name && (
                          <span className={`text-[10px] italic ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>({assigned.meal_plan.name})</span>
                        )}
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={isDark ? {
                            color: typeInfo.color,
                            background: `${typeInfo.color}18`,
                            border: `1px solid ${typeInfo.color}40`,
                          } : {
                            color: typeInfo.color,
                            backgroundColor: typeInfo.bg,
                          }}
                        >
                          {typeInfo.label}
                        </span>
                        {isPersonalized && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isDark ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                            {t('personalizedBadge')}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('mealsCount', { count: meals.length })} · {new Date(assigned.assigned_at).toLocaleDateString(locale)}
                      </p>
                      {assigned.notes && <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{assigned.notes}</p>}
                      {assigned.supplements && assigned.supplements.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {assigned.supplements.map((s, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${isDark ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                              💊 {s.name} <span className="opacity-60">· {s.amount}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {editingPlanTypeId === assigned.id ? (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {(Object.entries(PLAN_TYPE_LABELS) as [string, any][]).map(([key, val]) => (
                          <button key={key} onClick={() => changePlanType(assigned.id, key as any)}
                            className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${
                              assigned.plan_type === key
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : isDark ? 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}>
                            {val.label}
                          </button>
                        ))}
                        <button onClick={() => setEditingPlanTypeId(null)} className={`text-xs px-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>✕</button>
                      </div>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm"
                          onClick={e => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}
                          className={`text-xs h-7 px-3 rounded-full border ${isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}>
                          {t('activeStatusBtn')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditingPlanTypeId(assigned.id) }}>
                          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('typeLabel')}</span>
                        </Button>
                        <Button variant="ghost" size="sm" title={t('saveAsTemplateTooltip')}
                          onClick={e => { e.stopPropagation(); saveAsTemplate(assigned) }}
                          disabled={savingTemplate === assigned.id}>
                          <BookMarked size={14} className="text-violet-400" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditTarget(assigned) }}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          title="Brzi unos"
                          onClick={e => { e.stopPropagation(); quickEditMealPlanId === assigned.id ? cancelQuickMealEdit() : enterQuickMealEdit(assigned) }}
                          className={quickEditMealPlanId === assigned.id ? 'text-blue-400' : ''}
                        >
                          <Zap size={14} className={quickEditMealPlanId === assigned.id ? 'text-blue-400' : 'text-gray-400'} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setConfirmDelete(assigned.id) }}>
                          <Trash2 size={14} className="text-red-400" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Nutritional summary — ostvareno vs. cilj */}
                {meals.length > 0 && (
                  <NutritionalSummary
                    meals={meals}
                    caloriesTarget={calories}
                    proteinTarget={protein}
                    carbsTarget={carbs}
                    fatTarget={fat}
                    activeExtraFields={activeExtraFields}
                    extrasTargets={extrasTargets}
                    isDark={isDark}
                  />
                )}

                {/* Meals list — collapsible ingredients */}
                {meals.length > 0 && (
                  <MealAccordion
                    meals={meals}
                    activeExtraFields={activeExtraFields}
                    recipes={availableRecipes}
                    isDark={isDark}
                    isEditing={quickEditMealPlanId === assigned.id}
                    onUpdateIngGrams={(mealIdx, food_id, newGrams) => updateIngGrams(mealIdx, food_id, newGrams)}
                    onRemoveIng={(mealIdx, food_id) => removeIng(mealIdx, food_id)}
                    onAddIng={(mealIdx, food) => addIng(mealIdx, food)}
                    onUpdateMacros={(mealIdx, field, val) => updateMacros(mealIdx, field, val)}
                    foods={foods}
                  />
                )}

                {/* Quick edit save/cancel bar */}
                {quickEditMealPlanId === assigned.id && (
                  <div
                    className="px-4 py-2.5 flex items-center gap-2"
                    style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f0f0f0' }}
                  >
                    <Zap size={11} className="text-blue-400 shrink-0" />
                    <span className={`text-xs flex-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Brzi unos aktiviran</span>
                    <Button
                      variant="ghost" size="sm"
                      onClick={cancelQuickMealEdit}
                      className={`text-xs h-7 px-3 ${isDark ? 'text-gray-500 hover:text-gray-300' : ''}`}
                    >
                      Odustani
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveQuickMealEdit}
                      disabled={quickEditSaving}
                      className="text-xs h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white gap-1"
                    >
                      {quickEditSaving ? '...' : <><Check size={12} />Spremi</>}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Inactive plans */}
      {inactivePlans.length > 0 && (
        <div className="space-y-2">
          <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('inactivePlans')}</p>
          {inactivePlans.map(assigned => {
            const typeInfo = PLAN_TYPE_LABELS[assigned.plan_type || 'default']
            return (
              <div
                key={assigned.id}
                className="rounded-xl opacity-55 hover:opacity-75 transition-opacity cursor-pointer"
                style={isDark ? {
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                } : {
                  background: 'white',
                  border: '1px solid #e5e7eb',
                }}
                onDoubleClick={() => setEditTarget(assigned)}
              >
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isDark ? 'bg-white/20' : 'bg-gray-300'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>{assigned.custom_name || assigned.meal_plan.name}</p>
                        {assigned.custom_name && <span className={`text-[10px] italic ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>({assigned.meal_plan.name})</span>}
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={isDark ? {
                            color: typeInfo.color,
                            background: `${typeInfo.color}18`,
                            border: `1px solid ${typeInfo.color}40`,
                          } : {
                            color: typeInfo.color,
                            backgroundColor: typeInfo.bg,
                          }}
                        >{typeInfo.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm"
                      onClick={e => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}
                      className={`text-xs h-7 px-3 rounded-full border ${isDark ? 'text-gray-500 bg-white/5 border-white/15 hover:bg-white/10' : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                      {t('inactiveStatusBtn')}
                    </Button>
                    <Button variant="ghost" size="sm" title={t('saveAsTemplateTooltip')}
                      onClick={e => { e.stopPropagation(); saveAsTemplate(assigned) }}
                      disabled={savingTemplate === assigned.id}>
                      <BookMarked size={14} className="text-violet-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditTarget(assigned) }}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setConfirmDelete(assigned.id) }}>
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ASSIGN DIALOG ── */}
      <Dialog
        open={showAssignDialog}
        onOpenChange={v => {
          setShowAssignDialog(v)
          if (!v) { setSelectedPlanId(''); setAssignMeals([]); setAssignNotes(''); setAssignSupplements([]); setAssignPlanType('default'); setAssignTargets({ calories: '', protein: '', carbs: '', fat: '' }) }
        }}
      >
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0" showCloseButton={false}>
          <DialogTitle className="sr-only">{t('assignDialogTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('assignDialogTitle')}</DialogDescription>

          {/* Gradient header */}
          <div className="bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 shrink-0 flex items-center gap-3 rounded-t-lg">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base">{t('assignDialogTitle')}</h2>
              <p className="text-purple-100/70 text-xs">{t('assignDialogSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAssignDialog(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="space-y-5 pt-4">
            {/* Plan select */}
            <div className="space-y-1.5">
              <Label>{t('planLabel')}</Label>
              <Select value={selectedPlanId} onValueChange={handleSelectPlan}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectPlanPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {availablePlans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.calories_target ? ` · ${p.calories_target} kcal` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plan type */}
            {selectedPlanId && (
              <div className="space-y-1.5">
                <Label>{t('planTypeLabel')}</Label>
                <div className="flex gap-2">
                  {(Object.entries(PLAN_TYPE_LABELS) as [string, any][]).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAssignPlanType(key as any)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                        assignPlanType === key
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Nutritivni ciljevi */}
            {selectedPlanId && (
              <div className="space-y-1.5">
                <Label>{t('nutritionGoalsLabel')} <span className="text-gray-400 font-normal text-xs">{t('nutritionGoalsNote')}</span></Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'calories', label: t('kcalLabel')         },
                    { key: 'protein',  label: t('proteinInputLabel') },
                    { key: 'carbs',    label: t('carbsInputLabel')   },
                    { key: 'fat',      label: t('fatInputLabel')     },
                  ].map(f => (
                    <div key={f.key}>
                      <p className="text-xs text-gray-400 mb-0.5">{f.label}</p>
                      <Input
                        type="number"
                        value={assignTargets[f.key as keyof typeof assignTargets]}
                        onChange={e => setAssignTargets(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable meals with DnD */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('mealsHeaderLabel')} {assignMeals.length > 0 && `(${assignMeals.length})`}
                </p>
                <Button variant="outline" size="sm" onClick={addAssignMeal} className="flex items-center gap-1 h-7 text-xs">
                  <Plus size={12} /> {t('addMealBtn')}
                </Button>
              </div>

              {assignMeals.length === 0 && selectedPlanId && (
                <button
                  type="button"
                  onClick={addAssignMeal}
                  className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
                >
                  {t('addFirstMealBtn')}
                </button>
              )}

              <DndContext sensors={assignSensors} collisionDetection={closestCenter} onDragEnd={handleMealDragEnd}>
                <SortableContext items={assignMeals.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {assignMeals.map(meal => (
                      <SortableMealCard
                        key={meal.id}
                        meal={meal}
                        recipes={availableRecipes}
                        onUpdate={(field, val) => updateAssignMealField(meal.id, field, val)}
                        onRemove={() => removeAssignMeal(meal.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Ukupno */}
              {assignTotals.calories > 0 && (
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 grid grid-cols-4 gap-2">
                  {[
                    { label: t('kcalSummaryLabel'),    val: Math.round(assignTotals.calories), color: 'text-orange-600' },
                    { label: t('proteinSummaryLabel'), val: Math.round(assignTotals.protein),  color: 'text-rose-600',    unit: 'g' },
                    { label: t('carbsSummaryLabel'),   val: Math.round(assignTotals.carbs),    color: 'text-amber-600',   unit: 'g' },
                    { label: t('fatSummaryLabel'),     val: Math.round(assignTotals.fat),      color: 'text-emerald-600', unit: 'g' },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
                      <p className={`text-sm font-bold ${item.color}`}>{item.val}{item.unit || ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suplementacija */}
            <SupplementsSection
              supplements={assignSupplements}
              onChange={setAssignSupplements}
            />

            {/* Napomena */}
            <div className="space-y-1.5">
              <Label>{t('noteLabel')} <span className="text-gray-400 font-normal text-xs">({tCommon('optional')})</span></Label>
              <Input value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder={t('assignNotePlaceholder')} />
            </div>

          </div>
          </div>

          {/* Sticky footer */}
          <div className="px-6 py-4 border-t bg-white shrink-0">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)} className="flex-1">{tCommon('cancel')}</Button>
              <Button onClick={assignPlan} disabled={!selectedPlanId || assigning} className="flex-1 bg-purple-600 hover:bg-purple-700">
                {assigning ? t('assigning') : t('assign')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create new */}
      <AddMealPlanDialog
        open={showCreateNew}
        onClose={() => setShowCreateNew(false)}
        isTemplate={false}
        onSuccess={async () => {
          const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
          if (!user) return
          const { data: latestPlan } = await supabase
            .from('meal_plans').select('id, meals, calories_target, protein_target, carbs_target, fat_target')
            .eq('trainer_id', user.id)
            .order('created_at', { ascending: false }).limit(1).single()
          if (!latestPlan) { setShowCreateNew(false); return }

          const conflicting = assignedPlans.find(p => p.active && p.plan_type === 'default')
          const doInsert = async () => {
            await supabase.from('client_meal_plans').insert({
              trainer_id: user.id, client_id: clientId,
              meal_plan_id: latestPlan.id, meals: latestPlan.meals || [],
              calories_target: latestPlan.calories_target,
              protein_target:  latestPlan.protein_target,
              carbs_target:    latestPlan.carbs_target,
              fat_target:      latestPlan.fat_target,
              active: true, plan_type: 'default',
            })
            setShowCreateNew(false)
          }

          if (conflicting) {
            setActivateConflict({
              existingName: conflicting.meal_plan.name,
              typeLabel: PLAN_TYPE_LABELS['default']?.label ?? t('planTypeDefault'),
              execute: () => deactivateSameTypeAndRun('default', null, doInsert),
            })
          } else {
            await doInsert()
            fetchData()
          }
        }}
      />

      {/* Edit client copy */}
      {editTarget && (
        <EditMealPlanDialog
          open={!!editTarget}
          plan={{
            ...editTarget.meal_plan,
            meals: editTarget.meals?.length ? editTarget.meals : editTarget.meal_plan.meals,
            calories_target: editTarget.calories_target ?? editTarget.meal_plan.calories_target,
            protein_target: editTarget.protein_target ?? editTarget.meal_plan.protein_target,
            carbs_target: editTarget.carbs_target ?? editTarget.meal_plan.carbs_target,
            fat_target: editTarget.fat_target ?? editTarget.meal_plan.fat_target,
            extras_targets: editTarget.extras_targets ?? editTarget.meal_plan.extras_targets,
            notes: editTarget.notes,
            supplements: editTarget.supplements,
          }}
          clientAssignId={editTarget.id}
          initialCustomName={editTarget.custom_name || ''}
          initialSupplements={editTarget.supplements || []}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); fetchData() }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={tCommon('remove')}
        description={t('removeConfirm')}
        onConfirm={() => confirmDelete && removePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('remove')}
        destructive
      />

      {/* Conflict: same plan-type already active */}
      <ConfirmDialog
        open={activateConflict !== null}
        title={t('replacePlanTitle')}
        description={t('replacePlanConfirm', { name: activateConflict?.existingName || '', type: activateConflict?.typeLabel || '' })}
        onConfirm={async () => {
          if (activateConflict) await activateConflict.execute()
          setActivateConflict(null)
        }}
        onCancel={() => setActivateConflict(null)}
        confirmLabel={t('replaceConfirmBtn')}
        cancelLabel={tCommon('cancel')}
      />
    </div>
  )
}
