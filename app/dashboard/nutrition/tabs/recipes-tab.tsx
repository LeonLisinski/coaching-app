'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import AddRecipeDialog from '../dialogs/add-recipe-dialog'
import EditRecipeDialog from '../dialogs/edit-recipe-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type Recipe = {
  id: string
  name: string
  description: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  ingredients: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

export default function RecipesTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('name_asc')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchRecipes() }, [])

  const fetchRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('recipes').select('*').eq('trainer_id', user.id)
    if (data) setRecipes(data)
    setLoading(false)
  }

  const deleteRecipe = async (id: string) => {
    await supabase.from('recipes').delete().eq('id', id)
    setRecipes(recipes.filter(r => r.id !== id))
    setConfirmDelete(null)
  }

  const filtered = recipes
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'name_asc') return a.name.localeCompare(b.name)
      if (sort === 'name_desc') return b.name.localeCompare(a.name)
      return 0
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{recipes.length} jela</p>
        <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
          <Plus size={14} />
          Dodaj jelo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Pretraži jela..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown size={14} className="text-gray-400" />
        <span className="text-sm text-gray-500">Sortiraj:</span>
        {([
          { value: 'date_desc', label: 'Najnoviji' },
          { value: 'date_asc', label: 'Najstariji' },
          { value: 'name_asc', label: 'A → Z' },
          { value: 'name_desc', label: 'Z → A' },
        ] as { value: SortOption; label: string }[]).map(option => (
          <Button
            key={option.value}
            variant={sort === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSort(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {search ? 'Nema rezultata' : 'Još nemaš jela. Dodaj prvo!'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((recipe) => (
            <Card key={recipe.id} className="hover:shadow-sm transition-shadow cursor-pointer" onDoubleClick={() => setEditRecipe(recipe)}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{recipe.name}</p>
                  {recipe.description && <p className="text-xs text-gray-500">{recipe.description}</p>}
                  <p className="text-xs text-gray-400">{recipe.ingredients?.length || 0} namirnica</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>🔥 {Math.round(recipe.total_calories)} kcal</span>
                    <span>🥩 {Math.round(recipe.total_protein)}g</span>
                    <span>🍞 {Math.round(recipe.total_carbs)}g</span>
                    <span>🫒 {Math.round(recipe.total_fat)}g</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditRecipe(recipe) }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(recipe.id) }}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddRecipeDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchRecipes} />
      {editRecipe && (
        <EditRecipeDialog recipe={editRecipe} open={!!editRecipe} onClose={() => setEditRecipe(null)}
          onSuccess={() => { setEditRecipe(null); fetchRecipes() }} />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Obriši jelo"
        description="Sigurno želiš obrisati ovo jelo?"
        onConfirm={() => confirmDelete && deleteRecipe(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
    </div>
  )
}