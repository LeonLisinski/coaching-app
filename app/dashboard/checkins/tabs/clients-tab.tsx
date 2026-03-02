'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

type ClientCheckin = {
  id: string
  full_name: string
  checkin_day: number | null
  photo_frequency: string | null
  last_checkin: string | null
  status: 'submitted' | 'late' | 'neutral'
}

const DAYS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']

function getStatus(checkinDay: number | null, lastCheckin: string | null): 'submitted' | 'late' | 'neutral' {
  if (checkinDay === null) return 'neutral'

  const today = new Date()
  const todayDay = today.getDay()

  // Pronađi zadnji očekivani checkin datum
  const daysAgo = (todayDay - checkinDay + 7) % 7
  const expectedDate = new Date(today)
  expectedDate.setDate(today.getDate() - daysAgo)
  expectedDate.setHours(0, 0, 0, 0)

  if (!lastCheckin) return 'late'

  const lastDate = new Date(lastCheckin)
  lastDate.setHours(0, 0, 0, 0)

  if (lastDate >= expectedDate) return 'submitted'
  return 'late'
}

const STATUS_CONFIG = {
  submitted: { label: 'Checkin poslan', color: 'bg-green-500', text: 'text-green-600' },
  late: { label: 'Kasni', color: 'bg-red-500', text: 'text-red-600' },
  neutral: { label: 'Nije konfiguriran', color: 'bg-gray-300', text: 'text-gray-400' },
}

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'A → Z' },
  { value: 'name_desc', label: 'Z → A' },
  { value: 'day_asc', label: 'Dan checkina' },
  { value: 'status', label: 'Status' },
]

const DAY_FILTERS = ['Svi', ...DAYS]

export default function ClientsCheckinTab() {
  const [clients, setClients] = useState<ClientCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name_asc')
  const [dayFilter, setDayFilter] = useState('Svi')
  const router = useRouter()

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: clientsData } = await supabase
      .from('clients')
      .select(`
        id,
        profiles!clients_user_id_fkey (full_name)
      `)
      .eq('trainer_id', user.id)
      .eq('active', true)

    if (!clientsData) return

    const clientIds = clientsData.map(c => c.id)

    // Dohvati config odvojeno — izbjegavamo problematični join
    const { data: configs } = await supabase
      .from('checkin_config')
      .select('client_id, checkin_day, photo_frequency')
      .in('client_id', clientIds)

    const configMap: Record<string, { checkin_day: number | null, photo_frequency: string | null }> = {}
    configs?.forEach(c => {
      configMap[c.client_id] = { checkin_day: c.checkin_day, photo_frequency: c.photo_frequency }
    })

    // Dohvati zadnji checkin
    const { data: lastCheckins } = await supabase
      .from('checkins')
      .select('client_id, date')
      .in('client_id', clientIds)
      .order('date', { ascending: false })

    const lastCheckinMap: Record<string, string> = {}
    lastCheckins?.forEach(c => {
      if (!lastCheckinMap[c.client_id]) {
        lastCheckinMap[c.client_id] = c.date
      }
    })

    const mapped: ClientCheckin[] = clientsData.map((c: any) => {
      const cfg = configMap[c.id] || null
      const checkinDay = cfg?.checkin_day ?? null
      const lastCheckin = lastCheckinMap[c.id] || null
      return {
        id: c.id,
        full_name: c.profiles?.full_name || 'Bez imena',
        checkin_day: checkinDay,
        photo_frequency: cfg?.photo_frequency || null,
        last_checkin: lastCheckin,
        status: getStatus(checkinDay, lastCheckin),
      }
    })

    setClients(mapped)
    setLoading(false)
  }

  const filtered = clients
    .filter(c => {
      const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase())
      const matchDay = dayFilter === 'Svi' || (c.checkin_day !== null && DAYS[c.checkin_day] === dayFilter)
      return matchSearch && matchDay
    })
    .sort((a, b) => {
      if (sort === 'name_asc') return a.full_name.localeCompare(b.full_name)
      if (sort === 'name_desc') return b.full_name.localeCompare(a.full_name)
      if (sort === 'day_asc') return (a.checkin_day ?? 99) - (b.checkin_day ?? 99)
      if (sort === 'status') {
        const order = { late: 0, neutral: 1, submitted: 2 }
        return order[a.status] - order[b.status]
      }
      return 0
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder="Pretraži klijente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Sortiraj:</span>
        {SORT_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant={sort === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSort(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Dan:</span>
        {DAY_FILTERS.map(day => (
          <Button
            key={day}
            variant={dayFilter === day ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDayFilter(day)}
          >
            {day}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            Nema klijenata
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((client) => {
            const status = STATUS_CONFIG[client.status]
            return (
              <Card
                key={client.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/checkins/${client.id}`)}
              >
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                    <div>
                      <p className="font-medium text-sm">{client.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {client.checkin_day !== null
                          ? `Checkin: ${DAYS[client.checkin_day]}`
                          : 'Dan nije postavljen'}
                        {client.last_checkin && ` • Zadnji: ${new Date(client.last_checkin).toLocaleDateString('hr-HR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${status.text}`}>{status.label}</span>
                    <Button variant="outline" size="sm">
                      Pregled
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}