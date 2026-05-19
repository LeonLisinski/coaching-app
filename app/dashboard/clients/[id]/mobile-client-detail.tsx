'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MessageSquare, Package, Calendar, Mail,
  Phone, AlertTriangle, CheckCircle2, Clock, Monitor,
  FileText, Eye, EyeOff, ChevronRight, Loader2,
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'
import dynamic from 'next/dynamic'
import type { SavedReport } from '@/app/dashboard/clients/[id]/components/weekly-report-detail-dialog'

const WeeklyReportDetailDialog = dynamic(
  () => import('@/app/dashboard/clients/[id]/components/weekly-report-detail-dialog'),
  { ssr: false, loading: () => null }
)

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
// Subtle, dark-premium gradients (no harsh pinks/blues)
function avatarGrad(gender: string | null) {
  if (gender === 'F') return 'linear-gradient(135deg, #9f1239 0%, #4a0519 100%)'
  if (gender === 'M') return 'linear-gradient(135deg, #1e3a8a 0%, #0f1e4d 100%)'
  return 'linear-gradient(135deg, #374151 0%, #1f2937 100%)'
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
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const STATUS_CFG = {
    submitted: {
      icon: CheckCircle2,
      color: isDark ? '#34d399' : '#16a34a',
      bg: isDark ? 'rgba(52,211,153,0.12)' : '#f0fdf4',
      label: tCheckins2('statusSubmitted'),
    },
    late: {
      icon: AlertTriangle,
      color: isDark ? '#f87171' : '#dc2626',
      bg: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      label: tCheckins2('statusLate'),
    },
    neutral: {
      icon: Clock,
      color: isDark ? '#6b7280' : '#6b7280',
      bg: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
      label: tCheckins2('statusWaiting'),
    },
  }

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<SavedReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null)
  const [reportDetailOpen, setReportDetailOpen] = useState(false)

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

    const [{ data: pkgData }, { data: cfgData }, { data: ciData }, { data: rptData }] = await Promise.all([
      supabase.from('client_packages').select('end_date, packages(name, color)')
        .eq('client_id', id).eq('status', 'active').maybeSingle(),
      supabase.from('checkin_config').select('checkin_day')
        .eq('client_id', id).maybeSingle(),
      supabase.from('checkins').select('date')
        .eq('client_id', id).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('client_weekly_reports')
        .select('id, range_start, range_end, is_partial, visible_to_client, created_at, trainer_notes, snapshot')
        .eq('client_id', id)
        .order('range_end', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10),
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
    setReports((rptData ?? []) as SavedReport[])
    setReportsLoading(false)
    setLoading(false)
  }

  const cardBg     = isDark ? 'oklch(0.2 0.025 264)' : 'white'
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'
  const textPrimary   = isDark ? 'white' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const iconBg        = isDark ? 'rgba(255,255,255,0.07)' : '#f9fafb'
  const iconColor     = isDark ? '#6b7280' : '#9ca3af'

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-40 rounded-3xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#e5e7eb' }} />
      <div className="h-24 rounded-2xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }} />
      <div className="h-24 rounded-2xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }} />
    </div>
  )
  if (!client) return <p className="text-center py-16" style={{ color: textSecondary }}>{tDetail('notFound')}</p>

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
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors mb-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <ArrowLeft size={16} className="text-white" />
          </button>

          <div className="flex items-end justify-between">
            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <span className="text-white font-black text-lg">{getInitials(client.full_name)}</span>
              </div>
              <div>
                <h1 className="text-white font-black text-xl leading-tight">{client.full_name}</h1>
                {client.goal && <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{client.goal}</p>}
              </div>
            </div>

            {/* Chat button */}
            <button
              onClick={() => router.push(`/dashboard/chat?clientId=${client.id}`)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <MessageSquare size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Check-in status */}
      <div className="rounded-2xl border p-4 flex items-center gap-3"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sc.bg }}>
          <StatusIcon size={18} style={{ color: sc.color }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: textPrimary }}>{sc.label}</p>
          {client.checkinDay !== null && (
            <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
              {tDetail('mobileCheckinDay')} {tDays(String(client.checkinDay) as any)}
              {client.lastCheckin && `${tDetail('mobileLast')}${new Date(client.lastCheckin).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}`}
            </p>
          )}
          {client.checkinDay === null && (
            <p className="text-xs mt-0.5" style={{ color: textSecondary }}>{tDetail('mobileCheckinNotConfigured')}</p>
          )}
        </div>
      </div>

      {/* Package */}
      {client.packageName ? (
        <div className="rounded-2xl border p-4 flex items-center gap-3"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${client.packageColor || '#6b7280'}22` }}>
            <Package size={18} style={{ color: client.packageColor || '#6b7280' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: textPrimary }}>{client.packageName}</p>
            {daysLeft !== null && (
              <p className="text-xs mt-0.5 font-medium"
                style={{ color: daysLeft <= 7 ? (isDark ? '#f87171' : '#dc2626') : textSecondary }}>
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
        <div className="rounded-2xl border p-4 flex items-center gap-3 opacity-50"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg }}>
            <Package size={18} style={{ color: iconColor }} />
          </div>
          <p className="text-sm" style={{ color: textSecondary }}>{tDetail('mobileNoPackage')}</p>
        </div>
      )}

      {/* Contact info */}
      <div className="rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        {client.email && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
              <Mail size={14} style={{ color: iconColor }} />
            </div>
            <p className="text-sm truncate" style={{ color: textPrimary }}>{client.email}</p>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
              <Phone size={14} style={{ color: iconColor }} />
            </div>
            <p className="text-sm" style={{ color: textPrimary }}>{client.phone}</p>
          </div>
        )}
        {client.start_date && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
              <Calendar size={14} style={{ color: iconColor }} />
            </div>
            <p className="text-sm" style={{ color: textPrimary }}>
              {tDetail('collabSince')} {new Date(client.start_date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        )}
        {client.notes && (
          <div className="pt-2" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <p className="text-xs font-medium mb-1" style={{ color: textSecondary }}>{tDetail('notesLabel')}</p>
            <p className="text-sm leading-relaxed" style={{ color: isDark ? '#d1d5db' : '#4b5563' }}>{client.notes}</p>
          </div>
        )}
      </div>

      {/* Desktop-only notice */}
      <div className="flex items-center gap-3 rounded-2xl border p-4"
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', borderColor: cardBorder }}>
        <Monitor size={16} style={{ color: iconColor }} className="shrink-0" />
        <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>
          Planovi treninga, prehrana i check-in konfiguracija dostupni su na desktop verziji.
        </p>
      </div>

      {/* Desktop-only notice */}
      <div className="flex items-center gap-3 rounded-2xl border p-4"
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', borderColor: cardBorder }}>
        <Monitor size={16} style={{ color: iconColor }} className="shrink-0" />
        <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>
          Planovi treninga, prehrana i check-in konfiguracija dostupni su na desktop verziji.
        </p>
      </div>

      {/* Reports section */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        {/* Section header */}
        <div className="flex items-center gap-2.5 px-4 py-3.5"
          style={{ borderBottom: `1px solid ${cardBorder}` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: isDark ? 'rgba(96,165,250,0.15)' : '#eff6ff' }}>
            <FileText size={14} style={{ color: isDark ? '#60a5fa' : '#3b82f6' }} />
          </div>
          <p className="text-sm font-bold flex-1" style={{ color: textPrimary }}>{tDetail('mobileReportsTitle')}</p>
          {reports.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: textSecondary }}>
              {reports.length}
            </span>
          )}
        </div>

        {/* Content */}
        {reportsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin" style={{ color: textSecondary }} />
          </div>
        ) : reports.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <FileText size={24} className="mx-auto mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db' }} />
            <p className="text-sm font-medium" style={{ color: textSecondary }}>{tDetail('mobileReportsEmpty')}</p>
            <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af' }}>{tDetail('mobileReportsEmptySub')}</p>
          </div>
        ) : (
          <div>
            {reports.map((r, idx) => {
              const summary = r.snapshot?.summary
              const weightDelta = summary?.weightDelta
              return (
                <button
                  key={r.id}
                  onClick={() => { setSelectedReport(r); setReportDetailOpen(true) }}
                  className="w-full text-left px-4 py-3.5 flex items-start gap-3 active:opacity-70 transition-opacity"
                  style={{ borderTop: idx > 0 ? `1px solid ${cardBorder}` : undefined }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: textPrimary }}>
                        {new Date(r.range_start + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                        {' — '}
                        {new Date(r.range_end + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      {r.is_partial && (
                        <span className="text-[10px] font-bold uppercase rounded-full px-1.5 py-0.5"
                          style={{ backgroundColor: isDark ? 'rgba(251,191,36,0.15)' : '#fffbeb', color: isDark ? '#fbbf24' : '#92400e' }}>
                          {tDetail('mobileReportsPartial')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap">
                      {summary && (
                        <span className="text-xs" style={{ color: textSecondary }}>
                          {summary.workoutsCompletedCount}/{summary.workoutsPlannedCount} treninga
                        </span>
                      )}
                      {summary && (
                        <span className="text-xs" style={{ color: textSecondary }}>
                          {summary.nutritionConfirmedDays}/{summary.nutritionTotalDays} dana prehrane
                        </span>
                      )}
                      {weightDelta != null && (
                        <span className="text-xs font-semibold" style={{
                          color: weightDelta > 0
                            ? (isDark ? '#34d399' : '#16a34a')
                            : weightDelta < 0
                              ? (isDark ? '#f87171' : '#dc2626')
                              : textSecondary,
                        }}>
                          {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {r.visible_to_client ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold"
                          style={{ color: isDark ? '#34d399' : '#16a34a' }}>
                          <Eye size={10} /> {tDetail('mobileReportsVisible')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold"
                          style={{ color: textSecondary }}>
                          <EyeOff size={10} /> {tDetail('mobileReportsHidden')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : '#d1d5db' }} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedReport && (
        <WeeklyReportDetailDialog
          open={reportDetailOpen}
          onOpenChange={setReportDetailOpen}
          report={selectedReport}
          onChanged={fetchData}
          onDeleted={() => { setReportDetailOpen(false); fetchData() }}
        />
      )}

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
