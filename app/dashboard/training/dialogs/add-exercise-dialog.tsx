'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EQUIPMENT_CATEGORIES, MUSCLE_GROUPS } from '../tabs/exercises-tab'
import { useTrainerSettings, EXERCISE_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

export default function AddExerciseDialog({ open, onClose, onSuccess }: Props) {
  const { settings } = useTrainerSettings()
  const [form, setForm] = useState({
    name: '', category: 'Slobodni utezi', muscle_group: 'Prsa',
    description: '', video_url: '', exercise_type: 'strength' as 'strength' | 'endurance',
  })
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const extraFields = EXERCISE_FIELD_OPTIONS.filter(f => settings.exerciseFields.includes(f.key))

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const cleanExtras = Object.fromEntries(
      Object.entries(extras).filter(([_, v]) => v !== '')
    )

    const { error } = await supabase.from('exercises').insert({
      trainer_id: user.id,
      is_default: false,
      name: form.name,
      category: form.category,
      muscle_group: form.muscle_group || null,
      description: form.description || null,
      video_url: form.video_url || null,
      exercise_type: form.exercise_type,
      extras: Object.keys(cleanExtras).length > 0 ? cleanExtras : null,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    onSuccess()
    onClose()
    setForm({ name: '', category: 'Slobodni utezi', muscle_group: 'Prsa', description: '', video_url: '', exercise_type: 'strength' })
    setExtras({})
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

          {/* Dinamična extras polja prema trainer_profiles.exercise_fields */}
          {extraFields.length > 0 && (
            <div className="space-y-2">
              <Label>Dodatne metrike <span className="text-gray-400 font-normal text-xs">(opcionalno)</span></Label>
              <div className="grid grid-cols-2 gap-3">
                {extraFields.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      {f.label} {f.unit && <span className="text-gray-400">({f.unit})</span>}
                    </Label>
                    <Input
                      value={extras[f.key] || ''}
                      onChange={e => setExtras({ ...extras, [f.key]: e.target.value })}
                      placeholder={f.desc}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
