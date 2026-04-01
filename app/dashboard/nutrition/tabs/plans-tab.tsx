'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDroppable } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2, CalendarDays, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import AddMealPlanDialog from '../dialogs/add-meal-plan-dialog'
import EditMealPlanDialog from '../dialogs/edit-meal-plan-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'

type MealPlan = {
  id: string
  name: string
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  meals: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

function DroppablePlanCard({
  plan, activeType, onEdit, onDelete, activeExtraFields, foodExtrasMap,
}: {
  plan: MealPlan
  activeType?: 'food' | 'recipe' | null
  onEdit: () => void
  onDelete: () => void
  activeExtraFields: typeof NUTRITION_FIELD_OPTIONS
  foodExtrasMap: Map<string, Record<string, number>>
}) {
  const getMealExtra = (m: any, key: string): number => {
    // Prefer stored extras (new plans), else recompute from current food data
    if (m.extras?.[key] != null) return m.extras[key] as number
    return ((m.custom_ingredients || []) as any[]).reduce((s: number, ing: any) => {
      const foodExtras = foodExtrasMap.get(ing.food_id)
      if (foodExtras?.[key] != null) return s + (foodExtras[key] as number) * ((ing.grams || 100) / 100)
      return s + ((ing.extras?.[key] as number) || 0)
    }, 0)
  }
  const planExtras = activeExtraFields.reduce((acc, f) => {
    acc[f.key] = (plan.meals || []).reduce((sum, m) => sum + getMealExtra(m, f.key), 0)
    return acc
  }, {} as Record<string, number>)
  const { setNodeRef, isOver } = useDroppable({
    id: `plan-drop::${plan.id}`,
    data: { type: 'plan-drop', planId: plan.id },
  })
  const isActive = isOver && activeType === 'recipe'
  return (
    <div
      ref={setNodeRef}
      onDoubleClick={onEdit}
      className={`border rounded-xl p-3 bg-white transition-all cursor-default select-none ${
        isActive
          ? 'border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/40 shadow-sm'
          : 'border-gray-100 hover:shadow-sm hover:border-gray-200'
      }`}
    >
      {isActive && (
        <div className="text-[11px] text-purple-600 font-semibold mb-2 flex items-center gap-1">
          <CalendarDays size={11} /> Ispusti recept da dodaš obrok
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
          <CalendarDays size={12} className="text-purple-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate text-gray-800">{plan.name}</p>
          {activeExtraFields.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-0.5">
              {activeExtraFields.map(f => {
                const val = planExtras[f.key]
                if (!val) return null
                return <span key={f.key} className="text-[10px] text-gray-400">{f.label}: {Math.round(val * 10) / 10}{f.unit}</span>
              })}
            </div>
          )}
          <p className="text-[10px] text-gray-300 mt-0.5">dvoklik za uređivanje</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onDoubleClick={e => e.stopPropagation()}>
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium border border-purple-100">
            {plan.meals?.length ?? 0} obroka
          </span>
          {plan.calories_target && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded-full border border-gray-100">
              🎯 {plan.calories_target} kcal
            </span>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
            onClick={e => { e.stopPropagation(); onEdit() }}>
            <Pencil size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
            onClick={e => { e.stopPropagation(); onDelete() }}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
    </div>
  )
}

type Props = { activeType?: 'food' | 'recipe' | null; refreshKey?: number }

export default function PlansTab({ activeType, refreshKey }: Props) {
  const { settings } = useTrainerSettings()
  const activeExtraFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  const [plans, setPlans] = useState<MealPlan[]>([])
  const [foodExtrasMap, setFoodExtrasMap] = useState<Map<string, Record<string, number>>>(new Map())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('date_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editPlan, setEditPlan] = useState<MealPlan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchPlans() }, [refreshKey])

  const fetchPlans = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data }, { data: foods }] = await Promise.all([
      supabase
        .from('meal_plans')
        .select('id, name, calories_target, protein_target, carbs_target, fat_target, meals, created_at')
        .eq('trainer_id', user.id)
        .eq('is_template', true),
      supabase.from('foods').select('id, extras'),
    ])
    const map = new Map<string, Record<string, number>>()
    ;(foods || []).forEach((f: any) => { if (f.extras) map.set(f.id, f.extras) })
    setFoodExtrasMap(map)
    if (data) setPlans(data)
    setLoading(false)
  }

  const deletePlan = async (id: string) => {
    await supabase.from('meal_plans').delete().eq('id', id)
    setPlans(plans.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const sorted = [...plans]
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'hr')
      if (sort === 'name_desc') return b.name.localeCompare(a.name, 'hr')
      return 0
    })

  const hasFilters = sort !== 'date_desc'

  return (
    <div>
      {/* Sticky: header + search */}
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 pt-3 pb-3 border-b border-gray-100 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-xs">{sorted.length} / {plans.length} planova</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${hasFilters ? 'border-purple-300 text-purple-600 bg-purple-50' : ''}`}
            >
              <SlidersHorizontal size={12} />
              Filtriraj
              {hasFilters && <span className="bg-purple-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
              <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm" className="h-7 text-xs flex items-center gap-1 px-2.5 bg-purple-600 hover:bg-purple-700">
              <Plus size={12} /> Dodaj
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <Input
            placeholder="Pretraži planove prehrane..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`pl-9 h-9 text-sm ${search ? 'pr-8' : ''}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="space-y-3 pt-3">

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-purple-50/60 rounded-xl p-3 space-y-3 border border-purple-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sortiraj po</p>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'date_desc', label: 'Najnoviji' },
                { key: 'date_asc', label: 'Najstariji' },
                { key: 'name_asc', label: 'A → Z' },
                { key: 'name_desc', label: 'Z → A' },
              ] as const).map(opt => (
                <button key={opt.key} type="button" onClick={() => setSort(opt.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    sort === opt.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button type="button" onClick={() => setSort('date_desc')} className="text-xs text-purple-600 flex items-center gap-1 hover:text-purple-800">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-2">
            <CalendarDays size={20} className="text-purple-400" />
          </div>
          <p className="text-gray-400 text-sm">{search ? 'Nema rezultata za pretragu' : 'Nema planova prehrane'}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 mx-auto">
              <Plus size={11} /> Kreiraj prvi plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {sorted.map(plan => (
            <DroppablePlanCard
              key={plan.id}
              plan={plan}
              activeType={activeType}
              onEdit={() => setEditPlan(plan)}
              onDelete={() => setConfirmDelete(plan.id)}
              activeExtraFields={activeExtraFields}
              foodExtrasMap={foodExtrasMap}
            />
          ))}
        </div>
      )}

      <AddMealPlanDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchPlans} isTemplate />
      {editPlan && (
        <EditMealPlanDialog plan={editPlan} open={!!editPlan} onClose={() => setEditPlan(null)}
          onSuccess={() => { setEditPlan(null); fetchPlans() }} />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Obriši plan prehrane"
        description="Jesi li siguran da želiš obrisati ovaj plan? Ova radnja je nepovratna."
        onConfirm={() => confirmDelete && deletePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
      </div>
    </div>
  )
}

