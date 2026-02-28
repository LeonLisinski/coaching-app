'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIES = ['Meso & Riba', 'Mliječni', 'Žitarice', 'Voće', 'Povrće', 'Orašasti', 'Ostalo']

export default function AddFoodDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '',
    category: 'Ostalo',
    calories_per_100g: '',
    protein_per_100g: '',
    carbs_per_100g: '',
    fat_per_100g: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('foods')
      .insert({
        trainer_id: user.id,
        name: form.name,
        category: form.category,
        calories_per_100g: parseFloat(form.calories_per_100g) || 0,
        protein_per_100g: parseFloat(form.protein_per_100g) || 0,
        carbs_per_100g: parseFloat(form.carbs_per_100g) || 0,
        fat_per_100g: parseFloat(form.fat_per_100g) || 0,
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
    setForm({ name: '', category: 'Ostalo', calories_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj namirnicu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Naziv</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Piletina, prsa"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Kategorija</Label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">Vrijednosti na 100g</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kalorije (kcal)</Label>
              <Input
                type="number"
                value={form.calories_per_100g}
                onChange={(e) => setForm({ ...form, calories_per_100g: e.target.value })}
                placeholder="165"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Proteini (g)</Label>
              <Input
                type="number"
                value={form.protein_per_100g}
                onChange={(e) => setForm({ ...form, protein_per_100g: e.target.value })}
                placeholder="31"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ugljikohidrati (g)</Label>
              <Input
                type="number"
                value={form.carbs_per_100g}
                onChange={(e) => setForm({ ...form, carbs_per_100g: e.target.value })}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Masti (g)</Label>
              <Input
                type="number"
                value={form.fat_per_100g}
                onChange={(e) => setForm({ ...form, fat_per_100g: e.target.value })}
                placeholder="3.6"
                required
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Dodavanje...' : 'Dodaj namirnicu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}