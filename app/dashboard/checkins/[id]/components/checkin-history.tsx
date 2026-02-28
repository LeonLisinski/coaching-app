'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

type Props = { clientId: string }

type Parameter = {
  id: string
  name: string
  type: string
  unit: string | null
}

type Checkin = {
  id: string
  date: string
  values: Record<string, any>
  trainer_note: string | null
  trainer_comment: string | null
}

export default function CheckinHistory({ clientId }: Props) {
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: params }, { data: checkinsData }] = await Promise.all([
      supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('order_index'),
      supabase.from('checkins').select('*').eq('client_id', clientId).order('date', { ascending: false })
    ])

    if (params) setParameters(params)
    if (checkinsData) setCheckins(checkinsData)
    setLoading(false)
  }

  const filtered = checkins.filter(c =>
    c.date.includes(search) ||
    Object.values(c.values).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  )

  // Grupiraj po mjesecu
  const grouped = filtered.reduce((acc, checkin) => {
    const month = checkin.date.slice(0, 7)
    if (!acc[month]) acc[month] = []
    acc[month].push(checkin)
    return acc
  }, {} as Record<string, Checkin[]>)

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Pretraži povijest..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <p className="text-sm text-gray-500">{checkins.length} checkina ukupno</p>

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            Nema checkina
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([month, monthCheckins]) => (
          <div key={month} className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {new Date(month + '-01').toLocaleDateString('hr-HR', { month: 'long', year: 'numeric' })}
            </p>
            {monthCheckins.map(checkin => (
              <Card
                key={checkin.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setExpanded(expanded === checkin.id ? null : checkin.id)}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <p className="text-sm font-medium">
                        {new Date(checkin.date).toLocaleDateString('hr-HR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {parameters.slice(0, 2).map(param => {
                        const val = checkin.values[param.id]
                        if (!val) return null
                        return (
                          <Badge key={param.id} variant="outline" className="text-xs">
                            {param.name}: {val}{param.unit ? ` ${param.unit}` : ''}
                          </Badge>
                        )
                      })}
                      {checkin.trainer_note && <span className="text-xs">📝</span>}
                    </div>
                  </div>

                  {expanded === checkin.id && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        {parameters.map(param => {
                          const val = checkin.values[param.id]
                          if (val === undefined || val === null || val === '') return null
                          return (
                            <div key={param.id} className="bg-gray-50 rounded p-2">
                              <p className="text-xs text-gray-500">{param.name}</p>
                              <p className="text-sm font-medium">
                                {param.type === 'boolean' ? (val ? 'Da' : 'Ne') : `${val}${param.unit ? ` ${param.unit}` : ''}`}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                      {checkin.trainer_note && (
                        <div className="bg-yellow-50 rounded p-2">
                          <p className="text-xs text-gray-500">📝 Bilješka</p>
                          <p className="text-sm">{checkin.trainer_note}</p>
                        </div>
                      )}
                      {checkin.trainer_comment && (
                        <div className="bg-blue-50 rounded p-2">
                          <p className="text-xs text-gray-500">💬 Komentar klijentu</p>
                          <p className="text-sm">{checkin.trainer_comment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  )
}