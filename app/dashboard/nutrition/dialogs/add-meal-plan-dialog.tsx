'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import MealSlotEditor from '../components/meal-slot-editor'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

type Recipe = {
  id: string; name: string
  total_calories: number; total_protein: number; total_carbs: number; total_fat: number
}

type Food = {
  id: string; name: string
  calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number
}

type MealSlot = {
  meal_type: string; recipe_id: string | null; recipe_name: string
  calories: number; protein: number; carbs: number; fat: number
  custom_ingredients?: any[]; save_as_recipe?: boolean
}

type PlanType = 'default' | 'training_day' | 'rest_day'

export default function AddMealPlanDialog({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('nutrition.dialogs.mealPlan')
  const tRecipe = useTranslations('nutrition.dialogs.recipe')
  const tCommon = useTranslations('common')

  const PLAN_TYPE_OPTIONS: { value: PlanType; label: string; desc: string; color: string }[] = [
    { value: 'default',      label: t('planTypeDefault'),      desc: t('planTypeDefaultDesc'),      color: 'border-gray-300 bg-gray-50 text-gray-700' },
    { value: 'training_day', label: t('planTypeTrainingDay'),  desc: t('planTypeTrainingDayDesc'),  color: 'border-blue-300 bg-blue-50 text-blue-700' },
    { value: 'rest_day',     label: t('planTypeRestDay'),      desc: t('planTypeRestDayDesc'),      color: 'border-purple-300 bg-purple-50 text-purple-700' },
  ]

  const [name, setName] = useState('')
  const [planType, setPlanType] = useState<PlanType>('default')
  const [targets, setTargets] = useState({ calories: '', protein: '', carbs: '', fat: '' })
  const [meals, setMeals] = useState<MealSlot[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { fetchRecipes(); fetchFoods() }
  }, [open])

  const fetchRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('recipes')
      .select('id, name, total_calories, total_protein, total_carbs, total_fat')
      .eq('trainer_id', user.id).order('name')
    if (data) setRecipes(data)
  }

  const fetchFoods = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('foods').select('*').eq('trainer_id', user.id).order('name')
    if (data) setFoods(data)
  }

  const addMeal = () => setMeals([...meals, { meal_type: 'Doručak', recipe_id: null, recipe_name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }])

  const updateMeal = (index: number, field: string, value: any) => {
    setMeals(meals.map((m, i) => {
      if (i !== index) return m
      if (field === '_custom') return { ...m, ...value }
      if (field === 'recipe_id') {
        const recipe = recipes.find(r => r.id === value)
        return { ...m, recipe_id: value || null, recipe_name: recipe?.name || '', calories: recipe?.total_calories || 0, protein: recipe?.total_protein || 0, carbs: recipe?.total_carbs || 0, fat: recipe?.total_fat || 0, custom_ingredients: undefined }
      }
      return { ...m, [field]: value }
    }))
  }

  const removeMeal = (index: number) => setMeals(meals.filter((_, i) => i !== index))

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0), protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0), fat: acc.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

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
      calories_target: targets.calories ? parseInt(targets.calories) : null,
      protein_target: targets.protein ? parseInt(targets.protein) : null,
      carbs_target: targets.carbs ? parseInt(targets.carbs) : null,
      fat_target: targets.fat ? parseInt(targets.fat) : null,
      meals: processedMeals,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess(); onClose()
    setName(''); setPlanType('default'); setTargets({ calories: '', protein: '', carbs: '', fat: '' }); setMeals([])
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} required />
          </div>

          {/* Plan type */}
          <div className="space-y-2">
            <Label>Tip plana</Label>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPlanType(opt.value)}
                  className={`rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                    planType === opt.value
                      ? opt.color + ' border-opacity-100 ring-1 ring-offset-1 ' + (opt.value === 'default' ? 'ring-gray-400' : opt.value === 'training_day' ? 'ring-blue-400' : 'ring-purple-400')
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-xs">{opt.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'calories', label: t('targetCalories'), placeholder: '2000' },
              { key: 'protein',  label: t('targetProtein'),  placeholder: '150' },
              { key: 'carbs',    label: t('targetCarbs'),    placeholder: '200' },
              { key: 'fat',      label: t('targetFat'),      placeholder: '70' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input type="number" value={targets[f.key as keyof typeof targets]}
                  onChange={(e) => setTargets({ ...targets, [f.key]: e.target.value })}
                  className="h-8 text-sm" placeholder={f.placeholder} />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('meals', { count: meals.length })}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMeal} className="flex items-center gap-1">
                <Plus size={12} />{t('addMeal')}
              </Button>
            </div>
            {meals.map((meal, index) => (
              <MealSlotEditor key={index} meal={meal} index={index} recipes={recipes} foods={foods} onChange={updateMeal} onRemove={removeMeal} />
            ))}
            {meals.length > 0 && (
              <div className="bg-gray-50 rounded-md p-3 flex gap-4 text-sm">
                <span className="font-medium">{tRecipe('total')}:</span>
                <span>🔥 {Math.round(totals.calories)} kcal</span>
                <span>🥩 {Math.round(totals.protein)}g</span>
                <span>🍞 {Math.round(totals.carbs)}g</span>
                <span>🫒 {Math.round(totals.fat)}g</span>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? tCommon('saving') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
