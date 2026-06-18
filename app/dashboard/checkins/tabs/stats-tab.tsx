'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, CheckCircle2, Clock, HelpCircle, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

// Module-level stale-while-revalidate cache — avoids refetch on every tab switch.
// Stats don't need to be real-time; a 3-minute window is fine.
const STATS_STALE_MS = 3 * 60 * 1000
let _statsCache: {
  stats: any; trendData: any[]; dayDist: any[]; topClients: any[];
  lateClients: any[]; compRate: any[]
} | null = null
let _statsFetchedAt = 0

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getStatus(checkinDay: number | null, lastCheckin: string | null): 'submitted' | 'late' | 'neutral' {
  if (checkinDay === null) return 'neutral'
  const today = new Date()
  const rawDaysBack = (today.getDay() - checkinDay + 7) % 7

  if (rawDaysBack === 0) {
    if (!lastCheckin) return 'neutral'
    return lastCheckin >= isoDate(today) ? 'submitted' : 'neutral'
  }

  const expected = new Date(today)
  expected.setDate(today.getDate() - rawDaysBack)
  const expectedStr = isoDate(expected)

  if (!lastCheckin) return 'neutral'
  return lastCheckin >= expectedStr ? 'submitted' : 'late'
}

function avatarStyle(gender: string | null): string {
  if (gender === 'F') return 'bg-gradient-to-br from-rose-400 to-pink-500'
  if (gender === 'M') return 'bg-gradient-to-br from-sky-400 to-blue-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-500'
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function StatCard({ icon: Icon, label, value, sub, color, isDark }: any) {
  return (
    <div
      className="rounded-xl border p-4 relative overflow-hidden transition-all"
      style={{
        background: isDark ? `color-mix(in srgb, ${color} 10%, oklch(0.195 0.018 264))` : `color-mix(in srgb, ${color} 7%, white)`,
        borderColor: isDark ? `color-mix(in srgb, ${color} 25%, transparent)` : `color-mix(in srgb, ${color} 20%, #e5e7eb)`,
      }}
    >
      <div className="absolute -right-2 -top-2 w-14 h-14 rounded-full pointer-events-none" style={{ backgroundColor: `${color}0c` }} />
      <div className="flex items-start justify-between mb-3 relative">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}22`, color }}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-black leading-none relative" style={{ color }}>{value}</p>
      <p className={`text-sm font-medium mt-1 relative ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</p>
      {sub && <p className={`text-xs mt-0.5 relative ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label, unit = '' }: any) => {
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: isDark ? '#1e2030' : '#ffffff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : '#f3f4f6'}`,
      boxShadow: isDark ? '0 4px 16px rgb(0 0 0 / 0.5)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    }} className="rounded-xl px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.fill || p.stroke }} />
          <span className="text-gray-500">{p.name}: </span>
          <span className="font-semibold text-gray-700">{p.value}{unit}</span>
        </div>
      ))}
    </div>
  )
}

export default function CheckinStatsTab() {
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isDark = mode === 'dark'
  const router = useRouter()
  const tDays = useTranslations('daysShort')
  const tMonths = useTranslations('common.months')
  const t = useTranslations('checkins.statsTab')
  const t2 = useTranslations('checkins2')

  const [loading, setLoading] = useState(() => !_statsCache)
  const [stats, setStats] = useState(() => _statsCache?.stats ?? { submitted: 0, late: 0, neutral: 0, total: 0 })
  const [trendData, setTrendData] = useState(() => _statsCache?.trendData ?? [])
  const [dayDist, setDayDist] = useState(() => _statsCache?.dayDist ?? [])
  const [topClients, setTopClients] = useState(() => _statsCache?.topClients ?? [])
  const [lateClients, setLateClients] = useState(() => _statsCache?.lateClients ?? [])
  const [compRate, setCompRate] = useState(() => _statsCache?.compRate ?? [])

  useEffect(() => {
    const fresh = _statsCache && Date.now() - _statsFetchedAt < STATS_STALE_MS
    if (fresh) { setLoading(false); return }
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    const nineMonthsAgo = new Date()
    nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9)
    const nineMonthsAgoStr = isoDate(nineMonthsAgo)

    // Single parallel round: embed checkin_config in clients, fetch checkins by trainer concurrently
    // Limit checkins to 20 000 rows — covers 100 clients × 200 check-ins (>3 years weekly) with headroom.
    const [{ data: clientsData }, { data: allCheckins }] = await Promise.all([
      supabase.from('clients')
        .select(`id, gender, profiles!clients_user_id_fkey(full_name), checkin_config(checkin_day)`)
        .eq('trainer_id', user.id).eq('active', true),
      supabase.from('checkins')
        .select('client_id, date')
        .eq('trainer_id', user.id)
        .gte('date', nineMonthsAgoStr)
        .order('date', { ascending: false })
        .limit(20000),
    ])

    if (!clientsData?.length) { setLoading(false); return }

    const configMap: Record<string, number | null> = {}
    clientsData.forEach((c: any) => {
      const ccRaw = c.checkin_config
      configMap[c.id] = Array.isArray(ccRaw) ? (ccRaw[0]?.checkin_day ?? null) : (ccRaw?.checkin_day ?? null)
    })

    const myCheckins = allCheckins || []

    const lastMap: Record<string, string> = {}
    myCheckins.forEach(c => { if (!lastMap[c.client_id]) lastMap[c.client_id] = c.date })

    // Summary counts
    let submitted = 0, late = 0, neutral = 0
    const lateList: any[] = []
    for (const c of clientsData) {
      const s = getStatus(configMap[c.id] ?? null, lastMap[c.id] || null)
      if (s === 'submitted') submitted++
      else if (s === 'late') {
        late++
        lateList.push({ id: c.id, name: (c.profiles as any)?.full_name || '—', gender: c.gender, last: lastMap[c.id] || null })
      }
      else neutral++
    }
    setStats({ submitted, late, neutral, total: clientsData.length })
    setLateClients(lateList.slice(0, 5))

    // Monthly trend (last 8 months)
    const now = new Date()
    const monthMap: Record<string, number> = {}
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
    }
    myCheckins.forEach(c => {
      const key = c.date?.slice(0, 7)
      if (key && key in monthMap) monthMap[key]++
    })
    setTrendData(
      Object.entries(monthMap).map(([k, count]) => ({
        month: tMonths(String(parseInt(k.slice(5)) - 1) as any),
        count,
      }))
    )

    // Day distribution — use configMap built above (configMap[clientId] = checkin_day | null)
    const dayCount: Record<number, number> = {}
    Object.values(configMap).forEach(day => {
      if (day != null) dayCount[day] = (dayCount[day] || 0) + 1
    })
    setDayDist(
      [0,1,2,3,4,5,6].map(i => ({ day: i, count: dayCount[i] || 0 })).filter(d => d.count > 0)
    )

    // Top clients by checkin count
    const clientCheckinCount: Record<string, number> = {}
    myCheckins.forEach(c => { clientCheckinCount[c.client_id] = (clientCheckinCount[c.client_id] || 0) + 1 })
    const sorted = Object.entries(clientCheckinCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    setTopClients(sorted.map(([id, count]) => {
      const c = clientsData.find(x => x.id === id)
      return { id, name: (c?.profiles as any)?.full_name || '—', gender: c?.gender || null, count }
    }))

    // Weekly completion rate (last 8 weeks) — single-pass bucketing: O(N) not O(8N)
    const weekBounds: { start: string; end: string; label: string }[] = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - i * 7 - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)
      weekBounds.push({
        start: weekStart.toISOString().slice(0, 10),
        end: weekEnd.toISOString().slice(0, 10),
        label: i === 0 ? t2('thisWeekLabel') : `T-${i}`,
      })
    }
    const weekSets: Map<number, Set<string>> = new Map(weekBounds.map((_, idx) => [idx, new Set()]))
    myCheckins.forEach(c => {
      for (let idx = 0; idx < weekBounds.length; idx++) {
        const wb = weekBounds[idx]
        if (c.date >= wb.start && c.date < wb.end) { weekSets.get(idx)!.add(c.client_id); break }
      }
    })
    // Weekly completion rate — denominator = clients with a checkin_day configured
    const configured = Object.values(configMap).filter(d => d != null).length || 1
    const weekRates = weekBounds.map((wb, idx) => ({
      week: wb.label,
      rate: Math.min(Math.round((weekSets.get(idx)!.size / Math.max(configured, 1)) * 100), 100),
    }))
    setCompRate(weekRates)

    _statsCache = { stats: { submitted, late, neutral, total: clientsData.length }, trendData: Object.entries(monthMap).map(([k, count]) => ({ month: tMonths(String(parseInt(k.slice(5)) - 1) as any), count })), dayDist: [0,1,2,3,4,5,6].map(i => ({ day: i, count: dayCount[i] || 0 })).filter(d => d.count > 0), topClients: sorted.map(([id, count]) => { const c = clientsData.find(x => x.id === id); return { id, name: (c?.profiles as any)?.full_name || '—', gender: c?.gender || null, count } }), lateClients: lateList.slice(0, 5), compRate: weekRates }
    _statsFetchedAt = Date.now()

    setLoading(false)
  }

  const submissionRate = stats.total > 0 ? Math.round((stats.submitted / (stats.submitted + stats.late || 1)) * 100) : 0
  const pieData = [
    { name: t('submitted'), value: stats.submitted, color: '#10b981' },
    { name: t('late'), value: stats.late, color: '#ef4444' },
    { name: t('allClients'), value: stats.neutral, color: '#d1d5db' },
  ].filter(d => d.value > 0)

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1,2,3,4].map(i => <div key={i} className={`h-24 rounded-xl animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2} label={t('totalSubmitted')} value={stats.submitted}
          sub={`${submissionRate}%`} color="#10b981" isDark={isDark} />
        <StatCard icon={Clock} label={t('late')} value={stats.late}
          sub={t('allClients')} color="#ef4444" isDark={isDark} />
        <StatCard icon={HelpCircle} label={t('noCheckins')} value={stats.neutral}
          sub="" color="#6b7280" isDark={isDark} />
        <StatCard
          icon={submissionRate >= 80 ? TrendingUp : submissionRate >= 50 ? Minus : TrendingDown}
          label={t('submitted')} value={`${submissionRate}%`}
          sub=""
          color={submissionRate >= 80 ? accentHex : submissionRate >= 50 ? '#d97706' : '#ef4444'}
          isDark={isDark} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Pie status */}
        <div className={`rounded-xl border p-4 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`} style={isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{t('clientStatusDist')}</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={30} outerRadius={50} paddingAngle={3} strokeWidth={0}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{d.name}</span>
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Day distribution */}
        <div className={`rounded-xl border p-4 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`} style={isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{t('checkinsByDay')}</h3>
          {dayDist.length === 0 ? (
            <p className={`text-xs py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('noCheckins')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={dayDist.map(d => ({ ...d, label: tDays(String(d.day) as any) }))} barSize={20} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }} />
                <Bar dataKey="count" name={t('count')} fill={accentHex} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weekly compliance */}
        <div className={`rounded-xl border p-4 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`} style={isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{t('submitted')} (8w)</h3>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={compRate} margin={{ top: 2, right: 4, bottom: 0, left: -30 }}>
              <defs>
                <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentHex} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={accentHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip content={<CustomTooltip unit="%" />} />
              <Area type="monotone" dataKey="rate" name={t('submitted')} stroke={accentHex} strokeWidth={2} fill="url(#compGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly trend */}
      <div className={`rounded-xl border p-4 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`} style={isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined}>
        <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{t('checkinsByMonth')}</h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={trendData} barSize={28} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentHex} stopOpacity={0.9} />
                <stop offset="95%" stopColor={accentHex} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }} />
            <Bar dataKey="count" name={t('totalSubmitted')} fill="url(#barGrad)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: top + late clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top clients */}
        <div className={`rounded-xl border p-4 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`} style={isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined}>
          <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{t('allClients')}</h3>
          {topClients.length === 0 ? (
            <p className={`text-xs py-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('noCheckins')}</p>
          ) : (
            <div className="space-y-2">
              {topClients.map((c, i) => (
                <button key={c.id} onClick={() => router.push(`/dashboard/checkins/${c.id}`)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left group ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`}>
                  <span className={`w-5 text-xs font-bold shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>{i + 1}.</span>
                  <div className={`w-7 h-7 rounded-lg ${avatarStyle(c.gender)} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{getInitials(c.name)}</span>
                  </div>
                  <span className={`flex-1 text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{c.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: `${accentHex}18`, color: accentHex }}>
                    {String(c.count) + ' ' + t2('checkinCountSuffix')}
                  </span>
                  <ChevronRight size={13} className={`${isDark ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-300 group-hover:text-gray-500'}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Late clients */}
        <div className={`rounded-xl border p-4 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`} style={isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined}>
          <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-100' : 'text-gray-700'}`}>{t('late')}</h3>
          {lateClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6">
              <CheckCircle2 size={24} className="text-emerald-400 mb-2" />
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('onTime')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lateClients.map(c => (
                <button key={c.id} onClick={() => router.push(`/dashboard/checkins/${c.id}`)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left group ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                  <div className={`w-7 h-7 rounded-lg ${avatarStyle(c.gender)} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{getInitials(c.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{c.name}</p>
                    <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {c.last ? new Date(c.last).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-50 text-red-600 border border-red-100'}`}>{t('late')}</span>
                  <ChevronRight size={13} className={`${isDark ? 'text-gray-600 group-hover:text-red-400' : 'text-gray-300 group-hover:text-red-400'}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
