'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Food, FOOD_CATEGORIES } from '../tabs/foods-tab'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'

type Props = { food: Food | null; open: boolean; onClose: () => void; onSuccess: () => void }

export default function EditFoodDialog({ food, open, onClose, onSuccess }: Props) {
  if (!food) return null

  const { settings, loading: settingsLoading } = useTrainerSettings()

  const [form, setForm] = useState({
    name: food.name,
    category: food.category,
    calories_per_100g: food.calories_per_100g.toString(),
    protein_per_100g: food.protein_per_100g.toString(),
    carbs_per_100g: food.carbs_per_100g.toString(),
    fat_per_100g: food.fat_per_100g.toString(),
  })
  const [extras, setExtras] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(food.extras ?? {}).map(([k, v]) => [k, v?.toString() ?? ''])
    )
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isFork = food.is_default
  const activeFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const extrasPayload: Record<string, number | null> = {}
    for (const f of activeFields) {
      extrasPayload[f.key] = extras[f.key] !== undefined && extras[f.key] !== ''
        ? parseFloat(extras[f.key]) : null
    }

    const payload = {
      name: form.name,
      category: form.category,
      calories_per_100g: parseFloat(form.calories_per_100g) || 0,
      protein_per_100g: parseFloat(form.protein_per_100g) || 0,
      carbs_per_100g: parseFloat(form.carbs_per_100g) || 0,
      fat_per_100g: parseFloat(form.fat_per_100g) || 0,
      extras: extrasPayload,
    }

    if (isFork) {
      // Kreiraj novu trenerovu namirnicu (kopija defaulta)
      const { error: insertErr } = await supabase.from('foods').insert({
        ...payload,
        trainer_id: user.id,
        is_default: false,
      })
      if (insertErr) { setError(insertErr.message); setLoading(false); return }

      // Zapamti da je ovaj default "preuzet"
      await supabase.from('trainer_overrides').insert({
        trainer_id: user.id,
        resource_type: 'food',
        default_id: food.id,
      })
    } else {
      // Normalni edit trenerove namirnice
      const { error: updateErr } = await supabase.from('foods').update(payload).eq('id', food.id)
      if (updateErr) { setError(updateErr.message); setLoading(false); return }
    }

    setLoading(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFork ? 'Prilagodi namirnicu' : 'Uredi namirnicu'}</DialogTitle>
          {isFork && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md mt-1">
              Uređuješ default namirnicu. Bit će kreirana tvoja verzija, a original će biti sakriven.
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Naziv</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Kategorija</Label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm">
              {FOOD_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-500">Vrijednosti na 100g <span className="font-medium text-gray-700">sirove mase</span></p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'calories_per_100g', label: 'Kalorije' },
              { key: 'protein_per_100g', label: 'Proteini (g)' },
              { key: 'carbs_per_100g', label: 'Ugljikohidrati (g)' },
              { key: 'fat_per_100g', label: 'Masti (g)' },
            ].map(field => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input type="number" step="0.1"
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })} required />
              </div>
            ))}
          </div>

          {/* Dinamička extras polja iz trainer settings */}
          {!settingsLoading && activeFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dodatni podaci <span className="text-gray-400 font-normal normal-case">(opcionalno)</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                {activeFields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-xs">{field.label} ({field.unit})</Label>
                    <Input type="number" step="0.1" placeholder="—"
                      value={extras[field.key] ?? ''}
                      onChange={e => setExtras({ ...extras, [field.key]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Sprema...' : isFork ? 'Spremi kao moju' : 'Spremi promjene'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
