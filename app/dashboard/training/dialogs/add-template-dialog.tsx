'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { useTrainerSettings, EXERCISE_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

type Exercise = { id: string; name: string; category: string }

type TemplateExercise = {
  exercise_id: string; name: string
  sets: number; reps: string; rest_seconds: number; notes: string
  extras?: Record<string, string>
}

export default function AddTemplateDialog({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('training.dialogs.template')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selected, setSelected] = useState<TemplateExercise[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Extra exercise fields koje trener koristi (bez sets/reps/rest koji su uvijek tu)
  const extraFields = EXERCISE_FIELD_OPTIONS.filter(f =>
    settings.exerciseFields.includes(f.key) && !['rest'].includes(f.key)
  )

  useEffect(() => {
    if (open) { fetchExercises(); setName(''); setDescription(''); setSelected([]) }
  }, [open])

  const fetchExercises = async () => {
    const { data } = await supabase.from('exercises').select('id, name, category').order('name')
    if (data) setExercises(data)
  }

  const addExercise = (exercise: Exercise) => {
    if (selected.find(s => s.exercise_id === exercise.id)) return
    setSelected([...selected, {
      exercise_id: exercise.id, name: exercise.name,
      sets: 3, reps: '10', rest_seconds: 60, notes: '', extras: {},
    }])
    setSearch('')
  }

  const removeExercise = (exercise_id: string) => setSelected(selected.filter(s => s.exercise_id !== exercise_id))

  const updateExercise = (exercise_id: string, field: string, value: any) => {
    setSelected(selected.map(s => s.exercise_id === exercise_id ? { ...s, [field]: value } : s))
  }

  const updateExtra = (exercise_id: string, key: string, value: string) => {
    setSelected(selected.map(s => s.exercise_id === exercise_id
      ? { ...s, extras: { ...s.extras, [key]: value } } : s))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('workout_templates').insert({
      trainer_id: user.id, name, description: description || null, exercises: selected,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess(); onClose()
  }

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find(s => s.exercise_id === e.id)
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('addTitle')}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} required />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('addExercise')}</Label>
            <div className="relative">
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchExercises')} />
              {search && filteredExercises.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 border rounded-md max-h-40 overflow-y-auto bg-white shadow-md mt-0.5">
                  {filteredExercises.map(e => (
                    <button key={e.id} type="button" onClick={() => addExercise(e)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm border-b last:border-0">
                      <span>{e.name}</span>
                      <Badge variant="outline" className="text-xs">{e.category}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selected.length > 0 && (
            <div className="space-y-3">
              <Label>{t('exercises', { count: selected.length })}</Label>
              {selected.map((ex, index) => (
                <div key={ex.exercise_id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{index + 1}. {ex.name}</span>
                    <button type="button" onClick={() => removeExercise(ex.exercise_id)}>
                      <X size={14} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                  {/* Osnovna polja — uvijek */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">{t('sets')}</Label>
                      <Input type="number" value={ex.sets}
                        onChange={e => updateExercise(ex.exercise_id, 'sets', parseInt(e.target.value))}
                        className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">{t('reps')}</Label>
                      <Input value={ex.reps}
                        onChange={e => updateExercise(ex.exercise_id, 'reps', e.target.value)}
                        placeholder="10 ili 8-12" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">{t('rest')} (sek)</Label>
                      <Input type="number" value={ex.rest_seconds}
                        onChange={e => updateExercise(ex.exercise_id, 'rest_seconds', parseInt(e.target.value))}
                        className="h-8 text-sm" />
                    </div>
                  </div>
                  {/* Dinamička extra polja iz trainer settings */}
                  {extraFields.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {extraFields.map(f => (
                        <div key={f.key}>
                          <Label className="text-xs">
                            {f.label} {f.unit && <span className="text-gray-400">({f.unit})</span>}
                          </Label>
                          <Input
                            value={ex.extras?.[f.key] || ''}
                            onChange={e => updateExtra(ex.exercise_id, f.key, e.target.value)}
                            placeholder={f.desc}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">{t('notes')}</Label>
                    <Input value={ex.notes}
                      onChange={e => updateExercise(ex.exercise_id, 'notes', e.target.value)}
                      className="h-8 text-sm" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
            <Button type="submit" disabled={loading || selected.length === 0} className="flex-1">
              {loading ? tCommon('saving') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
