'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, BookOpen, Plus } from 'lucide-react'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import AddFoodDialog from './add-food-dialog'
import { useAppTheme } from '@/app/contexts/app-theme'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

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

export default function AddRecipeDialog({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('nutrition.dialogs.recipe')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [foodsLoaded, setFoodsLoaded] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [dropdownIndex, setDropdownIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createFoodOpen, setCreateFoodOpen] = useState(false)
  const [createFoodName, setCreateFoodName] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const ingredientsEndRef = useRef<HTMLDivElement>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasAlreadyFocusedRef = useRef(false)

  const activeNutritionFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  useEffect(() => {
    if (open) { fetchFoods(); setName(''); setDescription(''); setIngredients([]) }
  }, [open])

  const fetchFoods = async () => {
    setFoodsLoaded(false)
    const { data } = await supabase.from('foods').select('id,name,category,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,is_default,trainer_id,extras').order('name')
    setFoodsLoaded(true)
    if (data) setFoods(data)
  }

  const [flashIngId, setFlashIngId] = useState<string | null>(null)

  const addIngredient = (food: Food) => {
    if (ingredients.find(i => i.food_id === food.id)) return
    const extras: Record<string, number> = {}
    if (food.extras) {
      Object.entries(food.extras).forEach(([k, v]) => { if (v != null) extras[k] = v })
    }
    setIngredients(prev => [...prev, {
      food_id: food.id, name: food.name, grams: 100,
      calories: food.calories_per_100g, protein: food.protein_per_100g,
      carbs: food.carbs_per_100g, fat: food.fat_per_100g,
      extras,
    }])
    setSearch('')
    setDropdownIndex(-1)
    setSearchFocused(false)
    setTimeout(() => searchRef.current?.focus(), 0)
    setFlashIngId(food.id)
    setTimeout(() => setFlashIngId(null), 1400)
    setTimeout(() => ingredientsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
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
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { error } = await supabase.from('recipes').insert({
      trainer_id: user.id, name, description: description || null, ingredients,
      total_calories: totals.calories, total_protein: totals.protein,
      total_carbs: totals.carbs, total_fat: totals.fat,
      total_extras: extraTotals,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess(); onClose()
    setName(''); setDescription(''); setIngredients([])
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className={`max-w-2xl flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh] ${isDark ? 'bg-[oklch(0.195_0.018_264)]' : 'bg-white'}`} showCloseButton={false}>
        <DialogTitle className="sr-only">{t('addTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('addTitle')}</DialogDescription>

        {/* Rose header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-400 px-6 py-4 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <BookOpen size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">{t('addTitle')}</h2>
            <p className="text-rose-100/70 text-xs">{t('addSubtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

          {/* Fixed: name + description */}
          <div className={`px-6 pt-4 pb-3 border-b shrink-0 ${isDark ? 'bg-[oklch(0.195_0.018_264)] border-white/8' : 'bg-white'}`}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('name')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('description')}</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
              </div>
            </div>
          </div>

          {/* Fixed: search */}
          <div className={`px-6 py-3 border-b shrink-0 space-y-1.5 ${isDark ? 'bg-[oklch(0.195_0.018_264)] border-white/8' : 'bg-white'}`}>
            <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('addIngredients')}</Label>
            <div className="relative">
              <Input
                ref={searchRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownIndex(-1) }}
                onMouseDown={() => { wasAlreadyFocusedRef.current = document.activeElement === searchRef.current }}
                onFocus={() => {
                  if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
                  setSearchFocused(true)
                }}
                onBlur={() => { blurTimerRef.current = setTimeout(() => { setSearchFocused(false); setDropdownIndex(-1) }, 150) }}
                onClick={() => {
                  if (wasAlreadyFocusedRef.current && showDropdown) {
                    setSearchFocused(false); setSearch(''); setDropdownIndex(-1)
                    searchRef.current?.blur()
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('searchIngredients')}
                className="focus:border-orange-300"
              />
              {showDropdown && (
                <div className={`absolute top-full left-0 right-0 z-50 mt-1 border rounded-xl shadow-lg overflow-hidden ${isDark ? 'bg-[oklch(0.22_0.018_264)] border-white/10' : 'bg-white border-orange-100'}`}>
                  {!foodsLoaded ? (
                    <p className="px-4 py-3 text-xs text-gray-400 text-center">{t('loadingFoods')}</p>
                  ) : (
                    <>
                      <div className="overflow-y-auto max-h-44">
                        {filteredFoods.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-gray-400 text-center">
                            {search ? t('noResults', { search }) : t('allAdded')}
                          </p>
                        ) : filteredFoods.map((f, i) => (
                          <button key={f.id} type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => addIngredient(f)}
                            onMouseEnter={() => setDropdownIndex(i)}
                            className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm border-b last:border-0 transition-colors ${
                              dropdownIndex === i
                                ? 'bg-orange-500 text-white'
                                : isDark ? 'border-white/8 hover:bg-white/[0.06] text-gray-200' : 'border-gray-50 hover:bg-orange-50'
                            }`}>
                            <span className="font-medium">{f.name}</span>
                            <span className={dropdownIndex === i ? 'text-orange-100 text-xs' : 'text-gray-400 text-xs'}>{f.calories_per_100g} kcal/100g</span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setCreateFoodName(search); setCreateFoodOpen(true); setSearchFocused(false) }}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-xs text-orange-600 font-medium border-t transition-colors ${isDark ? 'border-white/8 hover:bg-white/[0.06]' : 'border-orange-50 hover:bg-orange-50'}`}
                      >
                        <Plus size={12} /> {search ? t('createFood', { search }) : t('createNewFood')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable: ingredients */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {ingredients.length > 0 && (
            <div className="space-y-2">
              <Label>{t('ingredients')} ({ingredients.length})</Label>
              {ingredients.map(ing => (
                <div key={ing.food_id} className={`flex items-center gap-3 border rounded-lg p-2 ${flashIngId === ing.food_id ? 'item-added' : ''} ${isDark ? 'bg-white/[0.04] border-white/10' : 'border-orange-100 bg-orange-50/30'}`}>
                  <span className={`text-sm flex-1 font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{ing.name}</span>
                  <div className="flex items-center gap-2">
                  <Input type="text" inputMode="numeric" value={ing.grams || ''}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const v = parseFloat(e.target.value.replace(',', '.'))
                      if (!isNaN(v) && v >= 0) updateGrams(ing.food_id, v)
                      else if (e.target.value === '') updateGrams(ing.food_id, 0)
                    }}
                    className="w-20 h-7 text-sm border-orange-200 focus:border-orange-400" />
                    <span className="text-xs text-gray-500">g</span>
                  </div>
                  <div className="text-xs text-orange-600 font-medium w-24 text-right">{Math.round(ing.calories)} kcal</div>
                  <button type="button" onClick={() => removeIngredient(ing.food_id)}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}

              <div className={`rounded-lg p-3 space-y-1 ${isDark ? 'bg-white/[0.04] border border-white/10' : 'bg-orange-50 border border-orange-100'}`}>
                <div className="flex gap-4 text-sm">
                  <span className="font-semibold text-orange-700">{t('total')}:</span>
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
          <div ref={ingredientsEndRef} />
          </div>

        <div className={`px-6 py-4 border-t shrink-0 flex gap-3 ${isDark ? 'bg-[oklch(0.195_0.018_264)] border-white/8' : 'bg-white'}`}>
          <Button type="button" variant="outline" onClick={onClose} className={`flex-1 ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/[0.06]' : ''}`}>{tCommon('cancel')}</Button>
          <Button type="submit" disabled={loading || ingredients.length === 0} className="flex-1 bg-rose-500 hover:bg-rose-600">
            {loading ? tCommon('saving') : t('save')}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>

    <AddFoodDialog
      open={createFoodOpen}
      initialName={createFoodName}
      onClose={() => setCreateFoodOpen(false)}
      onSuccess={() => { setCreateFoodOpen(false); fetchFoods() }}
    />
    </>
  )
}


