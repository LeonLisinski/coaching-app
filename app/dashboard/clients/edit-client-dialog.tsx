'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Client = {
  id: string
  full_name: string
  goal: string | null
  date_of_birth: string | null
  weight: number | null
  height: number | null
  start_date: string | null
  active: boolean
}

type Props = {
  client: Client
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditClientDialog({ client, open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    full_name: client.full_name,
    goal: client.goal || '',
    date_of_birth: client.date_of_birth || '',
    weight: client.weight?.toString() || '',
    height: client.height?.toString() || '',
    start_date: client.start_date || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Update profile (full_name)
    const { data: clientData } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', client.id)
      .single()

    if (clientData) {
      await supabase
        .from('profiles')
        .update({ full_name: form.full_name })
        .eq('id', clientData.user_id)
    }

    // Update client record
    const { error } = await supabase
      .from('clients')
      .update({
        goal: form.goal || null,
        date_of_birth: form.date_of_birth || null,
        weight: form.weight ? parseFloat(form.weight) : null,
        height: form.height ? parseFloat(form.height) : null,
        start_date: form.start_date || null,
      })
      .eq('id', client.id)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Uredi klijenta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Ime i prezime</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Cilj</Label>
            <Input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Mršavljenje, nabava mišića..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Težina (kg)</Label>
              <Input
                type="number"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Visina (cm)</Label>
              <Input
                type="number"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum rođenja</Label>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Početak suradnje</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Odustani</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Spremanje...' : 'Spremi promjene'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}