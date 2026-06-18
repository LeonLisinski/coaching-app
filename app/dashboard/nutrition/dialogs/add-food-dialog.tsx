'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, UtensilsCrossed } from 'lucide-react'
import SelectDropdown from '@/app/components/ui/select-dropdown'
import { FOOD_CATEGORIES } from '../tabs/foods-tab'
import { useTrainerSettings, NUTRITION_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import { useTranslations } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  initialName?: string
}

export default function AddFoodDialog({ open, onClose, onSuccess, initialName }: Props) {
  const t = useTranslations('nutrition.dialogs.food')
  const tCommon = useTranslations('common')
  const { settings, loading: settingsLoading } = useTrainerSettings()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const [form, setForm] = useState({
    name: '',
    category: FOOD_CATEGORIES[0],
    calories_per_100g: '',
    protein_per_100g: '',
    carbs_per_100g: '',
    fat_per_100g: '',
  })
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setForm(prev => ({ ...prev, name: initialName || '' }))
  }, [open, initialName])

  const activeFields = NUTRITION_FIELD_OPTIONS.filter(f => settings.nutritionFields.includes(f.key))

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const extrasPayload: Record<string, number | null> = {}
    for (const f of activeFields) {
      extrasPayload[f.key] = extras[f.key] !== undefined && extras[f.key] !== ''
        ? parseFloat(extras[f.key]) : null
    }

    const { error: insertErr } = await supabase.from('foods').insert({
      trainer_id: user.id,
      name: form.name,
      category: form.category,
      calories_per_100g: parseFloat(form.calories_per_100g) || 0,
      protein_per_100g: parseFloat(form.protein_per_100g) || 0,
      carbs_per_100g: parseFloat(form.carbs_per_100g) || 0,
      fat_per_100g: parseFloat(form.fat_per_100g) || 0,
      is_default: false,
      extras: extrasPayload,
    })

    if (insertErr) {
      setError(insertErr.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setForm({ name: '', category: FOOD_CATEGORIES[0], calories_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '' })
    setExtras({})
    onSuccess()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className={`max-w-md flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh] ${isDark ? 'bg-[oklch(0.195_0.018_264)]' : 'bg-white'}`} showCloseButton={false}>
        <DialogTitle className="sr-only">{t('addTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('addTitle')}</DialogDescription>

        {/* Orange header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-4 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <UtensilsCrossed size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">{t('addTitle')}</h2>
            <p className="text-orange-100/70 text-xs">{t('addSubtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('category')}</Label>
            <SelectDropdown
              value={form.category}
              onChange={cat => setForm({ ...form, category: cat })}
              options={FOOD_CATEGORIES}
              isDark={isDark}
              accentHex="#f97316"
              accentClass="focus:ring-orange-400"
            />
          </div>

          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('per100gLabel')}</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'calories_per_100g', label: t('calories') },
              { key: 'protein_per_100g', label: t('protein') },
              { key: 'carbs_per_100g', label: t('carbs') },
              { key: 'fat_per_100g', label: t('fat') },
            ].map(field => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value.replace(',', '.') })}
                  required
                />
              </div>
            ))}
          </div>

          {/* Dinamička extras polja iz trainer settings */}
          {!settingsLoading && activeFields.length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('extraFields')} <span className="text-gray-400 font-normal normal-case">({tCommon('optional')})</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                {activeFields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-xs">{field.label} ({field.unit})</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="—"
                      value={extras[field.key] ?? ''}
                      onChange={e => setExtras({ ...extras, [field.key]: e.target.value.replace(',', '.') })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className={`px-6 py-4 border-t shrink-0 flex gap-3 ${isDark ? 'bg-[oklch(0.195_0.018_264)] border-white/8' : 'bg-white'}`}>
          <Button type="button" variant="outline" onClick={onClose} className={`flex-1 ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/[0.06]' : ''}`}>{tCommon('cancel')}</Button>
          <Button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600">
            {loading ? tCommon('saving') : t('save')}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


