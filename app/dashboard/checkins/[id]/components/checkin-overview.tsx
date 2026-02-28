'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = { clientId: string }

type Parameter = {
  id: string
  name: string
  type: string
  unit: string | null
  options: string[] | null
}

type Checkin = {
  id: string
  date: string
  values: Record<string, any>
  trainer_note: string | null
  trainer_comment: string | null
}

function getWeekRange(offset: number = 0) {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function formatDate(d: Date) {
  return d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function CheckinOverview({ clientId }: Props) {
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [trainerNote, setTrainerNote] = useState('')
  const [trainerComment, setTrainerComment] = useState('')
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { monday, sunday } = getWeekRange(weekOffset)

  useEffect(() => {
    fetchData()
  }, [clientId, weekOffset])

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: params }, { data: checkinsData }] = await Promise.all([
      supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('order_index'),
      supabase.from('checkins').select('*').eq('client_id', clientId)
        .gte('date', isoDate(monday))
        .lte('date', isoDate(sunday))
        .order('date')
    ])

    if (params) setParameters(params)
    if (checkinsData) setCheckins(checkinsData)
    setLoading(false)
  }

  const openCheckin = (checkin: Checkin) => {
    setSelectedCheckin(checkin)
    setTrainerNote(checkin.trainer_note || '')
    setTrainerComment(checkin.trainer_comment || '')
  }

  const saveNotes = async () => {
    if (!selectedCheckin) return
    setSaving(true)
    await supabase.from('checkins').update({
      trainer_note: trainerNote || null,
      trainer_comment: trainerComment || null,
    }).eq('id', selectedCheckin.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchData()
  }

  // Tjedni prosjek za numeričke parametre
  const weeklyAverage = (paramId: string) => {
    const values = checkins
      .map(c => parseFloat(c.values[paramId]))
      .filter(v => !isNaN(v))
    if (values.length === 0) return null
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  return (
    <div className="space-y-4">
      {/* Navigacija tjednom */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft size={14} />
        </Button>
        <p className="text-sm font-medium">
          {formatDate(monday)} — {formatDate(sunday)}
          {weekOffset === 0 && <span className="ml-2 text-xs text-blue-600">(ovaj tjedan)</span>}
        </p>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
          <ChevronRight size={14} />
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : (
        <>
          {/* Tjedni prosjeci */}
          {parameters.filter(p => p.type === 'number').length > 0 && (
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-gray-500 mb-3">Tjedni prosjeci</p>
                <div className="grid grid-cols-3 gap-3">
                  {parameters.filter(p => p.type === 'number').map(param => {
                    const avg = weeklyAverage(param.id)
                    return (
                      <div key={param.id} className="text-center">
                        <p className="text-xs text-gray-400">{param.name}</p>
                        <p className="font-semibold text-sm">
                          {avg !== null ? `${avg}${param.unit ? ` ${param.unit}` : ''}` : '—'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dnevni checkini */}
          <div className="grid grid-cols-1 gap-2">
            {days.map(day => {
              const checkin = checkins.find(c => c.date === isoDate(day))
              const isToday = isoDate(day) === isoDate(new Date())
              return (
                <Card
                  key={isoDate(day)}
                  className={`transition-shadow ${checkin ? 'cursor-pointer hover:shadow-sm' : 'opacity-60'} ${isToday ? 'border-blue-200' : ''}`}
                  onClick={() => checkin && openCheckin(checkin)}
                >
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${checkin ? 'bg-green-500' : 'bg-gray-200'}`} />
                      <div>
                        <p className="text-sm font-medium">
                          {day.toLocaleDateString('hr-HR', { weekday: 'long' })}
                          {isToday && <span className="ml-2 text-xs text-blue-600">danas</span>}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(day)}</p>
                      </div>
                    </div>
                    {checkin ? (
                      <div className="flex items-center gap-2">
                        {parameters.slice(0, 3).map(param => {
                          const val = checkin.values[param.id]
                          if (val === undefined || val === null || val === '') return null
                          return (
                            <Badge key={param.id} variant="outline" className="text-xs">
                              {param.name}: {val}{param.unit ? ` ${param.unit}` : ''}
                            </Badge>
                          )
                        })}
                        {checkin.trainer_note && <span className="text-xs text-gray-400">📝</span>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Nije uneseno</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Detalji odabranog checkina */}
          {selectedCheckin && (
            <Card className="border-blue-200">
              <CardContent className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">
                    {new Date(selectedCheckin.date).toLocaleDateString('hr-HR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCheckin(null)}>✕</Button>
                </div>

                {/* Vrijednosti */}
                <div className="grid grid-cols-2 gap-3">
                  {parameters.map(param => {
                    const val = selectedCheckin.values[param.id]
                    if (val === undefined || val === null || val === '') return null
                    return (
                      <div key={param.id} className="bg-gray-50 rounded-md p-2">
                        <p className="text-xs text-gray-500">{param.name}</p>
                        <p className="font-medium text-sm">
                          {param.type === 'boolean' ? (val ? 'Da' : 'Ne') : `${val}${param.unit ? ` ${param.unit}` : ''}`}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Bilješka trenera */}
                <div className="space-y-2">
                  <Label className="text-xs">Bilješka (privatna)</Label>
                  <textarea
                    value={trainerNote}
                    onChange={(e) => setTrainerNote(e.target.value)}
                    placeholder="Bilješka samo za tebe..."
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-16 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Komentar klijentu</Label>
                  <textarea
                    value={trainerComment}
                    onChange={(e) => setTrainerComment(e.target.value)}
                    placeholder="Komentar koji će klijent vidjeti..."
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-16 resize-none"
                  />
                </div>

                <Button onClick={saveNotes} disabled={saving} size="sm" className="w-full">
                  {saving ? 'Spremanje...' : saved ? '✓ Spremljeno!' : 'Spremi bilješke'}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}