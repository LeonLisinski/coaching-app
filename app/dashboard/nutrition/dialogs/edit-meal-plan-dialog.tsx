'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import MealSlotEditor from '../components/meal-slot-editor'
import { decimalKeyDown } from '@/lib/utils'
import { Plus, X, CalendarDays } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Custom sensor: skip drag activation when pointer starts on an interactive element
function isInteractiveElement(el: HTMLElement | null) {
  while (el) {
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName)) return true
    el = el.parentElement
  }
  return false
}
class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: React.PointerEvent) =>
        !isInteractiveElement(nativeEvent.target as HTMLElement),
    },
  ]
}

type Recipe   = { id: string; name: string; total_calories: number; total_protein: number; total_carbs: number; total_fat: number; ingredients?: any[] }
type Food     = { id: string; name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; extras?: Record<string, number> }
type MealSlot = { _id: string; meal_type: string; recipe_id: string | null; recipe_name: string; calories: number; protein: number; carbs: number; fat: number; custom_ingredients?: any[]; save_as_recipe?: boolean }
type PlanType = 'default' | 'training_day' | 'rest_day'
type MealPlan = { id: string; name: string; plan_type?: PlanType; calories_target: number | null; protein_target: number | null; carbs_target: number | null; fat_target: number | null; meals: MealSlot[] }
type Props    = { plan: MealPlan; open: boolean; onClose: () => void; onSuccess: () => void; clientAssignId?: string }

function SortableMealSlot({ meal, index, recipes, foods, nutritionFields, onChange, onRemove, onCopy, isNew }: {
  meal: MealSlot; index: number; recipes: any[]; foods: any[]; nutritionFields: string[];
  onChange: (i: number, f: string, v: any) => void; onRemove: (i: number) => void; onCopy: (i: number) => void;
  isNew?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: meal._id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl ${isNew ? 'item-added' : ''}`}>
      <MealSlotEditor
        meal={meal} index={index} recipes={recipes} foods={foods}
        nutritionFields={nutritionFields} onChange={onChange} onRemove={onRemove}
        onCopy={onCopy} isDragging={isDragging}
        dragHandleProps={{ ...listeners, ...attributes } as any}
      />
    </div>
  )
}

export default function EditMealPlanDialog({ plan, open, onClose, onSuccess, clientAssignId }: Props) {
  const t       = useTranslations('nutrition.dialogs.mealPlan')
  const tCommon = useTranslations('common')
  const isClientEdit = !!clientAssignId
  const { settings } = useTrainerSettings()

  const PLAN_TYPE_OPTIONS: { value: PlanType; label: string; desc: string; color: string }[] = [
    { value: 'default',      label: t('planTypeDefault'),      desc: t('planTypeDefaultDesc'),      color: 'border-gray-300 bg-gray-50 text-gray-700' },
    { value: 'training_day', label: t('planTypeTrainingDay'),  desc: t('planTypeTrainingDayDesc'),  color: 'border-blue-300 bg-blue-50 text-blue-700' },
    { value: 'rest_day',     label: t('planTypeRestDay'),      desc: t('planTypeRestDayDesc'),      color: 'border-purple-300 bg-purple-50 text-purple-700' },
  ]

  const [name, setName]       = useState(plan.name)
  const [planType, setPlanType] = useState<PlanType>((plan.plan_type as PlanType) || 'default')
  const [targets, setTargets] = useState({
    calories: plan.calories_target?.toString() || '',
    protein:  plan.protein_target?.toString()  || '',
    carbs:    plan.carbs_target?.toString()    || '',
    fat:      plan.fat_target?.toString()      || '',
  })
  const [meals, setMeals]     = useState<MealSlot[]>(plan.meals || [])
  const [extrasTargets, setExtrasTargets] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries((plan as any).extras_targets || {}).map(([k, v]) => [k, v != null ? String(v) : '']))
  )
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [foods, setFoods]     = useState<Food[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const mealsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setName(plan.name)
      setPlanType((plan.plan_type as PlanType) || 'default')
      setTargets({
        calories: plan.calories_target?.toString() || '',
        protein:  plan.protein_target?.toString()  || '',
        carbs:    plan.carbs_target?.toString()    || '',
        fat:      plan.fat_target?.toString()      || '',
      })
      setMeals((plan.meals || []).map((m: any) => ({
        _id: m._id || crypto.randomUUID(),
        meal_type: m.meal_type ?? 'Doručak', recipe_id: m.recipe_id ?? null,
        recipe_name: m.recipe_name ?? '', calories: m.calories ?? 0, protein: m.protein ?? 0,
        carbs: m.carbs ?? 0, fat: m.fat ?? 0, custom_ingredients: m.custom_ingredients, extras: m.extras,
      })))
      setExtrasTargets(Object.fromEntries(Object.entries((plan as any).extras_targets || {}).map(([k, v]) => [k, v != null ? String(v) : ''])))
      fetchRecipes(); fetchFoods()
    }
  }, [open])

  const fetchRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('recipes').select('id, name, total_calories, total_protein, total_carbs, total_fat, ingredients').eq('trainer_id', user.id).order('name')
    if (data) setRecipes(data)
  }

  const fetchFoods = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: allFoods }, { data: overrides }] = await Promise.all([
      supabase.from('foods').select('*').order('name'),
      supabase.from('trainer_overrides').select('default_id').eq('trainer_id', user.id).eq('resource_type', 'food'),
    ])
    const overriddenIds = new Set((overrides || []).map(o => o.default_id))
    const visible = (allFoods || []).filter(f =>
      (!f.is_default && f.trainer_id === user.id) ||
      (f.is_default && !overriddenIds.has(f.id))
    )
    setFoods(visible)
  }

  const sensors = useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [flashMealId, setFlashMealId] = useState<string | null>(null)

  const addMeal = () => {
    const newId = crypto.randomUUID()
    setMeals(prev => [...prev, { _id: newId, meal_type: 'Doručak', recipe_id: null, recipe_name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }])
    setTimeout(() => mealsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    setFlashMealId(newId)
    setTimeout(() => setFlashMealId(null), 1400)
  }

  const copyMeal = (index: number) => {
    setMeals(prev => {
      const meal = prev[index]
      const copy = { ...meal, _id: crypto.randomUUID(), meal_type: `${meal.meal_type} (kopija)` }
      const next = [...prev]
      next.splice(index + 1, 0, copy)
      return next
    })
  }

  const reorderMeals = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setMeals(prev => {
      const oldIdx = prev.findIndex(m => m._id === active.id)
      const newIdx = prev.findIndex(m => m._id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const updateMeal = (index: number, field: string, value: any) => {
    setMeals(prev => prev.map((m, i) => {
      if (i !== index) return m
      if (field === '_custom') return { ...m, ...value }
      if (field === 'recipe_id') {
        const recipe = recipes.find(r => r.id === value)
        return { ...m, recipe_id: value || null, recipe_name: recipe?.name || '', calories: recipe?.total_calories || 0, protein: recipe?.total_protein || 0, carbs: recipe?.total_carbs || 0, fat: recipe?.total_fat || 0, custom_ingredients: undefined }
      }
      return { ...m, [field]: value }
    }))
  }

  const removeMeal = (index: number) => setMeals(prev => prev.filter((_, i) => i !== index))

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0), protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),          fat: acc.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const activeExtraFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))
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

  const tgt = {
    calories: targets.calories ? parseInt(targets.calories) : null,
    protein:  targets.protein  ? parseInt(targets.protein)  : null,
    carbs:    targets.carbs    ? parseInt(targets.carbs)    : null,
    fat:      targets.fat      ? parseInt(targets.fat)      : null,
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const processedMeals = await Promise.all(meals.map(async (meal) => {
      if (meal.save_as_recipe && meal.custom_ingredients?.length && meal.recipe_name) {
        const { data } = await supabase.from('recipes').insert({
          trainer_id: user.id, name: meal.recipe_name, ingredients: meal.custom_ingredients,
          total_calories: meal.calories, total_protein: meal.protein, total_carbs: meal.carbs, total_fat: meal.fat,
        }).select('id').single()
        return { ...meal, recipe_id: data?.id || null }
      }
      return meal
    }))

    const extrasTgt: Record<string, number | null> = {}
    activeExtraFields.forEach(f => {
      extrasTgt[f.key] = extrasTargets[f.key] ? parseFloat(extrasTargets[f.key]) : null
    })

    if (isClientEdit) {
      const { error } = await supabase.from('client_meal_plans').update({
        meals: processedMeals, calories_target: tgt.calories, protein_target: tgt.protein, carbs_target: tgt.carbs, fat_target: tgt.fat,
        extras_targets: extrasTgt,
      }).eq('id', clientAssignId)
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.from('meal_plans').update({
        name, plan_type: planType, calories_target: tgt.calories, protein_target: tgt.protein, carbs_target: tgt.carbs, fat_target: tgt.fat,
        extras_targets: extrasTgt, meals: processedMeals,
      }).eq('id', plan.id)
      if (error) { setError(error.message); setLoading(false); return }
    }

    setLoading(false); onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">Uredi plan prehrane</DialogTitle>
        <DialogDescription className="sr-only">Uredi plan prehrane</DialogDescription>

        {/* Purple header */}
        <div className="bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-4 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <CalendarDays size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base truncate">
              {isClientEdit ? `Uredi plan klijenta — ${plan.name}` : 'Uredi plan prehrane'}
            </h2>
            <p className="text-purple-100/70 text-xs">
              {isClientEdit ? 'Promjene vrijede samo za ovog klijenta' : 'Uredi obroke i ciljeve plana'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Single scroll: form fields scroll away, Obroci bar sticks, meals scroll */}
        <div className="flex-1 overflow-y-auto">
          <form id="edit-meal-plan-form" onSubmit={handleSubmit}>
            {/* Scrollable: form fields */}
            <div className="px-6 pt-4 pb-4 space-y-3">
              {!isClientEdit && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t('name')}</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Tip plana</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {PLAN_TYPE_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setPlanType(opt.value)}
                          className={`rounded-lg border-2 px-3 py-2 text-left transition-all ${
                            planType === opt.value
                              ? opt.color + ' border-opacity-100 ring-1 ring-offset-1 ' + (opt.value === 'default' ? 'ring-gray-400' : opt.value === 'training_day' ? 'ring-blue-400' : 'ring-purple-400')
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}>
                          <p className="font-semibold text-xs">{opt.label}</p>
                          <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'calories', label: 'Kcal',        placeholder: '2000' },
                  { key: 'protein',  label: 'Proteini (g)', placeholder: '150'  },
                  { key: 'carbs',    label: 'Ugljik. (g)',  placeholder: '200'  },
                  { key: 'fat',      label: 'Masti (g)',    placeholder: '70'   },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input type="number" value={targets[f.key as keyof typeof targets]} onKeyDown={decimalKeyDown}
                      onChange={e => setTargets(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-7 text-sm" placeholder={f.placeholder} />
                  </div>
                ))}
                {activeExtraFields.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label} ({f.unit})</Label>
                    <Input type="number" value={extrasTargets[f.key] ?? ''} onKeyDown={decimalKeyDown}
                      onChange={e => setExtrasTargets(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-7 text-sm" placeholder="—" />
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky: Obroci header — sticks when form fields scroll out of view */}
            <div className="sticky top-0 z-10 bg-white border-y border-gray-100 px-6 py-2 flex items-center justify-between">
              <Label>{t('meals', { count: meals.length })}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMeal} className="gap-1">
                <Plus size={12} /> {t('addMeal')}
              </Button>
            </div>

            {/* Meals list */}
            <div className="px-6 py-3 space-y-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderMeals}>
                <SortableContext items={meals.map(m => m._id)} strategy={verticalListSortingStrategy}>
                  {meals.map((meal, index) => (
                    <SortableMealSlot
                      key={meal._id} meal={meal} index={index}
                      recipes={recipes} foods={foods}
                      nutritionFields={settings.nutritionFields}
                      onChange={updateMeal} onRemove={removeMeal} onCopy={copyMeal}
                      isNew={flashMealId === meal._id}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div ref={mealsEndRef} />
            </div>
          </form>
        </div>

        {/* Sticky footer — summary + buttons */}
        <div className="px-6 py-4 border-t bg-white shrink-0 space-y-3">
          {meals.length > 0 && (
            <div className="rounded-md bg-gray-50 px-4 py-2.5 grid grid-cols-4 gap-2 text-center text-xs">
              {([
                { label: 'Kcal',      val: Math.round(totals.calories), tgt: tgt.calories, unit: '' },
                { label: 'Proteini',  val: Math.round(totals.protein),  tgt: tgt.protein,  unit: 'g' },
                { label: 'Ugljik.',   val: Math.round(totals.carbs),    tgt: tgt.carbs,    unit: 'g' },
                { label: 'Masti',     val: Math.round(totals.fat),      tgt: tgt.fat,      unit: 'g' },
              ] as const).map(item => (
                <div key={item.label}>
                  <p className="text-gray-400 font-medium">{item.label}</p>
                  <p className="font-semibold text-gray-800">{item.val}{item.unit}</p>
                  {item.tgt != null && (
                    <p className={`text-[10px] ${item.val > item.tgt ? 'text-red-500' : 'text-green-600'}`}>
                      / {item.tgt}{item.unit}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {visibleExtras.length > 0 && meals.length > 0 && (
            <div className="flex gap-3 flex-wrap px-1">
              {visibleExtras.map(f => {
                const tgtVal = extrasTargets[f.key] ? parseFloat(extrasTargets[f.key]) : null
                const actual = Math.round(extraTotals[f.key] * 10) / 10
                const over = tgtVal != null && actual > tgtVal
                return (
                  <span key={f.key} className="text-xs text-gray-400">
                    {f.label}: <span className={`font-medium ${over ? 'text-red-500' : 'text-gray-700'}`}>{actual}{f.unit}</span>
                    {tgtVal != null && <span className={`text-[10px] ${over ? 'text-red-400' : 'text-green-600'}`}> / {tgtVal}{f.unit}</span>}
                  </span>
                )
              })}
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" form="edit-meal-plan-form" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {loading ? tCommon('saving') : tCommon('saveChanges')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


