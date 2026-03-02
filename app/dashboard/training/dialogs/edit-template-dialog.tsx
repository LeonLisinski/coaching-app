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

type Exercise = {
  id: string
  name: string
  category: string
}

type TemplateExercise = {
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes: string
}

type Template = {
  id: string
  name: string
  description: string
  exercises: TemplateExercise[]
}

type Props = {
  template: Template
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditTemplateDialog({ template, open, onClose, onSuccess }: Props) {
  const t = useTranslations('training.dialogs.template')
  const tCommon = useTranslations('common')
  const tExercises = useTranslations('training.exercisesTab')

  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description || '')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selected, setSelected] = useState<TemplateExercise[]>(template.exercises || [])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) fetchExercises()
  }, [open])

  const fetchExercises = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('exercises')
      .select('id, name, category')
      .eq('trainer_id', user.id)
      .order('name')
    if (data) setExercises(data)
  }

  const addExercise = (exercise: Exercise) => {
    if (selected.find(s => s.exercise_id === exercise.id)) return
    setSelected([...selected, {
      exercise_id: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: '10',
      rest_seconds: 60,
      notes: ''
    }])
    setSearch('')
  }

  const removeExercise = (exercise_id: string) => {
    setSelected(selected.filter(s => s.exercise_id !== exercise_id))
  }

  const updateExercise = (exercise_id: string, field: string, value: any) => {
    setSelected(selected.map(s =>
      s.exercise_id === exercise_id ? { ...s, [field]: value } : s
    ))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase
      .from('workout_templates')
      .update({
        name,
        description: description || null,
        exercises: selected,
      })
      .eq('id', template.id)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
  }

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find(s => s.exercise_id === e.id)
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('addExercise')}</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchExercises')}
            />
            {search && filteredExercises.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredExercises.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => addExercise(e)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between text-sm"
                  >
                    <span>{e.name}</span>
                    <Badge variant="outline" className="text-xs">{tExercises(`categories.${e.category}` as any)}</Badge>
                  </button>
                ))}
              </div>
            )}
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
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">{t('sets')}</Label>
                      <Input
                        type="number"
                        value={ex.sets}
                        onChange={(e) => updateExercise(ex.exercise_id, 'sets', parseInt(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{t('reps')}</Label>
                      <Input
                        value={ex.reps}
                        onChange={(e) => updateExercise(ex.exercise_id, 'reps', e.target.value)}
                        placeholder="10 ili 8-12"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{t('rest')}</Label>
                      <Input
                        type="number"
                        value={ex.rest_seconds}
                        onChange={(e) => updateExercise(ex.exercise_id, 'rest_seconds', parseInt(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">{t('notes')}</Label>
                    <Input
                      value={ex.notes}
                      onChange={(e) => updateExercise(ex.exercise_id, 'notes', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

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
