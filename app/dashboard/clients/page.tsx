'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, UserX, UserCheck, SlidersHorizontal, X, Trash2, ChevronRight, ChevronDown, Users } from 'lucide-react'
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

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function avatarStyle(gender: string | null): string {
  if (gender === 'F') return 'bg-gradient-to-br from-rose-400 to-pink-500'
  if (gender === 'M') return 'bg-gradient-to-br from-sky-400 to-blue-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-500'
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
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null)
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

  const deleteClient = async (client: Client) => {
    // Delete related data first, then the client record
    await supabase.from('checkins').delete().eq('client_id', client.id)
    await supabase.from('payments').delete().eq('client_id', client.id)
    await supabase.from('client_packages').delete().eq('client_id', client.id)
    await supabase.from('client_meal_plans').delete().eq('client_id', client.id)
    await supabase.from('client_workout_plans').delete().eq('client_id', client.id)
    await supabase.from('checkin_config').delete().eq('client_id', client.id)
    await supabase.from('messages').delete().eq('receiver_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)
    setClients(prev => prev.filter(c => c.id !== client.id))
    setConfirmDelete(null)
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
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Toolbar row 1: search + add */}
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
        <Button onClick={() => setShowAdd(true)} size="sm"
          className="h-9 flex items-center gap-1.5 px-3.5 bg-violet-600 hover:bg-violet-700 shrink-0">
          <Plus size={13} /> {t('addClient')}
        </Button>
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
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filter button */}
        <Button variant="outline" size="sm"
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${activeFilterCount > 0 ? 'border-violet-300 text-violet-600 bg-violet-50' : ''}`}>
          <SlidersHorizontal size={12} />
          Filteri
          {activeFilterCount > 0 && (
            <span className="bg-violet-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Button>

        {/* Sort dropdown */}
        <div className="relative ml-auto" ref={filterRef}>
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
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${sortKey === key ? 'font-semibold text-violet-600' : 'text-gray-700'}`}
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
        <div className="bg-violet-50/60 rounded-xl p-3 space-y-3 border border-violet-100">
          {/* Gender */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Spol</p>
            <div className="flex gap-1.5">
              {([['', 'Svi'], ['M', '♂ Muško'], ['F', '♀ Žensko']] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setGenderFilter(val)}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                    genderFilter === val ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Package */}
          {packages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Paket</p>
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setPackageFilter('')}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                    !packageFilter ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                  }`}>
                  Svi paketi
                </button>
                {packages.map(p => (
                  <button key={p.id} type="button" onClick={() => setPackageFilter(p.id)}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                      packageFilter === p.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Age range */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dob (godine)</p>
            <div className="flex items-center gap-2">
              <Input type="number" min="1" max="120" placeholder="Od" value={ageFrom}
                onChange={e => setAgeFrom(e.target.value)} className="h-8 text-sm w-24 focus:border-violet-300" />
              <span className="text-gray-400 text-sm">–</span>
              <Input type="number" min="1" max="120" placeholder="Do" value={ageTo}
                onChange={e => setAgeTo(e.target.value)} className="h-8 text-sm w-24 focus:border-violet-300" />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="text-xs text-violet-600 flex items-center gap-1 hover:text-violet-800">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-400">Filteri:</span>
          {genderFilter && (
            <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {genderFilter === 'M' ? '♂ Muško' : '♀ Žensko'}
              <button type="button" onClick={() => setGenderFilter('')}><X size={9} /></button>
            </span>
          )}
          {packageFilter && (
            <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {packages.find(p => p.id === packageFilter)?.name}
              <button type="button" onClick={() => setPackageFilter('')}><X size={9} /></button>
            </span>
          )}
          {(ageFrom || ageTo) && (
            <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium">
              Dob: {ageFrom || '?'}–{ageTo || '?'} god.
              <button type="button" onClick={() => { setAgeFrom(''); setAgeTo('') }}><X size={9} /></button>
            </span>
          )}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-gray-500">{filtered.length} / {clients.length} klijenata</p>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-2">
            <Users size={20} className="text-violet-400" />
          </div>
          <p className="text-gray-400 text-sm">{t('noClients')}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1 mx-auto">
              <Plus size={11} /> Dodaj prvog klijenta
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((client) => {
            const age = client.date_of_birth ? calcAge(client.date_of_birth) : null
            return (
              <div
                key={client.id}
                className={`border rounded-xl px-4 py-3 bg-white hover:shadow-sm hover:border-violet-200 transition-all cursor-default select-none group ${
                  !client.active ? 'opacity-55' : 'border-gray-100'
                }`}
                onDoubleClick={() => router.push(`/dashboard/clients/${client.id}`)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl ${avatarStyle(client.gender)} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-xs font-bold">{getInitials(client.full_name)}</span>
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
                    </div>
                    <div className="flex items-center text-[11px] text-gray-400 flex-wrap gap-0">
                      <span>{client.email}</span>
                      {client.goal && <><span className="mx-1.5 text-gray-200">·</span><span>{client.goal}</span></>}
                      {client.weight && <><span className="mx-1.5 text-gray-200">·</span><span>{client.weight} kg</span></>}
                      {client.height && <><span className="mx-1.5 text-gray-200">·</span><span>{client.height} cm</span></>}
                      {age !== null && <><span className="mx-1.5 text-gray-200">·</span><span>{age} god.</span></>}
                      {client.start_date && <><span className="mx-1.5 text-gray-200">·</span><span>od {new Date(client.start_date).toLocaleDateString('hr-HR')}</span></>}
                    </div>
                    {client.notes && (
                      <p className="text-[11px] text-gray-400 truncate max-w-[380px] italic" title={client.notes}>
                        {client.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button type="button" onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-300 group-hover:text-violet-400 transition-colors">
                      <ChevronRight size={15} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditClient(client) }}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
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
        title={`Brisanje klijenta: ${confirmDelete?.full_name || ''}`}
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
                <span className="font-semibold">Preporuka:</span> Umjesto brisanja, razmotrite{' '}
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
            <p className="font-bold text-red-600">Ova radnja je nepovratna i ne može se poništiti.</p>
            <p className="text-gray-700">Želite li nastaviti s brisanjem klijenta?</p>
          </div>
        }
        onConfirm={() => confirmDelete && deleteClient(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Da, obriši"
        cancelLabel="Ne, odustani"
        destructive
      />
    </div>
  )
}
