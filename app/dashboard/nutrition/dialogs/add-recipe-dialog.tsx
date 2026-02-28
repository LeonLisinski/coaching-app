'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type Food = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

type Ingredient = {
  food_id: string
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export default function AddRecipeDialog({ open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) fetchFoods()
  }, [open])

  const fetchFoods = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('foods')
      .select('*')
      .eq('trainer_id', user.id)
      .order('name')
    if (data) setFoods(data)
  }

  const addIngredient = (food: Food) => {
    if (ingredients.find(i => i.food_id === food.id)) return
    setIngredients([...ingredients, {
      food_id: food.id,
      name: food.name,
      grams: 100,
      calories: food.calories_per_100g,
      protein: food.protein_per_100g,
      carbs: food.carbs_per_100g,
      fat: food.fat_per_100g,
    }])
    setSearch('')
  }

  const updateGrams = (food_id: string, grams: number) => {
    setIngredients(ingredients.map(i => {
      if (i.food_id !== food_id) return i
      const food = foods.find(f => f.id === food_id)!
      const ratio = grams / 100
      return {
        ...i,
        grams,
        calories: food.calories_per_100g * ratio,
        protein: food.protein_per_100g * ratio,
        carbs: food.carbs_per_100g * ratio,
        fat: food.fat_per_100g * ratio,
      }
    }))
  }

  const removeIngredient = (food_id: string) => {
    setIngredients(ingredients.filter(i => i.food_id !== food_id))
  }

  const totals = ingredients.reduce((acc, i) => ({
    calories: acc.calories + i.calories,
    protein: acc.protein + i.protein,
    carbs: acc.carbs + i.carbs,
    fat: acc.fat + i.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('recipes')
      .insert({
        trainer_id: user.id,
        name,
        description: description || null,
        ingredients,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbs: totals.carbs,
        total_fat: totals.fat,
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
    setName('')
    setDescription('')
    setIngredients([])
  }

  const filteredFoods = foods.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    !ingredients.find(i => i.food_id === f.id)
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj jelo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Naziv jela</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zobena kaša s bananama"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Doručak, visoko proteinski..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dodaj namirnice</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži namirnice..."
            />
            {search && filteredFoods.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredFoods.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => addIngredient(f)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between"
                  >
                    <span>{f.name}</span>
                    <span className="text-gray-400">{f.calories_per_100g} kcal/100g</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {ingredients.length > 0 && (
            <div className="space-y-2">
              <Label>Sastojci ({ingredients.length})</Label>
              {ingredients.map((ing) => (
                <div key={ing.food_id} className="flex items-center gap-3 border rounded-md p-2">
                  <span className="text-sm flex-1">{ing.name}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={ing.grams}
                      onChange={(e) => updateGrams(ing.food_id, parseFloat(e.target.value) || 0)}
                      className="w-20 h-7 text-sm"
                    />
                    <span className="text-xs text-gray-500">g</span>
                  </div>
                  <div className="text-xs text-gray-400 w-32 text-right">
                    {Math.round(ing.calories)} kcal
                  </div>
                  <button type="button" onClick={() => removeIngredient(ing.food_id)}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}

              <div className="bg-gray-50 rounded-md p-3 flex gap-4 text-sm">
                <span className="font-medium">Ukupno:</span>
                <span>🔥 {Math.round(totals.calories)} kcal</span>
                <span>🥩 {Math.round(totals.protein)}g</span>
                <span>🍞 {Math.round(totals.carbs)}g</span>
                <span>🫒 {Math.round(totals.fat)}g</span>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading || ingredients.length === 0} className="flex-1">
              {loading ? 'Spremanje...' : 'Spremi jelo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}