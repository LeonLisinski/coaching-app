'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EQUIPMENT_CATEGORIES, MUSCLE_GROUPS } from '../tabs/exercises-tab'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

export default function AddExerciseDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '', category: 'Slobodni utezi', muscle_group: 'Prsa',
    description: '', video_url: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('exercises').insert({
      trainer_id: user.id,
      is_default: false,
      name: form.name,
      category: form.category,
      muscle_group: form.muscle_group || null,
      description: form.description || null,
      video_url: form.video_url || null,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    onSuccess()
    onClose()
    setForm({ name: '', category: 'Slobodni utezi', muscle_group: 'Prsa', description: '', video_url: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dodaj vježbu</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Naziv</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="npr. Bench press" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mišićna grupa</Label>
              <select value={form.muscle_group} onChange={e => setForm({ ...form, muscle_group: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm">
                {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Oprema</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm">
                {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Opis <span className="text-gray-400 font-normal text-xs">(opcionalno)</span></Label>
            <textarea value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Kratki opis tehnike izvedbe..."
              className="w-full border rounded-md px-3 py-2 text-sm resize-none h-20" />
          </div>
          <div className="space-y-2">
            <Label>Video URL <span className="text-gray-400 font-normal text-xs">(opcionalno)</span></Label>
            <Input value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })}
              placeholder="https://youtube.com/..." />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Sprema...' : 'Spremi'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
