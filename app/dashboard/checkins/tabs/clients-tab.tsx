'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type ClientCheckin = {
  id: string
  full_name: string
  checkin_day: number | null
  last_checkin: string | null
  status: 'submitted' | 'late' | 'neutral'
}

function getStatus(checkinDay: number | null, lastCheckin: string | null): 'submitted' | 'late' | 'neutral' {
  if (checkinDay === null) return 'neutral'
  const today = new Date()
  const daysAgo = (today.getDay() - checkinDay + 7) % 7
  const expected = new Date(today)
  expected.setDate(today.getDate() - daysAgo)
  expected.setHours(0, 0, 0, 0)
  if (!lastCheckin) return 'late'
  const last = new Date(lastCheckin)
  last.setHours(0, 0, 0, 0)
  return last >= expected ? 'submitted' : 'late'
}

const STATUS_DOT = { submitted: 'bg-green-500', late: 'bg-red-500', neutral: 'bg-gray-300' }
const STATUS_TEXT = { submitted: 'text-green-600', late: 'text-red-500', neutral: 'text-gray-400' }

export default function ClientsCheckinTab() {
  const locale = useLocale()
  const t = useTranslations('checkins.clientsTab')
  const tDays = useTranslations('days')
  const tDaysShort = useTranslations('daysShort')
  const SORT_OPTIONS = [
    { value: 'name_asc', label: t('sortAZ') },
    { value: 'name_desc', label: t('sortZA') },
    { value: 'day_asc', label: t('sortDay') },
    { value: 'status', label: t('sortStatus') },
  ]
  const STATUS_LABEL = { submitted: t('statuses.onTime'), late: t('statuses.late'), neutral: t('statuses.noConfig') }
  const [clients, setClients] = useState<ClientCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name_asc')
  const [dayFilter, setDayFilter] = useState<'all' | number>('all')
  const [showFilters, setShowFilters] = useState(false)
  const router = useRouter()

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: clientsData } = await supabase.from('clients')
      .select(`id, profiles!clients_user_id_fkey (full_name)`)
      .eq('trainer_id', user.id).eq('active', true)
    if (!clientsData) return
    const clientIds = clientsData.map(c => c.id)
    const [{ data: configs }, { data: lastCheckins }] = await Promise.all([
      supabase.from('checkin_config').select('client_id, checkin_day').in('client_id', clientIds),
      supabase.from('checkins').select('client_id, date').in('client_id', clientIds).order('date', { ascending: false }),
    ])
    const configMap: Record<string, number | null> = {}
    configs?.forEach(c => { configMap[c.client_id] = c.checkin_day })
    const lastMap: Record<string, string> = {}
    lastCheckins?.forEach(c => { if (!lastMap[c.client_id]) lastMap[c.client_id] = c.date })
    setClients(clientsData.map((c: any) => {
      const checkinDay = configMap[c.id] ?? null
      const lastCheckin = lastMap[c.id] || null
      return { id: c.id, full_name: c.profiles?.full_name || '—', checkin_day: checkinDay, last_checkin: lastCheckin, status: getStatus(checkinDay, lastCheckin) }
    }))
    setLoading(false)
  }

  const activeFilterCount = (sort !== 'name_asc' ? 1 : 0) + (dayFilter !== 'all' ? 1 : 0)

  const clearFilters = () => { setSort('name_asc'); setDayFilter('all') }

  const filtered = clients
    .filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()) && (dayFilter === 'all' || c.checkin_day === dayFilter))
    .sort((a, b) => {
      if (sort === 'name_asc') return a.full_name.localeCompare(b.full_name)
      if (sort === 'name_desc') return b.full_name.localeCompare(a.full_name)
      if (sort === 'day_asc') return (a.checkin_day ?? 99) - (b.checkin_day ?? 99)
      if (sort === 'status') return ({ late: 0, neutral: 1, submitted: 2 }[a.status]) - ({ late: 0, neutral: 1, submitted: 2 }[b.status])
      return 0
    })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('clientCount', { filtered: filtered.length, total: clients.length })}</p>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="flex items-center gap-2">
          <SlidersHorizontal size={14} />
          {t('filters')}
          {activeFilterCount > 0 && (
            <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('sortLabel')}</p>
            <div className="flex gap-2 flex-wrap">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSort(opt.value)} style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 13,
                  fontWeight: sort === opt.value ? 600 : 400,
                  backgroundColor: sort === opt.value ? '#111827' : 'white',
                  color: sort === opt.value ? 'white' : '#374151',
                  border: `1px solid ${sort === opt.value ? '#111827' : '#e5e7eb'}`, cursor: 'pointer',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('dayLabel')}</p>
            <div className="flex gap-2 flex-wrap">
              {['all', 0,1,2,3,4,5,6].map(d => (
                <button key={String(d)} onClick={() => setDayFilter(d as any)} style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 13,
                  fontWeight: dayFilter === d ? 600 : 400,
                  backgroundColor: dayFilter === d ? '#111827' : 'white',
                  color: dayFilter === d ? 'white' : '#374151',
                  border: `1px solid ${dayFilter === d ? '#111827' : '#e5e7eb'}`, cursor: 'pointer',
                }}>{d === 'all' ? t('allDays') : tDaysShort(String(d))}</button>
              ))}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ fontSize: 12, color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> {t('resetFilters')}
            </button>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">{t('activeFilters')}</span>
          {sort !== 'name_asc' && (
            <button onClick={() => setSort('name_asc')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: '#111827', color: 'white', border: 'none', cursor: 'pointer' }}>
              {SORT_OPTIONS.find(o => o.value === sort)?.label} <X size={10} />
            </button>
          )}
          {dayFilter !== 'all' && (
            <button onClick={() => setDayFilter('all')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: '#111827', color: 'white', border: 'none', cursor: 'pointer' }}>
              {tDays(String(dayFilter))} <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-500 text-sm">{t('noClients')}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(client => (
            <Card key={client.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => router.push(`/dashboard/checkins/${client.id}`)}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[client.status]}`} />
                  <div>
                    <p className="font-medium text-sm">{client.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {client.checkin_day !== null ? `${t('checkinPrefix')} ${tDays(String(client.checkin_day))}` : t('noDay')}
                      {client.last_checkin && ` · ${t('lastPrefix')} ${new Date(client.last_checkin).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${STATUS_TEXT[client.status]}`}>{STATUS_LABEL[client.status]}</span>
                  <Button variant="outline" size="sm">{t('viewClient')}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
