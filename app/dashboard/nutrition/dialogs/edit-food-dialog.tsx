'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Food = {
  id: string
  name: string
  category: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

type Props = {
  food: Food
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIES = ['Meso & Riba', 'Mliječni', 'Žitarice', 'Voće', 'Povrće', 'Orašasti', 'Ostalo']

export default function EditFoodDialog({ food, open, onClose, onSuccess }: Props) {
  const t = useTranslations('nutrition.dialogs.food')
  const tCat = useTranslations('nutrition.foodsTab')
  const tCommon = useTranslations('common')

  const [form, setForm] = useState({
    name: food.name,
    category: food.category,
    calories_per_100g: food.calories_per_100g.toString(),
    protein_per_100g: food.protein_per_100g.toString(),
    carbs_per_100g: food.carbs_per_100g.toString(),
    fat_per_100g: food.fat_per_100g.toString(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase
      .from('foods')
      .update({
        name: form.name,
        category: form.category,
        calories_per_100g: parseFloat(form.calories_per_100g) || 0,
        protein_per_100g: parseFloat(form.protein_per_100g) || 0,
        carbs_per_100g: parseFloat(form.carbs_per_100g) || 0,
        fat_per_100g: parseFloat(form.fat_per_100g) || 0,
      })
      .eq('id', food.id)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('category')}</Label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{tCat(`categories.${cat}` as any)}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">{tCat('per100g')}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('calories')}</Label>
              <Input type="number" value={form.calories_per_100g} onChange={(e) => setForm({ ...form, calories_per_100g: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t('protein')}</Label>
              <Input type="number" value={form.protein_per_100g} onChange={(e) => setForm({ ...form, protein_per_100g: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t('carbs')}</Label>
              <Input type="number" value={form.carbs_per_100g} onChange={(e) => setForm({ ...form, carbs_per_100g: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t('fat')}</Label>
              <Input type="number" value={form.fat_per_100g} onChange={(e) => setForm({ ...form, fat_per_100g: e.target.value })} required />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? tCommon('saving') : tCommon('saveChanges')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
