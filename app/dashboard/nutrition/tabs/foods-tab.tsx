'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, X, ChevronDown, GripVertical, UtensilsCrossed } from 'lucide-react'
import AddFoodDialog from '../dialogs/add-food-dialog'
import EditFoodDialog from '../dialogs/edit-food-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import { useDraggable } from '@dnd-kit/core'
import { useTranslations } from 'next-intl'

export type Food = {
  id: string
  name: string
  category: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  is_default: boolean
  trainer_id: string | null
  extras?: Record<string, number | null>
}

export const FOOD_CATEGORIES = [
  'Meso', 'Riba', 'Mliječni i jaja', 'Žitarice', 'Mahunarke',
  'Voće', 'Povrće', 'Orašasti i sjemenke', 'Ulja i masti',
  'Suplementi', 'Pića', 'Ostalo',
]

type SortKey = 'name_asc' | 'name_desc' | 'calories_asc' | 'calories_desc' | 'protein_desc'

// ─── Draggable food card ───────────────────────────────────────────────────────
function DraggableFoodCard({
  food,
  children,
}: {
  food: Food
  children: (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `food::${food.id}`,
    data: {
      type: 'food',
      name: food.name,
      subtitle: `${food.calories_per_100g} kcal/100g`,
      payload: food,
    },
  })
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }} className="transition-opacity">
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

export default function FoodsTab({
  activeType,
  refreshKey,
  onFoodCreated,
}: {
  activeType?: 'food' | 'recipe' | null
  refreshKey?: number
  onFoodCreated?: () => void
}) {
  const t = useTranslations('nutrition.foodsTab')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()

  const [foods, setFoods] = useState<Food[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Sve')
  const [showOnlyMine, setShowOnlyMine] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name_asc')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editFood, setEditFood] = useState<Food | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const activeExtraFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  useEffect(() => { fetchFoods() }, [refreshKey])

  const fetchFoods = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: allFoods }, { data: overrides }] = await Promise.all([
        supabase.from('foods').select('*').order('name'),
        supabase.from('trainer_overrides')
          .select('default_id')
          .eq('trainer_id', user.id)
          .eq('resource_type', 'food'),
      ])

      const overriddenIds = new Set((overrides || []).map(o => o.default_id))
      const visible = (allFoods || []).filter(f =>
        (!f.is_default && f.trainer_id === user.id) ||
        (f.is_default && !overriddenIds.has(f.id))
      )
      setFoods(visible)
    } catch {
      // Auth lock was taken over by another tab/request — non-fatal
    } finally {
      setLoading(false)
    }
  }

  const deleteFood = async (id: string) => {
    await supabase.from('foods').delete().eq('id', id)
    setFoods(prev => prev.filter(f => f.id !== id))
    setConfirmDelete(null)
  }

  const sorted = [...foods].sort((a, b) => {
    switch (sortKey) {
      case 'name_asc': return a.name.localeCompare(b.name, 'hr')
      case 'name_desc': return b.name.localeCompare(a.name, 'hr')
      case 'calories_asc': return a.calories_per_100g - b.calories_per_100g
      case 'calories_desc': return b.calories_per_100g - a.calories_per_100g
      case 'protein_desc': return b.protein_per_100g - a.protein_per_100g
    }
  })

  const filtered = sorted.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'Sve' || f.category === activeCategory
    const matchMine = !showOnlyMine || !f.is_default
    return matchSearch && matchCategory && matchMine
  })

  const activeFilterCount = [activeCategory !== 'Sve', showOnlyMine, sortKey !== 'name_asc'].filter(Boolean).length
  const clearFilters = () => { setActiveCategory('Sve'); setShowOnlyMine(false); setSortKey('name_asc') }

  const pillClass = (active: boolean) =>
    `text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer font-medium ${
      active ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
    }`

  return (
    <div>
      {/* Sticky: header + search */}
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 pt-3 pb-3 border-b border-gray-100 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-xs">{filtered.length} / {foods.length} namirnica</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${activeFilterCount > 0 ? 'border-orange-300 text-orange-700 bg-orange-50' : ''}`}
            >
              <SlidersHorizontal size={12} />
              Filtriraj
              {activeFilterCount > 0 && (
                <span className="bg-orange-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm" className="h-7 text-xs flex items-center gap-1 px-2.5 bg-orange-500 hover:bg-orange-600">
              <Plus size={12} /> {t('add')}
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <Input
            placeholder="Pretraži namirnice..."
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
        <div className="bg-orange-50/60 rounded-xl p-3 space-y-3 border border-orange-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kategorija</p>
            <div className="flex gap-1.5 flex-wrap">
              {['Sve', ...FOOD_CATEGORIES].map(cat => (
                <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                  className={pillClass(activeCategory === cat)}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sortiraj po</p>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'name_asc', label: 'Naziv A→Z' },
                { key: 'name_desc', label: 'Naziv Z→A' },
                { key: 'calories_asc', label: 'Kalorije ↑' },
                { key: 'calories_desc', label: 'Kalorije ↓' },
                { key: 'protein_desc', label: 'Proteini ↓' },
              ] as const).map(opt => (
                <button key={opt.key} type="button" onClick={() => setSortKey(opt.key)}
                  className={pillClass(sortKey === opt.key)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600 font-medium">Samo moje namirnice</p>
            <button type="button" onClick={() => setShowOnlyMine(!showOnlyMine)}
              className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${showOnlyMine ? 'bg-orange-500' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${showOnlyMine ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="text-xs text-orange-600 flex items-center gap-1 hover:text-orange-800">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Aktivni filteri:</span>
          {activeCategory !== 'Sve' && (
            <button type="button" onClick={() => setActiveCategory('Sve')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-600 text-white">
              {activeCategory} <X size={10} />
            </button>
          )}
          {showOnlyMine && (
            <button type="button" onClick={() => setShowOnlyMine(false)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-500 text-white">
              Samo moje <X size={10} />
            </button>
          )}
          {sortKey !== 'name_asc' && (
            <button type="button" onClick={() => setSortKey('name_asc')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white text-gray-700 border border-gray-200">
              Sortirano <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* Food list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-2">
            <UtensilsCrossed size={20} className="text-orange-400" />
          </div>
          <p className="text-gray-400 text-sm">{search ? t('noResults') : t('noFoods')}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1 mx-auto">
              <Plus size={11} /> {t('addFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5">
          {filtered.map(food => (
            <DraggableFoodCard key={food.id} food={food}>
              {(dragHandleProps) => (
                <div
                  className="border border-gray-100 rounded-xl p-2.5 bg-white hover:shadow-sm hover:border-gray-200 transition-all cursor-default select-none"
                  onDoubleClick={() => setEditFood(food)}
                  title="Dvoklik za uređivanje"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      {...dragHandleProps}
                      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-orange-400 shrink-0 touch-none transition-colors"
                      title="Povuci u recept"
                      onDoubleClick={e => e.stopPropagation()}
                    >
                      <GripVertical size={14} />
                    </button>

                    <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <UtensilsCrossed size={11} className="text-orange-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium text-sm truncate text-gray-800">{food.name}</p>
                        {food.is_default && <span className="text-[10px] text-gray-400 shrink-0">(default)</span>}
                      </div>
                    </div>

                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100 shrink-0 font-medium">
                      {food.category}
                    </span>

                    <div className="flex items-center gap-0.5 shrink-0" onDoubleClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
                        onClick={e => { e.stopPropagation(); setEditFood(food) }}>
                        <Pencil size={13} />
                      </Button>
                      {!food.is_default && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                          onClick={e => { e.stopPropagation(); setConfirmDelete(food.id) }}>
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Macro values */}
                  <div className="mt-1 ml-8 flex gap-2.5 text-[10px] text-gray-400 flex-wrap">
                    <span>🔥 {food.calories_per_100g} kcal</span>
                    <span>🥩 {food.protein_per_100g}g</span>
                    <span>🍞 {food.carbs_per_100g}g</span>
                    <span>🫒 {food.fat_per_100g}g</span>
                    {food.extras && activeExtraFields.map(f => {
                      const val = food.extras?.[f.key]
                      if (val == null) return null
                      return <span key={f.key}>{f.label}: {val}{f.unit}</span>
                    })}
                  </div>
                </div>
              )}
            </DraggableFoodCard>
          ))}
        </div>
      )}

      <AddFoodDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => { fetchFoods(); onFoodCreated?.() }} />
      {editFood && (
        <EditFoodDialog food={editFood} open={!!editFood} onClose={() => setEditFood(null)}
          onSuccess={() => { setEditFood(null); fetchFoods() }} />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Obriši namirnicu"
        description="Jesi li siguran da želiš obrisati ovu namirnicu?"
        onConfirm={() => confirmDelete && deleteFood(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
      </div>
    </div>
  )
}

