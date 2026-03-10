'use client'

import { useEffect, useState } from 'react'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, X, UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddMealPlanDialog from '@/app/dashboard/nutrition/dialogs/add-meal-plan-dialog'
import EditMealPlanDialog from '@/app/dashboard/nutrition/dialogs/edit-meal-plan-dialog'
import { useTranslations, useLocale } from 'next-intl'

type Props = { clientId: string }

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
  meals: any[] | null
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
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
  meal_type: string
  recipe_id: string | null
  recipe_name: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

const PLAN_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  default:      { color: '#6b7280', bg: '#f3f4f6' },
  training_day: { color: '#2563eb', bg: '#dbeafe' },
  rest_day:     { color: '#7c3aed', bg: '#ede9fe' },
}

const MEAL_TYPES = ['Doručak', 'Ručak', 'Večera', 'Užina', 'Prije treninga', 'Nakon treninga']

function NutritionalSummary({ meals, caloriesTarget, proteinTarget, carbsTarget, fatTarget }: {
  meals: any[]
  caloriesTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
}) {
  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein:  acc.protein  + (m.protein  || 0),
    carbs:    acc.carbs    + (m.carbs    || 0),
    fat:      acc.fat      + (m.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  if (totals.calories === 0 && totals.protein === 0) return null

  const items = [
    { label: 'Kcal',     val: Math.round(totals.calories), target: caloriesTarget, unit: ''  },
    { label: 'Proteini', val: Math.round(totals.protein),  target: proteinTarget,  unit: 'g' },
    { label: 'Ugljik.',  val: Math.round(totals.carbs),    target: carbsTarget,    unit: 'g' },
    { label: 'Masti',    val: Math.round(totals.fat),      target: fatTarget,      unit: 'g' },
  ]

  return (
    <div className="px-3 pt-2.5 pb-3 border-t border-gray-100 bg-gray-50/60 grid grid-cols-4 gap-3">
      {items.map(item => {
        const pct    = item.target ? Math.min((item.val / item.target) * 100, 110) : null
        const over   = item.target != null && item.val > item.target
        const barPct = pct != null ? Math.min(pct, 100) : null
        const barColor = pct == null ? 'bg-gray-300'
          : over             ? 'bg-red-400'
          : pct >= 90        ? 'bg-emerald-500'
          :                    'bg-amber-400'
        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{item.label}</span>
              <span className={`text-[10px] font-semibold tabular-nums ${over ? 'text-red-500' : 'text-gray-700'}`}>
                {item.val}{item.unit}
                {item.target != null && <span className="text-gray-400 font-normal">/{item.target}{item.unit}</span>}
              </span>
            </div>
            {barPct != null && (
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${barPct}%` }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MealAccordion({ meals }: { meals: any[] }) {
  const [openMeals, setOpenMeals] = useState<Record<number, boolean>>({})
  const toggle = (i: number) => setOpenMeals(prev => ({ ...prev, [i]: !(prev[i] ?? false) }))

  return (
    <div className="border-t border-gray-100 divide-y divide-gray-50">
      {meals.map((meal: any, mIdx: number) => {
        const ingredients: any[] = meal.custom_ingredients || []
        const hasIngredients = ingredients.length > 0
        const isOpen = openMeals[mIdx] ?? false
        return (
          <div key={mIdx}>
            <button
              type="button"
              onClick={() => hasIngredients && toggle(mIdx)}
              className={`w-full flex items-center gap-2 px-2 py-2 text-left transition-colors ${hasIngredients ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
            >
              {hasIngredients ? (
                isOpen ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className="text-xs text-gray-300 w-4 text-right tabular-nums shrink-0">{mIdx + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-800">{meal.recipe_name || meal.meal_type}</span>
                {meal.recipe_name && <span className="text-xs text-gray-400 ml-1.5">{meal.meal_type}</span>}
              </div>
              <span className="text-xs text-gray-400 tabular-nums shrink-0">
                {meal.calories ? `${Math.round(meal.calories)} kcal` : '—'}
                {meal.protein ? ` · P: ${Math.round(meal.protein)}g` : ''}
              </span>
            </button>
            {hasIngredients && isOpen && (
              <div className="pb-2 px-3">
                {ingredients.map((ing: any, iIdx: number) => (
                  <div key={iIdx} className="flex items-center justify-between py-1 text-xs text-gray-500 border-b border-gray-50 last:border-0">
                    <span className="ml-5">{ing.name}</span>
                    <span className="text-gray-400">{ing.grams}g · {Math.round(ing.calories)} kcal</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ClientMealPlans({ clientId }: Props) {
  const t = useTranslations('clients.mealPlans')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const PLAN_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    default:      { label: t('planTypeDefault'),     ...PLAN_TYPE_COLORS.default },
    training_day: { label: t('planTypeTrainingDay'), ...PLAN_TYPE_COLORS.training_day },
    rest_day:     { label: t('planTypeRestDay'),     ...PLAN_TYPE_COLORS.rest_day },
  }

  const [assignedPlans, setAssignedPlans] = useState<AssignedPlan[]>([])
  const [availablePlans, setAvailablePlans] = useState<MealPlan[]>([])
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  // Assign dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [assignMeals, setAssignMeals] = useState<AssignMeal[]>([])
  const [assignTargets, setAssignTargets] = useState({ calories: '', protein: '', carbs: '', fat: '' })
  const [assignPlanType, setAssignPlanType] = useState<'default' | 'training_day' | 'rest_day'>('default')
  const [assignNotes, setAssignNotes] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Other
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [editTarget, setEditTarget] = useState<AssignedPlan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingPlanTypeId, setEditingPlanTypeId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: assigned }, { data: available }, { data: recipes }] = await Promise.all([
      supabase
        .from('client_meal_plans')
        .select(`
          id, active, assigned_at, notes, plan_type, meals,
          calories_target, protein_target, carbs_target, fat_target,
          meal_plan:meal_plans (id, name, calories_target, protein_target, carbs_target, fat_target, meals)
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
        .order('name'),
    ])

    if (assigned) setAssignedPlans(assigned as any)
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
    setAssignMeals((plan.meals || []).map((m: any) => ({
      meal_type: m.meal_type ?? 'Doručak',
      recipe_id: m.recipe_id ?? null,
      recipe_name: m.recipe_name ?? '',
      calories: m.calories ?? 0,
      protein: m.protein ?? 0,
      carbs: m.carbs ?? 0,
      fat: m.fat ?? 0,
    })))
  }

  const updateAssignMealRecipe = (idx: number, recipeId: string) => {
    const recipe = availableRecipes.find(r => r.id === recipeId)
    setAssignMeals(prev => prev.map((m, i) => i !== idx ? m : {
      ...m,
      recipe_id: recipeId || null,
      recipe_name: recipe?.name || '',
      calories: recipe?.total_calories || 0,
      protein: recipe?.total_protein || 0,
      carbs: recipe?.total_carbs || 0,
      fat: recipe?.total_fat || 0,
    }))
  }

  const updateAssignMealField = (idx: number, field: string, value: any) => {
    setAssignMeals(prev => prev.map((m, i) => i !== idx ? m : { ...m, [field]: value }))
  }

  const removeAssignMeal = (idx: number) => {
    setAssignMeals(prev => prev.filter((_, i) => i !== idx))
  }

  const addAssignMeal = () => {
    setAssignMeals(prev => [...prev, { meal_type: 'Doručak', recipe_id: null, recipe_name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }])
  }

  const assignTotals = assignMeals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),
    fat: acc.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const assignPlan = async () => {
    if (!selectedPlanId) return
    setAssigning(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (assignPlanType !== 'default') {
      await supabase.from('client_meal_plans')
        .update({ active: false })
        .eq('client_id', clientId)
        .eq('plan_type', assignPlanType)
        .eq('active', true)
    }

    await supabase.from('client_meal_plans').insert({
      trainer_id: user.id,
      client_id: clientId,
      meal_plan_id: selectedPlanId,
      meals: assignMeals,
      calories_target: assignTargets.calories ? parseInt(assignTargets.calories) : null,
      protein_target: assignTargets.protein ? parseInt(assignTargets.protein) : null,
      carbs_target: assignTargets.carbs ? parseInt(assignTargets.carbs) : null,
      fat_target: assignTargets.fat ? parseInt(assignTargets.fat) : null,
      notes: assignNotes || null,
      active: true,
      plan_type: assignPlanType,
    })

    setAssigning(false)
    setShowAssignDialog(false)
    setSelectedPlanId('')
    setAssignMeals([])
    setAssignTargets({ calories: '', protein: '', carbs: '', fat: '' })
    setAssignPlanType('default')
    setAssignNotes('')
    fetchData()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('client_meal_plans').update({ active: !current }).eq('id', id)
    setAssignedPlans(prev => prev.map(p => p.id === id ? { ...p, active: !current } : p))
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

  const activePlans = assignedPlans.filter(p => p.active)
  const inactivePlans = assignedPlans.filter(p => !p.active)
  const hasTrainingDay = activePlans.some(p => p.plan_type === 'training_day')
  const hasRestDay = activePlans.some(p => p.plan_type === 'rest_day')
  const hasDefault = activePlans.some(p => p.plan_type === 'default')

  if (loading) return <p className="text-gray-500 text-sm">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">

      {/* Info banneri */}
      {hasTrainingDay && hasRestDay && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          {t('infoBannerBoth')}
        </div>
      )}
      {hasDefault && !hasTrainingDay && !hasRestDay && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {t.rich('infoBannerTip', { strong: (chunks) => <strong>{chunks}</strong> })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('assigned', { count: assignedPlans.length })}</p>
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
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed size={24} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">{t('noPlans')}</p>
            <button onClick={() => setShowAssignDialog(true)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
              {t('assignExisting')} →
            </button>
          </CardContent>
        </Card>
      )}

      {/* Active plans */}
      {activePlans.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('activePlans')}</p>
          {activePlans.map(assigned => {
            const meals = assigned.meals?.length ? assigned.meals : assigned.meal_plan.meals || []
            const isPersonalized = !!(assigned.meals?.length)
            const typeInfo = PLAN_TYPE_LABELS[assigned.plan_type || 'default']
            const calories = assigned.calories_target ?? assigned.meal_plan.calories_target
            const protein = assigned.protein_target ?? assigned.meal_plan.protein_target
            const carbs = assigned.carbs_target ?? assigned.meal_plan.carbs_target
            const fat = assigned.fat_target ?? assigned.meal_plan.fat_target

            return (
              <Card
                key={assigned.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onDoubleClick={() => setEditTarget(assigned)}
              >
                <CardContent className="py-0">
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-[5px] w-2 h-2 rounded-full shrink-0 bg-emerald-400" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{assigned.meal_plan.name}</span>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: typeInfo.color, backgroundColor: typeInfo.bg }}
                          >
                            {typeInfo.label}
                          </span>
                          {isPersonalized && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                              Personalizirano
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('mealsCount', { count: meals.length })} · {new Date(assigned.assigned_at).toLocaleDateString(locale)}
                        </p>
                        {assigned.notes && <p className="text-xs text-gray-500 mt-1">{assigned.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {editingPlanTypeId === assigned.id ? (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          {(Object.entries(PLAN_TYPE_LABELS) as [string, any][]).map(([key, val]) => (
                            <button key={key} onClick={() => changePlanType(assigned.id, key as any)}
                              className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${
                                assigned.plan_type === key ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}>
                              {val.label}
                            </button>
                          ))}
                          <button onClick={() => setEditingPlanTypeId(null)} className="text-xs text-gray-400 px-1">✕</button>
                        </div>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm"
                            onClick={e => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}
                            className="text-xs h-7 px-3 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100">
                            Aktivno
                          </Button>
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditingPlanTypeId(assigned.id) }}>
                            <span className="text-xs text-gray-400">{t('typeLabel')}</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditTarget(assigned) }}>
                            <Pencil size={14} />
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
                    />
                  )}

                  {/* Meals list — collapsible ingredients */}
                  {meals.length > 0 && <MealAccordion meals={meals} />}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Inactive plans */}
      {inactivePlans.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('inactivePlans')}</p>
          {inactivePlans.map(assigned => {
            const typeInfo = PLAN_TYPE_LABELS[assigned.plan_type || 'default']
            return (
              <Card key={assigned.id} className="opacity-55 hover:opacity-75 transition-opacity cursor-pointer" onDoubleClick={() => setEditTarget(assigned)}>
                <CardContent className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-gray-300" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{assigned.meal_plan.name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: typeInfo.color, backgroundColor: typeInfo.bg }}>{typeInfo.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm"
                      onClick={e => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}
                      className="text-xs h-7 px-3 rounded-full border text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100">
                      Neaktivno
                    </Button>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditTarget(assigned) }}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setConfirmDelete(assigned.id) }}>
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── ASSIGN DIALOG ── */}
      <Dialog
        open={showAssignDialog}
        onOpenChange={v => {
          setShowAssignDialog(v)
          if (!v) { setSelectedPlanId(''); setAssignMeals([]); setAssignNotes(''); setAssignPlanType('default'); setAssignTargets({ calories: '', protein: '', carbs: '', fat: '' }) }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodijeli plan klijentu</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Plan select */}
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={handleSelectPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Odaberi plan..." />
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
                <Label>Tip plana</Label>
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
                <Label>Nutritivni ciljevi <span className="text-gray-400 font-normal text-xs">(prilagodi za klijenta)</span></Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'calories', label: 'Kcal' },
                    { key: 'protein', label: 'Proteini (g)' },
                    { key: 'carbs', label: 'Ugljik. (g)' },
                    { key: 'fat', label: 'Masti (g)' },
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

            {/* Editable meals */}
            {assignMeals.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Obroci</p>
                  <Button variant="outline" size="sm" onClick={addAssignMeal} className="flex items-center gap-1 h-7 text-xs">
                    <Plus size={12} /> Dodaj obrok
                  </Button>
                </div>

                {assignMeals.map((meal, idx) => (
                  <Card key={idx}>
                    <CardContent className="py-0">
                      <div className="py-3 flex items-center justify-between border-b border-gray-100">
                        <select
                          value={meal.meal_type}
                          onChange={e => updateAssignMealField(idx, 'meal_type', e.target.value)}
                          className="text-sm font-medium bg-transparent border-none outline-none cursor-pointer text-gray-700"
                        >
                          {MEAL_TYPES.map(mt => <option key={mt} value={mt}>{mt}</option>)}
                        </select>
                        <Button variant="ghost" size="sm" onClick={() => removeAssignMeal(idx)}>
                          <X size={12} className="text-gray-400" />
                        </Button>
                      </div>

                      <div className="py-3 space-y-2">
                        {/* Recipe select */}
                        <Select value={meal.recipe_id || ''} onValueChange={v => updateAssignMealRecipe(idx, v)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Odaberi recept..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRecipes.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} · {Math.round(r.total_calories)} kcal
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Makro prikaz */}
                        {meal.calories > 0 && (
                          <div className="flex gap-3 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">
                            <span>🔥 {Math.round(meal.calories)} kcal</span>
                            <span>🥩 {Math.round(meal.protein)}g</span>
                            <span>🍞 {Math.round(meal.carbs)}g</span>
                            <span>🫒 {Math.round(meal.fat)}g</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Ukupno */}
                {assignTotals.calories > 0 && (
                  <div className="bg-gray-50 rounded-md p-3 flex gap-4 text-sm border border-gray-100">
                    <span className="font-medium text-gray-600">Ukupno:</span>
                    <span>🔥 {Math.round(assignTotals.calories)} kcal</span>
                    <span>🥩 {Math.round(assignTotals.protein)}g</span>
                    <span>🍞 {Math.round(assignTotals.carbs)}g</span>
                    <span>🫒 {Math.round(assignTotals.fat)}g</span>
                  </div>
                )}
              </div>
            )}

            {/* Napomena */}
            <div className="space-y-1.5">
              <Label>Napomena <span className="text-gray-400 font-normal text-xs">(opcionalno)</span></Label>
              <Input value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="npr. Počni od ponedjeljka" />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)} className="flex-1">Odustani</Button>
              <Button onClick={assignPlan} disabled={!selectedPlanId || assigning} className="flex-1">
                {assigning ? 'Sprema...' : 'Dodijeli plan'}
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
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          const { data: latestPlan } = await supabase
            .from('meal_plans').select('id, meals, calories_target, protein_target, carbs_target, fat_target')
            .eq('trainer_id', user.id)
            .order('created_at', { ascending: false }).limit(1).single()
          if (latestPlan) {
            await supabase.from('client_meal_plans').insert({
              trainer_id: user.id, client_id: clientId,
              meal_plan_id: latestPlan.id,
              meals: latestPlan.meals || [],
              calories_target: latestPlan.calories_target,
              protein_target: latestPlan.protein_target,
              carbs_target: latestPlan.carbs_target,
              fat_target: latestPlan.fat_target,
              active: true, plan_type: 'default',
            })
          }
          setShowCreateNew(false)
          fetchData()
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
          }}
          clientAssignId={editTarget.id}
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
    </div>
  )
}
