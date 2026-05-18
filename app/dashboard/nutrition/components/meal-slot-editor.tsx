'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { X, ChevronDown, ChevronUp, GripVertical, Copy, Plus } from 'lucide-react'
import { NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import AddFoodDialog from '../dialogs/add-food-dialog'

/** Input za grame koji drži lokalni string state, pa comma→točka radi ispravno */
function GramInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [display, setDisplay] = useState(value > 0 ? String(value) : '')
  const prevExternal = useRef(value)

  useEffect(() => {
    if (value !== prevExternal.current) {
      prevExternal.current = value
      setDisplay(value > 0 ? String(value) : '')
    }
  }, [value])

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={e => e.target.select()}
      onChange={e => {
        const raw = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
        setDisplay(raw)
        const num = parseFloat(raw)
        if (!isNaN(num) && num >= 0) { prevExternal.current = num; onChange(num) }
        else if (raw === '' || raw === '.') { prevExternal.current = 0; onChange(0) }
      }}
      className={className}
    />
  )
}

type Recipe = {
  id: string
  name: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  ingredients?: Ingredient[]
}

type Ingredient = {
  food_id: string
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  extras?: Record<string, number>
}

type Food = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  extras?: Record<string, number>
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
  extras?: Record<string, number>
}

type Props = {
  meal: MealSlot
  index: number
  recipes: Recipe[]
  foods: Food[]
  nutritionFields?: string[]
  onChange: (index: number, field: string, value: any) => void
  onRemove: (index: number) => void
  onCopy?: (index: number) => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isDragging?: boolean
  onFoodsRefresh?: () => void
}

const MEAL_TYPES = ['Doručak', 'Ručak', 'Večera', 'Snack 1', 'Snack 2', 'Užina', 'Prije treninga', 'Nakon treninga']

function calcTotals(ings: Ingredient[]) {
  return ings.reduce((acc, i) => ({
    calories: acc.calories + (i.calories || 0),
    protein:  acc.protein  + (i.protein  || 0),
    carbs:    acc.carbs    + (i.carbs    || 0),
    fat:      acc.fat      + (i.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
}

export default function MealSlotEditor({ meal, index, recipes, foods, nutritionFields = [], onChange, onRemove, onCopy, dragHandleProps, isDragging, onFoodsRefresh }: Props) {
  const t = useTranslations('nutrition.dialogs.mealPlan')
  const tRecipe = useTranslations('nutrition.dialogs.recipe')
  const tCommon = useTranslations('common')

  const [mode, setMode] = useState<'existing' | 'custom'>(
    meal.custom_ingredients?.length ? 'custom' : 'existing'
  )
  const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([])
  const [showIngredients, setShowIngredients] = useState(false)

  const [customName, setCustomName] = useState(meal.recipe_name || '')
  const [saveAsRecipe, setSaveAsRecipe] = useState(meal.save_as_recipe || false)
  const [ingredients, setIngredients] = useState<Ingredient[]>(meal.custom_ingredients || [])
  const [search, setSearch] = useState('')

  const [confirmRemove, setConfirmRemove] = useState(false)
  const [expanded, setExpanded]           = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)
  const [dropdownIndex, setDropdownIndex] = useState(-1)
  const [flashIngId, setFlashIngId]       = useState<string | null>(null)
  const [createFoodOpen, setCreateFoodOpen] = useState(false)
  const [createFoodName, setCreateFoodName] = useState('')

  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const recipeSearchRef = useRef<HTMLInputElement>(null)
  const wasAlreadyFocusedRef = useRef(false)

  const scrollInputToCenter = (ref: React.RefObject<HTMLInputElement | null>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  useEffect(() => {
    const isCustomMode = !meal.recipe_id && !!meal.custom_ingredients?.length
    setMode(isCustomMode ? 'custom' : 'existing')
    setCustomName(meal.recipe_name || '')
    setSaveAsRecipe(meal.save_as_recipe || false)
    setIngredients(isCustomMode ? (meal.custom_ingredients || []) : [])
    setSearch('')

    if (meal.recipe_id) {
      if (meal.custom_ingredients?.length) {
        setRecipeIngredients(meal.custom_ingredients.map((i: any) => ({ ...i })))
      } else {
        const recipe = recipes.find(r => r.id === meal.recipe_id)
        if (recipe?.ingredients?.length) {
          setRecipeIngredients(recipe.ingredients.map(i => ({ ...i })))
        } else {
          setRecipeIngredients([])
        }
      }
      return
    }
    setRecipeIngredients([])
    setShowIngredients(false)
  }, [index])

  useEffect(() => {
    if (mode !== 'existing' || !meal.recipe_id || recipeIngredients.length > 0) return
    if (meal.custom_ingredients?.length) {
      setRecipeIngredients(meal.custom_ingredients.map((i: any) => ({ ...i })))
      return
    }
    const recipe = recipes.find(r => r.id === meal.recipe_id)
    if (recipe?.ingredients?.length) {
      setRecipeIngredients(recipe.ingredients.map(i => ({ ...i })))
    }
  }, [recipes])

  const calcExtras = (ings: Ingredient[]) => {
    const extras: Record<string, number> = {}
    nutritionFields.forEach(key => {
      extras[key] = ings.reduce((sum, i) => sum + ((i.extras?.[key] as number) || 0), 0)
    })
    return extras
  }

  const handleSelectRecipe = (recipeId: string) => {
    if (!recipeId || recipeId === 'none') {
      onChange(index, 'recipe_id', null)
      setRecipeIngredients([])
      setShowIngredients(false)
      return
    }
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return

    const ings: Ingredient[] = (recipe.ingredients || []).map(i => ({ ...i }))
    setRecipeIngredients(ings)
    setShowIngredients(true)

    const totals = calcTotals(ings)
    onChange(index, '_custom', {
      recipe_id: recipeId,
      recipe_name: recipe.name,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      custom_ingredients: ings,
      extras: calcExtras(ings),
    })
  }

  const updateRecipeIngredientGrams = (food_id: string, grams: number) => {
    const food = foods.find(f => f.id === food_id)
    const newIngs = recipeIngredients.map(i => {
      if (i.food_id !== food_id) return i
      const ratio = grams / 100
      if (food) {
        const extras: Record<string, number> = {}
        if (food.extras) {
          Object.entries(food.extras).forEach(([k, v]) => {
            extras[k] = (v as number) * ratio
          })
        }
        return {
          ...i, grams,
          calories: food.calories_per_100g * ratio,
          protein:  food.protein_per_100g  * ratio,
          carbs:    food.carbs_per_100g    * ratio,
          fat:      food.fat_per_100g      * ratio,
          extras,
        }
      }
      const origGrams = recipeIngredients.find(x => x.food_id === food_id)?.grams || 100
      const r = grams / origGrams
      return { ...i, grams, calories: i.calories * r, protein: i.protein * r, carbs: i.carbs * r, fat: i.fat * r }
    })
    setRecipeIngredients(newIngs)
    const totals = calcTotals(newIngs)
    onChange(index, '_custom', {
      recipe_id: meal.recipe_id,
      recipe_name: meal.recipe_name,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      custom_ingredients: newIngs,
      extras: calcExtras(newIngs),
    })
  }

  const addIngredient = (food: Food) => {
    if (ingredients.find(i => i.food_id === food.id)) return
    const extras: Record<string, number> = {}
    if (food.extras) {
      Object.entries(food.extras).forEach(([k, v]) => { if (v != null) extras[k] = v as number })
    }
    const newIngs = [...ingredients, {
      food_id: food.id, name: food.name, grams: 100,
      calories: food.calories_per_100g, protein: food.protein_per_100g,
      carbs: food.carbs_per_100g, fat: food.fat_per_100g,
      extras,
    }]
    setIngredients(newIngs)
    setShowIngredients(true)
    setSearch('')
    setDropdownIndex(-1)
    setSearchFocused(false)
    updateCustomTotals(newIngs, customName, saveAsRecipe)
    setTimeout(() => searchRef.current?.focus(), 0)
    setFlashIngId(food.id)
    setTimeout(() => setFlashIngId(null), 1400)
  }

  const addRecipeIngredient = (food: Food) => {
    if (recipeIngredients.find(i => i.food_id === food.id)) return
    const extras: Record<string, number> = {}
    if (food.extras) {
      Object.entries(food.extras).forEach(([k, v]) => { if (v != null) extras[k] = v as number })
    }
    const newIng: Ingredient = {
      food_id: food.id, name: food.name, grams: 100,
      calories: food.calories_per_100g, protein: food.protein_per_100g,
      carbs: food.carbs_per_100g, fat: food.fat_per_100g,
      extras,
    }
    const newIngs = [...recipeIngredients, newIng]
    setRecipeIngredients(newIngs)
    setSearch('')
    setDropdownIndex(-1)
    setSearchFocused(false)
    setFlashIngId(food.id)
    setTimeout(() => setFlashIngId(null), 1400)
    const totals = calcTotals(newIngs)
    onChange(index, '_custom', {
      recipe_id: meal.recipe_id,
      recipe_name: meal.recipe_name,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      custom_ingredients: newIngs,
      extras: calcExtras(newIngs),
    })
  }

  const showDropdown = searchFocused || !!search

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    const visible = (mode === 'existing' ? filteredRecipeFoods : filteredFoods).slice(0, 20)
    if (!showDropdown || visible.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIndex(i => Math.min(i + 1, visible.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIndex(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && dropdownIndex >= 0) {
      e.preventDefault()
      if (mode === 'existing') addRecipeIngredient(visible[dropdownIndex])
      else { addIngredient(visible[dropdownIndex]); setSearchFocused(false) }
    }
    else if (e.key === 'Escape') { setSearchFocused(false); setDropdownIndex(-1) }
  }

  const updateCustomGrams = (food_id: string, grams: number) => {
    const food = foods.find(f => f.id === food_id)
    const newIngs = ingredients.map(i => {
      if (i.food_id !== food_id) return i
      if (!food) {
        const origGrams = i.grams || 100
        const r = origGrams > 0 ? grams / origGrams : 1
        return { ...i, grams, calories: i.calories * r, protein: i.protein * r, carbs: i.carbs * r, fat: i.fat * r }
      }
      const ratio = grams / 100
      const extras: Record<string, number> = {}
      if (food.extras) {
        Object.entries(food.extras).forEach(([k, v]) => { if (v != null) extras[k] = (v as number) * ratio })
      }
      return {
        ...i, grams,
        calories: food.calories_per_100g * ratio,
        protein:  food.protein_per_100g  * ratio,
        carbs:    food.carbs_per_100g    * ratio,
        fat:      food.fat_per_100g      * ratio,
        extras,
      }
    })
    setIngredients(newIngs)
    updateCustomTotals(newIngs, customName, saveAsRecipe)
  }

  const removeIngredient = (food_id: string) => {
    const newIngs = ingredients.filter(i => i.food_id !== food_id)
    setIngredients(newIngs)
    updateCustomTotals(newIngs, customName, saveAsRecipe)
  }

  const removeRecipeIngredient = (food_id: string) => {
    const newIngs = recipeIngredients.filter(i => i.food_id !== food_id)
    setRecipeIngredients(newIngs)
    const totals = calcTotals(newIngs)
    onChange(index, '_custom', {
      recipe_id: meal.recipe_id,
      recipe_name: meal.recipe_name,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      custom_ingredients: newIngs,
      extras: calcExtras(newIngs),
    })
  }

  const updateCustomTotals = (ings: Ingredient[], name: string, save: boolean) => {
    const totals = calcTotals(ings)
    onChange(index, '_custom', {
      recipe_name: name, recipe_id: null,
      calories: totals.calories, protein: totals.protein,
      carbs: totals.carbs, fat: totals.fat,
      custom_ingredients: ings, save_as_recipe: save,
      extras: calcExtras(ings),
    })
  }

  const filteredFoods = foods.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    !ingredients.find(i => i.food_id === f.id)
  )

  const filteredRecipeFoods = foods.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    !recipeIngredients.find(i => i.food_id === f.id)
  )

  const extraNutritionFields = NUTRITION_FIELD_OPTIONS.filter((f: any) => nutritionFields.includes(f.key))
  const activeIngredients = mode === 'existing' ? recipeIngredients : ingredients

  const currentSearchRef = mode === 'existing' ? recipeSearchRef : searchRef

  const searchInputProps = {
    value: search,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setDropdownIndex(-1) },
    onMouseDown: () => { wasAlreadyFocusedRef.current = document.activeElement === currentSearchRef.current },
    onFocus: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current)
      setSearchFocused(true)
      scrollInputToCenter(currentSearchRef)
    },
    onBlur: () => { blurTimer.current = setTimeout(() => { setSearchFocused(false); setDropdownIndex(-1) }, 150) },
    onClick: () => {
      if (wasAlreadyFocusedRef.current && showDropdown) {
        setSearchFocused(false); setSearch(''); setDropdownIndex(-1)
        currentSearchRef.current?.blur()
      }
    },
    onKeyDown: handleSearchKeyDown,
    className: 'h-7 text-xs border-orange-200 focus:border-orange-400 pl-7',
  }

  const DropdownContent = ({ onAdd }: { onAdd: (f: Food) => void }) => {
    const items = (mode === 'existing' ? filteredRecipeFoods : filteredFoods).slice(0, 20)
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-0.5 border border-orange-100 rounded-xl bg-white shadow-lg overflow-hidden">
        <div className="overflow-y-auto max-h-44" onWheel={e => e.stopPropagation()}>
          {items.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-gray-400 text-center">
              {search ? t('noIngredientResults', { search }) : t('allIngredientsAdded')}
            </p>
          ) : items.map((f, i) => (
            <button key={f.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => onAdd(f)}
              onMouseEnter={() => setDropdownIndex(i)}
              className={`w-full text-left px-3 py-2 text-xs flex justify-between border-b border-gray-50 last:border-0 transition-colors ${
                dropdownIndex === i ? 'bg-orange-500 text-white' : 'hover:bg-orange-50'
              }`}>
              <span className="font-medium">{f.name}</span>
              <span className={dropdownIndex === i ? 'text-orange-100' : 'text-gray-400'}>{f.calories_per_100g} kcal/100g</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setCreateFoodName(search); setCreateFoodOpen(true); setSearchFocused(false) }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-600 font-medium border-t border-orange-50 hover:bg-orange-50 transition-colors"
        >
          <Plus size={11} /> Kreiraj namirnicu{search ? ` "${search}"` : ''}
        </button>
      </div>
    )
  }

  return (
    <div className={`border border-rose-200 rounded-xl transition-opacity ${isDragging ? 'opacity-40' : ''}`}>
      {/* Collapsible header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 border-b border-rose-100 rounded-t-xl">
        {dragHandleProps && (
          <button type="button" {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-rose-300 hover:text-rose-500 shrink-0 touch-none"
            tabIndex={-1}>
            <GripVertical size={14} />
          </button>
        )}
        <button type="button" onClick={() => setExpanded(v => !v)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left overflow-hidden">
          {expanded
            ? <ChevronUp   size={14} className="text-rose-400 shrink-0" />
            : <ChevronDown size={14} className="text-rose-400 shrink-0" />}
          {expanded ? (
            <span className="text-sm font-semibold text-rose-800 truncate">{meal.meal_type || t('mealFallback')}</span>
          ) : (
            <span className="text-xs text-gray-500 truncate min-w-0">
              {(meal.calories > 0 || meal.protein > 0)
                ? `🔥 ${Math.round(meal.calories)} kcal · P: ${Math.round(meal.protein)}g · U: ${Math.round(meal.carbs)}g · M: ${Math.round(meal.fat)}g`
                : <span className="text-gray-400">{t('emptyMeal')}</span>}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Select value={meal.meal_type} onValueChange={v => onChange(index, 'meal_type', v)}>
            <SelectTrigger className="h-7 w-36 text-xs border-0 bg-transparent hover:bg-rose-100 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onCopy && (
            <button type="button" title={t('copyMealTooltip')} onClick={() => onCopy(index)} className="p-1">
              <Copy size={13} className="text-rose-300 hover:text-rose-600" />
            </button>
          )}
          <button type="button" onClick={() => setConfirmRemove(true)} className="p-1">
            <X size={13} className="text-rose-300 hover:text-red-500" />
          </button>
        </div>
      </div>

      {expanded && (
      <div className="p-3 space-y-3 bg-white">

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('existing')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            mode === 'existing' ? 'bg-rose-500 text-white border-rose-500 font-semibold' : 'text-gray-500 border-gray-300 hover:border-rose-300 hover:text-rose-600'
          }`}>
          {t('useRecipe')}
        </button>
        <button type="button" onClick={() => setMode('custom')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            mode === 'custom' ? 'bg-rose-500 text-white border-rose-500 font-semibold' : 'text-gray-500 border-gray-300 hover:border-rose-300 hover:text-rose-600'
          }`}>
          {t('customMeal')}
        </button>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-2">
          <Select
            value={meal.recipe_id || 'none'}
            onValueChange={handleSelectRecipe}
          >
            <SelectTrigger className="text-sm border-rose-200 focus:border-rose-400">
              <SelectValue placeholder={t('selectDishPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('selectDishPlaceholder')}</SelectItem>
              {recipes.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({Math.round(r.total_calories)} kcal)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Editable sastojci recepta */}
          {recipeIngredients.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowIngredients(!showIngredients)}
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700"
              >
                {showIngredients ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {t('editIngredientsLabel', { count: recipeIngredients.length })}
                <span className="text-gray-300 ml-1">· {t('doesNotAffectOriginal')}</span>
              </button>
              {showIngredients && (
                <div className="space-y-1 pt-1 pl-1 border-l-2 border-orange-100">
                  {recipeIngredients.map(ing => (
                    <div key={ing.food_id} className={`flex items-center gap-2 text-xs rounded px-1 ${flashIngId === ing.food_id ? 'item-added' : ''}`}>
                      <span className="flex-1 text-gray-700">{ing.name}</span>
                      <GramInput value={ing.grams} onChange={v => updateRecipeIngredientGrams(ing.food_id, v)} className="w-16 h-6 text-xs border-orange-200 focus:border-orange-400" />
                      <span className="text-gray-400">g</span>
                      <span className="text-orange-500 font-medium w-14 text-right">{Math.round(ing.calories)} kcal</span>
                      <button type="button" onClick={() => removeRecipeIngredient(ing.food_id)}>
                        <X size={11} className="text-gray-300 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                  {/* Add ingredient to recipe copy */}
                  <div className="relative pt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-300 pointer-events-none mt-0.5">
                      <Plus size={11} />
                    </span>
                    <Input
                      ref={recipeSearchRef}
                      {...searchInputProps}
                      placeholder={t('addIngredientPlaceholder')}
                    />
                    {showDropdown && mode === 'existing' && <DropdownContent onAdd={addRecipeIngredient} />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={customName}
            onChange={e => { setCustomName(e.target.value); updateCustomTotals(ingredients, e.target.value, saveAsRecipe) }}
            placeholder={`${t('mealName')}...`}
            className="h-8 text-sm border-rose-200 focus:border-rose-400"
          />

          {ingredients.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowIngredients(!showIngredients)}
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700"
              >
                {showIngredients ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {t('editIngredientsLabel', { count: ingredients.length })}
              </button>
              {showIngredients && (
                <div className="space-y-1 pt-1 pl-1 border-l-2 border-orange-100">
                  {ingredients.map(ing => (
                    <div key={ing.food_id} className={`flex items-center gap-2 text-xs rounded px-1 ${flashIngId === ing.food_id ? 'item-added' : ''}`}>
                      <span className="flex-1 text-gray-700">{ing.name}</span>
                      <GramInput value={ing.grams} onChange={v => updateCustomGrams(ing.food_id, v)} className="w-16 h-6 text-xs border-orange-200 focus:border-orange-400" />
                      <span className="text-gray-400">g</span>
                      <span className="text-orange-500 font-medium w-16 text-right">{Math.round(ing.calories)} kcal</span>
                      <button type="button" onClick={() => removeIngredient(ing.food_id)}>
                        <X size={11} className="text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer pt-0.5">
                    <input type="checkbox" checked={saveAsRecipe}
                      onChange={e => { setSaveAsRecipe(e.target.checked); updateCustomTotals(ingredients, customName, e.target.checked) }}
                      className="rounded" />
                    {t('saveAsDishLabel')}
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Search — uvijek vidljiv za dodavanje novih namirnica */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-300 pointer-events-none">
              <Plus size={11} />
            </span>
            <Input
              ref={searchRef}
              {...searchInputProps}
              placeholder={tRecipe('addIngredients')}
              className="h-7 text-xs border-orange-200 focus:border-orange-400 pl-7"
            />
            {showDropdown && mode === 'custom' && <DropdownContent onAdd={addIngredient} />}
          </div>
        </div>
      )}

      {/* Makro prikaz */}
      {(meal.recipe_id || meal.custom_ingredients?.length) ? (
        <div className="space-y-1 bg-orange-50/60 border border-orange-100 rounded-lg px-3 py-2">
          <p className="text-xs text-orange-700 font-medium">
            🔥 {Math.round(meal.calories)} kcal · 🥩 {Math.round(meal.protein)}g · 🍞 {Math.round(meal.carbs)}g · 🫒 {Math.round(meal.fat)}g
          </p>
          {extraNutritionFields.length > 0 && activeIngredients.length > 0 && (
            <p className="text-xs text-gray-400">
              {extraNutritionFields.map(f => {
                const total = activeIngredients.reduce((acc, ing) => acc + ((ing.extras?.[f.key] as number) || 0), 0)
                return `${f.label}: ${Math.round(total * 10) / 10}${f.unit}`
              }).join(' · ')}
            </p>
          )}
        </div>
      ) : null}

      </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title={t('removeMealTitle')}
        description={t('removeMealConfirm', { mealType: meal.meal_type })}
        onConfirm={() => { setConfirmRemove(false); onRemove(index) }}
        onCancel={() => setConfirmRemove(false)}
        confirmLabel={tCommon('remove')}
        destructive
      />

      <AddFoodDialog
        open={createFoodOpen}
        initialName={createFoodName}
        onClose={() => setCreateFoodOpen(false)}
        onSuccess={() => { setCreateFoodOpen(false); onFoodsRefresh?.() }}
      />
    </div>
  )
}
