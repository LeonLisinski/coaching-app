'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTrainerSettings } from '@/hooks/use-trainer-settings'
import MealSlotEditor from '../components/meal-slot-editor'
import { decimalKeyDown } from '@/lib/utils'
import { Plus } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void; isTemplate?: boolean }

type Recipe   = { id: string; name: string; total_calories: number; total_protein: number; total_carbs: number; total_fat: number; ingredients?: any[] }
type Food     = { id: string; name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; extras?: Record<string, number> }
type MealSlot = { _id: string; meal_type: string; recipe_id: string | null; recipe_name: string; calories: number; protein: number; carbs: number; fat: number; custom_ingredients?: any[]; save_as_recipe?: boolean }
type PlanType = 'default' | 'training_day' | 'rest_day'

function SortableMealSlot({ meal, index, recipes, foods, nutritionFields, onChange, onRemove, onCopy }: {
  meal: MealSlot; index: number; recipes: any[]; foods: any[]; nutritionFields: string[];
  onChange: (i: number, f: string, v: any) => void; onRemove: (i: number) => void; onCopy: (i: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: meal._id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <MealSlotEditor
        meal={meal} index={index} recipes={recipes} foods={foods}
        nutritionFields={nutritionFields} onChange={onChange} onRemove={onRemove}
        onCopy={onCopy} isDragging={isDragging}
        dragHandleProps={{ ...listeners, ...attributes } as any}
      />
    </div>
  )
}

export default function AddMealPlanDialog({ open, onClose, onSuccess, isTemplate = true }: Props) {
  const t       = useTranslations('nutrition.dialogs.mealPlan')
  const tRecipe = useTranslations('nutrition.dialogs.recipe')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()

  const PLAN_TYPE_OPTIONS: { value: PlanType; label: string; desc: string; color: string }[] = [
    { value: 'default',      label: t('planTypeDefault'),      desc: t('planTypeDefaultDesc'),      color: 'border-gray-300 bg-gray-50 text-gray-700' },
    { value: 'training_day', label: t('planTypeTrainingDay'),  desc: t('planTypeTrainingDayDesc'),  color: 'border-blue-300 bg-blue-50 text-blue-700' },
    { value: 'rest_day',     label: t('planTypeRestDay'),      desc: t('planTypeRestDayDesc'),      color: 'border-purple-300 bg-purple-50 text-purple-700' },
  ]

  const [name, setName]       = useState('')
  const [planType, setPlanType] = useState<PlanType>('default')
  const [targets, setTargets] = useState({ calories: '', protein: '', carbs: '', fat: '' })
  const [meals, setMeals]     = useState<MealSlot[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [foods, setFoods]     = useState<Food[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const mealsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) { fetchRecipes(); fetchFoods() }
  }, [open])

  const fetchRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('recipes')
      .select('id, name, total_calories, total_protein, total_carbs, total_fat, ingredients')
      .eq('trainer_id', user.id).order('name')
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const addMeal = () => {
    setMeals(prev => [...prev, { _id: crypto.randomUUID(), meal_type: 'Doručak', recipe_id: null, recipe_name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }])
    setTimeout(() => mealsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
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

    const { error } = await supabase.from('meal_plans').insert({
      trainer_id: user.id, name, plan_type: planType,
      calories_target: tgt.calories, protein_target: tgt.protein, carbs_target: tgt.carbs, fat_target: tgt.fat,
      meals: processedMeals,
      is_template: isTemplate,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess(); onClose()
    setName(''); setPlanType('default'); setTargets({ calories: '', protein: '', carbs: '', fat: '' }); setMeals([])
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{t('addTitle')}</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
          <form id="add-meal-plan-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} required />
            </div>

            <div className="space-y-2">
              <Label>Tip plana</Label>
              <div className="grid grid-cols-3 gap-2">
                {PLAN_TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setPlanType(opt.value)}
                    className={`rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
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

            <div className="grid grid-cols-4 gap-3">
              {[
                { key: 'calories', label: 'Kcal',         placeholder: '2000' },
                { key: 'protein',  label: 'Proteini (g)',  placeholder: '150'  },
                { key: 'carbs',    label: 'Ugljik. (g)',   placeholder: '200'  },
                { key: 'fat',      label: 'Masti (g)',     placeholder: '70'   },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input type="number" value={targets[f.key as keyof typeof targets]} onKeyDown={decimalKeyDown}
                    onChange={e => setTargets(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="h-8 text-sm" placeholder={f.placeholder} />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('meals', { count: meals.length })}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMeal} className="gap-1">
                  <Plus size={12} /> {t('addMeal')}
                </Button>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderMeals}>
                <SortableContext items={meals.map(m => m._id)} strategy={verticalListSortingStrategy}>
                  {meals.map((meal, index) => (
                    <SortableMealSlot
                      key={meal._id} meal={meal} index={index}
                      recipes={recipes} foods={foods}
                      nutritionFields={settings.nutritionFields}
                      onChange={updateMeal} onRemove={removeMeal} onCopy={copyMeal}
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" form="add-meal-plan-form" disabled={loading} className="flex-1">
              {loading ? tCommon('saving') : t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
