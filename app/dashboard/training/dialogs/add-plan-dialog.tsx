'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type Template = {
  id: string
  name: string
  exercises: any[]
}

type PlanDay = {
  day_number: number
  name: string
  template_id: string | null
  exercises: any[]
}

export default function AddPlanDialog({ open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState<PlanDay[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) fetchTemplates()
  }, [open])

  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name, exercises')
      .eq('trainer_id', user.id)
      .order('name')
    if (data) setTemplates(data)
  }

  const addDay = () => {
    setDays([...days, {
      day_number: days.length + 1,
      name: `Dan ${days.length + 1}`,
      template_id: null,
      exercises: []
    }])
  }

  const removeDay = (index: number) => {
    const updated = days.filter((_, i) => i !== index).map((d, i) => ({
      ...d,
      day_number: i + 1
    }))
    setDays(updated)
  }

  const updateDay = (index: number, field: string, value: any) => {
    setDays(days.map((d, i) => {
      if (i !== index) return d
      if (field === 'template_id') {
        const template = templates.find(t => t.id === value)
        return { ...d, template_id: value, exercises: template?.exercises || [] }
      }
      return { ...d, [field]: value }
    }))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('workout_plans')
      .insert({
        trainer_id: user.id,
        name,
        description: description || null,
        days,
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
    setName('')
    setDescription('')
    setDays([])
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novi plan treninga</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Naziv plana</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PPL Program, Full Body..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="3 dana tjedno, srednja razina..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Dani treninga ({days.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDay} className="flex items-center gap-1">
                <Plus size={12} />
                Dodaj dan
              </Button>
            </div>

            {days.map((day, index) => (
              <div key={index} className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Dan {day.day_number}</span>
                  <button type="button" onClick={() => removeDay(index)}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Naziv dana</Label>
                    <Input
                      value={day.name}
                      onChange={(e) => updateDay(index, 'name', e.target.value)}
                      placeholder="Push, Pull, Legs..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Predložak (opcionalno)</Label>
                    <select
                      value={day.template_id || ''}
                      onChange={(e) => updateDay(index, 'template_id', e.target.value || null)}
                      className="w-full border rounded-md px-3 py-1.5 text-sm h-8"
                    >
                      <option value="">Bez predloška</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.exercises?.length || 0} vježbi)</option>
                      ))}
                    </select>
                  </div>
                </div>
                {day.exercises.length > 0 && (
                  <p className="text-xs text-gray-400">✓ {day.exercises.length} vježbi iz predloška</p>
                )}
              </div>
            ))}

            {days.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Dodaj dane treninga klikom na gumb iznad</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading || days.length === 0} className="flex-1">
              {loading ? 'Spremanje...' : 'Spremi plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}