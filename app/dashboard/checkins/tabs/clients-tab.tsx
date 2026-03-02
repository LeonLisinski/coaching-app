'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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

function getStatus(checkinDay: number | null, lastCheckin: string | null): 'submitted' | 'late' | 'neutral' {
  if (checkinDay === null) return 'neutral'

  const today = new Date()
  const todayDay = today.getDay()

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

const STATUS_COLORS = {
  submitted: { color: 'bg-green-500', text: 'text-green-600' },
  late: { color: 'bg-red-500', text: 'text-red-600' },
  neutral: { color: 'bg-gray-300', text: 'text-gray-400' },
}

export default function ClientsCheckinTab() {
  const t = useTranslations('checkins')
  const tDays = useTranslations('days')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [clients, setClients] = useState<ClientCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name_asc')
  const [dayFilter, setDayFilter] = useState<'all' | number>('all')
  const router = useRouter()

  const SORT_OPTIONS = [
    { value: 'name_asc', label: 'A → Z' },
    { value: 'name_desc', label: 'Z → A' },
    { value: 'day_asc', label: t('clientsTab.checkinDay') },
    { value: 'status', label: t('clientsTab.status') },
  ]

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

    const { data: configs } = await supabase
      .from('checkin_config')
      .select('client_id, checkin_day, photo_frequency')
      .in('client_id', clientIds)

    const configMap: Record<string, { checkin_day: number | null, photo_frequency: string | null }> = {}
    configs?.forEach(c => {
      configMap[c.client_id] = { checkin_day: c.checkin_day, photo_frequency: c.photo_frequency }
    })

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
        full_name: c.profiles?.full_name || tCommon('noData'),
        checkin_day: checkinDay,
        photo_frequency: cfg?.photo_frequency || null,
        last_checkin: lastCheckin,
        status: getStatus(checkinDay, lastCheckin),
      }
    })

    setClients(mapped)
    setLoading(false)
  }

  const statusLabel = (status: 'submitted' | 'late' | 'neutral') => {
    const map = {
      submitted: t('clientsTab.statuses.onTime'),
      late: t('clientsTab.statuses.late'),
      neutral: t('clientsTab.statuses.noConfig'),
    }
    return map[status]
  }

  const filtered = clients
    .filter(c => {
      const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase())
      const matchDay = dayFilter === 'all' || c.checkin_day === dayFilter
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
            placeholder={t('clientsTab.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">{t('clientsTab.sortLabel')}</span>
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
        <span className="text-sm text-gray-500">{t('clientsTab.dayLabel')}</span>
        <Button
          variant={dayFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDayFilter('all')}
        >
          {t('clientsTab.allDays')}
        </Button>
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <Button
            key={i}
            variant={dayFilter === i ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDayFilter(i)}
          >
            {tDays(String(i))}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('clientsTab.noClients')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((client) => {
            const colors = STATUS_COLORS[client.status]
            return (
              <Card
                key={client.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/checkins/${client.id}`)}
              >
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.color}`} />
                    <div>
                      <p className="font-medium text-sm">{client.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {client.checkin_day !== null
                          ? `${t('clientsTab.checkinDay')}: ${tDays(String(client.checkin_day))}`
                          : t('clientsTab.noDay')}
                        {client.last_checkin && ` • ${t('clientsTab.lastCheckin')}: ${new Date(client.last_checkin).toLocaleDateString(locale)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${colors.text}`}>{statusLabel(client.status)}</span>
                    <Button variant="outline" size="sm">
                      {t('clientsTab.viewClient')}
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
