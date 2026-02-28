'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

type Props = { clientId: string }

const DAYS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']
const PHOTO_FREQUENCIES = [
  { value: 'daily', label: 'Svaki dan' },
  { value: 'weekly', label: 'Tjedno' },
  { value: 'biweekly', label: '2x tjedno' },
  { value: 'none', label: 'Bez slika' },
]
const PHOTO_POSITIONS = ['Prednja', 'Bočna', 'Stražnja']

export default function CheckinConfig({ clientId }: Props) {
  const [config, setConfig] = useState({
    checkin_day: 1,
    photo_frequency: 'weekly',
    photo_positions: ['Prednja', 'Bočna', 'Stražnja'],
    notes: '',
  })
  const [configId, setConfigId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [clientId])

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('checkin_config')
      .select('*')
      .eq('client_id', clientId)
      .single()

    if (data) {
      setConfigId(data.id)
      setConfig({
        checkin_day: data.checkin_day ?? 1,
        photo_frequency: data.photo_frequency || 'weekly',
        photo_positions: data.photo_positions || ['Prednja', 'Bočna', 'Stražnja'],
        notes: data.notes || '',
      })
    }
    setLoading(false)
  }

  const togglePosition = (pos: string) => {
    setConfig(prev => ({
      ...prev,
      photo_positions: prev.photo_positions.includes(pos)
        ? prev.photo_positions.filter(p => p !== pos)
        : [...prev.photo_positions, pos]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      trainer_id: user.id,
      client_id: clientId,
      checkin_day: config.checkin_day,
      photo_frequency: config.photo_frequency,
      photo_positions: config.photo_positions,
      notes: config.notes || null,
    }

    if (configId) {
      await supabase.from('checkin_config').update(payload).eq('id', configId)
    } else {
      const { data } = await supabase.from('checkin_config').insert(payload).select('id').single()
      if (data) setConfigId(data.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-gray-500 text-sm">Učitavanje...</p>

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Dan checkina</Label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => (
                <Button
                  key={day}
                  variant={config.checkin_day === i ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConfig({ ...config, checkin_day: i })}
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frekvencija slika</Label>
            <div className="flex gap-2 flex-wrap">
              {PHOTO_FREQUENCIES.map(f => (
                <Button
                  key={f.value}
                  variant={config.photo_frequency === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConfig({ ...config, photo_frequency: f.value })}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {config.photo_frequency !== 'none' && (
            <div className="space-y-2">
              <Label>Pozicije slika</Label>
              <div className="flex gap-2">
                {PHOTO_POSITIONS.map(pos => (
                  <Button
                    key={pos}
                    variant={config.photo_positions.includes(pos) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => togglePosition(pos)}
                  >
                    {pos}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Upute za klijenta</Label>
            <textarea
              value={config.notes}
              onChange={(e) => setConfig({ ...config, notes: e.target.value })}
              placeholder="Npr. Svaki ponedjeljak do 8h očekujem checkin i slike..."
              className="w-full border rounded-md px-3 py-2 text-sm min-h-24 resize-none"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Spremanje...' : saved ? '✓ Spremljeno!' : 'Spremi postavke'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}