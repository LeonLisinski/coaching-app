'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Search, MessageSquare, X, ChevronRight, Users } from 'lucide-react'
import AddClientDialog from '@/app/dashboard/clients/add-client-dialog'

// ── helpers ──────────────────────────────────────────────────────────────────
type CheckinStatus = 'submitted' | 'late' | 'neutral'

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCheckinStatus(checkinDay: number | null, lastCheckin: string | null): CheckinStatus {
  if (checkinDay === null) return 'neutral'
  const today = new Date()
  const daysBack = (today.getDay() - checkinDay + 7) % 7
  if (daysBack === 0) {
    if (!lastCheckin) return 'neutral'
    return lastCheckin >= isoDate(today) ? 'submitted' : 'neutral'
  }
  const expected = new Date(today)
  expected.setDate(today.getDate() - daysBack)
  if (!lastCheckin) return 'neutral'
  return lastCheckin >= isoDate(expected) ? 'submitted' : 'late'
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function avatarCls(gender: string | null) {
  if (gender === 'F') return 'bg-gradient-to-br from-rose-400 to-pink-500'
  if (gender === 'M') return 'bg-gradient-to-br from-sky-400 to-blue-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-500'
}

const DAY_NAMES = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']
const STATUS_CFG = {
  submitted: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Predano' },
  late:      { dot: 'bg-red-500',     text: 'text-red-600',     bg: 'bg-red-50',     label: 'Kasni'   },
  neutral:   { dot: 'bg-gray-300',    text: 'text-gray-400',    bg: 'bg-gray-50',    label: 'Na čekanju' },
}

// ── types ─────────────────────────────────────────────────────────────────────
type MobileClient = {
  id: string
  full_name: string
  email: string
  gender: string | null
  active: boolean
  packageName: string | null
  packageColor: string | null
  checkinDay: number | null
  lastCheckin: string | null
  checkinStatus: CheckinStatus
}

// ── component ─────────────────────────────────────────────────────────────────
export default function MobileClientsView() {
  const router = useRouter()
  const [clients, setClients]   = useState<MobileClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [filter, setFilter]     = useState<'all' | 'late'>('all')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: clientData } = await supabase
      .from('clients')
      .select(`id, gender, active, profiles!clients_user_id_fkey (full_name, email)`)
      .eq('trainer_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (!clientData?.length) { setLoading(false); return }

    const ids = clientData.map((c: any) => c.id)

    const [{ data: pkgData }, { data: cfgData }, { data: ciData }] = await Promise.all([
      supabase.from('client_packages').select('client_id, packages(name, color)').eq('status', 'active').in('client_id', ids),
      supabase.from('checkin_config').select('client_id, checkin_day').in('client_id', ids),
      supabase.from('checkins').select('client_id, date').in('client_id', ids).order('date', { ascending: false }),
    ])

    const pkgMap: Record<string, { name: string; color: string }> = {}
    for (const p of (pkgData || [])) {
      if (!pkgMap[p.client_id]) pkgMap[p.client_id] = p.packages as any
    }
    const cfgMap: Record<string, number | null> = {}
    for (const c of (cfgData || [])) cfgMap[c.client_id] = c.checkin_day
    const ciMap: Record<string, string> = {}
    for (const c of (ciData || [])) { if (!ciMap[c.client_id]) ciMap[c.client_id] = c.date }

    setClients(clientData.map((c: any) => {
      const checkinDay = cfgMap[c.id] ?? null
      const lastCheckin = ciMap[c.id] ?? null
      return {
        id: c.id,
        full_name: c.profiles?.full_name || 'Bez imena',
        email: c.profiles?.email || '',
        gender: c.gender || null,
        active: c.active,
        packageName: pkgMap[c.id]?.name ?? null,
        packageColor: pkgMap[c.id]?.color ?? null,
        checkinDay,
        lastCheckin,
        checkinStatus: getCheckinStatus(checkinDay, lastCheckin),
      }
    }))
    setLoading(false)
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.checkinStatus === 'late'
    return matchSearch && matchFilter
  })

  const lateCount = clients.filter(c => c.checkinStatus === 'late').length

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Klijenti</h1>
        <p className="text-sm text-gray-400 mt-0.5">{clients.length} aktivnih klijenata</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pretraži klijente..."
          className="w-full h-10 pl-9 pr-9 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${filter === 'all' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
          style={filter === 'all' ? { backgroundColor: 'var(--app-accent)' } : {}}
        >
          Svi ({clients.length})
        </button>
        {lateCount > 0 && (
          <button
            onClick={() => setFilter('late')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${filter === 'late' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500'}`}
          >
            Kasne ({lateCount})
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <Users size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">
            {search ? 'Nema rezultata' : 'Nema klijenata'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(client => {
            const sc = STATUS_CFG[client.checkinStatus]
            return (
              <div
                key={client.id}
                onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer shadow-sm"
              >
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-2xl ${avatarCls(client.gender)} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-bold text-sm">{getInitials(client.full_name)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-base leading-tight truncate">{client.full_name}</p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Check-in status */}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>

                    {/* Check-in day */}
                    {client.checkinDay !== null && (
                      <span className="text-[11px] text-gray-400 font-medium">
                        {DAY_NAMES[client.checkinDay]}
                      </span>
                    )}

                    {/* Package */}
                    {client.packageName && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: client.packageColor || '#6b7280' }}>
                        {client.packageName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/dashboard/chat?clientId=${client.id}`) }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors active:scale-90"
                    style={{ backgroundColor: '#f3f4f6' }}
                  >
                    <MessageSquare size={15} />
                  </button>
                  <ChevronRight size={16} className="text-gray-300 ml-0.5" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB add client */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-[76px] right-4 z-30 w-13 h-13 rounded-2xl text-white shadow-xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--app-accent)', width: 52, height: 52 }}
      >
        <Plus size={22} />
      </button>

      <AddClientDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => { setShowAdd(false); fetchData() }}
      />
    </div>
  )
}
