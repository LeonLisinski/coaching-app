'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { X, BookOpen } from 'lucide-react'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'

type Food = {
  id: string; name: string
  calories_per_100g: number; protein_per_100g: number
  carbs_per_100g: number; fat_per_100g: number
  extras?: Record<string, number | null>
}

type Ingredient = {
  food_id: string; name: string; grams: number
  calories: number; protein: number; carbs: number; fat: number
  extras?: Record<string, number>
}

type Recipe = {
  id: string; name: string; description: string
  ingredients: Ingredient[]; total_calories: number
  total_protein: number; total_carbs: number; total_fat: number
}

type Props = { recipe: Recipe; open: boolean; onClose: () => void; onSuccess: () => void }

export default function EditRecipeDialog({ recipe, open, onClose, onSuccess }: Props) {
  const t = useTranslations('nutrition.dialogs.recipe')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()

  const [name, setName] = useState(recipe.name)
  const [description, setDescription] = useState(recipe.description || '')
  const [foods, setFoods] = useState<Food[]>([])
  const [foodsLoaded, setFoodsLoaded] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe.ingredients || [])
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [dropdownIndex, setDropdownIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const activeNutritionFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  useEffect(() => {
    if (open) {
      setName(recipe.name)
      setDescription(recipe.description || '')
      setIngredients(recipe.ingredients || [])
      setSearch('')
      fetchFoods()
    }
  }, [open, recipe.id])

  const fetchFoods = async () => {
    setFoodsLoaded(false)
    const { data } = await supabase.from('foods').select('*').order('name')
    setFoodsLoaded(true)
    if (data) setFoods(data)
  }

  const addIngredient = (food: Food) => {
    if (ingredients.find(i => i.food_id === food.id)) return
    const extras: Record<string, number> = {}
    if (food.extras) {
      Object.entries(food.extras).forEach(([k, v]) => { if (v != null) extras[k] = v })
    }
    setIngredients(prev => [...prev, {
      food_id: food.id, name: food.name, grams: 100,
      calories: food.calories_per_100g, protein: food.protein_per_100g,
      carbs: food.carbs_per_100g, fat: food.fat_per_100g, extras,
    }])
    setSearch('')
    setDropdownIndex(-1)
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  const filteredFoods = foods.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    !ingredients.find(i => i.food_id === f.id)
  )
  const showDropdown = searchFocused || search.length > 0

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIndex(i => Math.min(i + 1, filteredFoods.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIndex(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && dropdownIndex >= 0) { e.preventDefault(); addIngredient(filteredFoods[dropdownIndex]) }
    else if (e.key === 'Escape') { setSearchFocused(false); setDropdownIndex(-1) }
  }

  const updateGrams = (food_id: string, grams: number) => {
    setIngredients(ingredients.map(i => {
      if (i.food_id !== food_id) return i
      const food = foods.find(f => f.id === food_id)!
      const ratio = grams / 100
      const extras: Record<string, number> = {}
      if (food.extras) {
        Object.entries(food.extras).forEach(([k, v]) => { if (v != null) extras[k] = v * ratio })
      }
      return {
        ...i, grams,
        calories: food.calories_per_100g * ratio,
        protein: food.protein_per_100g * ratio,
        carbs: food.carbs_per_100g * ratio,
        fat: food.fat_per_100g * ratio,
        extras,
      }
    }))
  }

  const removeIngredient = (food_id: string) => setIngredients(ingredients.filter(i => i.food_id !== food_id))

  const totals = ingredients.reduce((acc, i) => ({
    calories: acc.calories + i.calories, protein: acc.protein + i.protein,
    carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const extraTotals = activeNutritionFields.reduce((acc, f) => {
    acc[f.key] = ingredients.reduce((sum, i) => sum + ((i.extras?.[f.key] as number) || 0), 0)
    return acc
  }, {} as Record<string, number>)

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const { error } = await supabase.from('recipes').update({
      name, description: description || null, ingredients,
      total_calories: totals.calories, total_protein: totals.protein,
      total_carbs: totals.carbs, total_fat: totals.fat,
    }).eq('id', recipe.id)

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false}>
        <DialogTitle className="sr-only">Uredi recept</DialogTitle>

        {/* Rose header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-400 px-6 py-4 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <BookOpen size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">Uredi recept</h2>
            <p className="text-rose-100/70 text-xs">Uredi sastojke i podatke recepta</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('addIngredients')}</Label>
            <div className="relative">
              <Input
                ref={searchRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownIndex(-1) }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => { setSearchFocused(false); setDropdownIndex(-1) }, 150)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('searchIngredients')}
                className="focus:border-rose-300"
              />
              {showDropdown && (
                <div className="border border-rose-100 rounded-xl bg-white shadow-md overflow-hidden mt-1">
                  {!foodsLoaded ? (
                    <p className="px-4 py-3 text-xs text-gray-400 text-center">Učitavanje namirnica...</p>
                  ) : (
                    <div className="overflow-y-auto max-h-44">
                      {filteredFoods.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400 text-center">
                          {search ? `Nema rezultata za "${search}"` : 'Sve namirnice su već dodane'}
                        </p>
                      ) : filteredFoods.map((f, i) => (
                        <button key={f.id} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => addIngredient(f)}
                          onMouseEnter={() => setDropdownIndex(i)}
                          className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm border-b border-gray-50 last:border-0 transition-colors ${
                            dropdownIndex === i ? 'bg-rose-50 text-rose-700' : 'hover:bg-gray-50'
                          }`}>
                          <span className="font-medium">{f.name}</span>
                          <span className="text-gray-400 text-xs">{f.calories_per_100g} kcal/100g</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {ingredients.length > 0 && (
            <div className="space-y-2">
              <Label>{t('ingredients')} ({ingredients.length})</Label>
              {ingredients.map(ing => (
                <div key={ing.food_id} className="flex items-center gap-3 border rounded-md p-2">
                  <span className="text-sm flex-1">{ing.name}</span>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={ing.grams}
                      onChange={e => updateGrams(ing.food_id, parseFloat(e.target.value) || 0)}
                      className="w-20 h-7 text-sm" />
                    <span className="text-xs text-gray-500">g</span>
                  </div>
                  <div className="text-xs text-gray-400 w-32 text-right">{Math.round(ing.calories)} kcal</div>
                  <button type="button" onClick={() => removeIngredient(ing.food_id)}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}

              <div className="bg-gray-50 rounded-md p-3 space-y-1">
                <div className="flex gap-4 text-sm">
                  <span className="font-medium">{t('total')}:</span>
                  <span>🔥 {Math.round(totals.calories)} kcal</span>
                  <span>🥩 {Math.round(totals.protein)}g</span>
                  <span>🍞 {Math.round(totals.carbs)}g</span>
                  <span>🫒 {Math.round(totals.fat)}g</span>
                </div>
                {activeNutritionFields.length > 0 && (
                  <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                    {activeNutritionFields.map(f => (
                      <span key={f.key}>{f.label}: {Math.round(extraTotals[f.key] * 10) / 10}{f.unit}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t bg-white shrink-0 flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
          <Button type="submit" disabled={loading || ingredients.length === 0} className="flex-1 bg-rose-500 hover:bg-rose-600">
            {loading ? tCommon('saving') : tCommon('saveChanges')}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

