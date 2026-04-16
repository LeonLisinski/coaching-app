'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MessageSquare, Package, Calendar, Mail,
  Phone, ClipboardCheck, AlertTriangle, CheckCircle2, Clock, Monitor,
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

// ── helpers ───────────────────────────────────────────────────────────────────
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getCheckinStatus(day: number | null, last: string | null): 'submitted' | 'late' | 'neutral' {
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
function avatarGrad(gender: string | null) {
  if (gender === 'F') return 'linear-gradient(135deg, #be123c, #881337)'
  if (gender === 'M') return 'linear-gradient(135deg, #1d4ed8, #1e3a8a)'
  return 'linear-gradient(135deg, #374151, #1f2937)'
}

// ── types ─────────────────────────────────────────────────────────────────────
type ClientDetail = {
  id: string; full_name: string; email: string; phone?: string | null
  gender: string | null; active: boolean; start_date: string | null
  goal: string | null; notes: string | null
  packageName: string | null; packageColor: string | null; packageEnd: string | null
  checkinDay: number | null; lastCheckin: string | null
  checkinStatus: 'submitted' | 'late' | 'neutral'
}

// ── component ─────────────────────────────────────────────────────────────────
export default function MobileClientDetail() {
  const { id } = useParams()
  const router  = useRouter()
  const tDetail = useTranslations('clientDetail')
  const tDays   = useTranslations('days')
  const tCheckins2 = useTranslations('checkins2')
  const locale = useLocale()

  const STATUS_CFG = {
    submitted: { icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', label: tCheckins2('statusSubmitted') },
    late:      { icon: AlertTriangle, color: '#dc2626', bg: '#fef2f2', label: tCheckins2('statusLate') },
    neutral:   { icon: Clock,        color: '#6b7280', bg: '#f9fafb', label: tCheckins2('statusWaiting') },
  }

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`
        id, goal, active, gender, notes, start_date,
        profiles!clients_user_id_fkey (full_name, email, phone)
      `)
      .eq('id', id)
      .single()

    if (!data) { setLoading(false); return }

    const [{ data: pkgData }, { data: cfgData }, { data: ciData }] = await Promise.all([
      supabase.from('client_packages').select('end_date, packages(name, color)')
        .eq('client_id', id).eq('status', 'active').maybeSingle(),
      supabase.from('checkin_config').select('checkin_day')
        .eq('client_id', id).maybeSingle(),
      supabase.from('checkins').select('date')
        .eq('client_id', id).order('date', { ascending: false }).limit(1).maybeSingle(),
    ])

    const day = cfgData?.checkin_day ?? null
    const last = ciData?.date ?? null

    setClient({
      id: data.id,
      full_name: (data.profiles as any)?.full_name || tDetail('mobileNoName'),
      email: (data.profiles as any)?.email || '',
      phone: (data.profiles as any)?.phone || null,
      gender: (data as any).gender || null,
      active: data.active,
      start_date: data.start_date,
      goal: data.goal,
      notes: data.notes,
      packageName: (pkgData?.packages as any)?.name ?? null,
      packageColor: (pkgData?.packages as any)?.color ?? null,
      packageEnd: pkgData?.end_date ?? null,
      checkinDay: day,
      lastCheckin: last,
      checkinStatus: getCheckinStatus(day, last),
    })
    setLoading(false)
  }

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-40 bg-gray-200 rounded-3xl" />
      <div className="h-24 bg-gray-100 rounded-2xl" />
      <div className="h-24 bg-gray-100 rounded-2xl" />
    </div>
  )
  if (!client) return <p className="text-center text-gray-400 py-16">{tDetail('notFound')}</p>

  const sc = STATUS_CFG[client.checkinStatus]
  const StatusIcon = sc.icon
  const daysLeft = client.packageEnd
    ? Math.ceil((new Date(client.packageEnd).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="space-y-4 pb-6">
      {/* Hero card */}
      <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: avatarGrad(client.gender) }}>
        <div className="px-5 pt-4 pb-5">
          {/* Back */}
          <button onClick={() => router.push('/dashboard/clients')}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors mb-4">
            <ArrowLeft size={16} className="text-white" />
          </button>

          <div className="flex items-end justify-between">
            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <span className="text-white font-black text-lg">{getInitials(client.full_name)}</span>
              </div>
              <div>
                <h1 className="text-white font-black text-xl leading-tight">{client.full_name}</h1>
                {client.goal && <p className="text-white/60 text-xs mt-0.5 truncate max-w-[180px]">{client.goal}</p>}
              </div>
            </div>

            {/* Chat button */}
            <button
              onClick={() => router.push(`/dashboard/chat?clientId=${client.id}`)}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <MessageSquare size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Check-in status */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: sc.bg }}>
          <StatusIcon size={18} style={{ color: sc.color }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{sc.label}</p>
          {client.checkinDay !== null && (
            <p className="text-xs text-gray-400 mt-0.5">
              {tDetail('mobileCheckinDay')} {tDays(String(client.checkinDay) as any)}
              {client.lastCheckin && `${tDetail('mobileLast')}${new Date(client.lastCheckin).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}`}
            </p>
          )}
          {client.checkinDay === null && (
            <p className="text-xs text-gray-400 mt-0.5">{tDetail('mobileCheckinNotConfigured')}</p>
          )}
        </div>
      </div>

      {/* Package */}
      {client.packageName ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${client.packageColor || '#6b7280'}20` }}>
            <Package size={18} style={{ color: client.packageColor || '#6b7280' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{client.packageName}</p>
            {daysLeft !== null && (
              <p className={`text-xs mt-0.5 font-medium ${daysLeft <= 7 ? 'text-red-500' : 'text-gray-400'}`}>
                {daysLeft <= 0
                  ? tDetail('mobilePackageExpired')
                  : tDetail('mobilePackageExpiresIn', { days: daysLeft })
                }
                {client.packageEnd && ` · ${new Date(client.packageEnd).toLocaleDateString(locale)}`}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 opacity-60">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Package size={18} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">{tDetail('mobileNoPackage')}</p>
        </div>
      )}

      {/* Contact info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {client.email && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Mail size={14} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-700 truncate">{client.email}</p>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Phone size={14} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-700">{client.phone}</p>
          </div>
        )}
        {client.start_date && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Calendar size={14} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-700">
              {tDetail('collabSince')} {new Date(client.start_date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        )}
        {client.notes && (
          <div className="pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400 font-medium mb-1">{tDetail('notesLabel')}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Desktop-only notice */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 p-4">
        <Monitor size={16} className="text-gray-400 shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Planovi treninga, prehrana i check-in konfiguracija dostupni su na desktop verziji.
        </p>
      </div>

      {/* Primary action */}
      <button
        onClick={() => router.push(`/dashboard/chat?clientId=${client.id}`)}
        className="w-full h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform"
        style={{ backgroundColor: 'var(--app-accent)' }}
      >
        <MessageSquare size={18} />
        {tDetail('mobileSendMessage')}
      </button>
    </div>
  )
}
