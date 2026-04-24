'use client'
export const dynamic = 'force-dynamic'
import MobileClientsView from '@/app/dashboard/clients/mobile-clients-view'
import { useEffect, useRef, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, UserX, UserCheck, SlidersHorizontal, X, Trash2, ChevronRight, ChevronDown, Users, Copy, Dumbbell, UtensilsCrossed, ClipboardList, Package, LayoutDashboard, AlertTriangle, ChevronUp, TrendingUp } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import AddClientDialog from '@/app/dashboard/clients/add-client-dialog'
import EditClientDialog from '@/app/dashboard/clients/edit-client-dialog'
import CopyClientDialog from '@/app/dashboard/clients/copy-client-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useTranslations, useLocale } from 'next-intl'
import { consistencyScore } from '@/lib/checkin-engagement'

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
function avatarStyle(gender: string | null): string {
  if (gender === 'F') return 'bg-gradient-to-br from-rose-400 to-pink-500'
  if (gender === 'M') return 'bg-gradient-to-br from-sky-400 to-blue-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-500'
}

function ClientsPageContent() {
  const t = useTranslations('clients.page')
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('clientDetail')
  const tCP = useTranslations('clientsPage')
  const tDaysShort = useTranslations('daysShort')
  const locale = useLocale()

  const [clients, setClients] = useState<Client[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [subscription, setSubscription] = useState<{ plan: string; client_limit: number } | null>(null)
  const [loading, setLoading] = useState(true)
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
  const [copyClient, setCopyClient] = useState<Client | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const clickTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const router = useRouter()
  const searchParams = useSearchParams()

  const noName = tDetail('noName')

  useEffect(() => { fetchData() }, [])

  // Auto-open add dialog when ?action=add is in URL
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAdd(true)
      router.replace('/dashboard/clients')
    }
  }, [searchParams])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const [{ data: clientData }, { data: pkgData }, { data: subData }] = await Promise.all([
      supabase
        .from('clients')
        .select(`id, goal, weight, height, date_of_birth, start_date, active, gender, notes,
          profiles!clients_user_id_fkey (full_name, email)`)
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('packages')
        .select('id, name, color')
        .eq('trainer_id', user.id)
        .order('name'),
      supabase
        .from('subscriptions')
        .select('plan, client_limit')
        .eq('trainer_id', user.id)
        .single(),
    ])

    setSubscription(subData ? { plan: subData.plan, client_limit: subData.client_limit } : null)

    const rawClients: Client[] = (clientData || []).map((c: any) => ({
      id: c.id,
      full_name: c.profiles?.full_name || noName,
      email: c.profiles?.email || '',
      goal: c.goal, weight: c.weight, height: c.height,
      date_of_birth: c.date_of_birth, start_date: c.start_date,
      active: c.active, gender: c.gender, notes: c.notes,
      checkin_day: null,
    }))

    setPackages(pkgData || [])

    if (rawClients.length === 0) {
      setClients([])
      setLoading(false)
      return
    }

    const clientIds = rawClients.map(c => c.id)

    // Fetch active packages + checkin config in parallel
    const [{ data: cpData }, { data: ccData }, { data: checkinRows }] = await Promise.all([
      supabase
        .from('client_packages')
        .select('client_id, end_date, packages(name, color)')
        .eq('status', 'active')
        .in('client_id', clientIds),
      supabase
        .from('checkin_config')
        .select('client_id, checkin_day')
        .in('client_id', clientIds),
      supabase.from('checkins').select('client_id').in('client_id', clientIds),
    ])

    const checkinCountMap: Record<string, number> = {}
    for (const row of checkinRows || []) {
      checkinCountMap[row.client_id] = (checkinCountMap[row.client_id] || 0) + 1
    }

    const pkgMap: Record<string, { name: string; color: string; end_date: string }> = {}
    for (const cp of (cpData || [])) {
      if (!pkgMap[cp.client_id]) pkgMap[cp.client_id] = { ...(cp.packages as any), end_date: cp.end_date }
    }

    const checkinDayMap: Record<string, number | null> = {}
    for (const cc of (ccData || [])) {
      checkinDayMap[cc.client_id] = cc.checkin_day
    }

    setClients(rawClients.map(c => {
      const pkg = pkgMap[c.id]
      const daysLeft = pkg?.end_date ? calcPackageDaysLeft(pkg.end_date) : null
      const totalCi = checkinCountMap[c.id] || 0
      return {
        ...c,
        activePackageName: pkg?.name || null,
        activePackageColor: pkg?.color || null,
        packageEndDate: pkg?.end_date || null,
        packageDaysLeft: daysLeft,
        checkin_day: checkinDayMap[c.id] ?? null,
        consistency_score: consistencyScore(totalCi, c.start_date),
      }
    }))
    setLoading(false)
  }

  const toggleStatus = async (client: Client) => {
    await supabase.from('clients').update({ active: !client.active }).eq('id', client.id)
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, active: !c.active } : c))
    setConfirmToggle(null)
  }

  const deleteClient = async (client: Client) => {
    // Delete related data first (safety net in case cascades aren't fully set up)
    await supabase.from('checkins').delete().eq('client_id', client.id)
    await supabase.from('payments').delete().eq('client_id', client.id)
    await supabase.from('client_packages').delete().eq('client_id', client.id)
    await supabase.from('client_meal_plans').delete().eq('client_id', client.id)
    await supabase.from('client_workout_plans').delete().eq('client_id', client.id)
    await supabase.from('checkin_config').delete().eq('client_id', client.id)
    await supabase.from('messages').delete().eq('receiver_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)

    // Hard-delete the client's auth user (removes orphaned Supabase account)
    await fetch(`/api/clients/${client.id}/delete`, { method: 'DELETE' })

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

  const filtered = clients
    .filter(c => {
      const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.active : !c.active)
      const matchGender = !genderFilter || c.gender === genderFilter
      const matchPackage = !packageFilter || c.activePackageName === packages.find(p => p.id === packageFilter)?.name
      const age = c.date_of_birth ? calcAge(c.date_of_birth) : null
      const matchAgeFrom = !ageFrom || (age !== null && age >= parseInt(ageFrom))
      const matchAgeTo = !ageTo || (age !== null && age <= parseInt(ageTo))
      return matchSearch && matchStatus && matchGender && matchPackage && matchAgeFrom && matchAgeTo
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

  const isAtLimit = subscription !== null && clients.length >= subscription.client_limit

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
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            {isAtLimit && <AlertTriangle size={11} className="text-amber-500" />}
            <span>
              {clients.length}/{subscription.client_limit}{' '}
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

      {/* Toolbar row 2: status pills + filter + sort */}
      <div className="flex flex-wrap items-center gap-2">
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
                ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }
              }>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filter button */}
        <Button variant="outline" size="sm"
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 h-7 text-xs px-2.5"
          style={activeFilterCount > 0 ? { borderColor: 'var(--app-accent-muted)', color: 'var(--app-accent)', backgroundColor: 'var(--app-accent-muted)' } : {}}>
          <SlidersHorizontal size={12} />
          {tCP('filterLabel')}
          {activeFilterCount > 0 && (
            <span className="text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center" style={{ backgroundColor: 'var(--app-accent)' }}>
              {activeFilterCount}
            </span>
          )}
          <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Button>

        {/* Sort dropdown */}
        <div className="relative ml-auto">
          <button type="button" onClick={() => setShowSortMenu(v => !v)}
            className="flex items-center gap-1.5 text-xs h-7 px-2.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:border-violet-300 transition-colors font-medium">
            {sortLabels[sortKey]}
            <ChevronDown size={11} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-100 rounded-xl shadow-lg min-w-[190px] py-1.5 overflow-hidden">
                {(Object.entries(sortLabels) as [SortKey, string][]).map(([key, label]) => (
                  <button key={key} type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors text-gray-700"
                    style={sortKey === key ? { fontWeight: 600, color: 'var(--app-accent)' } : {}}
                    onClick={() => { setSortKey(key); setShowSortMenu(false) }}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inline filter panel */}
      {showFilters && (
        <div className="rounded-xl p-3 space-y-3 border" style={{ backgroundColor: 'var(--app-accent-muted)', borderColor: 'color-mix(in srgb, var(--app-accent) 20%, transparent)' }}>
          {/* Gender */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{tCP('filterGender')}</p>
            <div className="flex gap-1.5">
              {([
                ['', tCP('filterGenderAll')],
                ['M', tCP('filterGenderMale')],
                ['F', tCP('filterGenderFemale')],
              ] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setGenderFilter(val)}
                  className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
                  style={genderFilter === val
                    ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                    : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }
                  }>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Package */}
          {packages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{tCP('filterPackage')}</p>
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setPackageFilter('')}
                  className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
                  style={!packageFilter
                    ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                    : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }
                  }>
                  {tCP('filterAllPackages')}
                </button>
                {packages.map(p => (
                  <button key={p.id} type="button" onClick={() => setPackageFilter(p.id)}
                    className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
                    style={packageFilter === p.id
                      ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                      : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }
                    }>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Age range */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{tCP('filterAge')}</p>
            <div className="flex items-center gap-2">
              <Input type="number" min="1" max="120" placeholder={tCP('filterAgeFrom')} value={ageFrom}
                onChange={e => setAgeFrom(e.target.value)} className="h-8 text-sm w-24 focus:border-violet-300" />
              <span className="text-gray-400 text-sm">–</span>
              <Input type="number" min="1" max="120" placeholder={tCP('filterAgeTo')} value={ageTo}
                onChange={e => setAgeTo(e.target.value)} className="h-8 text-sm w-24 focus:border-violet-300" />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="text-xs flex items-center gap-1" style={{ color: 'var(--app-accent)' }}>
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
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-xl">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'var(--app-accent-muted)' }}>
            <Users size={20} style={{ color: 'var(--app-accent)' }} />
          </div>
          <p className="text-gray-400 text-sm">{t('noClients')}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs font-medium flex items-center gap-1 mx-auto" style={{ color: 'var(--app-accent)' }}>
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
              <div key={client.id} className={`border rounded-xl bg-white transition-all select-none group ${
                !client.active ? 'opacity-55' : ''
              } ${isExpanded ? 'border-violet-200 shadow-sm' : 'border-gray-100 hover:shadow-sm hover:border-violet-200'}`}>
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
                  <div className={`w-10 h-10 rounded-xl ${avatarStyle(client.gender)} flex items-center justify-center shrink-0 relative`}>
                    <span className="text-white text-xs font-bold">{getInitials(client.full_name)}</span>
                    {expiryUrgent && (
                      <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${expiryExpired ? 'bg-red-500' : 'bg-amber-400'}`}>
                        <AlertTriangle size={7} className="text-white" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-800">{client.full_name}</p>
                      {!client.active && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">
                          {tCommon('inactive')}
                        </span>
                      )}
                      {client.activePackageName && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            backgroundColor: (client.activePackageColor || '#7c3aed') + '20',
                            color: client.activePackageColor || '#7c3aed',
                            border: `1px solid ${(client.activePackageColor || '#7c3aed')}30`,
                          }}>
                          {client.activePackageName}
                        </span>
                      )}
                      {expiryExpired && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-600 border border-red-200">
                          {tCP('packageExpired')}
                        </span>
                      )}
                      {!expiryExpired && expiryUrgent && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {tCP('packageExpiresIn', { days: daysLeft! })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-[11px] text-gray-400 flex-wrap gap-0">
                      <span>{client.email}</span>
                      {client.goal && <><span className="mx-1.5 text-gray-200">·</span><span>{client.goal}</span></>}
                      {client.weight && <><span className="mx-1.5 text-gray-200">·</span><span>{client.weight}{tDetail('weightUnitFull')}</span></>}
                      {client.height && <><span className="mx-1.5 text-gray-200">·</span><span>{client.height}{tDetail('heightUnitFull')}</span></>}
                      {age !== null && <><span className="mx-1.5 text-gray-200">·</span><span>{age}{tDetail('ageUnit')}</span></>}
                      {client.start_date && <><span className="mx-1.5 text-gray-200">·</span><span>{tCP('datePrefix')} {new Date(client.start_date).toLocaleDateString(locale)}</span></>}
                      {client.checkin_day != null && <><span className="mx-1.5 text-gray-200">·</span><span>{tCP('checkinDayPrefix')} {tDaysShort(String(client.checkin_day) as any)}</span></>}
                      {client.consistency_score != null && (
                        <>
                          <span className="mx-1.5 text-gray-200">·</span>
                          <span title={tCP('consistencyScoreLabel')}>{tCP('consistencyScoreMeta', { n: client.consistency_score })}</span>
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
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-300 transition-colors group-hover:[color:var(--app-accent)]">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button type="button" title={tCP('copyPlanTooltip')} onClick={(e) => { e.stopPropagation(); setCopyClient(client) }}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 transition-colors hover:[color:var(--app-accent)] hover:[background-color:var(--app-accent-muted)]">
                      <Copy size={13} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditClient(client) }}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 transition-colors hover:[color:var(--app-accent)] hover:[background-color:var(--app-accent-muted)]">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmToggle(client) }}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-50 transition-colors">
                      {client.active
                        ? <UserX size={13} className="text-red-400" />
                        : <UserCheck size={13} className="text-emerald-500" />
                      }
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(client) }}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Quick actions panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 rounded-b-xl">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {/* Tab shortcuts */}
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
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:shadow-sm transition-all font-medium"
                          >
                            <Icon size={12} style={{ color }} />
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Package status */}
                      <div className="flex items-center gap-2">
                        {client.activePackageName && client.packageEndDate && (
                          <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border ${
                            expiryExpired
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : expiryUrgent
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {expiryExpired
                              ? `${tCP('packageExpired')} ${Math.abs(daysLeft!)}d`
                              : `${tCP('packageExpiresFull')} ${new Date(client.packageEndDate).toLocaleDateString(locale)}`
                            }
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/clients/${client.id}`) }}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-colors"
                          style={{ backgroundColor: 'var(--app-accent)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--app-accent-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--app-accent)')}
                        >
                          {tCP('openProfile')}
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AddClientDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchData}
      />

      {copyClient && (
        <CopyClientDialog
          open={!!copyClient}
          onClose={() => setCopyClient(null)}
          onSuccess={() => { setCopyClient(null); fetchData() }}
          sourceClientId={copyClient.id}
          sourceClientName={copyClient.full_name}
        />
      )}

      {editClient && (
        <EditClientDialog
          client={editClient}
          open={!!editClient}
          onClose={() => setEditClient(null)}
          onSuccess={() => { setEditClient(null); fetchData() }}
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
      />
    </div>
  )
}

export default function ClientsPage() {
  return (
    <>
      <div className="hidden lg:block">
        <Suspense fallback={null}>
          <ClientsPageContent />
        </Suspense>
      </div>
      <div className="lg:hidden"><MobileClientsView /></div>
    </>
  )
}

