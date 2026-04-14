'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MessageSquare, CheckCircle2, AlertTriangle, Clock, ChevronRight, ListChecks } from 'lucide-react'

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getStatus(day: number | null, last: string | null): 'submitted' | 'late' | 'neutral' {
  if (day === null) return 'neutral'
  const today = new Date()
  const daysBack = (today.getDay() - day + 7) % 7
  if (daysBack === 0) {
    if (!last) return 'neutral'
    return last >= isoDate(today) ? 'submitted' : 'neutral'
  }
  const expected = new Date(today); expected.setDate(today.getDate() - daysBack)
  if (!last) return 'neutral'
  return last >= isoDate(expected) ? 'submitted' : 'late'
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

type CiClient = {
  id: string; full_name: string; gender: string | null
  checkin_day: number | null; last_checkin: string | null
  status: 'submitted' | 'late' | 'neutral'
}

const STATUS_CFG = {
  submitted: { icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', label: 'Predano',    dot: 'bg-emerald-500' },
  late:      { icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', label: 'Kasni',      dot: 'bg-red-500'     },
  neutral:   { icon: Clock,         color: '#6b7280', bg: '#f9fafb', label: 'Na čekanju', dot: 'bg-gray-300'    },
}

export default function MobileCheckinsView() {
  const router = useRouter()
  const [clients, setClients] = useState<CiClient[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'late' | 'submitted'>('all')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { data: clientData } = await supabase
      .from('clients')
      .select(`id, gender, profiles!clients_user_id_fkey(full_name)`)
      .eq('trainer_id', user.id).eq('active', true)

    if (!clientData?.length) { setLoading(false); return }
    const ids = clientData.map((c: any) => c.id)

    const [{ data: cfgData }, { data: ciData }] = await Promise.all([
      supabase.from('checkin_config').select('client_id, checkin_day').in('client_id', ids),
      supabase.from('checkins').select('client_id, date').in('client_id', ids).order('date', { ascending: false }),
    ])

    const cfgMap: Record<string, number | null> = {}
    for (const c of (cfgData || [])) cfgMap[c.client_id] = c.checkin_day
    const lastMap: Record<string, string> = {}
    for (const c of (ciData || [])) { if (!lastMap[c.client_id]) lastMap[c.client_id] = c.date }

    setClients(clientData.map((c: any) => {
      const day = cfgMap[c.id] ?? null
      const last = lastMap[c.id] ?? null
      return {
        id: c.id,
        full_name: c.profiles?.full_name || '—',
        gender: c.gender || null,
        checkin_day: day, last_checkin: last,
        status: getStatus(day, last),
      }
    }).sort((a: CiClient, b: CiClient) => {
      const ord = { late: 0, neutral: 1, submitted: 2 }
      return ord[a.status] - ord[b.status]
    }))
    setLoading(false)
  }

  const lateCount      = clients.filter(c => c.status === 'late').length
  const submittedCount = clients.filter(c => c.status === 'submitted').length

  const displayed = filter === 'all' ? clients
    : clients.filter(c => c.status === filter)

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-gray-100 rounded-xl w-40" />
      {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Check-ini</h1>
        <p className="text-sm text-gray-400 mt-0.5">Status ovog tjedna</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Kasne',     value: lateCount,               color: lateCount > 0 ? '#dc2626' : '#9ca3af', bg: lateCount > 0 ? '#fef2f2' : '#f9fafb', icon: AlertTriangle },
          { label: 'Predano',  value: submittedCount,           color: '#16a34a', bg: '#f0fdf4',              icon: CheckCircle2 },
          { label: 'Na čekanju',value: clients.length - lateCount - submittedCount, color: '#6b7280', bg: '#f9fafb', icon: Clock },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-3 text-center">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ backgroundColor: s.bg }}>
                <Icon size={15} style={{ color: s.color }} />
              </div>
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all',       label: `Svi (${clients.length})` },
          { key: 'late',      label: `Kasne (${lateCount})` },
          { key: 'submitted', label: `Predano (${submittedCount})` },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${filter === f.key ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={filter === f.key ? { backgroundColor: f.key === 'late' ? '#dc2626' : f.key === 'submitted' ? '#16a34a' : 'var(--app-accent)' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Client list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
          <p className="text-sm font-semibold text-gray-500">Nema kasnih check-ina</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {displayed.map(c => {
              const sc = STATUS_CFG[c.status]
              const StatusIcon = sc.icon
              return (
                <div key={c.id}
                  onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 cursor-pointer">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl ${avatarCls(c.gender)} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-xs font-bold">{getInitials(c.full_name)}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      <span className="text-[11px] font-medium" style={{ color: sc.color }}>{sc.label}</span>
                      {c.checkin_day !== null && (
                        <span className="text-[11px] text-gray-400">· {DAY_NAMES[c.checkin_day]}</span>
                      )}
                    </div>
                  </div>

                  {/* Quick chat */}
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/dashboard/chat?clientId=${c.id}`) }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-50 shrink-0"
                  >
                    <MessageSquare size={13} className="text-blue-500" />
                  </button>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
