'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Exercise, EQUIPMENT_CATEGORIES, MUSCLE_GROUPS } from '../tabs/exercises-tab'

type Props = { exercise: Exercise; open: boolean; onClose: () => void; onSuccess: () => void }

export default function EditExerciseDialog({ exercise, open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: exercise.name,
    category: exercise.category || 'Slobodni utezi',
    muscle_group: exercise.muscle_group || 'Prsa',
    description: exercise.description || '',
    video_url: exercise.video_url || '',
    exercise_type: (exercise.exercise_type || 'strength') as 'strength' | 'endurance',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isFork = exercise.is_default

  // FIX: reset forme kad se promijeni exercise prop
  useEffect(() => {
    if (open) {
      setForm({
        name: exercise.name,
        category: exercise.category || 'Slobodni utezi',
        muscle_group: exercise.muscle_group || 'Prsa',
        description: exercise.description || '',
        video_url: exercise.video_url || '',
        exercise_type: (exercise.exercise_type || 'strength') as 'strength' | 'endurance',
      })
      setError('')
    }
  }, [open, exercise.id])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      name: form.name,
      category: form.category,
      muscle_group: form.muscle_group || null,
      description: form.description || null,
      video_url: form.video_url || null,
      exercise_type: form.exercise_type,
    }

    if (isFork) {
      const { error: insertErr } = await supabase.from('exercises').insert({
        ...payload, trainer_id: user.id, is_default: false,
      })
      if (insertErr) { setError(insertErr.message); setLoading(false); return }
      await supabase.from('trainer_overrides').insert({
        trainer_id: user.id, resource_type: 'exercise', default_id: exercise.id,
      })
    } else {
      const { error: updateErr } = await supabase.from('exercises').update(payload).eq('id', exercise.id)
      if (updateErr) { setError(updateErr.message); setLoading(false); return }
    }

    setLoading(false)
    onSuccess()
    onClose() // FIX: zatvori dialog nakon uspješnog save
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFork ? 'Prilagodi vježbu' : 'Uredi vježbu'}</DialogTitle>
          {isFork && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md mt-1">
              Uređuješ default vježbu. Bit će kreirana tvoja verzija, a original će biti sakriven.
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Naziv</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>

          {/* Tip vježbe */}
          <div className="space-y-1.5">
            <Label>Tip vježbe</Label>
            <div className="flex gap-2">
              {(['strength', 'endurance'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, exercise_type: t }))}
                  className={`text-xs px-4 py-1.5 rounded-full border transition-colors ${form.exercise_type === t ? 'bg-gray-900 text-white border-gray-900 font-semibold' : 'text-gray-500 border-gray-300 hover:border-gray-400'}`}>
                  {t === 'strength' ? 'Snaga (serije×ponav.)' : 'Izdržljivost (serije×min)'}
                </button>
              ))}
            </div>
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
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Sprema...' : isFork ? 'Spremi kao moju' : 'Spremi promjene'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
