'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddClientDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    goal: '',
    date_of_birth: '',
    weight: '',
    height: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user: trainer } } = await supabase.auth.getUser()
    if (!trainer) return

    // 1. Kreiraj auth usera za klijenta
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      user_metadata: {
        full_name: form.full_name,
        role: 'client'
      }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Kreiraj clients red
    const { error: clientError } = await supabase
      .from('clients')
      .insert({
        trainer_id: trainer.id,
        user_id: authData.user.id,
        goal: form.goal,
        date_of_birth: form.date_of_birth || null,
        weight: form.weight ? parseFloat(form.weight) : null,
        height: form.height ? parseFloat(form.height) : null,
      })

    if (clientError) {
      setError(clientError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
    setForm({ full_name: '', email: '', password: '', goal: '', date_of_birth: '', weight: '', height: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj novog klijenta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Ime i prezime</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Ivan Horvat"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ivan@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Lozinka</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimalno 6 znakova"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Cilj</Label>
            <Input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Mršavljenje, izgradnja mišića..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Težina (kg)</Label>
              <Input
                type="number"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="80"
              />
            </div>
            <div className="space-y-2">
              <Label>Visina (cm)</Label>
              <Input
                type="number"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
                placeholder="180"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Datum rođenja</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Odustani
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Dodavanje...' : 'Dodaj klijenta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}