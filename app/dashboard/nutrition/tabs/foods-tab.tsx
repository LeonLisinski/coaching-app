'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import AddFoodDialog from '../dialogs/add-food-dialog'
import EditFoodDialog from '../dialogs/edit-food-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'

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

export default function FoodsTab() {
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()

  const [foods, setFoods] = useState<Food[]>([])
  const [overrideIds, setOverrideIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Sve')
  const [showOnlyMine, setShowOnlyMine] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name_asc')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editFood, setEditFood] = useState<Food | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Aktivna extra polja koja trener koristi
  const activeExtraFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  useEffect(() => { fetchFoods() }, [])

  const fetchFoods = async () => {
    setLoading(true)
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
    setOverrideIds(overriddenIds)

    const visible = (allFoods || []).filter(f =>
      (!f.is_default && f.trainer_id === user.id) ||
      (f.is_default && !overriddenIds.has(f.id))
    )
    setFoods(visible)
    setLoading(false)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{filtered.length} / {foods.length} namirnica</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
            <SlidersHorizontal size={14} />
            Filtriraj
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
            <Plus size={14} /> Dodaj
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input placeholder="Pretraži namirnice..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {showFilters && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kategorija</p>
            <div className="flex gap-2 flex-wrap">
              {['Sve', ...FOOD_CATEGORIES].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 13,
                    fontWeight: activeCategory === cat ? 600 : 400,
                    backgroundColor: activeCategory === cat ? '#111827' : 'white',
                    color: activeCategory === cat ? 'white' : '#374151',
                    border: `1px solid ${activeCategory === cat ? '#111827' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sortiraj po</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'name_asc', label: 'Naziv A→Z' },
                { key: 'name_desc', label: 'Naziv Z→A' },
                { key: 'calories_asc', label: 'Kalorije ↑' },
                { key: 'calories_desc', label: 'Kalorije ↓' },
                { key: 'protein_desc', label: 'Proteini ↓' },
              ] as const).map(opt => (
                <button key={opt.key} onClick={() => setSortKey(opt.key)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 13,
                    fontWeight: sortKey === opt.key ? 600 : 400,
                    backgroundColor: sortKey === opt.key ? '#111827' : 'white',
                    color: sortKey === opt.key ? 'white' : '#374151',
                    border: `1px solid ${sortKey === opt.key ? '#111827' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Samo moje namirnice</p>
            <button onClick={() => setShowOnlyMine(!showOnlyMine)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${showOnlyMine ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${showOnlyMine ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-red-500 flex items-center gap-1">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {activeFilterCount > 0 && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Aktivni filteri:</span>
          {activeCategory !== 'Sve' && (
            <button onClick={() => setActiveCategory('Sve')}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:99, fontSize:12, backgroundColor:'#111827', color:'white', border:'none', cursor:'pointer' }}>
              {activeCategory} <X size={10} />
            </button>
          )}
          {showOnlyMine && (
            <button onClick={() => setShowOnlyMine(false)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:99, fontSize:12, backgroundColor:'#3b82f6', color:'white', border:'none', cursor:'pointer' }}>
              Samo moje <X size={10} />
            </button>
          )}
          {sortKey !== 'name_asc' && (
            <button onClick={() => setSortKey('name_asc')}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:99, fontSize:12, backgroundColor:'white', color:'#374151', border:'1px solid #e5e7eb', cursor:'pointer' }}>
              Sortirano <X size={10} />
            </button>
          )}
          <button onClick={clearFilters} style={{ fontSize:11, color:'#9ca3af', cursor:'pointer', background:'none', border:'none', padding:0 }}>
            Očisti sve
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-500 text-sm">Nema namirnica</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(food => (
            <Card key={food.id} className="hover:shadow-sm transition-shadow cursor-pointer"
              onDoubleClick={() => setEditFood(food)}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm">{food.name}</p>
                    {food.is_default && <span className="text-xs text-gray-400">(default)</span>}
                  </div>
                  <p className="text-xs text-gray-400">na 100g sirove mase</p>
                  {/* FIXED: dinamički extras prema nutritionFields */}
                  {food.extras && activeExtraFields.length > 0 && (
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {activeExtraFields.map(f => {
                        const val = food.extras?.[f.key]
                        if (val == null) return null
                        return (
                          <span key={f.key} className="text-xs text-gray-400">
                            {f.label}: {val}{f.unit}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>🔥 {food.calories_per_100g} kcal</span>
                    <span>🥩 {food.protein_per_100g}g</span>
                    <span>🍞 {food.carbs_per_100g}g</span>
                    <span>🫒 {food.fat_per_100g}g</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{food.category}</Badge>
                  <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditFood(food) }}>
                    <Pencil size={14} />
                  </Button>
                  {!food.is_default && (
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setConfirmDelete(food.id) }}>
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddFoodDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchFoods} />
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
        confirmLabel={tCommon('delete')}
        destructive
      />
    </div>
  )
}
