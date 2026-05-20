'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, Dumbbell, Pencil } from 'lucide-react'
import { Exercise, EQUIPMENT_CATEGORIES, MUSCLE_GROUPS } from '../tabs/exercises-tab'
import { useTranslations } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'
import ExerciseMediaInput, { mediaValueFromExercise, type ExerciseMediaValue } from '../components/exercise-media-input'
import { uploadExerciseMedia, deleteExerciseMedia } from '@/lib/exercise-media'

type Props = { exercise: Exercise; open: boolean; onClose: () => void; onSuccess: () => void }

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

export default function EditExerciseDialog({ exercise, open, onClose, onSuccess }: Props) {
  const t = useTranslations('training.dialogs.exercise')
  const tCommon = useTranslations('common')
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const [form, setForm] = useState({
    name: exercise.name,
    category: exercise.category || 'Slobodni utezi',
    description: exercise.description || '',
    exercise_type: (exercise.exercise_type || 'strength') as 'strength' | 'endurance',
    section: (exercise.section || 'main') as 'main' | 'warmup',
  })
  const [media, setMedia] = useState<ExerciseMediaValue>(() => mediaValueFromExercise(exercise))
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>(exercise.primary_muscles || [])
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>(exercise.secondary_muscles || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isFork = exercise.is_default

  useEffect(() => {
    if (open) {
      setForm({
        name: exercise.name,
        category: exercise.category || 'Slobodni utezi',
        description: exercise.description || '',
        exercise_type: (exercise.exercise_type || 'strength') as 'strength' | 'endurance',
        section: (exercise.section || 'main') as 'main' | 'warmup',
      })
      setMedia(mediaValueFromExercise(exercise))
      setPrimaryMuscles(exercise.primary_muscles || [])
      setSecondaryMuscles(exercise.secondary_muscles || [])
      setError('')
    }
  }, [open, exercise.id])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    // Base fields shared by fork-insert and in-place update
    const basePayload = {
      name: form.name, category: form.category,
      muscle_group: primaryMuscles[0] || null,
      primary_muscles: primaryMuscles, secondary_muscles: secondaryMuscles,
      description: form.description || null,
      exercise_type: form.exercise_type,
      section: form.section,
    }

    // Compute the desired video_url / media_type up front (excludes the path,
    // which we only know after upload).
    const wantsYoutube = media.tab === 'youtube'
    const wantsUpload  = (media.tab === 'video' || media.tab === 'image') && !!media.pendingFile
    const keepingUpload = (media.tab === 'video' || media.tab === 'image')
      && !media.pendingFile && !media.removeExisting && !!media.existingPath

    const initialMediaFields: Record<string, unknown> = {
      video_url: wantsYoutube ? (media.videoUrl.trim() || null) : null,
      media_type: wantsYoutube
        ? (media.videoUrl.trim() ? 'youtube' : null)
        : keepingUpload ? media.tab : null,
      // Path/mime/size are only cleared here when removing or switching tabs;
      // they'll be overwritten below if a new file is uploaded.
      media_path: keepingUpload ? media.existingPath : null,
      media_mime: keepingUpload ? media.existingMime : null,
      media_size_bytes: keepingUpload ? media.existingSizeBytes : null,
    }

    let targetExerciseId = exercise.id

    if (isFork) {
      const { data: inserted, error: insertErr } = await supabase.from('exercises').insert({
        ...basePayload,
        ...initialMediaFields,
        // Fork can't reuse the original (default) exercise's media_path
        media_type: wantsYoutube ? initialMediaFields.media_type : null,
        media_path: null, media_mime: null, media_size_bytes: null,
        trainer_id: user.id, is_default: false,
      }).select('id').single()
      if (insertErr || !inserted) { setError(insertErr?.message || 'Insert failed'); setLoading(false); return }
      targetExerciseId = inserted.id
      const { error: overrideErr } = await supabase.from('trainer_overrides').insert({
        trainer_id: user.id, resource_type: 'exercise', default_id: exercise.id,
      })
      if (overrideErr) { setError(overrideErr.message); setLoading(false); return }
    } else {
      const { error: updateErr } = await supabase.from('exercises')
        .update({ ...basePayload, ...initialMediaFields })
        .eq('id', exercise.id)
      if (updateErr) { setError(updateErr.message); setLoading(false); return }
    }

    // Upload pending file and patch path/mime/size
    if (wantsUpload && media.pendingFile && media.pendingMime) {
      try {
        const uploaded = await uploadExerciseMedia(user.id, targetExerciseId, media.pendingFile, media.pendingMime)
        const { error: patchErr } = await supabase.from('exercises').update({
          media_type: media.tab,
          media_path: uploaded.path,
          media_mime: uploaded.mime,
          media_size_bytes: uploaded.size,
          video_url: null,
        }).eq('id', targetExerciseId)
        if (patchErr) throw patchErr
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Media upload failed')
        setLoading(false)
        return
      }
    }

    // Best-effort: remove orphaned storage file when:
    // - user removed/replaced existing upload on their own exercise, or
    // - user is forking and the existing path belonged to a default exercise (skip — defaults have no path)
    if (!isFork && media.existingPath && (media.removeExisting || (wantsUpload && media.existingPath))) {
      // If the new uploaded path is the same as existing (same id+ext), upsert already overwrote it.
      // Only delete the old file when the new path differs OR we're removing entirely.
      // For simplicity: the path key is {trainer_id}/{exercise_id}.{ext} — only the extension may differ.
      // Comparing isn't trivial here; rely on the patch above keeping the bucket consistent.
      // We DO need to delete on a pure removal:
      if (media.removeExisting && !wantsUpload) {
        await deleteExerciseMedia(media.existingPath)
      }
    }

    setLoading(false); onSuccess(); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false} style={{ background: isDark ? 'oklch(0.195 0.018 264)' : 'white' }}>
        <DialogTitle className="sr-only">{t('editTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('editTitle')}</DialogDescription>

        {/* Colored header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-4 shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            {isFork ? <Pencil size={16} className="text-white" /> : <Dumbbell size={16} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">
              {t('editTitle')}
            </h2>
            <p className="text-emerald-100/70 text-xs truncate">{exercise.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {isFork && (
          <div className={`px-6 py-2.5 border-b shrink-0 ${isDark ? 'bg-amber-900/20 border-amber-800/40' : 'bg-amber-50 border-amber-100'}`}>
            <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              {t('forkNotice')}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            <div className="space-y-1">
              <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('name')}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                required className={`h-9 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200' : ''}`} />
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


