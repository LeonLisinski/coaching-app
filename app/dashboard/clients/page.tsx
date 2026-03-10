'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, UserX, UserCheck, ArrowUpDown, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AddClientDialog from '@/app/dashboard/clients/add-client-dialog'
import EditClientDialog from '@/app/dashboard/clients/edit-client-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useTranslations } from 'next-intl'

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
}

type Package = { id: string; name: string; color: string }
type SortKey = 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'weight_asc' | 'weight_desc' | 'age_asc' | 'age_desc'

function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function ClientsPage() {
  const t = useTranslations('clients.page')
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('clients.detail')

  const [clients, setClients] = useState<Client[]>([])
  const [packages, setPackages] = useState<Package[]>([])
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
  const router = useRouter()
  const filterRef = useRef<HTMLDivElement>(null)

  const noName = tDetail('noName')

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: clientData }, { data: pkgData }] = await Promise.all([
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
    ])

    const rawClients: Client[] = (clientData || []).map((c: any) => ({
      id: c.id,
      full_name: c.profiles?.full_name || noName,
      email: c.profiles?.email || '',
      goal: c.goal, weight: c.weight, height: c.height,
      date_of_birth: c.date_of_birth, start_date: c.start_date,
      active: c.active, gender: c.gender, notes: c.notes,
    }))

    setPackages(pkgData || [])

    // Fetch active packages for all clients
    if (rawClients.length > 0) {
      const clientIds = rawClients.map(c => c.id)
      const { data: cpData } = await supabase
        .from('client_packages')
        .select('client_id, packages(name, color)')
        .eq('status', 'active')
        .in('client_id', clientIds)

      const pkgMap: Record<string, { name: string; color: string }> = {}
      for (const cp of (cpData || [])) {
        if (!pkgMap[cp.client_id]) {
          pkgMap[cp.client_id] = cp.packages as any
        }
      }

      setClients(rawClients.map(c => ({
        ...c,
        activePackageName: pkgMap[c.id]?.name || null,
        activePackageColor: pkgMap[c.id]?.color || null,
      })))
    } else {
      setClients(rawClients)
    }
    setLoading(false)
  }

  const toggleStatus = async (client: Client) => {
    await supabase.from('clients').update({ active: !client.active }).eq('id', client.id)
    setClients(clients.map(c => c.id === client.id ? { ...c, active: !c.active } : c))
    setConfirmToggle(null)
  }

  const sortLabels: Record<SortKey, string> = {
    name_asc: 'Ime A → Z', name_desc: 'Ime Z → A',
    date_desc: 'Datum (najnoviji)', date_asc: 'Datum (najstariji)',
    weight_desc: 'Težina ↓', weight_asc: 'Težina ↑',
    age_asc: 'Dob (mlađi)', age_desc: 'Dob (stariji)',
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
        default: return 0
      }
    })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2 shrink-0">
          <Plus size={14} />
          {t('addClient')}
        </Button>
      </div>

      {/* Toolbar: status pills + filter btn + sort */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status */}
        <div className="flex gap-1">
          {[
            { value: 'active', label: t('filterActive') },
            { value: 'inactive', label: t('filterInactive') },
            { value: 'all', label: t('filterAll') },
          ].map(opt => (
            <Button
              key={opt.value}
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(opt.value as any)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Filter button */}
        <div className="relative" ref={filterRef}>
          <Button
            variant={activeFilterCount > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-1.5"
          >
            <SlidersHorizontal size={13} />
            Filteri
            {activeFilterCount > 0 && (
              <span className="bg-white text-primary rounded-full w-4 h-4 text-xs flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {showFilters && (
            <div className="absolute left-0 top-full mt-1 z-30 bg-white border rounded-xl shadow-lg w-72 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Filteri</span>
                {activeFilterCount > 0 && (
                  <button type="button" onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <X size={11} /> Resetiraj
                  </button>
                )}
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Spol</p>
                <div className="flex gap-1.5">
                  {([['', 'Svi'], ['M', '♂ Muško'], ['F', '♀ Žensko']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setGenderFilter(val)}
                      className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        genderFilter === val
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input bg-background hover:bg-accent'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Package */}
              {packages.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paket</p>
                  <select
                    value={packageFilter}
                    onChange={e => setPackageFilter(e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Svi paketi</option>
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Age range */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dob (godine)</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="Od"
                    value={ageFrom}
                    onChange={e => setAgeFrom(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <span className="text-gray-400 shrink-0">–</span>
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="Do"
                    value={ageTo}
                    onChange={e => setAgeTo(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sort */}
        <div className="relative ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSortMenu(v => !v)}
            className="flex items-center gap-1"
          >
            <ArrowUpDown size={13} />
            {sortLabels[sortKey]}
            <ChevronDown size={13} />
          </Button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border rounded-md shadow-md min-w-[180px] py-1">
                {(Object.entries(sortLabels) as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortKey === key ? 'font-medium text-primary' : ''}`}
                    onClick={() => { setSortKey(key); setShowSortMenu(false) }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {genderFilter && (
            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
              {genderFilter === 'M' ? '♂ Muško' : '♀ Žensko'}
              <button type="button" onClick={() => setGenderFilter('')}><X size={10} /></button>
            </span>
          )}
          {packageFilter && (
            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
              📦 {packages.find(p => p.id === packageFilter)?.name}
              <button type="button" onClick={() => setPackageFilter('')}><X size={10} /></button>
            </span>
          )}
          {(ageFrom || ageTo) && (
            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
              Dob: {ageFrom || '?'} – {ageTo || '?'} god.
              <button type="button" onClick={() => { setAgeFrom(''); setAgeTo('') }}><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      <p className="text-sm text-gray-500">{t('clientCount', { count: filtered.length })}</p>

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('noClients')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((client) => {
            const age = client.date_of_birth ? calcAge(client.date_of_birth) : null
            return (
              <Card
                key={client.id}
                className={`transition-shadow cursor-pointer hover:shadow-sm ${!client.active ? 'opacity-60' : ''}`}
                onDoubleClick={() => router.push(`/dashboard/clients/${client.id}`)}
              >
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Row 1: name + gender + status + package */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{client.full_name}</p>
                      {client.gender && (
                        <span className="text-xs text-gray-400">{client.gender === 'M' ? '♂' : '♀'}</span>
                      )}
                      {!client.active && (
                        <Badge variant="secondary" className="text-xs">{tCommon('inactive')}</Badge>
                      )}
                      {client.activePackageName && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: (client.activePackageColor || '#6366f1') + '18',
                            color: client.activePackageColor || '#6366f1',
                          }}
                        >
                          {client.activePackageName}
                        </span>
                      )}
                    </div>

                    {/* Row 2: email + goal + metrics — all subtle, dot-separated */}
                    <div className="flex items-center gap-0 text-xs text-gray-400 flex-wrap">
                      <span>{client.email}</span>
                      {client.goal && <><span className="mx-1.5 text-gray-300">·</span><span>{client.goal}</span></>}
                      {client.weight && <><span className="mx-1.5 text-gray-300">·</span><span>{client.weight} kg</span></>}
                      {client.height && <><span className="mx-1.5 text-gray-300">·</span><span>{client.height} cm</span></>}
                      {age !== null && <><span className="mx-1.5 text-gray-300">·</span><span>{age} god.</span></>}
                      {client.start_date && <><span className="mx-1.5 text-gray-300">·</span><span>od {new Date(client.start_date).toLocaleDateString('hr-HR')}</span></>}
                    </div>

                    {/* Row 3: notes — only if present */}
                    {client.notes && (
                      <p className="text-xs text-gray-400 truncate max-w-[400px] italic" title={client.notes}>
                        {client.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setEditClient(client) }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setConfirmToggle(client) }}
                    >
                      {client.active
                        ? <UserX size={14} className="text-red-400" />
                        : <UserCheck size={14} className="text-green-500" />
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddClientDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchData}
      />

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
    </div>
  )
}
