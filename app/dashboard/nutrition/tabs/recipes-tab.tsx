'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2, GripVertical, PlusCircle, BookOpen, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import AddRecipeDialog from '../dialogs/add-recipe-dialog'
import EditRecipeDialog from '../dialogs/edit-recipe-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'

type Recipe = {
  id: string
  name: string
  description: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_extras?: Record<string, number>
  ingredients: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'calories_desc'

// ─── Recipe card: droppable (receives foods) + draggable handle ──────────────
function RecipeCard({
  recipe,
  activeType,
  onEdit,
  onDelete,
  activeExtraFields,
}: {
  recipe: Recipe
  activeType?: 'food' | 'recipe' | null
  onEdit: () => void
  onDelete: () => void
  activeExtraFields: typeof NUTRITION_FIELD_OPTIONS
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `recipe-drop::${recipe.id}`,
    data: { type: 'recipe-drop', recipeId: recipe.id },
  })

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `recipe::${recipe.id}`,
    data: {
      type: 'recipe',
      name: recipe.name,
      subtitle: `${Math.round(recipe.total_calories)} kcal`,
      payload: recipe,
    },
  })

  const showDropHint = activeType === 'food'
  const isActive = isOver && activeType === 'food'

  return (
    <div
      ref={setDropRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className={`relative border rounded-xl p-3 transition-all duration-150 bg-white cursor-default select-none ${
        isActive
          ? 'border-rose-400 shadow-md ring-2 ring-rose-400/25 bg-rose-50/30'
          : showDropHint
          ? 'border-dashed border-rose-300'
          : 'border-gray-100 hover:shadow-sm hover:border-gray-200'
      }`}
      onDoubleClick={() => !isDragging && onEdit()}
    >
      {isActive && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-10">
          <div className="bg-rose-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <PlusCircle size={12} /> Dodaj namirnicu (100g)
          </div>
        </div>
      )}

      <div className={`flex items-center gap-2 ${isActive ? 'opacity-30' : ''}`}>
        <button
          ref={setDragRef}
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-rose-400 shrink-0 touch-none transition-colors"
          onDoubleClick={e => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>

        <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
          <BookOpen size={12} className="text-rose-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate text-gray-800">{recipe.name}</p>
          {recipe.description && (
            <p className="text-xs text-gray-400 truncate">{recipe.description}</p>
          )}
          <p className="text-[10px] text-gray-300 mt-0.5">dvoklik za uređivanje</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onDoubleClick={e => e.stopPropagation()}>
          <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded-full font-medium border border-rose-100">
            {recipe.ingredients?.length ?? 0} sast.
          </span>
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

      {/* Macro summary + ingredient chips */}
      {!isActive && (
        <div className={`mt-1.5 ml-8 ${isActive ? 'opacity-0' : ''}`}>
          <div className="flex gap-2.5 text-[10px] text-gray-400 mb-1 flex-wrap">
            <span>🔥 {Math.round(recipe.total_calories)} kcal</span>
            <span>🥩 {Math.round(recipe.total_protein)}g</span>
            <span>🍞 {Math.round(recipe.total_carbs)}g</span>
            <span>🫒 {Math.round(recipe.total_fat)}g</span>
            {activeExtraFields.map(f => {
              const val = recipe.total_extras?.[f.key]
              if (val == null || val === 0) return null
              return <span key={f.key}>{f.label}: {Math.round(val * 10) / 10}{f.unit}</span>
            })}
          </div>
          {recipe.ingredients?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.ingredients.slice(0, 4).map((ing: any) => (
                <span key={ing.food_id} className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-100">
                  {ing.name}
                </span>
              ))}
              {recipe.ingredients.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100">
                  +{recipe.ingredients.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────
export default function RecipesTab({
  activeType,
  onFoodCreated,
}: {
  activeType?: 'food' | 'recipe' | null
  onFoodCreated?: () => void
}) {
  const { settings } = useTrainerSettings()
  const activeExtraFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('date_desc')
  const [showFilters, setShowFilters] = useState(false)
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

  const sorted = [...recipes]
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'hr')
      if (sort === 'name_desc') return b.name.localeCompare(a.name, 'hr')
      if (sort === 'calories_desc') return b.total_calories - a.total_calories
      return 0
    })

  const hasFilters = sort !== 'date_desc'

  return (
    <div>
      {/* Sticky: header + search */}
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 pt-3 pb-3 border-b border-gray-100 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-xs">{sorted.length} / {recipes.length} recepata</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${hasFilters ? 'border-rose-300 text-rose-600 bg-rose-50' : ''}`}
            >
              <SlidersHorizontal size={12} />
              Filtriraj
              {hasFilters && <span className="bg-rose-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
              <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm" className="h-7 text-xs flex items-center gap-1 px-2.5 bg-rose-500 hover:bg-rose-600">
              <Plus size={12} /> Dodaj
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <Input
            placeholder="Pretraži recepte..."
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
        <div className="bg-rose-50/60 rounded-xl p-3 space-y-3 border border-rose-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sortiraj po</p>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'date_desc', label: 'Najnoviji' },
                { key: 'date_asc', label: 'Najstariji' },
                { key: 'name_asc', label: 'A → Z' },
                { key: 'name_desc', label: 'Z → A' },
                { key: 'calories_desc', label: 'Najviše kcal' },
              ] as const).map(opt => (
                <button key={opt.key} type="button" onClick={() => setSort(opt.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    sort === opt.key ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button type="button" onClick={() => setSort('date_desc')} className="text-xs text-rose-600 flex items-center gap-1 hover:text-rose-800">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {/* Drag hint */}
      {activeType === 'food' && (
        <p className="text-xs text-rose-600/70 text-center py-1 border border-dashed border-rose-300/50 rounded-lg">
          Ispusti namirnicu na recept ↓
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className={`py-10 text-center border-2 border-dashed rounded-xl transition-colors ${
          activeType === 'food' ? 'border-rose-300/50 bg-rose-50/30' : 'border-gray-100'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-2">
            <BookOpen size={20} className="text-rose-400" />
          </div>
          <p className="text-gray-400 text-sm">{search ? 'Nema rezultata za pretragu' : 'Nema recepata'}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 mx-auto">
              <Plus size={11} /> Kreiraj prvi recept
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {sorted.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              activeType={activeType}
              onEdit={() => setEditRecipe(recipe)}
              onDelete={() => setConfirmDelete(recipe.id)}
              activeExtraFields={activeExtraFields}
            />
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
        title="Obriši recept"
        description="Jesi li siguran da želiš obrisati ovaj recept? Ova radnja je nepovratna."
        onConfirm={() => confirmDelete && deleteRecipe(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
      </div>
    </div>
  )
}

