'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, Dumbbell } from 'lucide-react'
import { EQUIPMENT_CATEGORIES, MUSCLE_GROUPS } from '../tabs/exercises-tab'
import { useTrainerSettings, EXERCISE_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import { useTranslations } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'
import ExerciseMediaInput, { emptyMediaValue, type ExerciseMediaValue } from '../components/exercise-media-input'
import { uploadExerciseMedia } from '@/lib/exercise-media'

export type CreatedExercise = {
  id: string; name: string; category: string
  muscle_group: string | null; video_url: string | null
  primary_muscles: string[]; secondary_muscles: string[]
}

type Props = { open: boolean; onClose: () => void; onSuccess: (exercise?: CreatedExercise) => void; initialName?: string }

function MuscleChipSelect({
  value, onChange, label, color = 'emerald', isDark = false,
}: {
  value: string[]
  onChange: (v: string[]) => void
  label: string
  color?: 'emerald' | 'gray'
  isDark?: boolean
}) {
  const toggle = (m: string) =>
    onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m])
  const activeClass = color === 'emerald'
    ? 'bg-emerald-600 text-white border-emerald-600'
    : 'bg-gray-600 text-white border-gray-600'
  const inactiveClass = isDark
    ? 'bg-white/[0.04] text-gray-400 border-white/10 hover:border-emerald-500'
    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
  return (
    <div className="space-y-2">
      <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map(m => (
          <button
            key={m} type="button" onClick={() => toggle(m)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              value.includes(m) ? activeClass : inactiveClass
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AddExerciseDialog({ open, onClose, onSuccess, initialName = '' }: Props) {
  const t = useTranslations('training.dialogs.exercise')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const [form, setForm] = useState({
    name: initialName, category: 'Slobodni utezi', muscle_group: 'Prsa',
    description: '', exercise_type: 'strength' as 'strength' | 'endurance',
    section: 'main' as 'main' | 'warmup',
  })
  const [media, setMedia] = useState<ExerciseMediaValue>(emptyMediaValue())

  // Sync initialName when dialog opens
  useEffect(() => {
    if (open) {
      setForm(f => ({ ...f, name: initialName }))
      setMedia(emptyMediaValue())
    }
  }, [open, initialName])
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

    // Insert with youtube URL; upload media after (we need the exercise id for the path)
    const { data: inserted, error: insertErr } = await supabase.from('exercises').insert({
      trainer_id: user.id, is_default: false,
      name: form.name, category: form.category,
      muscle_group: primaryMuscles[0] || form.muscle_group || null,
      primary_muscles: primaryMuscles,
      secondary_muscles: secondaryMuscles,
      description: form.description || null,
      video_url: media.videoUrl.trim() || null,
      media_type: null,
      exercise_type: form.exercise_type,
      section: form.section,
      extras: Object.keys(cleanExtras).length > 0 ? cleanExtras : null,
    }).select('id, name, category, muscle_group, video_url, primary_muscles, secondary_muscles').single()

    if (insertErr || !inserted) { setError(insertErr?.message || 'Insert failed'); setLoading(false); return }

    // Upload video + image if picked
    const patch: Record<string, unknown> = {}
    try {
      if (media.pendingVideoFile && media.pendingVideoMime) {
        const up = await uploadExerciseMedia(user.id, inserted.id, media.pendingVideoFile, media.pendingVideoMime)
        patch.media_type = 'video'
        patch.media_path = up.path
        patch.media_mime = up.mime
        patch.media_size_bytes = up.size
      }
      if (media.pendingImageFile && media.pendingImageMime) {
        const up = await uploadExerciseMedia(user.id, inserted.id + '_img', media.pendingImageFile, media.pendingImageMime)
        patch.image_path = up.path
        patch.image_mime = up.mime
        patch.image_size_bytes = up.size
      }
      if (Object.keys(patch).length > 0) {
        const { error: patchErr } = await supabase.from('exercises').update(patch).eq('id', inserted.id)
        if (patchErr) throw patchErr
      }
    } catch (err) {
      await supabase.from('exercises').delete().eq('id', inserted.id)
      setError(err instanceof Error ? err.message : 'Media upload failed')
      setLoading(false)
      return
    }

    setLoading(false); onSuccess(inserted ?? undefined); onClose()
    setForm({ name: '', category: 'Slobodni utezi', muscle_group: 'Prsa', description: '', exercise_type: 'strength', section: 'main' })
    setMedia(emptyMediaValue())
    setPrimaryMuscles([]); setSecondaryMuscles([]); setExtras({})
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false} style={{ background: isDark ? 'oklch(0.195 0.018 264)' : 'white' }}>
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
              <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('name')}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')} required className={`h-9 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}`} />
            </div>

            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('exerciseType')}</Label>
              <div className="flex gap-2">
                {(['strength', 'endurance'] as const).map(exType => (
                  <button key={exType} type="button"
                    onClick={() => setForm(f => ({ ...f, exercise_type: exType }))}
                    className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                      form.exercise_type === exType
                        ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                        : isDark ? 'text-gray-400 border-white/10 bg-white/[0.04] hover:border-emerald-500' : 'text-gray-500 border-gray-200 hover:border-emerald-300'
                    }`}>
                    {exType === 'strength' ? `🏋️ ${t('strengthType')}` : `🏃 ${t('enduranceType')}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('sectionLabel')}</Label>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, section: 'main' }))}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                    form.section === 'main'
                      ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                      : isDark ? 'text-gray-400 border-white/10 bg-white/[0.04] hover:border-emerald-500' : 'text-gray-500 border-gray-200 hover:border-emerald-300'
                  }`}>
                  💪 {t('sectionMain')}
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, section: 'warmup' }))}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                    form.section === 'warmup'
                      ? 'bg-amber-600 text-white border-amber-600 font-semibold'
                      : isDark ? 'text-gray-400 border-white/10 bg-white/[0.04] hover:border-amber-500' : 'text-gray-500 border-gray-200 hover:border-amber-300'
                  }`}>
                  🔥 {t('sectionWarmup')}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('equipment')}</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200' : ''}`}>
                {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <MuscleChipSelect value={primaryMuscles} onChange={setPrimaryMuscles}
              label={t('primaryMuscles')} color="emerald" isDark={isDark} />

            <MuscleChipSelect value={secondaryMuscles} onChange={setSecondaryMuscles}
              label={`${t('secondaryMuscles')} (${tCommon('optional')})`} color="gray" isDark={isDark} />

            {extraFields.length > 0 && (
              <div className="space-y-2">
                <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('extraMetrics')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>({tCommon('optional')})</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {extraFields.map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {f.label} {f.unit && <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>({f.unit})</span>}
                      </Label>
                      <Input value={extras[f.key] || ''} onChange={e => setExtras({ ...extras, [f.key]: e.target.value })}
                        placeholder={f.desc} className={`h-8 text-sm ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('description')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>({tCommon('optional')})</span>
              </Label>
              <textarea value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
                className={`w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-400 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}`} />
            </div>

            <ExerciseMediaInput value={media} onChange={setMedia} isDark={isDark} />

            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>

          <div className={`px-6 py-4 border-t shrink-0 flex gap-3 ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-white'}`}>
            <Button type="button" variant="outline" onClick={onClose}
              className={`flex-1 ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/[0.05]' : ''}`}>{tCommon('cancel')}</Button>
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


