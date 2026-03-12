'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, SlidersHorizontal, X, ChevronRight, ClipboardList, ChevronDown, Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX_MAP: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type ClientCheckin = {
  id: string
  full_name: string
  gender: string | null
  checkin_day: number | null
  last_checkin: string | null
  status: 'submitted' | 'late' | 'neutral'
}

function getStatus(checkinDay: number | null, lastCheckin: string | null): 'submitted' | 'late' | 'neutral' {
  if (checkinDay === null) return 'neutral'
  const today = new Date()
  let daysAgo = (today.getDay() - checkinDay + 7) % 7
  if (daysAgo === 0) daysAgo = 7
  const expected = new Date(today)
  expected.setDate(today.getDate() - daysAgo)
  const yyyy = expected.getFullYear()
  const mm   = String(expected.getMonth() + 1).padStart(2, '0')
  const dd   = String(expected.getDate()).padStart(2, '0')
  const expectedStr = `${yyyy}-${mm}-${dd}`
  if (!lastCheckin) return 'late'
  return lastCheckin >= expectedStr ? 'submitted' : 'late'
}

const STATUS_CONFIG = {
  submitted: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Predano' },
  late:      { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600 border-red-200',             label: 'Kasni' },
  neutral:   { dot: 'bg-gray-300',   badge: 'bg-gray-50 text-gray-400 border-gray-200',           label: 'Bez konfiguracije' },
}

const DAY_NAMES_SHORT = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']
const DAY_NAMES_FULL  = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function avatarStyle(gender: string | null): string {
  if (gender === 'F') return 'bg-gradient-to-br from-rose-400 to-pink-500'
  if (gender === 'M') return 'bg-gradient-to-br from-sky-400 to-blue-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-500'
}

export default function ClientsCheckinTab() {
  const locale = useLocale()
  const t = useTranslations('checkins.clientsTab')

  const SORT_OPTIONS = [
    { value: 'name_asc',  label: t('sortAZ') },
    { value: 'name_desc', label: t('sortZA') },
    { value: 'day_asc',   label: t('sortDay') },
    { value: 'status',    label: t('sortStatus') },
  ]

  const [clients, setClients] = useState<ClientCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name_asc')
  const [dayFilter, setDayFilter] = useState<'all' | number>('all')
  const [showFilters, setShowFilters] = useState(false)
  const router = useRouter()
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: clientsData } = await supabase.from('clients')
      .select(`id, gender, profiles!clients_user_id_fkey (full_name)`)
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
      return { id: c.id, full_name: c.profiles?.full_name || '—', gender: c.gender || null, checkin_day: checkinDay, last_checkin: lastCheckin, status: getStatus(checkinDay, lastCheckin) }
    }))
    setLoading(false)
  }

  const hasFilters = sort !== 'name_asc' || dayFilter !== 'all'
  const activeFilterCount = (sort !== 'name_asc' ? 1 : 0) + (dayFilter !== 'all' ? 1 : 0)
  const clearFilters = () => { setSort('name_asc'); setDayFilter('all') }

  const filtered = clients
    .filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()) && (dayFilter === 'all' || c.checkin_day === dayFilter))
    .sort((a, b) => {
      if (sort === 'name_asc')  return a.full_name.localeCompare(b.full_name)
      if (sort === 'name_desc') return b.full_name.localeCompare(a.full_name)
      if (sort === 'day_asc')   return (a.checkin_day ?? 99) - (b.checkin_day ?? 99)
      if (sort === 'status')    return ({ late: 0, neutral: 1, submitted: 2 }[a.status]) - ({ late: 0, neutral: 1, submitted: 2 }[b.status])
      return 0
    })

  return (
    <div className="space-y-3">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-xs">{filtered.length} / {clients.length} klijenata</p>
        <Button
          variant="outline" size="sm"
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${hasFilters ? 'border-teal-300 text-teal-600 bg-teal-50' : ''}`}
        >
          <SlidersHorizontal size={12} />
          Filtriraj
          {activeFilterCount > 0 && (
            <span className="bg-teal-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`pl-9 h-9 text-sm ${search ? 'pr-8' : ''}`}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-teal-50/60 rounded-xl p-3 space-y-3 border border-teal-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('sortLabel')}</p>
            <div className="flex gap-1.5 flex-wrap">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setSort(opt.value)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    sort === opt.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('dayLabel')}</p>
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" onClick={() => setDayFilter('all')}
                className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                  dayFilter === 'all' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                }`}>
                {t('allDays')}
              </button>
              {[0,1,2,3,4,5,6].map(d => (
                <button key={d} type="button" onClick={() => setDayFilter(d)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    dayFilter === d ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                  }`}>
                  {DAY_NAMES_SHORT[d]}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="text-xs text-teal-600 flex items-center gap-1 hover:text-teal-800">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mx-auto mb-2">
            <ClipboardList size={20} className="text-teal-400" />
          </div>
          <p className="text-gray-400 text-sm">{search ? 'Nema rezultata za pretragu' : t('noClients')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(client => {
            const cfg = STATUS_CONFIG[client.status]
            return (
              <div
                key={client.id}
                onClick={() => router.push(`/dashboard/checkins/${client.id}`)}
                className="border border-gray-100 rounded-xl p-3 bg-white hover:shadow-sm hover:border-teal-200 transition-all cursor-pointer select-none group"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl ${avatarStyle(client.gender)} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-xs font-bold">{getInitials(client.full_name)}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{client.full_name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {client.checkin_day !== null
                        ? `Check-in: ${DAY_NAMES_FULL[client.checkin_day]}`
                        : 'Bez konfiguriranog dana'}
                      {client.last_checkin && (
                        <span className="ml-1.5">
                          · Zadnji: {new Date(client.last_checkin).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Status + reminder + arrow */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1`} />
                      {cfg.label}
                    </span>
                    {client.status === 'late' && (
                      <button
                        title="Pošalji podsjetnik"
                        onClick={e => {
                          e.stopPropagation()
                          router.push(`/dashboard/chat?clientId=${client.id}`)
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                        style={{ backgroundColor: `${accentHex}18`, color: accentHex }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${accentHex}30`)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${accentHex}18`)}
                      >
                        <Bell size={12} />
                      </button>
                    )}
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-teal-500 transition-colors" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

