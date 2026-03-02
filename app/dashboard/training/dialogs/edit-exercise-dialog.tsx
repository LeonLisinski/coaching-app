'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Exercise = {
  id: string
  name: string
  category: string
  muscle_group: string
  description: string
  video_url: string
}

type Props = {
  exercise: Exercise
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIES = ['Snaga', 'Kardio', 'Mobilnost', 'HIIT', 'Ostalo']

export default function EditExerciseDialog({ exercise, open, onClose, onSuccess }: Props) {
  const t = useTranslations('training.dialogs.exercise')
  const tCat = useTranslations('training.exercisesTab.categories')
  const tCommon = useTranslations('common')

  const [form, setForm] = useState({
    name: exercise.name,
    category: exercise.category,
    muscle_group: exercise.muscle_group || '',
    description: exercise.description || '',
    video_url: exercise.video_url || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase
      .from('exercises')
      .update({
        name: form.name,
        category: form.category,
        muscle_group: form.muscle_group || null,
        description: form.description || null,
        video_url: form.video_url || null,
      })
      .eq('id', exercise.id)

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
                <option key={cat} value={cat}>{tCat(cat as any)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('muscleGroup')}</Label>
            <Input
              value={form.muscle_group}
              onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('description')}</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
            />
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
