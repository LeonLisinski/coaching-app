'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

type Recipe = {
  id: string
  name: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
}

type Ingredient = {
  food_id: string
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
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
  custom_ingredients?: Ingredient[]
  save_as_recipe?: boolean
}

type Props = {
  meal: MealSlot
  index: number
  recipes: Recipe[]
  foods: Food[]
  onChange: (index: number, field: string, value: any) => void
  onRemove: (index: number) => void
}

const MEAL_TYPES = ['Doručak', 'Ručak', 'Večera', 'Snack 1', 'Snack 2']

export default function MealSlotEditor({ meal, index, recipes, foods, onChange, onRemove }: Props) {
  const t = useTranslations('nutrition.dialogs.mealPlan')
  const tRecipe = useTranslations('nutrition.dialogs.recipe')

  const [mode, setMode] = useState<'existing' | 'custom'>(meal.custom_ingredients ? 'custom' : 'existing')
  const [customName, setCustomName] = useState(meal.recipe_name || '')
  const [saveAsRecipe, setSaveAsRecipe] = useState(meal.save_as_recipe || false)
  const [ingredients, setIngredients] = useState<Ingredient[]>(meal.custom_ingredients || [])
  const [search, setSearch] = useState('')

  const addIngredient = (food: Food) => {
    if (ingredients.find(i => i.food_id === food.id)) return
    const newIngredients = [...ingredients, {
      food_id: food.id,
      name: food.name,
      grams: 100,
      calories: food.calories_per_100g,
      protein: food.protein_per_100g,
      carbs: food.carbs_per_100g,
      fat: food.fat_per_100g,
    }]
    setIngredients(newIngredients)
    setSearch('')
    updateCustomTotals(newIngredients, customName, saveAsRecipe)
  }

  const updateGrams = (food_id: string, grams: number) => {
    const newIngredients = ingredients.map(i => {
      if (i.food_id !== food_id) return i
      const food = foods.find(f => f.id === food_id)!
      const ratio = grams / 100
      return {
        ...i,
        grams,
        calories: food.calories_per_100g * ratio,
        protein: food.protein_per_100g * ratio,
        carbs: food.carbs_per_100g * ratio,
        fat: food.fat_per_100g * ratio,
      }
    })
    setIngredients(newIngredients)
    updateCustomTotals(newIngredients, customName, saveAsRecipe)
  }

  const removeIngredient = (food_id: string) => {
    const newIngredients = ingredients.filter(i => i.food_id !== food_id)
    setIngredients(newIngredients)
    updateCustomTotals(newIngredients, customName, saveAsRecipe)
  }

  const updateCustomTotals = (ings: Ingredient[], name: string, save: boolean) => {
    const totals = ings.reduce((acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

    onChange(index, '_custom', {
      recipe_name: name,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      custom_ingredients: ings,
      save_as_recipe: save,
      recipe_id: null,
    })
  }

  const filteredFoods = foods.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    !ingredients.find(i => i.food_id === f.id)
  )

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <select
          value={meal.meal_type}
          onChange={(e) => onChange(index, 'meal_type', e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          {MEAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <button type="button" onClick={() => onRemove(index)}>
          <X size={14} className="text-gray-400 hover:text-red-500" />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('existing')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            mode === 'existing'
              ? 'bg-black text-white border-black font-semibold'
              : 'text-gray-500 border-gray-300 hover:border-gray-400'
          }`}
        >
          {t('useRecipe')}
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            mode === 'custom'
              ? 'bg-black text-white border-black font-semibold'
              : 'text-gray-500 border-gray-300 hover:border-gray-400'
          }`}
        >
          {t('customMeal')}
        </button>
      </div>

      {mode === 'existing' ? (
        <select
          value={meal.recipe_id || ''}
          onChange={(e) => onChange(index, 'recipe_id', e.target.value || null)}
          className="w-full border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Odaberi jelo...</option>
          {recipes.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({Math.round(r.total_calories)} kcal)</option>
          ))}
        </select>
      ) : (
        <div className="space-y-2">
          <Input
            value={customName}
            onChange={(e) => {
              setCustomName(e.target.value)
              updateCustomTotals(ingredients, e.target.value, saveAsRecipe)
            }}
            placeholder={`${t('mealName')}...`}
            className="h-8 text-sm"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tRecipe('addIngredients')}
            className="h-8 text-sm"
          />
          {search && filteredFoods.length > 0 && (
            <div className="border rounded-md max-h-32 overflow-y-auto">
              {filteredFoods.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => addIngredient(f)}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-xs flex justify-between"
                >
                  <span>{f.name}</span>
                  <span className="text-gray-400">{f.calories_per_100g} kcal/100g</span>
                </button>
              ))}
            </div>
          )}
          {ingredients.map(ing => (
            <div key={ing.food_id} className="flex items-center gap-2 text-xs">
              <span className="flex-1">{ing.name}</span>
              <Input
                type="number"
                value={ing.grams}
                onChange={(e) => updateGrams(ing.food_id, parseFloat(e.target.value) || 0)}
                className="w-16 h-6 text-xs"
              />
              <span className="text-gray-400">g</span>
              <span className="text-gray-400 w-16 text-right">{Math.round(ing.calories)} kcal</span>
              <button type="button" onClick={() => removeIngredient(ing.food_id)}>
                <X size={12} className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ))}
          {ingredients.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsRecipe}
                onChange={(e) => {
                  setSaveAsRecipe(e.target.checked)
                  updateCustomTotals(ingredients, customName, e.target.checked)
                }}
                className="rounded"
              />
              Spremi kao jelo u bazu
            </label>
          )}
        </div>
      )}

      {(meal.recipe_id || (meal.custom_ingredients && meal.custom_ingredients.length > 0)) && (
        <p className="text-xs text-gray-400">
          🔥 {Math.round(meal.calories)} kcal • 🥩 {Math.round(meal.protein)}g • 🍞 {Math.round(meal.carbs)}g • 🫒 {Math.round(meal.fat)}g
        </p>
      )}
    </div>
  )
}
