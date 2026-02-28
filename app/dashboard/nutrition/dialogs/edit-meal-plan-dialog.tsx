'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import MealSlotEditor from '../components/meal-slot-editor'

type Recipe = {
  id: string
  name: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
}

type Food = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

type MealSlot = {
  meal_type: string
  recipe_id: string | null
  recipe_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  custom_ingredients?: any[]
  save_as_recipe?: boolean
}

type MealPlan = {
  id: string
  name: string
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  meals: MealSlot[]
}

type Props = {
  plan: MealPlan
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditMealPlanDialog({ plan, open, onClose, onSuccess }: Props) {
  const [name, setName] = useState(plan.name)
  const [targets, setTargets] = useState({
    calories: plan.calories_target?.toString() || '',
    protein: plan.protein_target?.toString() || '',
    carbs: plan.carbs_target?.toString() || '',
    fat: plan.fat_target?.toString() || '',
  })
  const [meals, setMeals] = useState<MealSlot[]>(plan.meals || [])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      fetchRecipes()
      fetchFoods()
    }
  }, [open])

  const fetchRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('recipes').select('id, name, total_calories, total_protein, total_carbs, total_fat').eq('trainer_id', user.id).order('name')
    if (data) setRecipes(data)
  }

  const fetchFoods = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('foods').select('*').eq('trainer_id', user.id).order('name')
    if (data) setFoods(data)
  }

  const addMeal = () => {
    setMeals([...meals, { meal_type: 'Doručak', recipe_id: null, recipe_name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }])
  }

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

  const removeMeal = (index: number) => {
    setMeals(meals.filter((_, i) => i !== index))
  }

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),
    fat: acc.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const processedMeals = await Promise.all(meals.map(async (meal) => {
      if (meal.save_as_recipe && meal.custom_ingredients && meal.custom_ingredients.length > 0 && meal.recipe_name) {
        const { data } = await supabase.from('recipes').insert({
          trainer_id: user.id,
          name: meal.recipe_name,
          ingredients: meal.custom_ingredients,
          total_calories: meal.calories,
          total_protein: meal.protein,
          total_carbs: meal.carbs,
          total_fat: meal.fat,
        }).select('id').single()
        return { ...meal, recipe_id: data?.id || null }
      }
      return meal
    }))

    const { error } = await supabase.from('meal_plans').update({
      name,
      calories_target: targets.calories ? parseInt(targets.calories) : null,
      protein_target: targets.protein ? parseInt(targets.protein) : null,
      carbs_target: targets.carbs ? parseInt(targets.carbs) : null,
      fat_target: targets.fat ? parseInt(targets.fat) : null,
      meals: processedMeals,
    }).eq('id', plan.id)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uredi plan prehrane</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Naziv plana</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cilj kcal</Label>
              <Input type="number" value={targets.calories} onChange={(e) => setTargets({ ...targets, calories: e.target.value })} className="h-8 text-sm" placeholder="2000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proteini (g)</Label>
              <Input type="number" value={targets.protein} onChange={(e) => setTargets({ ...targets, protein: e.target.value })} className="h-8 text-sm" placeholder="150" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ugljikohidrati (g)</Label>
              <Input type="number" value={targets.carbs} onChange={(e) => setTargets({ ...targets, carbs: e.target.value })} className="h-8 text-sm" placeholder="200" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Masti (g)</Label>
              <Input type="number" value={targets.fat} onChange={(e) => setTargets({ ...targets, fat: e.target.value })} className="h-8 text-sm" placeholder="70" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Obroci ({meals.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMeal} className="flex items-center gap-1">
                <Plus size={12} />
                Dodaj obrok
              </Button>
            </div>
            {meals.map((meal, index) => (
              <MealSlotEditor
                key={index}
                meal={meal}
                index={index}
                recipes={recipes}
                foods={foods}
                onChange={updateMeal}
                onRemove={removeMeal}
              />
            ))}
            {meals.length > 0 && (
              <div className="bg-gray-50 rounded-md p-3 flex gap-4 text-sm">
                <span className="font-medium">Ukupno:</span>
                <span>🔥 {Math.round(totals.calories)} kcal</span>
                <span>🥩 {Math.round(totals.protein)}g</span>
                <span>🍞 {Math.round(totals.carbs)}g</span>
                <span>🫒 {Math.round(totals.fat)}g</span>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Spremanje...' : 'Spremi promjene'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}