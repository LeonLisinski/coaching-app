'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import AddFoodDialog from '../dialogs/add-food-dialog'
import EditFoodDialog from '../dialogs/edit-food-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type Food = {
  id: string
  name: string
  category: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

const CATEGORIES = ['Sve', 'Meso & Riba', 'Mliječni', 'Žitarice', 'Voće', 'Povrće', 'Orašasti', 'Ostalo']

export default function FoodsTab() {
  const [foods, setFoods] = useState<Food[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Sve')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editFood, setEditFood] = useState<Food | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchFoods()
  }, [])

  const fetchFoods = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('foods')
      .select('*')
      .eq('trainer_id', user.id)
      .order('name')

    if (data) setFoods(data)
    setLoading(false)
  }

  const deleteFood = async (id: string) => {
    await supabase.from('foods').delete().eq('id', id)
    setFoods(foods.filter(f => f.id !== id))
    setConfirmDelete(null)
  }

  const filtered = foods.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'Sve' || f.category === activeCategory
    return matchSearch && matchCategory
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{foods.length} namirnica</p>
        <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
          <Plus size={14} />
          Dodaj namirnicu
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Pretraži namirnice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {search ? 'Nema rezultata' : 'Još nemaš namirnica. Dodaj prvu!'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((food) => (
            <Card
              key={food.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onDoubleClick={() => setEditFood(food)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{food.name}</p>
                  <p className="text-xs text-gray-400">na 100g</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>🔥 {food.calories_per_100g} kcal</span>
                    <span>🥩 {food.protein_per_100g}g</span>
                    <span>🍞 {food.carbs_per_100g}g</span>
                    <span>🫒 {food.fat_per_100g}g</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{food.category}</Badge>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditFood(food) }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(food.id) }}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddFoodDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchFoods}
      />

      {editFood && (
        <EditFoodDialog
          food={editFood}
          open={!!editFood}
          onClose={() => setEditFood(null)}
          onSuccess={() => {
            setEditFood(null)
            fetchFoods()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Obriši namirnicu"
        description="Sigurno želiš obrisati ovu namirnicu? Ova radnja se ne može poništiti."
        onConfirm={() => confirmDelete && deleteFood(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
    </div>
  )
}