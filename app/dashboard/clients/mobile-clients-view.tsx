'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, MessageSquare, X, ChevronRight, Users, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getCheckinStatus, consistencyScore, type CheckinEngagementStatus } from '@/lib/checkin-engagement'
import { useAppTheme } from '@/app/contexts/app-theme'

type CheckinStatus = CheckinEngagementStatus

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function avatarCls(gender: string | null) {
  if (gender === 'F') return 'bg-gradient-to-br from-rose-400 to-pink-500'
  if (gender === 'M') return 'bg-gradient-to-br from-sky-400 to-blue-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-500'
}

// ── types ─────────────────────────────────────────────────────────────────────
type MobileClient = {
  id: string
  full_name: string
  email: string
  gender: string | null
  active: boolean
  startDate: string | null
  packageName: string | null
  packageColor: string | null
  checkinDay: number | null
  lastCheckin: string | null
  checkinStatus: CheckinStatus
  consistencyScore: number
}

// ── component ─────────────────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', scale: 'Scale' }

export default function MobileClientsView() {
  const router = useRouter()
  const t = useTranslations('clientsPage')
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const DAY_NAMES = [
    t('dayAbbr0'), t('dayAbbr1'), t('dayAbbr2'), t('dayAbbr3'),
    t('dayAbbr4'), t('dayAbbr5'), t('dayAbbr6'),
  ]
  const STATUS_CFG: Record<CheckinStatus, { dot: string; text: string; bg: string; label: string }> = {
    submitted: {
      dot: 'bg-emerald-500',
      text: isDark ? 'text-emerald-400' : 'text-emerald-600',
      bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
      label: t('statusSubmitted'),
    },
    late: {
      dot: 'bg-red-500',
      text: isDark ? 'text-red-400' : 'text-red-600',
      bg: isDark ? 'bg-red-500/10' : 'bg-red-50',
      label: t('statusLate'),
    },
    neutral: {
      dot: isDark ? 'bg-gray-600' : 'bg-gray-300',
      text: isDark ? 'text-gray-500' : 'text-gray-400',
      bg: isDark ? 'bg-white/5' : 'bg-gray-50',
      label: t('statusNeutral'),
    },
  }
  const [clients, setClients]   = useState<MobileClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'late'>('all')
  const [subscription, setSubscription] = useState<{ plan: string; client_limit: number } | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const [{ data: clientData }, { data: subData }] = await Promise.all([
      supabase
        .from('clients')
        .select(`id, gender, active, start_date, profiles!clients_user_id_fkey (full_name, email)`)
        .eq('trainer_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('subscriptions')
        .select('plan, client_limit')
        .eq('trainer_id', user.id)
        .single(),
    ])

    setSubscription(subData ? { plan: subData.plan, client_limit: subData.client_limit } : null)

    if (!clientData?.length) { setLoading(false); return }

    const ids = clientData.map((c: any) => c.id)

    const [{ data: pkgData }, { data: cfgData }, { data: ciData }, { data: countsData }] = await Promise.all([
      supabase.from('client_packages').select('client_id, packages(name, color)').eq('status', 'active').in('client_id', ids),
      supabase.from('checkin_config').select('client_id, checkin_day').in('client_id', ids),
      supabase.rpc('get_trainer_last_checkins', { p_trainer_id: user.id }),
      supabase.rpc('get_client_checkin_counts', { trainer_user_id: user.id }),
    ])

    const checkinCountMap: Record<string, number> = {}
    for (const row of (countsData || [])) checkinCountMap[row.client_id] = Number(row.checkin_count)

    const pkgMap: Record<string, { name: string; color: string }> = {}
    for (const p of (pkgData || [])) {
      if (!pkgMap[p.client_id]) pkgMap[p.client_id] = p.packages as any
    }
    const cfgMap: Record<string, number | null> = {}
    for (const c of (cfgData || [])) cfgMap[c.client_id] = c.checkin_day
    const ciMap: Record<string, string> = {}
    for (const c of (ciData || [])) ciMap[c.client_id] = c.last_date

    setClients(clientData.map((c: any) => {
      const checkinDay = cfgMap[c.id] ?? null
      const lastCheckin = ciMap[c.id] ?? null
      const total = checkinCountMap[c.id] || 0
      return {
        id: c.id,
        full_name: c.profiles?.full_name || t('noName'),
        email: c.profiles?.email || '',
        gender: c.gender || null,
        active: c.active,
        startDate: c.start_date ?? null,
        packageName: pkgMap[c.id]?.name ?? null,
        packageColor: pkgMap[c.id]?.color ?? null,
        checkinDay,
        lastCheckin,
        checkinStatus: getCheckinStatus(checkinDay, lastCheckin),
        consistencyScore: consistencyScore(total, c.start_date ?? null),
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

  const cardBg     = isDark ? 'oklch(0.2 0.025 264)' : 'white'
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'
  const textPrimary   = isDark ? 'white' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: textPrimary }}>{t('title')}</h1>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-sm" style={{ color: textSecondary }}>{t('activeClientsCount', { count: clients.length })}</p>
          {subscription && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={clients.length >= subscription.client_limit
                ? { backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#fffbeb', color: isDark ? '#fbbf24' : '#92400e', border: `1px solid ${isDark ? 'rgba(217,119,6,0.3)' : '#fde68a'}` }
                : { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: textSecondary }
              }
            >
              {clients.length >= subscription.client_limit && <AlertTriangle size={10} style={{ color: isDark ? '#fbbf24' : '#f59e0b' }} />}
              {clients.length}/{subscription.client_limit} {PLAN_LABELS[subscription.plan] ?? subscription.plan}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={15} style={{ color: textSecondary }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full h-10 pl-9 pr-9 rounded-xl border text-sm outline-none"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'white',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
            color: isDark ? 'white' : '#111827',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: textSecondary }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors"
          style={filter === 'all'
            ? { backgroundColor: 'var(--app-accent)', color: 'white' }
            : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: isDark ? '#9ca3af' : '#6b7280' }
          }
        >
          {t('filterAll')} ({clients.length})
        </button>
        {lateCount > 0 && (
          <button
            onClick={() => setFilter('late')}
            className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors"
            style={filter === 'late'
              ? { backgroundColor: '#ef4444', color: 'white' }
              : { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2', color: isDark ? '#f87171' : '#ef4444' }
            }
          >
            {t('filterLate', { count: lateCount })}
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }}>
            <Users size={24} style={{ color: isDark ? '#4b5563' : '#d1d5db' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: textSecondary }}>
            {search ? t('noResults') : t('noClients')}
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
                className="rounded-2xl border p-4 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              >
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-2xl ${avatarCls(client.gender)} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-bold text-sm">{getInitials(client.full_name)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight truncate" style={{ color: textPrimary }}>{client.full_name}</p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Check-in status */}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>

                    {/* Check-in day */}
                    {client.checkinDay !== null && (
                      <span className="text-[11px] font-medium" style={{ color: textSecondary }}>
                        {DAY_NAMES[client.checkinDay]}
                      </span>
                    )}

                    <span className="text-[11px] tabular-nums font-medium" style={{ color: textSecondary }} title={t('consistencyScoreLabel')}>
                      {t('consistencyScoreShort', { n: client.consistencyScore })}
                    </span>

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
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors active:scale-90"
                    style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: isDark ? '#60a5fa' : '#3b82f6' }}
                  >
                    <MessageSquare size={15} />
                  </button>
                  <ChevronRight size={16} style={{ color: isDark ? '#374151' : '#d1d5db' }} className="ml-0.5" />
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
