'use client'
export const dynamic = 'force-dynamic'
import nextDynamic from 'next/dynamic'
import MobileClientsView from '@/app/dashboard/clients/mobile-clients-view'
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsLg } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, UserX, UserCheck, SlidersHorizontal, X, Trash2, ChevronRight, ChevronDown, Users, Copy, Dumbbell, UtensilsCrossed, ClipboardList, Package, LayoutDashboard, AlertTriangle, ChevronUp, TrendingUp, MessageSquare } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useTranslations, useLocale } from 'next-intl'
import { consistencyScore } from '@/lib/checkin-engagement'
import { useAppTheme } from '@/app/contexts/app-theme'

const AddClientDialog  = nextDynamic(() => import('@/app/dashboard/clients/add-client-dialog'),  { ssr: false })
const EditClientDialog = nextDynamic(() => import('@/app/dashboard/clients/edit-client-dialog'), { ssr: false })
const CopyClientDialog = nextDynamic(() => import('@/app/dashboard/clients/copy-client-dialog'), { ssr: false })

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type Client = {
  id: string
  full_name: string
  email: string
  goal: string | null
  weight: number | null
  height: number | null
  date_of_birth: string | null
  start_date: string | null
  active: boolean
  gender: string | null
  notes: string | null
  activePackageName?: string | null
  activePackageColor?: string | null
  packageEndDate?: string | null
  packageDaysLeft?: number | null
  checkin_day?: number | null
  consistency_score?: number
}

function calcPackageDaysLeft(endDate: string | null | undefined): number | null {
  if (!endDate) return null
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return diff
}


type Package = { id: string; name: string; color: string }
type SortKey = 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'weight_asc' | 'weight_desc' | 'age_asc' | 'age_desc' | 'checkin_day_asc' | 'checkin_day_desc'

function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function avatarStyle(gender: string | null, isDark: boolean): { bg: string; text: string } {
  if (isDark) {
    if (gender === 'F') return { bg: 'linear-gradient(135deg, rgba(244,63,94,0.25), rgba(190,18,60,0.18))', text: '#fda4af' }
    if (gender === 'M') return { bg: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(29,78,216,0.18))', text: '#93c5fd' }
    return { bg: 'rgba(255,255,255,0.08)', text: '#9ca3af' }
  }
  if (gender === 'F') return { bg: 'linear-gradient(135deg, #f43f5e, #be123c)', text: 'white' }
  if (gender === 'M') return { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', text: 'white' }
  return { bg: 'linear-gradient(135deg, #6b7280, #4b5563)', text: 'white' }
}

// ─── In-session cache (avoids 2 round-trips on soft navigation back to page) ─
const CLIENTS_STALE_MS = 90_000
let _clientsLastFetch = 0
type ClientsSnap = {
  clients:      Client[]
  packages:     Package[]
  subscription: { plan: string; client_limit: number | null; is_ambassador?: boolean } | null
}
let _clientsSnap: ClientsSnap | null = null

function ClientsPageContent() {
  const t = useTranslations('clients.page')
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('clientDetail')
  const tCP = useTranslations('clientsPage')
  const tDaysShort = useTranslations('daysShort')
  const locale = useLocale()
  const { mode, accent } = useAppTheme()
  const isDark = mode === 'dark'
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'

  // inactive chip style helper
  const inactiveChip = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.06)', color: '#9ca3af', borderColor: 'rgba(255,255,255,0.12)' }
    : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }

  const [clients, setClients] = useState<Client[]>(() => _clientsSnap?.clients ?? [])
  const [packages, setPackages] = useState<Package[]>(() => _clientsSnap?.packages ?? [])
  const [subscription, setSubscription] = useState<{ plan: string; client_limit: number | null; is_ambassador?: boolean } | null>(() => _clientsSnap?.subscription ?? null)
  const [loading, setLoading] = useState(() => !(_clientsSnap && Date.now() - _clientsLastFetch < CLIENTS_STALE_MS))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [genderFilter, setGenderFilter] = useState<'' | 'M' | 'F'>('')
  const [packageFilter, setPackageFilter] = useState('')
  const [ageFrom, setAgeFrom] = useState('')
  const [ageTo, setAgeTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date_desc')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Client | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [upgradeRequired, setUpgradeRequired] = useState<{ plan: string; current: number; limit: number } | null>(null)
  const [overageConfirm, setOverageConfirm] = useState<{ client: Client; info: { currentBlocks: number; newBlocks: number; additionalEur: number; newTotalEur: number; newCount: number } } | null>(null)
  const [copyClient, setCopyClient] = useState<Client | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [checkinTodayOnly, setCheckinTodayOnly] = useState(false)
  const todayDow = new Date().getDay() // 0=Sun … 6=Sat
  const clickTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const router = useRouter()
  const searchParams = useSearchParams()

  const noName = tDetail('noName')

  // All clients are fetched once; status/search/etc are filtered client-side.
  // fetchData is re-called after mutations (add/edit/delete) to bust the cache.
  useEffect(() => { fetchData() }, [])

  // Auto-open add dialog when ?action=add is in URL
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAdd(true)
      router.replace('/dashboard/clients')
    }
  }, [searchParams])

  const fetchData = async (bust = false) => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    // Serve from cache on soft navigation — client-side filters re-apply instantly
    if (!bust && _clientsSnap && Date.now() - _clientsLastFetch < CLIENTS_STALE_MS) {
      setClients(_clientsSnap.clients)
      setPackages(_clientsSnap.packages)
      setSubscription(_clientsSnap.subscription)
      setLoading(false)
      return
    }

    // Single parallel round: embed checkin_config + client_packages directly into the
    // clients query so we avoid a second sequential round-trip.
    const [
      { data: clientData },
      { data: pkgData },
      { data: subData },
      { data: countsData },
    ] = await Promise.all([
      supabase
        .from('clients')
        .select(`id, goal, weight, height, date_of_birth, start_date, active, gender, notes,
          profiles!clients_user_id_fkey(full_name, email),
          checkin_config(checkin_day),
          client_packages(client_id, end_date, status, packages(name, color))`)
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('packages')
        .select('id, name, color')
        .eq('trainer_id', user.id)
        .order('name'),
      supabase
        .from('subscriptions')
        .select('plan, client_limit, is_ambassador')
        .eq('trainer_id', user.id)
        .single(),
      supabase.rpc('get_client_checkin_counts', { trainer_user_id: user.id }),
    ])

    const sub = subData ? { plan: subData.plan, client_limit: subData.client_limit, is_ambassador: subData.is_ambassador } : null
    const pkgs = pkgData || []

    const checkinCountMap: Record<string, number> = {}
    for (const row of (countsData || [])) {
      checkinCountMap[row.client_id] = Number(row.checkin_count)
    }

    const finalClients: Client[] = (clientData || []).map((c: any) => {
      // checkin_config can come back as object or single-item array depending on DB constraints
      const ccRaw = c.checkin_config
      const checkinDay: number | null = Array.isArray(ccRaw)
        ? (ccRaw[0]?.checkin_day ?? null)
        : (ccRaw?.checkin_day ?? null)

      // Find the active package from the embedded array
      const activePkg = (c.client_packages as any[] | null)?.find((p: any) => p.status === 'active')
      const pkgName    = (activePkg?.packages as any)?.name  || null
      const pkgColor   = (activePkg?.packages as any)?.color || null
      const pkgEndDate = activePkg?.end_date || null
      const daysLeft   = pkgEndDate ? calcPackageDaysLeft(pkgEndDate) : null
      const totalCi    = checkinCountMap[c.id] || 0

      return {
        id:                 c.id,
        full_name:          c.profiles?.full_name || noName,
        email:              c.profiles?.email     || '',
        goal:               c.goal,
        weight:             c.weight,
        height:             c.height,
        date_of_birth:      c.date_of_birth,
        start_date:         c.start_date,
        active:             c.active,
        gender:             c.gender,
        notes:              c.notes,
        checkin_day:        checkinDay,
        activePackageName:  pkgName,
        activePackageColor: pkgColor,
        packageEndDate:     pkgEndDate,
        packageDaysLeft:    daysLeft,
        consistency_score:  consistencyScore(totalCi, c.start_date),
      }
    })

    // Persist to module-level cache
    _clientsLastFetch = Date.now()
    _clientsSnap = { clients: finalClients, packages: pkgs, subscription: sub }

    setSubscription(sub)
    setPackages(pkgs)
    setClients(finalClients)
    setLoading(false)
  }

  const toggleStatus = async (client: Client, opts?: { confirm_overage?: boolean }) => {
    setDeleting(true)
    const newActive = !client.active
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/clients/${client.id}/set-active`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActive, confirm_overage: opts?.confirm_overage }),
    })
    const data = await res.json()
    setDeleting(false)

    if (res.status === 402 && data?.error === 'UPGRADE_REQUIRED') {
      setUpgradeRequired({ plan: data.plan, current: data.current, limit: data.limit })
      setConfirmToggle(null)
      return
    }
    if (res.status === 402 && data?.error === 'OVERAGE_CONFIRMATION_REQUIRED') {
      setOverageConfirm({ client, info: data })
      setConfirmToggle(null)
      return
    }
    if (!res.ok) { console.error('[toggleStatus]', data); return }

    setClients(prev => prev.map(c => c.id === client.id ? { ...c, active: newActive } : c))
    setConfirmToggle(null)
    setOverageConfirm(null)
  }

  const deleteClient = async (client: Client) => {
    setDeleting(true)
    // Call the API first (while the clients row still exists for the ownership check)
    // This deletes the auth user, which cascades through profiles → clients → all related rows
    const res = await fetch(`/api/clients/${client.id}/delete`, { method: 'DELETE' })
    if (!res.ok) {
      console.error('[deleteClient] API error:', await res.text().catch(() => res.status))
      setDeleting(false)
      return
    }

    // Safety-net manual cleanup for any tables not fully covered by cascades
    await supabase.from('workout_logs').delete().eq('client_id', client.id)
    await supabase.from('nutrition_logs').delete().eq('client_id', client.id)
    await supabase.from('daily_logs').delete().eq('client_id', client.id)
    await supabase.from('checkins').delete().eq('client_id', client.id)
    await supabase.from('payments').delete().eq('client_id', client.id)
    await supabase.from('client_packages').delete().eq('client_id', client.id)
    await supabase.from('client_meal_plans').delete().eq('client_id', client.id)
    await supabase.from('client_workout_plans').delete().eq('client_id', client.id)
    await supabase.from('checkin_config').delete().eq('client_id', client.id)
    await supabase.from('messages').delete().eq('client_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)

    setDeleting(false)
    setClients(prev => prev.filter(c => c.id !== client.id))
    setConfirmDelete(null)
  }

  const sortLabels: Record<SortKey, string> = {
    name_asc: tCP('sortAZ'), name_desc: tCP('sortZA'),
    date_desc: tCP('sortNewest'), date_asc: tCP('sortOldest'),
    weight_desc: 'Težina ↓', weight_asc: 'Težina ↑',
    age_asc: 'Dob (mlađi)', age_desc: 'Dob (stariji)',
    checkin_day_asc: `${tCP('sortCheckinDay')} ↑`, checkin_day_desc: `${tCP('sortCheckinDay')} ↓`,
  }

  const activeFilterCount = [
    genderFilter !== '',
    packageFilter !== '',
    ageFrom !== '',
    ageTo !== '',
  ].filter(Boolean).length

  const clearFilters = () => {
    setGenderFilter('')
    setPackageFilter('')
    setAgeFrom('')
    setAgeTo('')
  }

  const filtered = useMemo(() => {
    const pkgName = packageFilter ? packages.find(p => p.id === packageFilter)?.name : undefined
    return clients
      .filter(c => {
        const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.active : !c.active)
        const matchGender = !genderFilter || c.gender === genderFilter
        const matchPackage = !pkgName || c.activePackageName === pkgName
        const age = c.date_of_birth ? calcAge(c.date_of_birth) : null
        const matchAgeFrom = !ageFrom || (age !== null && age >= parseInt(ageFrom))
        const matchAgeTo = !ageTo || (age !== null && age <= parseInt(ageTo))
        const matchToday = !checkinTodayOnly || c.checkin_day === todayDow
        return matchSearch && matchStatus && matchGender && matchPackage && matchAgeFrom && matchAgeTo && matchToday
      })
      .sort((a, b) => {
        switch (sortKey) {
          case 'name_asc': return a.full_name.localeCompare(b.full_name, 'hr')
          case 'name_desc': return b.full_name.localeCompare(a.full_name, 'hr')
          case 'date_asc': return (a.start_date || '').localeCompare(b.start_date || '')
          case 'date_desc': return (b.start_date || '').localeCompare(a.start_date || '')
          case 'weight_asc': return (a.weight || 0) - (b.weight || 0)
          case 'weight_desc': return (b.weight || 0) - (a.weight || 0)
          case 'age_asc': return (a.date_of_birth ? calcAge(a.date_of_birth) : 0) - (b.date_of_birth ? calcAge(b.date_of_birth) : 0)
          case 'age_desc': return (b.date_of_birth ? calcAge(b.date_of_birth) : 0) - (a.date_of_birth ? calcAge(a.date_of_birth) : 0)
          case 'checkin_day_asc': return (a.checkin_day ?? 99) - (b.checkin_day ?? 99)
          case 'checkin_day_desc': return (b.checkin_day ?? -1) - (a.checkin_day ?? -1)
          default: return 0
        }
      })
  }, [clients, search, statusFilter, genderFilter, packageFilter, packages, ageFrom, ageTo, sortKey, checkinTodayOnly, todayDow])

  // Persist ordered+filtered client list so the detail page can do prev/next navigation
  useEffect(() => {
    try {
      sessionStorage.setItem('client_nav_list', JSON.stringify(
        filtered.map(c => ({ id: c.id, full_name: c.full_name, gender: c.gender }))
      ))
    } catch {}
  }, [filtered])

  // Count only active clients against the limit; ambassador accounts have no limit
  const activeClientCount = clients.filter(c => c.active !== false).length
  const isAtLimit = subscription !== null
    && !subscription.is_ambassador
    && subscription.client_limit !== null
    && activeClientCount >= subscription.client_limit

  const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', scale: 'Scale' }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Toolbar row 1: search + limit badge + add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-9 h-9 text-sm ${search ? 'pr-8' : ''}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {subscription && (
          <div
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-semibold shrink-0 ${
              isAtLimit
                ? isDark ? 'bg-amber-500/15 border-amber-500/25 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                : isDark ? 'bg-white/[0.04] border-white/10 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            {isAtLimit && <AlertTriangle size={11} className="text-amber-500" />}
            <span>
              {subscription.is_ambassador ? '∞' : `${activeClientCount}/${subscription.client_limit}`}{' '}
              <span className="font-normal opacity-70">{PLAN_LABELS[subscription.plan] ?? subscription.plan}</span>
            </span>
          </div>
        )}

        {isAtLimit ? (
          <Button
            onClick={() => router.push('/dashboard/billing')}
            size="sm"
            className="h-9 flex items-center gap-1.5 px-3.5 text-white shrink-0"
            style={{ backgroundColor: '#d97706' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#b45309')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#d97706')}
          >
            <TrendingUp size={13} /> {tCP('upgradePlan')}
          </Button>
        ) : (
          <Button onClick={() => setShowAdd(true)} size="sm"
            className="h-9 flex items-center gap-1.5 px-3.5 text-white shrink-0"
            style={{ backgroundColor: 'var(--app-accent)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--app-accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--app-accent)')}>
            <Plus size={13} /> {t('addClient')}
          </Button>
        )}
      </div>

      {/* Toolbar row 2: Danas | status pills | filter + sort */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Today quick filter — first and prominent */}
        <button type="button"
          onClick={() => setCheckinTodayOnly(v => !v)}
          className={`flex items-center gap-1.5 h-8 text-xs px-3.5 rounded-lg border font-semibold transition-all ${
            checkinTodayOnly
              ? 'text-white shadow-sm'
              : isDark
                ? 'bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow-sm'
          }`}
          style={checkinTodayOnly ? { backgroundColor: accentHex, borderColor: accentHex } : {}}>
          <span className={`w-1.5 h-1.5 rounded-full ${checkinTodayOnly ? 'bg-white' : isDark ? 'bg-teal-400' : 'bg-teal-500'}`} />
          {t('filterToday')}
        </button>

        {/* Status pills */}
        <div className="flex gap-1">
          {([
            { value: 'active',   label: t('filterActive') },
            { value: 'inactive', label: t('filterInactive') },
            { value: 'all',      label: t('filterAll') },
          ] as const).map(opt => (
            <button key={opt.value} type="button" onClick={() => setStatusFilter(opt.value)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
              style={statusFilter === opt.value
                ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex }
                : inactiveChip
              }>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Right side: Filter + Sort */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Filter button */}
          <Button variant="outline" size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 h-7 text-xs px-2.5 border transition-colors ${isDark ? 'bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/8' : ''}`}
            style={activeFilterCount > 0 ? { borderColor: `${accentHex}50`, color: accentHex, backgroundColor: `${accentHex}15` } : {}}>
            <SlidersHorizontal size={12} />
            {tCP('filterLabel')}
            {activeFilterCount > 0 && (
              <span className="text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center" style={{ backgroundColor: accentHex }}>
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>

          {/* Sort dropdown */}
          <div className="relative">
            <button type="button" onClick={() => setShowSortMenu(v => !v)}
              className={`flex items-center gap-1.5 text-xs h-7 px-2.5 rounded-md border transition-colors font-medium ${isDark ? 'bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/8' : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300'}`}>
            {sortLabels[sortKey]}
            <ChevronDown size={11} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className={`absolute right-0 top-full mt-1 z-20 border rounded-xl shadow-lg min-w-[190px] py-1.5 overflow-hidden ${isDark ? 'bg-[oklch(0.195_0.018_264)] border-white/10' : 'bg-white border-gray-100'}`}>
                {(Object.entries(sortLabels) as [SortKey, string][]).map(([key, label]) => (
                  <button key={key} type="button"
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${isDark ? 'text-gray-300 hover:bg-white/8' : 'text-gray-700 hover:bg-gray-50'}`}
                    style={sortKey === key ? { fontWeight: 600, color: accentHex } : {}}
                    onClick={() => { setSortKey(key); setShowSortMenu(false) }}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Inline filter panel */}
      {showFilters && (
        <div className={`rounded-xl p-3 space-y-3 border ${isDark ? 'bg-white/[0.04] border-white/10' : ''}`}
          style={!isDark ? { backgroundColor: 'var(--app-accent-muted)', borderColor: `color-mix(in srgb, var(--app-accent) 20%, transparent)` } : {}}>
          {/* Gender */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{tCP('filterGender')}</p>
            <div className="flex gap-1.5">
              {([
                ['', tCP('filterGenderAll')],
                ['M', tCP('filterGenderMale')],
                ['F', tCP('filterGenderFemale')],
              ] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setGenderFilter(val)}
                  className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
                  style={genderFilter === val
                    ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex }
                    : inactiveChip
                  }>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Package */}
          {packages.length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{tCP('filterPackage')}</p>
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setPackageFilter('')}
                  className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
                  style={!packageFilter
                    ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex }
                    : inactiveChip
                  }>
                  {tCP('filterAllPackages')}
                </button>
                {packages.map(p => (
                  <button key={p.id} type="button" onClick={() => setPackageFilter(p.id)}
                    className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
                    style={packageFilter === p.id
                      ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex }
                      : inactiveChip
                    }>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Age range */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{tCP('filterAge')}</p>
            <div className="flex items-center gap-2">
              <Input type="number" min="1" max="120" placeholder={tCP('filterAgeFrom')} value={ageFrom}
                onChange={e => setAgeFrom(e.target.value)}
                className={`h-8 text-sm w-24 ${isDark ? 'bg-white/[0.05] border-white/12 text-gray-200 placeholder:text-gray-500' : 'focus:border-violet-300'}`} />
              <span className="text-gray-400 text-sm">–</span>
              <Input type="number" min="1" max="120" placeholder={tCP('filterAgeTo')} value={ageTo}
                onChange={e => setAgeTo(e.target.value)}
                className={`h-8 text-sm w-24 ${isDark ? 'bg-white/[0.05] border-white/12 text-gray-200 placeholder:text-gray-500' : 'focus:border-violet-300'}`} />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="text-xs flex items-center gap-1" style={{ color: accentHex }}>
              <X size={11} /> {tCP('clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-400">{tCP('activeFilters')}</span>
          {genderFilter && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--app-accent-muted)', color: 'var(--app-accent)' }}>
              {genderFilter === 'M' ? tCP('filterGenderMale') : tCP('filterGenderFemale')}
              <button type="button" onClick={() => setGenderFilter('')}><X size={9} /></button>
            </span>
          )}
          {packageFilter && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--app-accent-muted)', color: 'var(--app-accent)' }}>
              {packages.find(p => p.id === packageFilter)?.name}
              <button type="button" onClick={() => setPackageFilter('')}><X size={9} /></button>
            </span>
          )}
          {(ageFrom || ageTo) && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--app-accent-muted)', color: 'var(--app-accent)' }}>
              {tCP('filterAge')}: {ageFrom || '?'}–{ageTo || '?'}{tDetail('ageUnit')}
              <button type="button" onClick={() => { setAgeFrom(''); setAgeTo('') }}><X size={9} /></button>
            </span>
          )}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-gray-500">
        {tCP('clientCount', { filtered: filtered.length, total: clients.length })}
        {isAtLimit && (
          <span className="ml-2 text-amber-600 font-medium">{tCP('limitReached')}</span>
        )}
      </p>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`py-12 text-center border-2 border-dashed rounded-xl ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: isDark ? `${accentHex}20` : 'var(--app-accent-muted)' }}>
            <Users size={20} style={{ color: accentHex }} />
          </div>
          <p className="text-gray-400 text-sm">{t('noClients')}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs font-medium flex items-center gap-1 mx-auto" style={{ color: accentHex }}>
              <Plus size={11} /> {tCP('addFirstClient')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((client) => {
            const age = client.date_of_birth ? calcAge(client.date_of_birth) : null
            const isExpanded = expandedId === client.id
            const daysLeft = client.packageDaysLeft
            const expiryUrgent = daysLeft != null && daysLeft <= 7
            const expiryExpired = daysLeft != null && daysLeft <= 0

            return (
              <div key={client.id}
                className={`border rounded-xl transition-all select-none group ${!client.active ? 'opacity-55' : ''} ${
                  isDark
                    ? isExpanded ? 'border-white/15 bg-white/[0.04]' : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
                    : isExpanded ? 'border-violet-200 shadow-sm bg-white' : 'border-gray-100 bg-white hover:shadow-sm hover:border-violet-200'
                }`}>
                {/* Main row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => {
                    if (clickTimers.current[client.id]) return
                    clickTimers.current[client.id] = setTimeout(() => {
                      delete clickTimers.current[client.id]
                      setExpandedId(isExpanded ? null : client.id)
                    }, 220)
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    if (clickTimers.current[client.id]) {
                      clearTimeout(clickTimers.current[client.id])
                      delete clickTimers.current[client.id]
                    }
                    router.push(`/dashboard/clients/${client.id}`)
                  }}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
                    style={{ background: avatarStyle(client.gender, isDark).bg }}>
                    <span className="text-xs font-bold" style={{ color: avatarStyle(client.gender, isDark).text }}>{getInitials(client.full_name)}</span>
                    {expiryUrgent && (
                      <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center ${expiryExpired ? 'bg-red-500' : 'bg-amber-400'} ${isDark ? 'border-2 border-[oklch(0.195_0.018_264)]' : 'border-2 border-white'}`}>
                        <AlertTriangle size={7} className="text-white" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{client.full_name}</p>
                      {!client.active && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${isDark ? 'bg-white/8 text-gray-400 border-white/10' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {tCommon('inactive')}
                        </span>
                      )}
                      {client.activePackageName && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            backgroundColor: (client.activePackageColor || '#7c3aed') + '25',
                            color: client.activePackageColor || '#7c3aed',
                            border: `1px solid ${(client.activePackageColor || '#7c3aed')}35`,
                          }}>
                          {client.activePackageName}
                        </span>
                      )}
                      {expiryExpired && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${isDark ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-red-50 text-red-600 border-red-200'}`}>
                          {tCP('packageExpired')}
                        </span>
                      )}
                      {!expiryExpired && expiryUrgent && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {tCP('packageExpiresIn', { days: daysLeft! })}
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center text-[11px] flex-wrap gap-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span>{client.email}</span>
                      {client.goal && <><span className={`mx-1.5 ${isDark ? 'text-white/15' : 'text-gray-200'}`}>·</span><span>{client.goal}</span></>}
                      {client.weight && <><span className={`mx-1.5 ${isDark ? 'text-white/15' : 'text-gray-200'}`}>·</span><span>{client.weight}{tDetail('weightUnitFull')}</span></>}
                      {client.height && <><span className={`mx-1.5 ${isDark ? 'text-white/15' : 'text-gray-200'}`}>·</span><span>{client.height}{tDetail('heightUnitFull')}</span></>}
                      {age !== null && <><span className={`mx-1.5 ${isDark ? 'text-white/15' : 'text-gray-200'}`}>·</span><span>{age}{tDetail('ageUnit')}</span></>}
                      {client.start_date && <><span className={`mx-1.5 ${isDark ? 'text-white/15' : 'text-gray-200'}`}>·</span><span>{tCP('datePrefix')} {new Date(client.start_date).toLocaleDateString(locale)}</span></>}
                      {client.checkin_day != null && <><span className={`mx-1.5 ${isDark ? 'text-white/15' : 'text-gray-200'}`}>·</span><span>{tCP('checkinDayPrefix')} {tDaysShort(String(client.checkin_day) as any)}</span></>}
                      {client.consistency_score != null && (
                        <>
                          <span className={`mx-1.5 ${isDark ? 'text-white/15' : 'text-gray-200'}`}>·</span>
                          <span className="inline-flex items-center gap-1" title={tCP('consistencyScoreLabel')}>
                            <span className="w-12 h-1 rounded-full overflow-hidden inline-block align-middle"
                              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
                              <span className="block h-full rounded-full"
                                style={{
                                  width: `${client.consistency_score}%`,
                                  backgroundColor: client.consistency_score >= 70 ? '#34d399' : client.consistency_score >= 40 ? '#fbbf24' : '#fb7185',
                                }} />
                            </span>
                            <span style={{ color: client.consistency_score >= 70 ? '#34d399' : client.consistency_score >= 40 ? '#fbbf24' : '#fb7185' }}
                              className="font-semibold tabular-nums">
                              {client.consistency_score}%
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                    {client.notes && (
                      <p className="text-[11px] text-gray-400 truncate max-w-[380px] italic" title={client.notes}>
                        {client.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : client.id) }}
                      className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-300 group-hover:[color:var(--app-accent)]'}`}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button type="button" title={tCP('copyPlanTooltip')} onClick={(e) => { e.stopPropagation(); setCopyClient(client) }}
                      className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/8' : 'text-gray-400 hover:[color:var(--app-accent)] hover:[background-color:var(--app-accent-muted)]'}`}>
                      <Copy size={13} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditClient(client) }}
                      className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/8' : 'text-gray-400 hover:[color:var(--app-accent)] hover:[background-color:var(--app-accent-muted)]'}`}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmToggle(client) }}
                      className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`}>
                      {client.active
                        ? <UserX size={13} className="text-red-400" />
                        : <UserCheck size={13} className="text-emerald-500" />
                      }
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(client) }}
                      className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Quick-access panel — animated with grid-rows trick */}
                <div
                  className="grid transition-all duration-150 ease-out"
                  style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className={`border-t px-4 py-2.5 space-y-2 ${isDark ? 'border-white/8 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>

                      {/* Row 1 — tab shortcuts + chat */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {([
                          { label: tCP('quickOverview'),   tab: 'pregled',   icon: LayoutDashboard,  color: '#7c3aed' },
                          { label: tCP('quickTraining'),   tab: 'treninzi',  icon: Dumbbell,         color: '#4f46e5' },
                          { label: tCP('quickNutrition'),  tab: 'prehrana',  icon: UtensilsCrossed,  color: '#ea580c' },
                          { label: tCP('quickCheckin'),    tab: 'checkin',   icon: ClipboardList,    color: '#0d9488' },
                          { label: tCP('quickPackages'),   tab: 'paketi',    icon: Package,          color: '#059669' },
                        ] as { label: string; tab: string; icon: typeof LayoutDashboard; color: string }[]).map(({ label, tab, icon: Icon, color }) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/clients/${client.id}?tab=${tab}`) }}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${isDark ? 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/8 hover:border-white/20' : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:shadow-sm'}`}
                          >
                            <Icon size={12} style={{ color }} />
                            {label}
                          </button>
                        ))}
                        {/* Chat shortcut */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/chat?clientId=${client.id}`) }}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${isDark ? 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/8 hover:border-white/20' : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:shadow-sm'}`}
                        >
                          <MessageSquare size={12} style={{ color: '#f59e0b' }} />
                          {tCP('quickChat')}
                        </button>
                      </div>

                      {/* Row 2 — status strip + open profile */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Consistency score */}
                          {client.consistency_score != null && (
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-lg border ${
                              client.consistency_score >= 70
                                ? isDark ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : client.consistency_score >= 40
                                ? isDark ? 'bg-amber-500/12 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                                : isDark ? 'bg-red-500/12 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              <TrendingUp size={10} />
                              {client.consistency_score}% konzist.
                            </span>
                          )}
                          {/* Package expiry */}
                          {client.activePackageName && client.packageEndDate && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-lg font-medium border ${
                              expiryExpired
                                ? isDark ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-red-50 text-red-600 border-red-200'
                                : expiryUrgent
                                  ? isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-amber-50 text-amber-700 border-amber-200'
                                  : isDark ? 'bg-white/5 text-gray-400 border-white/10' : 'bg-white text-gray-500 border-gray-200'
                            }`}>
                              {expiryExpired
                                ? `${tCP('packageExpired')} ${Math.abs(daysLeft!)}d`
                                : `${tCP('packageExpiresFull')} ${new Date(client.packageEndDate).toLocaleDateString(locale)}`
                              }
                            </span>
                          )}
                        </div>
                        {/* Open profile */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/clients/${client.id}`) }}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-colors shrink-0"
                          style={{ backgroundColor: accentHex }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--app-accent-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = accentHex)}
                        >
                          {tCP('openProfile')}
                          <ChevronRight size={12} />
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddClientDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => fetchData(true)}
      />

      {copyClient && (
        <CopyClientDialog
          open={!!copyClient}
          onClose={() => setCopyClient(null)}
          onSuccess={() => { setCopyClient(null); fetchData(true) }}
          sourceClientId={copyClient.id}
          sourceClientName={copyClient.full_name}
        />
      )}

      {editClient && (
        <EditClientDialog
          client={editClient}
          open={!!editClient}
          onClose={() => setEditClient(null)}
          onSuccess={() => { setEditClient(null); fetchData(true) }}
        />
      )}

      <ConfirmDialog
        open={confirmToggle !== null}
        title={tCommon(confirmToggle?.active ? 'inactive' : 'active')}
        description={t(confirmToggle?.active ? 'deactivateConfirm' : 'activateConfirm')}
        onConfirm={() => confirmToggle && toggleStatus(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
        confirmLabel={tCommon(confirmToggle?.active ? 'inactive' : 'active')}
        destructive={confirmToggle?.active}
        loading={deleting}
      />

      {/* Upgrade required modal — Starter/Pro hit limit */}
      <ConfirmDialog
        open={upgradeRequired !== null}
        title="Dostigao si limit plana"
        description={
          <div className="space-y-3">
            <p>Tvoj <strong>{upgradeRequired?.plan === 'starter' ? 'Starter' : 'Pro'}</strong> plan dopušta najviše <strong>{upgradeRequired?.limit}</strong> aktivnih klijenata. Trenutno ih imaš <strong>{upgradeRequired?.current}</strong>.</p>
            <p>Za dodavanje/aktivaciju ovog klijenta nadogradi na <strong>{upgradeRequired?.plan === 'starter' ? 'Pro' : 'Scale'}</strong> plan.</p>
          </div>
        }
        confirmLabel="Otvori plaćanja"
        onConfirm={() => { router.push('/dashboard/billing'); setUpgradeRequired(null) }}
        onCancel={() => setUpgradeRequired(null)}
      />

      {/* Scale overage confirmation modal */}
      <ConfirmDialog
        open={overageConfirm !== null}
        title="Potvrdi dodatni Scale obračun"
        description={
          <div className="space-y-3">
            <p>Aktivacijom ovog klijenta prijeđeš na <strong>{overageConfirm?.info.newCount}</strong> aktivnih klijenata, što ulazi u dodatni Scale obračun.</p>
            <p>
              Nova mjesečna cijena: <strong>€{overageConfirm?.info.newTotalEur}/mj</strong><br/>
              (osnovni Scale €99 + €{overageConfirm?.info.additionalEur} za dodatne klijente)
            </p>
            <p className="text-xs text-gray-500">Overage se obračunava na temelju najvećeg broja aktivnih klijenata dosegnutog u trenutnom billing periodu.</p>
          </div>
        }
        confirmLabel="Potvrdi i aktiviraj"
        onConfirm={() => overageConfirm && toggleStatus(overageConfirm.client, { confirm_overage: true })}
        onCancel={() => setOverageConfirm(null)}
        loading={deleting}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={tDetail('deleteDialogTitle', { name: confirmDelete?.full_name || '' })}
        description={
          <div className="space-y-3">
            <p>Brisanjem ovog klijenta trajno će se ukloniti <span className="font-semibold text-gray-800">svi podaci vezani za njega</span>:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
              <li>Svi check-inovi i fotografije napretka</li>
              <li>Planovi prehrane i treninga</li>
              <li>Paketi i evidencija plaćanja</li>
              <li>Sve poruke u chatu</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2">
              <span className="text-amber-500 text-base leading-none mt-0.5">💡</span>
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{tDetail('deleteDialogRecommend').split(':')[0]}:</span> Umjesto brisanja, razmotrite{' '}
                <button
                  type="button"
                  className="underline font-semibold hover:text-amber-900"
                  onClick={() => {
                    setConfirmDelete(null)
                    if (confirmDelete) setConfirmToggle(confirmDelete)
                  }}
                >
                  deaktivaciju klijenta
                </button>
                . Na taj način zadržavate sve podatke i povijest, ali klijent više nije aktivan.
              </p>
            </div>
            <p className="font-bold text-red-600">{tDetail('deleteDialogWarning')}</p>
            <p className="text-gray-700">Želite li nastaviti s brisanjem klijenta?</p>
          </div>
        }
        onConfirm={() => confirmDelete && deleteClient(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tDetail('deleteDialogConfirm')}
        cancelLabel={tDetail('deleteDialogCancel')}
        destructive
        loading={deleting}
      />
    </div>
  )
}

function MobileClientsPageWrapper() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAdd(true)
      router.replace('/dashboard/clients')
    }
  }, [searchParams])

  return (
    <>
      <MobileClientsView />
      <AddClientDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => setShowAdd(false)}
      />
    </>
  )
}

export default function ClientsPage() {
  const isLg = useIsLg()
  if (isLg === undefined) return null
  if (isLg) return (
    <Suspense fallback={null}>
      <ClientsPageContent />
    </Suspense>
  )
  return (
    <Suspense fallback={null}>
      <MobileClientsPageWrapper />
    </Suspense>
  )
}

