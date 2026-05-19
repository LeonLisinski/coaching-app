'use client'
export const dynamic = 'force-dynamic'

import nextDynamic from 'next/dynamic'
import MobileDashboard from '@/app/dashboard/mobile-dashboard'
import { useEffect, useState } from 'react'
import { usePersistedTab } from '@/app/contexts/tab-state'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useIsLg } from '@/hooks/use-mobile'
import {
  Users, CheckCircle2, AlertCircle, TrendingUp, Banknote,
  Clock, ArrowRight, MessageSquare, Activity, ClipboardCheck, CreditCard,
  CalendarDays, Package, Sun, Globe, ChevronRight, Check, AlertTriangle,
  Loader2, PartyPopper,
} from 'lucide-react'

const DashboardRevenueCharts = nextDynamic(() => import('@/app/dashboard/dashboard-revenue-charts'), { ssr: false })
import { useAppTheme } from '@/app/contexts/app-theme'
import { isoDateLocal as isoDate, getCheckinStatus, getCheckinRate } from '@/lib/checkin-engagement'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ClientRow = {
  id: string
  full_name: string
  start_date: string | null
  checkin_day: number | null
  last_checkin: string | null
  total_checkins: number
  checkin_rate: number
  status: 'submitted' | 'late' | 'neutral'
}

type ActivityItem = {
  id: string
  type: 'checkin' | 'message' | 'payment'
  title: string
  subtitle: string
  time: string
  clientId?: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, onClick }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; color: string; onClick?: () => void
}) {
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isAccent = color === 'accent'

  const colorMap: Record<string, { bg: string; icon: string; val: string }> = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', val: 'text-emerald-600' },
    rose:    { bg: 'bg-rose-50',    icon: 'text-rose-500',    val: 'text-rose-600' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   val: 'text-amber-600' },
    sky:     { bg: 'bg-sky-50',     icon: 'text-sky-500',     val: 'text-sky-600' },
  }
  const c = colorMap[color]

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${!isAccent && c ? c.bg : ''}`}
          style={isAccent ? { backgroundColor: `${accentHex}18` } : undefined}
        >
          <Icon size={18}
            className={!isAccent && c ? c.icon : ''}
            style={isAccent ? { color: accentHex } : undefined}
          />
        </div>
        {onClick && <ArrowRight size={14} className="text-gray-300 mt-1" />}
      </div>
      <p
        className={`text-3xl font-extrabold leading-none ${!isAccent && c ? c.val : ''}`}
        style={isAccent ? { color: accentHex } : undefined}
      >{value}</p>
      <p className="text-sm text-gray-500 mt-1.5 font-medium">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function CheckinRow({ client, onClick }: { client: ClientRow; onClick: () => void }) {
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const t2 = useTranslations('dashboard2')

  const STATUS = {
    submitted: { label: t2('statusSubmitted'), cls: 'bg-emerald-50 text-emerald-700' },
    late:      { label: t2('statusLate'),      cls: 'bg-rose-50 text-rose-600' },
    neutral:   { label: t2('statusNoSchedule'), cls: 'bg-gray-100 text-gray-500' },
  }
  const s = STATUS[client.status]
  const rateColor = client.checkin_rate >= 70 ? 'bg-emerald-400' : client.checkin_rate >= 40 ? 'bg-amber-400' : 'bg-rose-400'
  const initials = client.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div onClick={onClick} className="flex items-center gap-3 py-2.5 px-1 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accentHex}18` }}>
        <span className="text-xs font-semibold" style={{ color: accentHex }}>{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{client.full_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 max-w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden" title={t2('consistencyScoreLabel')}>
            <div className={`h-full rounded-full ${rateColor}`} style={{ width: `${client.checkin_rate}%` }} />
          </div>
          <span className="text-xs text-gray-400 tabular-nums" title={t2('consistencyScoreLabel')}>{client.checkin_rate}%</span>
        </div>
      </div>
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${s.cls}`}>{s.label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Setup pending banner (shown after new-flow registration) ────────────────

function SetupBanner({ onReady }: { onReady: () => void }) {
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const t2 = useTranslations('dashboard2')

  useEffect(() => {
    let attempts = 0
    let mounted = true

    const check = async () => {
      if (!mounted) return
      attempts++
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user || !mounted) return

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('trainer_id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (sub && (sub.status === 'trialing' || sub.status === 'active')) {
        setReady(true)
        setTimeout(() => { if (mounted) onReady() }, 1200)
        return
      }
      if (attempts >= 15) { setTimedOut(true); return }
      setTimeout(check, 2000)
    }
    check()

    return () => { mounted = false }
  }, [])

  if (ready) return (
    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5 mb-5">
      <PartyPopper size={18} className="text-emerald-500 shrink-0" />
      <p className="text-sm font-semibold text-emerald-700">{t2('setupTrialActive')}</p>
    </div>
  )

  if (timedOut) return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 mb-5">
      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
      <p className="text-sm text-amber-700">
        {t2('setupSlowSetup')}{' '}
        <button onClick={() => window.location.reload()} className="font-semibold underline">{t2('setupRefresh')}</button>.
      </p>
    </div>
  )

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3.5 mb-5">
      <Loader2 size={16} className="animate-spin text-blue-500 shrink-0" />
      <p className="text-sm text-blue-700">{t2('setupSettingUp')}</p>
    </div>
  )
}

// ─── Page content ─────────────────────────────────────────────────────────────

// Module-level stale cache to avoid full refetch on in-session navigation back to dashboard
const DASH_STALE_MS = 90_000 // 90 seconds
let _dashLastFetch = 0

type DashSnap = {
  trainerName: string
  todayCheckinClients: { id: string; full_name: string; submitted: boolean }[]
  expiringPackages: { id: string; client_name: string; pkg_name: string; end_date: string; days_left: number; client_id: string }[]
  stats: { activeClients: number; submitted: number; late: number; neutral: number; expectedMonth: number; collectedMonth: number; paidByStart: number; totalMonth: number; latePayments: number; avgCheckinRate: number; unreadMessages: number }
  monthlyRevenue: { month: string; ocekivano: number; naplaceno: number }[]
  progressPercent: number
  recentActivity: ActivityItem[]
  yearRevenue: number
}
let _dashSnap: DashSnap | null = null

function DashboardPageContent() {
  const t      = useTranslations('dashboard')
  const t2     = useTranslations('dashboard2')
  const tDays  = useTranslations('days')
  const locale = useLocale()
  const router = useRouter()
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isDark = mode === 'dark'

  // Setup-pending banner (after new registration flow)
  const [showSetupBanner, setShowSetupBanner] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('setup') === 'pending') {
      setShowSetupBanner(true)
      // Clean URL without reload
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  const [loading, setLoading] = useState(() => !(_dashSnap && Date.now() - _dashLastFetch < DASH_STALE_MS))
  const [trainerName, setTrainerName] = useState(() => _dashSnap?.trainerName ?? '')
  const [dashView, setDashView] = usePersistedTab('dashboard_view', 'global') as [string, (v: string) => void]
  const [todayCheckinClients, setTodayCheckinClients] = useState<{ id: string; full_name: string; submitted: boolean }[]>(() => _dashSnap?.todayCheckinClients ?? [])
  const [expiringPackages, setExpiringPackages] = useState<{ id: string; client_name: string; pkg_name: string; end_date: string; days_left: number; client_id: string }[]>(() => _dashSnap?.expiringPackages ?? [])
  const [stats, setStats] = useState(() => _dashSnap?.stats ?? {
    activeClients: 0, submitted: 0, late: 0, neutral: 0,
    expectedMonth: 0, collectedMonth: 0, paidByStart: 0, totalMonth: 0, latePayments: 0,
    avgCheckinRate: 0, unreadMessages: 0,
  })
  const [clients, setClients]             = useState<ClientRow[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; ocekivano: number; naplaceno: number }[]>(() => _dashSnap?.monthlyRevenue ?? [])
  const [progressPercent, setProgressPercent] = useState(() => _dashSnap?.progressPercent ?? 0)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>(() => _dashSnap?.recentActivity ?? [])
  const [yearRevenue, setYearRevenue] = useState(() => _dashSnap?.yearRevenue ?? 0)

  const getMonthLabel = (d: Date) => d.toLocaleDateString(locale, { month: 'short' })

  useEffect(() => {
    const now = Date.now()
    if (_dashSnap && now - _dashLastFetch < DASH_STALE_MS) {
      // Cache is fresh — render immediately, no fetch
      return
    }
    _dashLastFetch = now
    fetchData()
  }, [])

  // Real-time: refresh unread message count as messages arrive / get read
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      const uid = session?.user?.id
      if (!uid) return

      channel = supabase
        .channel(`dashboard-unread-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `trainer_id=eq.${uid}` },
          async () => {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('trainer_id', uid)
              .neq('sender_id', uid)
              .eq('read', false)
            setStats(s => ({ ...s, unreadMessages: count ?? 0 }))
          },
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const fetchData = async () => {
    try {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    // Fetch profile + clients in parallel
    const [{ data: profileData }, { data: clientsData }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('clients').select(`id, start_date, profiles!clients_user_id_fkey(full_name)`).eq('trainer_id', user.id).eq('active', true).limit(2000),
    ])
    const name = profileData?.full_name?.split(' ')[0] || ''
    if (profileData) setTrainerName(name)

    const clientIds = clientsData?.map(c => c.id) || []

    // All client-id-dependent and user-id-dependent queries in parallel

    const [
      { data: checkinConfigs },
      { data: allCheckins },
      { data: checkinCounts },
      { count: unread },
      { data: packagesData },
      { data: recentMsgs },
      { data: recentPays },
    ] = await Promise.all([
      supabase.from('checkin_config').select('client_id, checkin_day').in('client_id', clientIds),
      // RPC returns only last checkin per client via DISTINCT ON — O(clients), not O(all rows)
      supabase.rpc('get_trainer_last_checkins', { p_trainer_id: user.id }),
      supabase.rpc('get_client_checkin_counts', { trainer_user_id: user.id }),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('trainer_id', user.id).neq('sender_id', user.id).eq('read', false),
      // Only load packages relevant to the dashboard: currently active, or started this calendar
      // year (covers YTD revenue + 6-month bar chart). Older historical packages are not shown.
      supabase
        .from('client_packages')
        .select(`id, client_id, price, status, start_date, end_date, payments(id,status,amount,paid_at), packages(name)`)
        .eq('trainer_id', user.id)
        .or(`status.eq.active,start_date.gte.${new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)}`)
        .limit(2000),
      supabase.from('messages').select('id, content, created_at, client_id').eq('trainer_id', user.id).neq('sender_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('payments').select('id, amount, paid_at, client_packages(client_id)').eq('trainer_id', user.id).eq('status', 'paid').not('paid_at', 'is', null).order('paid_at', { ascending: false }).limit(5),
    ])

    // PostgREST returns payments as a single object (not array) when client_package_id has a
    // UNIQUE constraint. Normalise to array here so all downstream code stays the same.
    const normalizedPackages = (packagesData || []).map((cp: any) => ({
      ...cp,
      payments: cp.payments == null ? [] : Array.isArray(cp.payments) ? cp.payments : [cp.payments],
    }))

    const checkinDayMap: Record<string, number> = {}
    checkinConfigs?.forEach(cfg => { checkinDayMap[cfg.client_id] = cfg.checkin_day })

    const lastCheckinMap: Record<string, string> = {}
    allCheckins?.forEach((c: any) => { lastCheckinMap[c.client_id] = c.last_date })
    const checkinCountMap: Record<string, number> = {}
    checkinCounts?.forEach((c: any) => { checkinCountMap[c.client_id] = Number(c.checkin_count) })

    // Build client rows
    const rows: ClientRow[] = (clientsData || []).map((c: any) => {
      const checkinDay  = checkinDayMap[c.id] ?? null
      const lastCheckin = lastCheckinMap[c.id] || null
      const total       = checkinCountMap[c.id] || 0
      const rate        = getCheckinRate(total, c.start_date)
      return {
        id: c.id,
        full_name: c.profiles?.full_name || t2('fallbackNoName'),
        start_date: c.start_date,
        checkin_day: checkinDay,
        last_checkin: lastCheckin,
        total_checkins: total,
        checkin_rate: rate,
        status: getCheckinStatus(checkinDay, lastCheckin),
      }
    })

    const submitted = rows.filter(r => r.status === 'submitted').length
    const late      = rows.filter(r => r.status === 'late').length
    const neutral   = rows.filter(r => r.status === 'neutral').length
    const avgRate   = rows.length ? Math.round(rows.reduce((s, r) => s + r.checkin_rate, 0) / rows.length) : 0

    // Sort: late first, then by rate desc
    rows.sort((a, b) => {
      if (a.status === 'late' && b.status !== 'late') return -1
      if (b.status === 'late' && a.status !== 'late') return 1
      return b.checkin_rate - a.checkin_rate
    })
    setClients(rows)

    // Today widget — clients with check-in day = today
    const todayDay = new Date().getDay()
    const todayStr = isoDate(new Date())
    const todayClients = rows
      .filter(r => r.checkin_day === todayDay)
      .map(r => ({ id: r.id, full_name: r.full_name, submitted: !!(r.last_checkin && r.last_checkin >= todayStr) }))
    setTodayCheckinClients(todayClients)

    // Revenue calculations — use normalizedPackages (payments already normalised to array above)
    const now        = new Date()
    const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const monthEnd   = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    let expectedMonth = 0, collectedMonth = 0, paidByStart = 0, latePayments = 0
    const monthly: Record<string, { ocekivano: number; naplaceno: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthly[getMonthLabel(d)] = { ocekivano: 0, naplaceno: 0 }
    }

    normalizedPackages.forEach((cp: any) => {
      const price      = cp.price || 0
      const paidPayment = (cp.payments as any[])?.find((p: any) => p.status === 'paid')
      const hasPaid    = !!paidPayment
      const paidAmt    = paidPayment?.amount || price   // stvarni iznos plaćanja

      // Kasna plaćanja = aktivni paketi bez uplate čiji je end_date prošao
      if (!hasPaid && cp.status === 'active' && new Date(cp.end_date) < now) latePayments++

      // ── STAT KARTICE ──────────────────────────────────────────────────────────
      // Naplaćeno ovaj mj = plaćanja s paid_at u tekućem mj (stvarni novčani tok)
      // paid_at može biti timestamp ("2026-03-31T22:00:00+00:00") pa uzimamo samo prvih 10 znakova
      ;(cp.payments as any[])?.forEach((p: any) => {
        const paidDate = p.paid_at ? (p.paid_at as string).substring(0, 10) : null
        if (p.status === 'paid' && paidDate && paidDate >= monthStart && paidDate <= monthEnd) {
          collectedMonth += p.amount || price
        }
      })
      // Paketi koji POČINJU ovaj mj — za donut i konzistentnost s bar chartom
      // naplaćeno = svi plaćeni (uključujući expired), očekivano = samo aktivni neplaćeni
      if (cp.start_date >= monthStart && cp.start_date <= monthEnd) {
        if (hasPaid)                     paidByStart   += paidAmt
        else if (cp.status === 'active') expectedMonth += price
      }

      // ── BAR CHART (historijski) ───────────────────────────────────────────────
      // naplaćeno = stvarni iznos, očekivano = samo aktivni neplaćeni
      for (let i = 5; i >= 0; i--) {
        const d      = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mStart = isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
        const mEnd   = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
        const key    = getMonthLabel(d)
        if (cp.start_date >= mStart && cp.start_date <= mEnd) {
          if (hasPaid)                     monthly[key].naplaceno += paidAmt
          else if (cp.status === 'active') monthly[key].ocekivano += price
        }
      }
    })

    const totalMonth = paidByStart + expectedMonth
    const progress   = totalMonth > 0 ? Math.round((paidByStart / totalMonth) * 100) : (paidByStart > 0 ? 100 : 0)

    // Expiring packages (within 7 days, active, not paid)
    const clientNameMapForPkg: Record<string, string> = {}
    rows.forEach(r => { clientNameMapForPkg[r.id] = r.full_name })
    const expiring = normalizedPackages
      .filter((cp: any) => {
        if (cp.status !== 'active') return false
        const dl = Math.ceil((new Date(cp.end_date).getTime() - Date.now()) / 86400000)
        return dl >= 0 && dl <= 7
      })
      .map((cp: any) => ({
        id: cp.id,
        client_id: cp.client_id,
        client_name: clientNameMapForPkg[cp.client_id] || '—',
        pkg_name: (cp.packages as any)?.name || '—',
        end_date: cp.end_date,
        days_left: Math.ceil((new Date(cp.end_date).getTime() - Date.now()) / 86400000),
      }))
      .sort((a: any, b: any) => a.days_left - b.days_left)
    setExpiringPackages(expiring)

    // Year-to-date revenue = plaćanja s paid_at ove godine (stvarni novčani tok)
    const thisYear = now.getFullYear().toString()
    let ytdRevenue = 0
    normalizedPackages.forEach((cp: any) => {
      ;(cp.payments as any[])?.forEach((p: any) => {
        if (p.status === 'paid' && (p.paid_at as string | null)?.substring(0, 4) === thisYear) {
          ytdRevenue += p.amount || cp.price || 0
        }
      })
    })
    setYearRevenue(ytdRevenue)

    setStats({ activeClients: clientsData?.length || 0, submitted, late, neutral, expectedMonth, collectedMonth, paidByStart, totalMonth, latePayments, avgCheckinRate: avgRate, unreadMessages: unread || 0 })
    setMonthlyRevenue(Object.entries(monthly).map(([month, v]) => ({ month, ...v })))
    setProgressPercent(progress)

    // ─── Recent activity ─────────────────────────────────────────────────────
    // Build client name lookup from already-fetched rows
    const clientNameMap: Record<string, string> = {}
    rows.forEach(r => { clientNameMap[r.id] = r.full_name })

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)
    const sevenDaysAgoStr = isoDate(sevenDaysAgo)

    const formatRelTime = (ts: number) => {
      const diffMs = now.getTime() - ts
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)
      if (diffMins < 2) return t2('timeJustNow')
      if (diffMins < 60) return t2('timeMinutes', { n: diffMins })
      if (diffHours < 24) return t2('timeHours', { n: diffHours })
      if (diffDays === 1) return t2('timeYesterday')
      return t2('timeDays', { n: diffDays })
    }

    // Filter last-checkins to those submitted within the past 7 days for activity feed
    const recentCi = (allCheckins || [])
      .filter((c: any) => c.last_date >= sevenDaysAgoStr)
      .slice(0, 5)
      .map((c: any, i: number) => ({
        id: `checkin-${c.client_id}-${c.last_date}`,
        type: 'checkin' as const,
        title: clientNameMap[c.client_id] || t2('fallbackClient'),
        subtitle: t2('activitySubmittedCheckin'),
        time: '',
        ts: new Date(c.last_date).getTime() - i,
        clientId: c.client_id,
      }))

    const recentMsgActivities = (recentMsgs || []).map((m: any) => ({
      id: `msg-${m.id}`,
      type: 'message' as const,
      title: clientNameMap[m.client_id] || t2('fallbackClient'),
      subtitle: (m.content as string)?.slice(0, 50) || t2('activityNewMessage'),
      time: '',
      ts: new Date(m.created_at).getTime(),
      clientId: m.client_id as string,
    }))

    const recentPayActivities = (recentPays || [])
      .filter((p: any) => clientIds.includes(p.client_packages?.client_id))
      .map((p: any) => ({
        id: `pay-${p.id}`,
        type: 'payment' as const,
        title: clientNameMap[p.client_packages?.client_id] || t2('fallbackClient'),
        subtitle: t2('activityPayment', { amount: p.amount }),
        time: '',
        ts: new Date(p.paid_at).getTime(),
        clientId: p.client_packages?.client_id as string,
      }))

    const all = [...recentCi, ...recentMsgActivities, ...recentPayActivities]
    all.sort((a, b) => b.ts - a.ts)
    const activitySlice = all.slice(0, 8).map(a => ({ ...a, time: formatRelTime(a.ts) }))
    setRecentActivity(activitySlice)

    // Save snapshot for in-session cache (avoids full re-fetch on navigation back)
    _dashSnap = {
      trainerName: name,
      todayCheckinClients: todayClients,
      expiringPackages: expiring,
      stats: { activeClients: clientsData?.length || 0, submitted, late, neutral, expectedMonth, collectedMonth, paidByStart, totalMonth, latePayments, avgCheckinRate: avgRate, unreadMessages: unread || 0 },
      monthlyRevenue: Object.entries(monthly).map(([month, v]) => ({ month, ...v })),
      progressPercent: progress,
      recentActivity: activitySlice,
      yearRevenue: ytdRevenue,
    }

    } catch (err) {
      console.error('[dashboard] fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? t2('greetingMorning') : now.getHours() < 18 ? t2('greetingAfternoon') : t2('greetingEvening')
  const dateStr = now.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const pieData = [{ value: progressPercent }, { value: 100 - progressPercent }]

  // Month-over-month revenue trend
  const lastMonthCollected = monthlyRevenue.length >= 2 ? monthlyRevenue[monthlyRevenue.length - 2].naplaceno : 0
  const revTrendPct = lastMonthCollected > 0
    ? Math.round(((stats.collectedMonth - lastMonthCollected) / lastMonthCollected) * 100)
    : null
  const revTrendLabel = revTrendPct !== null
    ? (revTrendPct >= 0 ? t2('revTrendUp', { pct: Math.abs(revTrendPct) }) : t2('revTrendDown', { pct: Math.abs(revTrendPct) }))
    : (stats.expectedMonth > 0 ? t2('revExpectedSub', { amount: stats.expectedMonth }) : '')

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Setup banner — shown after new registration flow */}
      {showSetupBanner && (
        <SetupBanner onReady={() => setShowSetupBanner(false)} />
      )}

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}{trainerName ? `, ${trainerName}` : ''} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 capitalize">{dateStr}</p>
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setDashView('today')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dashView === 'today' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Sun size={13} /> {t2('viewToday')}
          </button>
          <button
            onClick={() => setDashView('global')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dashView === 'global' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Globe size={13} /> {t2('viewGlobal')}
          </button>
        </div>
      </div>

      {/* ── TODAY VIEW ── */}
      {dashView === 'today' && (() => {
        const todayDayName = (tDays as any)(String(new Date().getDay()))
        const submittedCount = todayCheckinClients.filter(c => c.submitted).length
        const waitingCount   = todayCheckinClients.filter(c => !c.submitted).length

        // Dark-mode aware stat definitions
        const miniStats = [
          {
            label: t2('miniStatCheckins'), value: todayCheckinClients.length,
            icon: CalendarDays,
            color: accentHex,
            bg: isDark ? `${accentHex}28` : `${accentHex}12`,
          },
          {
            label: t2('miniStatSubmitted'), value: submittedCount,
            icon: Check,
            color: isDark ? '#4ade80' : '#16a34a',
            bg: isDark ? 'rgba(22,163,74,0.2)' : '#dcfce7',
          },
          {
            label: t2('miniStatWaiting'), value: waitingCount,
            icon: Clock,
            color: isDark ? '#fbbf24' : '#d97706',
            bg: isDark ? 'rgba(217,119,6,0.2)' : '#fef3c7',
          },
          {
            label: t2('miniStatExpiring'), value: expiringPackages.length,
            icon: AlertTriangle,
            color: expiringPackages.length > 0
              ? (isDark ? '#f87171' : '#dc2626')
              : (isDark ? '#6b7280' : '#9ca3af'),
            bg: expiringPackages.length > 0
              ? (isDark ? 'rgba(220,38,38,0.2)' : '#fee2e2')
              : (isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb'),
          },
        ]

        const cardCls = isDark
          ? 'rounded-2xl border border-white/8 overflow-hidden'
          : 'bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'
        const cardStyle = isDark ? { background: 'oklch(0.195 0.018 264)' } : {}
        const headerBorderCls = isDark ? 'border-white/8' : 'border-gray-50'

        return (
          <div className="space-y-5">

            {/* Mini stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {miniStats.map(s => (
                <div
                  key={s.label}
                  className={`px-4 py-3.5 flex items-center gap-3 rounded-2xl border ${isDark ? 'border-white/8' : 'border-gray-100 shadow-sm bg-white'}`}
                  style={isDark ? { background: 'oklch(0.195 0.018 264)' } : {}}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
                    <s.icon size={16} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Check-ins today */}
              <div className={cardCls} style={cardStyle}>
                <div className={`flex items-center gap-3 px-5 py-4 border-b ${headerBorderCls}`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentHex}${isDark ? '28' : '15'}` }}>
                    <CalendarDays size={15} style={{ color: accentHex }} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t2('miniStatCheckins')}</p>
                    <p className={`text-xs capitalize ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{todayDayName}</p>
                  </div>
                  {todayCheckinClients.length > 0 && (
                    <button onClick={() => router.push('/dashboard/checkins')}
                      className="flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: accentHex }}>
                      {t2('allLink')} <ChevronRight size={12} />
                    </button>
                  )}
                </div>
                {todayCheckinClients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: `${accentHex}${isDark ? '20' : '10'}` }}>
                      <CalendarDays size={22} style={{ color: accentHex, opacity: 0.5 }} />
                    </div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t2('noCheckinsToday')}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t2('clientsWithCheckinOn')} {todayDayName}</p>
                  </div>
                ) : (
                  <div className={`divide-y ${isDark ? 'divide-white/6' : 'divide-gray-50'}`}>
                    {todayCheckinClients.map(c => (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/dashboard/clients/${c.id}?tab=checkin`)}
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors group ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentHex}${isDark ? '28' : '15'}` }}>
                          <span className="text-xs font-bold" style={{ color: accentHex }}>
                            {c.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className={`flex-1 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{c.full_name}</span>
                        {c.submitted ? (
                          <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                            <Check size={10} /> {t2('miniStatSubmitted')}
                          </span>
                        ) : (
                          <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            <Clock size={10} /> {t2('miniStatWaiting')}
                          </span>
                        )}
                        <ChevronRight size={13} className={`ml-1 transition-colors ${isDark ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-300 group-hover:text-gray-400'}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Expiring packages */}
              <div className={cardCls} style={cardStyle}>
                <div className={`flex items-center gap-3 px-5 py-4 border-b ${headerBorderCls}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? '' : 'bg-amber-50'}`}
                    style={isDark ? { backgroundColor: 'rgba(217,119,6,0.2)' } : {}}>
                    <Package size={15} style={{ color: isDark ? '#fbbf24' : undefined }} className={!isDark ? 'text-amber-500' : ''} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t2('packagesExpiringTitle')}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t2('expiresIn7Days')}</p>
                  </div>
                  {expiringPackages.length > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {expiringPackages.length}
                    </span>
                  )}
                </div>
                {expiringPackages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${isDark ? '' : 'bg-amber-50'}`}
                      style={isDark ? { backgroundColor: 'rgba(217,119,6,0.15)' } : {}}>
                      <Package size={22} style={{ color: isDark ? '#d97706' : undefined, opacity: 0.5 }} className={!isDark ? 'text-amber-300' : ''} />
                    </div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t2('noExpiringPackages')}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t2('allPackagesActiveThisWeek')}</p>
                  </div>
                ) : (
                  <div className={`divide-y max-h-[416px] overflow-y-auto ${isDark ? 'divide-white/6' : 'divide-gray-50'}`}>
                    {expiringPackages.map(pkg => {
                      const urgent = pkg.days_left <= 2
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => router.push(`/dashboard/clients/${pkg.client_id}?tab=paketi`)}
                          className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors group ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: urgent
                              ? (isDark ? 'rgba(220,38,38,0.2)' : undefined)
                              : (isDark ? 'rgba(217,119,6,0.2)' : undefined),
                            }}
                          >
                            <span
                              className={`text-xs font-bold ${!isDark ? (urgent ? 'text-red-500' : 'text-amber-600') : ''}`}
                              style={isDark ? { color: urgent ? '#f87171' : '#fbbf24' } : {}}
                            >
                              {pkg.client_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{pkg.client_name}</p>
                            <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{pkg.pkg_name}</p>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-0.5">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              pkg.days_left <= 0 || urgent
                                ? (isDark ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-red-50 text-red-600 border-red-100')
                                : (isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-amber-50 text-amber-700 border-amber-100')
                            }`}>
                              {pkg.days_left === 0 ? t2('expiresToday') : `${pkg.days_left}d`}
                            </span>
                          </div>
                          <ChevronRight size={13} className={`transition-colors ${isDark ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-300 group-hover:text-gray-400'}`} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Stat cards — 2 rows × 4 */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${dashView === 'today' ? 'hidden' : ''}`}>
        <StatCard icon={Users}         label={t2('statActiveClients')}         value={stats.activeClients}     color="accent"  onClick={() => router.push('/dashboard/clients')} />
        <StatCard icon={CheckCircle2}  label={t2('statCheckinThisWeek')}       value={stats.submitted}         color="emerald" sub={t2('statLateCount', { count: stats.late })} onClick={() => router.push('/dashboard/checkins')} />
        <StatCard icon={AlertCircle}   label={t2('statLateCheckin')}           value={stats.late}              color="rose"    onClick={() => router.push('/dashboard/checkins')} />
        <StatCard icon={TrendingUp}    label={t2('statAvgRegularity')}         value={`${stats.avgCheckinRate}%`} color="sky"  sub={t2('statCheckinRate')} />
        <StatCard icon={Banknote}      label={t2('statRevenueThisMonth')}      value={`${stats.collectedMonth}€`} color="emerald" sub={revTrendLabel} onClick={() => router.push('/dashboard/financije')} />
        <StatCard icon={AlertCircle}   label={t2('statLatePayments')}          value={stats.latePayments}      color="amber"   onClick={() => router.push('/dashboard/financije')} />
        <StatCard icon={MessageSquare} label={t2('statUnreadMessages')}        value={stats.unreadMessages}    color="accent"  onClick={() => router.push('/dashboard/chat')} />
        <StatCard icon={TrendingUp}    label={t2('statRevenueThisYear')}       value={`${yearRevenue}€`}       color="emerald" sub={stats.totalMonth > 0 ? t2('revThisMonthSub', { paid: stats.paidByStart, total: stats.totalMonth }) : ''} onClick={() => router.push('/dashboard/financije')} />
      </div>

      {/* Charts + checkin list */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-5 ${dashView === 'today' ? 'hidden' : ''}`}>

        {/* Revenue bar chart + Donut */}
        <DashboardRevenueCharts
          monthlyRevenue={monthlyRevenue}
          accentHex={accentHex}
          isDark={isDark}
          progressPercent={progressPercent}
          paidByStart={stats.paidByStart}
          totalMonth={stats.totalMonth}
          latePayments={stats.latePayments}
        />
      </div>

      {/* Recent activity feed */}
      {dashView === 'global' && recentActivity.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15` }}>
                <Activity size={14} style={{ color: accentHex }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t2('activityFeedTitle')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t2('activityFeedSub')}</p>
              </div>
            </div>
          </div>
          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-0.5">
            {recentActivity.map((item, idx) => {
              const icon = item.type === 'checkin'
                ? <ClipboardCheck size={13} style={{ color: accentHex }} />
                : item.type === 'message'
                ? <MessageSquare size={13} style={{ color: isDark ? '#38bdf8' : '#0284c7' }} />
                : <CreditCard size={13} style={{ color: isDark ? '#34d399' : '#059669' }} />
              const dot = item.type === 'checkin'
                ? { backgroundColor: isDark ? `${accentHex}35` : `${accentHex}20`, color: accentHex }
                : item.type === 'message'
                ? { backgroundColor: isDark ? 'rgba(2,132,199,0.22)' : '#e0f2fe', color: isDark ? '#38bdf8' : '#0284c7' }
                : { backgroundColor: isDark ? 'rgba(5,150,105,0.22)' : '#d1fae5', color: isDark ? '#34d399' : '#059669' }
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-colors group ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  onClick={() => item.clientId && router.push(`/dashboard/clients/${item.clientId}`)}
                >
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={dot}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.title}</span>
                    <span className={`text-xs ml-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.subtitle}</span>
                  </div>
                  <span className={`text-[11px] tabular-nums shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{item.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Checkin status — all clients (global view only) */}
      {dashView === 'global' && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{t2('checkinStatusTitle')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t2('checkinStatusSummary', { submitted: stats.submitted, late: stats.late, neutral: stats.neutral })}</p>
          </div>
          <button type="button" onClick={() => router.push('/dashboard/checkins')}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: accentHex }}>
            {t2('allCheckinsLink')} <ArrowRight size={12} />
          </button>
        </div>

        {clients.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('noUpcomingCheckins')}</p>
        ) : (
          <div className="max-h-[240px] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 divide-y divide-gray-50 sm:divide-y-0">
              {clients.map(c => (
                <CheckinRow key={c.id} client={c} onClick={() => router.push(`/dashboard/clients/${c.id}`)} />
              ))}
            </div>
          </div>
        )}
      </div>}

    </div>
  )
}

export default function DashboardPage() {
  const isLg = useIsLg()
  if (isLg === undefined) return null
  if (isLg) return <DashboardPageContent />
  return <MobileDashboard />
}
