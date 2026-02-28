'use client'

import { useEffect, useState } from 'react'
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

type Client = {
  id: string
  full_name: string
}

export default function AddMealPlanDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '',
    client_id: '',
    calories_target: '',
    protein_target: '',
    carbs_target: '',
    fat_target: '',
  })
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) fetchClients()
  }, [open])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select(`id, profiles!clients_user_id_fkey (full_name)`)
      .eq('trainer_id', user.id)
      .eq('active', true)

    if (data) {
      setClients(data.map((c: any) => ({
        id: c.id,
        full_name: c.profiles?.full_name || 'Bez imena'
      })))
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('meal_plans')
      .insert({
        trainer_id: user.id,
        client_id: form.client_id || null,
        name: form.name,
        calories_target: form.calories_target ? parseInt(form.calories_target) : null,
        protein_target: form.protein_target ? parseInt(form.protein_target) : null,
        carbs_target: form.carbs_target ? parseInt(form.carbs_target) : null,
        fat_target: form.fat_target ? parseInt(form.fat_target) : null,
      })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
    setForm({ name: '', client_id: '', calories_target: '', protein_target: '', carbs_target: '', fat_target: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novi plan prehrane</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Naziv plana</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cutting plan, Bulk plan..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Klijent</Label>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Odaberi klijenta...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kalorije (kcal)</Label>
              <Input type="number" value={form.calories_target} onChange={(e) => setForm({ ...form, calories_target: e.target.value })} placeholder="2000" />
            </div>
            <div className="space-y-2">
              <Label>Proteini (g)</Label>
              <Input type="number" value={form.protein_target} onChange={(e) => setForm({ ...form, protein_target: e.target.value })} placeholder="150" />
            </div>
            <div className="space-y-2">
              <Label>Ugljikohidrati (g)</Label>
              <Input type="number" value={form.carbs_target} onChange={(e) => setForm({ ...form, carbs_target: e.target.value })} placeholder="200" />
            </div>
            <div className="space-y-2">
              <Label>Masti (g)</Label>
              <Input type="number" value={form.fat_target} onChange={(e) => setForm({ ...form, fat_target: e.target.value })} placeholder="70" />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Spremanje...' : 'Kreiraj plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}