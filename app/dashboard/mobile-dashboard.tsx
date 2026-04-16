'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Users, AlertTriangle, Banknote, MessageSquare,
  ChevronRight, CheckCircle2, Clock, UserPlus, ClipboardList,
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
  const { accent } = useAppTheme()
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    setTrainerName(profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || t2('fallbackTrainer'))

    const [{ data: clients }, { data: payments }] = await Promise.all([
      supabase.from('clients')
        .select(`id, gender, profiles!clients_user_id_fkey(full_name)`)
        .eq('trainer_id', user.id).eq('active', true),
      supabase.from('payments')
        .select('amount, status')
        .eq('trainer_id', user.id),
    ])

    setTotalClients(clients?.length || 0)

    const paid = (payments || []).filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
    const unpaid = (payments || []).filter(p => p.status !== 'paid').length
    setRevenueMonth(paid)
    setUnpaidCount(unpaid)

    if (!clients?.length) { setLoading(false); return }

    const ids = clients.map((c: any) => c.id)
    const [{ data: cfgData }, { data: ciData }] = await Promise.all([
      supabase.from('checkin_config').select('client_id, checkin_day').in('client_id', ids),
      supabase.from('checkins').select('client_id, date').in('client_id', ids).order('date', { ascending: false }),
    ])

    const cfgMap: Record<string, number | null> = {}
    for (const c of (cfgData || [])) cfgMap[c.client_id] = c.checkin_day
    const lastMap: Record<string, string> = {}
    for (const c of (ciData || [])) { if (!lastMap[c.client_id]) lastMap[c.client_id] = c.date }

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

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 bg-gray-100 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  )

  const stats = [
    { label: t2('mobileStat1'), value: totalClients,        icon: Users,          color: accentHex     },
    { label: t2('mobileStat2'), value: lateClients.length,  icon: AlertTriangle,  color: lateClients.length > 0 ? '#dc2626' : '#16a34a' },
    { label: t2('mobileStat3'), value: submittedToday,      icon: CheckCircle2,   color: '#16a34a'  },
    { label: t2('mobileStat4'), value: unpaidCount,         icon: Banknote,       color: unpaidCount > 0 ? '#d97706' : '#6b7280' },
  ]

  return (
    <div className="space-y-5 pb-4">
      {/* Greeting */}
      <div className="rounded-3xl px-5 py-5 text-white overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${accentHex} 0%, color-mix(in srgb, ${accentHex} 70%, #0f0a1e) 100%)` }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
          style={{ backgroundColor: 'white' }} />
        <p className="text-white/70 text-sm">{greeting},</p>
        <p className="text-white font-black text-2xl leading-tight mt-0.5">
          {trainerName.split(' ')[0]}
        </p>
        <div className="flex items-center gap-4 mt-4">
          <div>
            <p className="text-white/60 text-xs">{t2('mobileRevenue')}</p>
            <p className="text-white font-black text-lg leading-tight">{revenueMonth.toLocaleString('hr-HR')} €</p>
          </div>
          {unpaidCount > 0 && (
            <div>
              <p className="text-white/60 text-xs">{t2('mobilePending')}</p>
              <p className="text-yellow-300 font-black text-lg leading-tight">{unpaidCount} pl.</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                style={{ backgroundColor: `${s.color}18` }}>
                <Icon size={18} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-black text-gray-900 leading-tight">{s.value}</p>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5 leading-tight">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Late check-ins */}
      {lateClients.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-gray-50">
            <AlertTriangle size={15} className="text-red-500" />
            <p className="text-sm font-bold text-gray-900">{t2('mobileLateTitle', { count: lateClients.length })}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {lateClients.slice(0, 5).map(c => (
              <div key={c.id}
                onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer">
                <div className={`w-9 h-9 rounded-xl ${avatarCls(c.gender)} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-xs font-bold">{getInitials(c.full_name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/dashboard/chat?clientId=${c.id}`) }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: '#eff6ff' }}
                >
                  <MessageSquare size={14} className="text-blue-500" />
                </button>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            ))}
          </div>
          {lateClients.length > 5 && (
            <button onClick={() => router.push('/dashboard/clients')}
              className="w-full py-3 text-xs font-semibold text-center border-t border-gray-50"
              style={{ color: accentHex }}>
              {t2('mobileSeeAll', { count: lateClients.length })}
            </button>
          )}
        </div>
      )}

      {/* Submitted — if no late */}
      {lateClients.length === 0 && submittedToday > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3.5">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <p className="text-sm font-semibold text-emerald-700">{t2('mobileSubmittedCount', { count: submittedToday })}</p>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t2('mobileQuickActions')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/dashboard/clients?action=add')}
            className="flex items-center gap-2.5 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${accentHex}18` }}>
              <UserPlus size={16} style={{ color: accentHex }} />
            </div>
            <span className="text-sm font-semibold text-gray-700">{t2('mobileNewClient')}</span>
          </button>
          <button onClick={() => router.push('/dashboard/chat')}
            className="flex items-center gap-2.5 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
              <MessageSquare size={16} className="text-blue-500" />
            </div>
            <span className="text-sm font-semibold text-gray-700">{tNav('chat')}</span>
          </button>
          <button onClick={() => router.push('/dashboard/clients')}
            className="flex items-center gap-2.5 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50">
              <Users size={16} className="text-gray-500" />
            </div>
            <span className="text-sm font-semibold text-gray-700">{tNav('clients')}</span>
          </button>
          <button onClick={() => router.push('/dashboard/financije')}
            className="flex items-center gap-2.5 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50">
              <Banknote size={16} className="text-emerald-500" />
            </div>
            <span className="text-sm font-semibold text-gray-700">{tNav('finance')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
