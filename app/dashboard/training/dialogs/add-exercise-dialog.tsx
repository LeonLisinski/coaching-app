'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, Dumbbell } from 'lucide-react'
import { EQUIPMENT_CATEGORIES, MUSCLE_GROUPS } from '../tabs/exercises-tab'
import { useTrainerSettings, EXERCISE_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import { useTranslations } from 'next-intl'

export type CreatedExercise = {
  id: string; name: string; category: string
  muscle_group: string | null; video_url: string | null
  primary_muscles: string[]; secondary_muscles: string[]
}

type Props = { open: boolean; onClose: () => void; onSuccess: (exercise?: CreatedExercise) => void }

function MuscleChipSelect({
  value, onChange, label, color = 'emerald',
}: {
  value: string[]
  onChange: (v: string[]) => void
  label: string
  color?: 'emerald' | 'gray'
}) {
  const toggle = (m: string) =>
    onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m])
  const activeClass = color === 'emerald'
    ? 'bg-emerald-600 text-white border-emerald-600'
    : 'bg-gray-600 text-white border-gray-600'
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-gray-600">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map(m => (
          <button
            key={m} type="button" onClick={() => toggle(m)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              value.includes(m) ? activeClass : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AddExerciseDialog({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('training.dialogs.exercise')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()
  const [form, setForm] = useState({
    name: '', category: 'Slobodni utezi', muscle_group: 'Prsa',
    description: '', video_url: '', exercise_type: 'strength' as 'strength' | 'endurance',
  })
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>([])
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([])
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const extraFields = EXERCISE_FIELD_OPTIONS.filter(f => settings.exerciseFields.includes(f.key))

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const cleanExtras = Object.fromEntries(Object.entries(extras).filter(([_, v]) => v !== ''))

    const { data: inserted, error } = await supabase.from('exercises').insert({
      trainer_id: user.id, is_default: false,
      name: form.name, category: form.category,
      muscle_group: primaryMuscles[0] || form.muscle_group || null,
      primary_muscles: primaryMuscles,
      secondary_muscles: secondaryMuscles,
      description: form.description || null,
      video_url: form.video_url || null,
      exercise_type: form.exercise_type,
      extras: Object.keys(cleanExtras).length > 0 ? cleanExtras : null,
    }).select('id, name, category, muscle_group, video_url, primary_muscles, secondary_muscles').single()

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess(inserted ?? undefined); onClose()
    setForm({ name: '', category: 'Slobodni utezi', muscle_group: 'Prsa', description: '', video_url: '', exercise_type: 'strength' })
    setPrimaryMuscles([]); setSecondaryMuscles([]); setExtras({})
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('addTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('addTitle')}</DialogDescription>

        {/* Colored header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-4 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Dumbbell size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">{t('addTitle')}</h2>
            <p className="text-emerald-100/70 text-xs">{t('addSubtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-600">{t('name')}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')} required className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">{t('exerciseType')}</Label>
              <div className="flex gap-2">
                {(['strength', 'endurance'] as const).map(exType => (
                  <button key={exType} type="button"
                    onClick={() => setForm(f => ({ ...f, exercise_type: exType }))}
                    className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                      form.exercise_type === exType
                        ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                        : 'text-gray-500 border-gray-200 hover:border-emerald-300'
                    }`}>
                    {exType === 'strength' ? `🏋️ ${t('strengthType')}` : `🏃 ${t('enduranceType')}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">{t('equipment')}</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <MuscleChipSelect value={primaryMuscles} onChange={setPrimaryMuscles}
              label={t('primaryMuscles')} color="emerald" />

            <MuscleChipSelect value={secondaryMuscles} onChange={setSecondaryMuscles}
              label={`${t('secondaryMuscles')} (${tCommon('optional')})`} color="gray" />

            {extraFields.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-600">
                  {t('extraMetrics')} <span className="text-gray-400 font-normal">({tCommon('optional')})</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {extraFields.map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs text-gray-500">
                        {f.label} {f.unit && <span className="text-gray-400">({f.unit})</span>}
                      </Label>
                      <Input value={extras[f.key] || ''} onChange={e => setExtras({ ...extras, [f.key]: e.target.value })}
                        placeholder={f.desc} className="h-8 text-sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">
                {t('description')} <span className="text-gray-400 font-normal">({tCommon('optional')})</span>
              </Label>
              <textarea value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-400" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">
                {t('videoUrl')} <span className="text-gray-400 font-normal">({tCommon('optional')})</span>
              </Label>
              <Input value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://youtube.com/..." />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t bg-white shrink-0 flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" disabled={loading || !form.name}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {loading ? tCommon('saving') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


