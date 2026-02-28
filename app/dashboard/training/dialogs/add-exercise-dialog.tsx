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

const CATEGORIES = ['Snaga', 'Kardio', 'Mobilnost', 'HIIT', 'Ostalo']

export default function AddExerciseDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '',
    category: 'Snaga',
    muscle_group: '',
    description: '',
    video_url: '',
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
      .from('exercises')
      .insert({
        trainer_id: user.id,
        name: form.name,
        category: form.category,
        muscle_group: form.muscle_group || null,
        description: form.description || null,
        video_url: form.video_url || null,
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
    setForm({ name: '', category: 'Snaga', muscle_group: '', description: '', video_url: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj vježbu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Naziv vježbe</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bench press"
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
          <div className="space-y-2">
            <Label>Mišićna grupa</Label>
            <Input
              value={form.muscle_group}
              onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}
              placeholder="Prsa, triceps..."
            />
          </div>
          <div className="space-y-2">
            <Label>Opis</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Kratki opis tehnike..."
            />
          </div>
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
              placeholder="https://youtube.com/..."
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Odustani
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Dodavanje...' : 'Dodaj vježbu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}