'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, UtensilsCrossed, Pencil } from 'lucide-react'
import { Food, FOOD_CATEGORIES } from '../tabs/foods-tab'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import { useTranslations } from 'next-intl'

type Props = { food: Food | null; open: boolean; onClose: () => void; onSuccess: () => void }

export default function EditFoodDialog({ food, open, onClose, onSuccess }: Props) {
  const t = useTranslations('nutrition.dialogs.food')
  const tCommon = useTranslations('common')
  const { settings, loading: settingsLoading } = useTrainerSettings()

  if (!food) return null

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
      <DialogContent className="max-w-md flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('editTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('editTitle')}</DialogDescription>

        {/* Orange header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-4 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            {isFork ? <Pencil size={16} className="text-white" /> : <UtensilsCrossed size={16} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">{t('editTitle')}</h2>
            <p className="text-orange-100/70 text-xs">{t('editSubtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isFork && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-100">
              {t('forkNotice')}
            </p>
          )}
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>{t('category')}</Label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm">
              {FOOD_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-500">{t('per100gLabel')}</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'calories_per_100g', label: t('calories') },
              { key: 'protein_per_100g', label: t('protein') },
              { key: 'carbs_per_100g', label: t('carbs') },
              { key: 'fat_per_100g', label: t('fat') },
            ].map(field => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input type="text" inputMode="decimal"
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value.replace(',', '.') })} required />
              </div>
            ))}
          </div>

          {/* Dinamička extras polja iz trainer settings */}
          {!settingsLoading && activeFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {t('extraFields')} <span className="text-gray-400 font-normal normal-case">({tCommon('optional')})</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                {activeFields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-xs">{field.label} ({field.unit})</Label>
                    <Input type="text" inputMode="decimal" placeholder="—"
                      value={extras[field.key] ?? ''}
                      onChange={e => setExtras({ ...extras, [field.key]: e.target.value.replace(',', '.') })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t bg-white shrink-0 flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
          <Button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600">
            {loading ? tCommon('saving') : t('save')}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


