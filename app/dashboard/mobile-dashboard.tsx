'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Users, AlertTriangle, Banknote, MessageSquare,
  ChevronRight, CheckCircle2, Clock, UserPlus, TrendingUp, ArrowRight,
} from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTranslations } from 'next-intl'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

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

type MiniClient = {
  id: string; full_name: string; gender: string | null
  checkin_day: number | null; last_checkin: string | null
  status: 'submitted' | 'late' | 'neutral'
}

export default function MobileDashboard() {
  const router = useRouter()
  const { accent, mode } = useAppTheme()
  const isDark = mode === 'dark'
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const t2 = useTranslations('dashboard2')
  const tNav = useTranslations('nav')

  const [trainerName, setTrainerName] = useState('')
  const [totalClients, setTotalClients] = useState(0)
  const [lateClients, setLateClients] = useState<MiniClient[]>([])
  const [submittedToday, setSubmittedToday] = useState(0)
  const [revenueMonth, setRevenueMonth] = useState(0)
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const _now    = new Date()
    const mStart  = new Date(_now.getFullYear(), _now.getMonth(), 1).toISOString().slice(0, 10)
    const mEnd    = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().slice(0, 10)

    const [{ data: profile }, { data: clients }, { data: payments }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabase.from('clients')
        .select(`id, gender, profiles!clients_user_id_fkey(full_name)`)
        .eq('trainer_id', user.id).eq('active', true),
      supabase.from('payments')
        .select('amount, status')
        .eq('trainer_id', user.id)
        .or(`status.eq.unpaid,and(status.eq.paid,paid_at.gte.${mStart},paid_at.lte.${mEnd}T23:59:59)`),
    ])
    setTrainerName(profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || t2('fallbackTrainer'))

    setTotalClients(clients?.length || 0)

    const paid = (payments || []).filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
    const unpaid = (payments || []).filter(p => p.status !== 'paid').length
    setRevenueMonth(paid)
    setUnpaidCount(unpaid)

    if (!clients?.length) { setLoading(false); return }

    const [{ data: cfgData }, { data: ciData }] = await Promise.all([
      supabase.from('checkin_config').select('client_id, checkin_day').in('client_id', clients.map((c: any) => c.id)),
      supabase.rpc('get_trainer_last_checkins', { p_trainer_id: user.id }),
    ])

    const cfgMap: Record<string, number | null> = {}
    for (const c of (cfgData || [])) cfgMap[c.client_id] = c.checkin_day
    const lastMap: Record<string, string> = {}
    for (const c of (ciData || [])) lastMap[c.client_id] = c.last_date

    const withStatus: MiniClient[] = clients.map((c: any) => ({
      id: c.id,
      full_name: c.profiles?.full_name || '—',
      gender: c.gender || null,
      checkin_day: cfgMap[c.id] ?? null,
      last_checkin: lastMap[c.id] ?? null,
      status: getStatus(cfgMap[c.id] ?? null, lastMap[c.id] ?? null),
    }))

    setLateClients(withStatus.filter(c => c.status === 'late'))
    setSubmittedToday(withStatus.filter(c => c.status === 'submitted').length)
    setLoading(false)
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? t2('greetingMorning') : now.getHours() < 18 ? t2('greetingAfternoon') : t2('greetingEvening')

  const cardBg     = isDark ? 'oklch(0.2 0.025 264)' : 'white'
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'
  const textPrimary   = isDark ? 'white' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const rowDivider    = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-3xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }} />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }} />)}
      </div>
    </div>
  )

  const neutralCount = totalClients - lateClients.length - submittedToday

  return (
    <div className="space-y-4 pb-4">

      {/* ── Greeting hero ── */}
      <div
        className="rounded-3xl px-5 py-5 text-white overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${accentHex} 0%, color-mix(in srgb, ${accentHex} 60%, #050010) 100%)` }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-15 pointer-events-none"
          style={{ backgroundColor: 'white' }} />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-10 pointer-events-none"
          style={{ backgroundColor: 'white' }} />

        <p className="text-white/70 text-sm font-medium">{greeting},</p>
        <p className="text-white font-black text-2xl leading-tight mt-0.5">{trainerName.split(' ')[0]}</p>

        {/* Stats row */}
        <div className="flex items-center gap-5 mt-4">
          <div>
            <p className="text-white/60 text-[11px] uppercase tracking-wide font-semibold">{t2('mobileRevenue')}</p>
            <p className="text-white font-black text-xl leading-tight">{revenueMonth.toLocaleString('hr-HR')} €</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <p className="text-white/60 text-[11px] uppercase tracking-wide font-semibold">{t2('mobileStat1')}</p>
            <p className="text-white font-black text-xl leading-tight">{totalClients}</p>
          </div>
          {unpaidCount > 0 && (
            <>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-white/60 text-[11px] uppercase tracking-wide font-semibold">{t2('mobilePending')}</p>
                <p className="text-yellow-300 font-black text-xl leading-tight">{unpaidCount}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Check-in pulse ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: textSecondary }}>Check-ini ovog tjedna</p>
          <button
            onClick={() => router.push('/dashboard/checkins')}
            className="flex items-center gap-1 text-xs font-semibold transition-opacity active:opacity-60"
            style={{ color: accentHex }}
          >
            Sve <ArrowRight size={12} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-1">
          <div className="flex gap-1 h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
            {submittedToday > 0 && (
              <div className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round((submittedToday / Math.max(totalClients, 1)) * 100)}%` }} />
            )}
            {lateClients.length > 0 && (
              <div className="h-full rounded-full bg-red-500 transition-all"
                style={{ width: `${Math.round((lateClients.length / Math.max(totalClients, 1)) * 100)}%` }} />
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x px-0 pb-3 pt-2"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
          {[
            { label: 'Predano',    value: submittedToday,     color: '#10b981', bg: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4' },
            { label: 'Kasne',      value: lateClients.length, color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2' },
            { label: 'Na čekanju', value: neutralCount,       color: isDark ? '#6b7280' : '#9ca3af', bg: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-1" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
              <p className="text-xl font-black leading-none" style={{ color: s.value > 0 ? s.color : textSecondary }}>{s.value}</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: textSecondary }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Late check-ins ── */}
      {lateClients.length > 0 && (
        <div className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: cardBg, borderColor: isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2' }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'}` }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2' }}>
                <AlertTriangle size={13} className="text-red-500" />
              </div>
              <p className="text-sm font-bold" style={{ color: isDark ? '#f87171' : '#dc2626' }}>
                {t2('mobileLateTitle', { count: lateClients.length })}
              </p>
            </div>
          </div>
          {lateClients.slice(0, 4).map((c, idx) => (
            <div key={c.id}
              onClick={() => router.push(`/dashboard/clients/${c.id}`)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
              style={{ borderTop: idx > 0 ? `1px solid ${rowDivider}` : 'none' }}
            >
              <div className={`w-9 h-9 rounded-xl ${avatarCls(c.gender)} flex items-center justify-center shrink-0`}>
                <span className="text-white text-xs font-bold">{getInitials(c.full_name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{c.full_name}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); router.push(`/dashboard/chat?clientId=${c.id}`) }}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: isDark ? '#60a5fa' : '#3b82f6' }}
              >
                <MessageSquare size={14} />
              </button>
              <ChevronRight size={14} style={{ color: isDark ? '#374151' : '#d1d5db' }} />
            </div>
          ))}
          {lateClients.length > 4 && (
            <button onClick={() => router.push('/dashboard/clients')}
              className="w-full py-3 text-xs font-semibold text-center transition-colors"
              style={{ color: accentHex, borderTop: `1px solid ${rowDivider}` }}>
              {t2('mobileSeeAll', { count: lateClients.length })}
            </button>
          )}
        </div>
      )}

      {/* ── All good banner ── */}
      {lateClients.length === 0 && submittedToday > 0 && (
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4', border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : '#bbf7d0'}` }}>
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <p className="text-sm font-semibold" style={{ color: isDark ? '#34d399' : '#059669' }}>
            {t2('mobileSubmittedCount', { count: submittedToday })}
          </p>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: textSecondary }}>{t2('mobileQuickActions')}</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: t2('mobileNewClient'),
              icon: UserPlus,
              iconBg: `${accentHex}1a`,
              iconColor: accentHex,
              action: () => router.push('/dashboard/clients?action=add'),
            },
            {
              label: tNav('chat'),
              icon: MessageSquare,
              iconBg: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
              iconColor: isDark ? '#60a5fa' : '#3b82f6',
              action: () => router.push('/dashboard/chat'),
            },
            {
              label: tNav('clients'),
              icon: Users,
              iconBg: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
              iconColor: isDark ? '#9ca3af' : '#6b7280',
              action: () => router.push('/dashboard/clients'),
            },
            {
              label: tNav('finance'),
              icon: Banknote,
              iconBg: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
              iconColor: isDark ? '#34d399' : '#10b981',
              action: () => router.push('/dashboard/financije'),
            },
          ].map(a => {
            const Icon = a.icon
            return (
              <button
                key={a.label}
                onClick={a.action}
                className="flex items-center gap-3 p-4 rounded-2xl border text-left active:scale-95 transition-transform"
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: a.iconBg }}>
                  <Icon size={18} style={{ color: a.iconColor }} />
                </div>
                <span className="text-sm font-semibold leading-tight" style={{ color: textPrimary }}>{a.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
