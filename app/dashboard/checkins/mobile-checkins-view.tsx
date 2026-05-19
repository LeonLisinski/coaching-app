'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MessageSquare, CheckCircle2, AlertTriangle, Clock, ChevronRight, ListChecks } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'

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

export default function MobileCheckinsView() {
  const router = useRouter()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
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
      supabase.rpc('get_trainer_last_checkins', { p_trainer_id: user.id }),
    ])

    const cfgMap: Record<string, number | null> = {}
    for (const c of (cfgData || [])) cfgMap[c.client_id] = c.checkin_day
    const lastMap: Record<string, string> = {}
    for (const c of (ciData || [])) lastMap[c.client_id] = c.last_date

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

  const STATUS_CFG = {
    submitted: {
      icon: CheckCircle2,
      color: isDark ? '#34d399' : '#16a34a',
      bg: isDark ? 'rgba(52,211,153,0.1)' : '#f0fdf4',
      label: 'Predano',
      dotCls: 'bg-emerald-500',
    },
    late: {
      icon: AlertTriangle,
      color: isDark ? '#f87171' : '#dc2626',
      bg: isDark ? 'rgba(248,113,113,0.1)' : '#fef2f2',
      label: 'Kasni',
      dotCls: 'bg-red-500',
    },
    neutral: {
      icon: Clock,
      color: isDark ? '#6b7280' : '#6b7280',
      bg: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
      label: 'Na čekanju',
      dotCls: isDark ? 'bg-gray-600' : 'bg-gray-300',
    },
  }

  const lateCount      = clients.filter(c => c.status === 'late').length
  const submittedCount = clients.filter(c => c.status === 'submitted').length

  const displayed = filter === 'all' ? clients
    : clients.filter(c => c.status === filter)

  const cardBg     = isDark ? 'oklch(0.2 0.025 264)' : 'white'
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'
  const textPrimary   = isDark ? 'white' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const rowDivider    = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 rounded-xl w-40" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }} />
      {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-2xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }} />)}
    </div>
  )

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: textPrimary }}>Check-ini</h1>
        <p className="text-sm mt-0.5" style={{ color: textSecondary }}>Status ovog tjedna</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { value: lateCount,                                   ...STATUS_CFG.late      },
          { value: submittedCount,                              ...STATUS_CFG.submitted },
          { value: clients.length - lateCount - submittedCount, ...STATUS_CFG.neutral   },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-2xl border p-3 text-center"
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ backgroundColor: s.bg }}>
                <Icon size={15} style={{ color: s.color }} />
              </div>
              <p className="text-xl font-black" style={{ color: textPrimary }}>{s.value}</p>
              <p className="text-[10px] font-medium" style={{ color: textSecondary }}>{s.label}</p>
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
            className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors"
            style={filter === f.key
              ? { backgroundColor: f.key === 'late' ? '#dc2626' : f.key === 'submitted' ? '#16a34a' : 'var(--app-accent)', color: 'white' }
              : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: isDark ? '#9ca3af' : '#6b7280' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Client list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
          <p className="text-sm font-semibold" style={{ color: textSecondary }}>Nema kasnih check-ina</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          {displayed.map((c, idx) => {
            const sc = STATUS_CFG[c.status]
            const StatusIcon = sc.icon
            return (
              <div key={c.id}
                onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                style={{
                  borderTop: idx > 0 ? `1px solid ${rowDivider}` : 'none',
                }}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl ${avatarCls(c.gender)} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-xs font-bold">{getInitials(c.full_name)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{c.full_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dotCls}`} />
                    <span className="text-[11px] font-medium" style={{ color: sc.color }}>{sc.label}</span>
                    {c.checkin_day !== null && (
                      <span className="text-[11px]" style={{ color: textSecondary }}>· {DAY_NAMES[c.checkin_day]}</span>
                    )}
                  </div>
                </div>

                {/* Quick chat */}
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/dashboard/chat?clientId=${c.id}`) }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: isDark ? '#60a5fa' : '#3b82f6' }}
                >
                  <MessageSquare size={13} />
                </button>
                <ChevronRight size={14} style={{ color: isDark ? '#374151' : '#d1d5db' }} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
