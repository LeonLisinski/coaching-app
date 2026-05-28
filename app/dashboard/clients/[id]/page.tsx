'use client'
export const dynamic = 'force-dynamic'
import nextDynamic from 'next/dynamic'
import MobileClientDetail from '@/app/dashboard/clients/[id]/mobile-client-detail'
import { useEffect, useLayoutEffect, useState, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsLg } from '@/hooks/use-mobile'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePersistedTab } from '@/app/contexts/tab-state'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Pencil, CreditCard, Trash2, Dumbbell, UtensilsCrossed, ActivitySquare, Package, History, ClipboardList, BarChart2, Settings2, LayoutDashboard, GitCommitHorizontal, FileText, ChevronDown, ChevronUp, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import EditClientDialog from '@/app/dashboard/clients/edit-client-dialog'

function dobDisplayToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
function isoToDisplay(iso: string | null): string {
  if (!iso || !iso.match(/^\d{4}-\d{2}-\d{2}$/)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function Stat({ label, value, sub, valueClass }: {
  label: string; value: string; sub?: string; valueClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium leading-tight ${valueClass || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const TabLoader = () => <div className="py-10 flex justify-center"><div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" /></div>

const CheckinOverview    = nextDynamic(() => import('@/app/dashboard/checkins/[id]/components/checkin-overview'),    { ssr: false, loading: TabLoader })
const CheckinHistory     = nextDynamic(() => import('@/app/dashboard/checkins/[id]/components/checkin-history'),     { ssr: false, loading: TabLoader })
const CheckinGraphs      = nextDynamic(() => import('@/app/dashboard/checkins/[id]/components/checkin-graphs'),      { ssr: false, loading: TabLoader })
const CheckinConfig      = nextDynamic(() => import('@/app/dashboard/checkins/[id]/components/checkin-config'),      { ssr: false, loading: TabLoader })
const ClientWorkoutPlans = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-workout-plans'), { ssr: false, loading: TabLoader })
const ClientMealPlans    = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-meal-plans'),    { ssr: false, loading: TabLoader })
const ClientPackages     = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-packages'),      { ssr: false, loading: TabLoader })
const ClientHistory      = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-history'),       { ssr: false, loading: TabLoader })
const ClientOverview     = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-overview'),      { ssr: false, loading: TabLoader })
const ClientCalculator   = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-calculator'),    { ssr: false, loading: TabLoader })
const ClientTimeline     = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-timeline'),      { ssr: false, loading: TabLoader })
const ClientWeeklyReports = nextDynamic(() => import('@/app/dashboard/clients/[id]/components/client-weekly-reports'), { ssr: false, loading: TabLoader })
import { useTranslations, useLocale } from 'next-intl'
import { useClientAttentionFlags } from '@/hooks/use-client-attention-flags'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type ActivityLevel = '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'


type Client = {
  id: string
  full_name: string
  email: string
  goal: string | null
  weight: number | null
  height: number | null
  date_of_birth: string | null
  start_date: string | null
  active: boolean
  gender: string | null
  notes: string | null
  activity_level: string | null
  step_goal: number | null
}

type ActivePackage = {
  id: string
  name: string
  color: string
  end_date: string
  status: string
}

type EditForm = {
  full_name: string
  goal: string
  weight: string
  height: string
  dob_display: string
  date_of_birth: string
  start_date: string
  start_display: string
  gender: '' | 'M' | 'F'
  activity_level: ActivityLevel
  step_goal: string
  notes: string
}

function formatDate(dateStr: string | null, locale: string) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale)
}

function ClientDetailPageContent() {
  const t = useTranslations('clients.detail')
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('clientDetail')
  const tAdd = useTranslations('addClient')
  const tReports = useTranslations('clients.weeklyReports')
  const locale = useLocale()

  const ACTIVITY_LABELS: Record<string, string> = {
    sedentary:   tAdd('activitySedentary'),
    light:       tAdd('activityLight'),
    moderate:    tAdd('activityModerate'),
    active:      tAdd('activityActive'),
    very_active: tAdd('activityVeryActive'),
  }

  const { id } = useParams()
  const attention = useClientAttentionFlags(id as string | undefined)
  const router = useRouter()
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isDark = mode === 'dark'
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab')
  // Per-client persistence; URL param overrides storage (for quick-action deep links)
  const [activeTab, setActiveTab] = usePersistedTab(`client_tab_${id as string}`, 'pregled')

  // Legacy tab values that moved into sub-tabs
  const LEGACY_CHECKIN_SUBS: Record<string, string> = { slike: 'slike', graphs: 'grafovi', izvjestaji: 'izvjestaji' }
  const LEGACY_OSTALO_SUBS: Record<string, string> = { paketi: 'paketi', timeline: 'timeline' }
  const toMainTab = (tab: string) => {
    if (tab in LEGACY_CHECKIN_SUBS) return 'checkin'
    if (tab in LEGACY_OSTALO_SUBS) return 'ostalo'
    return tab
  }

  // URL ?tab=xxx takes priority; handle legacy values
  useEffect(() => {
    if (!urlTab) return
    const main = toMainTab(urlTab)
    setActiveTab(main)
    if (urlTab in LEGACY_CHECKIN_SUBS) setCheckinSubTab(LEGACY_CHECKIN_SUBS[urlTab])
    if (urlTab in LEGACY_OSTALO_SUBS) setOstaloSubTab(LEGACY_OSTALO_SUBS[urlTab])
  }, [urlTab])
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [activePackage, setActivePackage] = useState<ActivePackage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mealPlansRefreshKey, setMealPlansRefreshKey] = useState(0)
  const [showStats, setShowStats] = useState(false)

  // Client navigation (prev/next based on the filtered list from the clients page)
  type NavClient = { id: string; full_name: string; gender: string | null }
  const [navList, setNavList] = useState<NavClient[]>([])
  const [showNavPicker, setShowNavPicker] = useState(false)
  const navBtnRef = useRef<HTMLButtonElement>(null)
  const [navPickerRect, setNavPickerRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('client_nav_list')
      if (raw) setNavList(JSON.parse(raw))
    } catch {}
  }, [])

  const currentNavIdx = navList.findIndex(c => c.id === (id as string))
  const hasNav = navList.length > 1 && currentNavIdx !== -1
  const prevNavId = hasNav ? navList[(currentNavIdx - 1 + navList.length) % navList.length].id : null
  const nextNavId = hasNav ? navList[(currentNavIdx + 1) % navList.length].id : null
  const goTo = (cid: string) => { setShowNavPicker(false); router.push(`/dashboard/clients/${cid}`) }
  const openNavPicker = () => {
    if (!showNavPicker && navBtnRef.current) {
      setNavPickerRect(navBtnRef.current.getBoundingClientRect())
    }
    setShowNavPicker(v => !v)
  }

  // Sub-tab persistence for grouped tabs
  const [checkinSubTab, setCheckinSubTab] = usePersistedTab(`client_checkin_sub_${id as string}`, 'parametri')
  const [ostaloSubTab, setOstaloSubTab] = usePersistedTab(`client_ostalo_sub_${id as string}`, 'paketi')
  // Track which tabs have been mounted — once visited, keep alive to avoid re-fetching
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([toMainTab(urlTab || 'pregled')]))
  // activeTab can be restored from persistence (localStorage / __tabState) while mountedTabs only
  // knew urlTab||pregled — then the tab header shows e.g. Check-in but content stays empty until
  // the user switches tabs. Always merge the current active tab before paint.
  useLayoutEffect(() => {
    setMountedTabs(prev => {
      const next = new Set([...prev, activeTab])
      // Also mount the current sub-tab when parent tab is already active
      if (activeTab === 'checkin') next.add(`ci_${checkinSubTab}`)
      if (activeTab === 'ostalo') next.add(`ost_${ostaloSubTab}`)
      return next
    })
  }, [activeTab, checkinSubTab, ostaloSubTab])

  const noName = t('noName')

  useEffect(() => { fetchClient() }, [id])

  const fetchClient = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const [{ data }, { data: pkgData }] = await Promise.all([
      supabase
        .from('clients')
        .select(`id, goal, weight, height, date_of_birth, start_date, active, gender, notes, activity_level, step_goal,
          profiles!clients_user_id_fkey (full_name, email)`)
        .eq('id', id)
        .eq('trainer_id', user.id)
        .single(),
      supabase
        .from('client_packages')
        .select('id, start_date, end_date, status, packages(name, color)')
        .eq('client_id', id as string)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (!data) {
      setLoading(false)
      router.push('/dashboard/clients')
      return
    }

    setClient({
      id: data.id,
      full_name: (data.profiles as any)?.full_name || noName,
      email: (data.profiles as any)?.email || '',
      goal: data.goal, weight: data.weight, height: data.height,
      date_of_birth: data.date_of_birth, start_date: data.start_date, active: data.active,
      gender: data.gender, notes: data.notes,
      activity_level: data.activity_level, step_goal: data.step_goal,
    })

    if (pkgData) {
      setActivePackage({
        id: pkgData.id,
        name: (pkgData.packages as any)?.name || 'Paket',
        color: (pkgData.packages as any)?.color || '#6366f1',
        end_date: pkgData.end_date,
        status: pkgData.status,
      })
    }

    setLoading(false)
  }

  const deleteClient = async () => {
    if (!client) return
    setDeleting(true)
    // Call the API first (while the clients row still exists for the ownership check)
    // This deletes the auth user, which cascades through profiles → clients → all related rows
    await fetch(`/api/clients/${client.id}/delete`, { method: 'DELETE' })

    // Safety-net manual cleanup for any tables not fully covered by cascades
    await supabase.from('workout_logs').delete().eq('client_id', client.id)
    await supabase.from('nutrition_logs').delete().eq('client_id', client.id)
    await supabase.from('daily_logs').delete().eq('client_id', client.id)
    await supabase.from('checkins').delete().eq('client_id', client.id)
    await supabase.from('payments').delete().eq('client_id', client.id)
    await supabase.from('client_packages').delete().eq('client_id', client.id)
    await supabase.from('client_meal_plans').delete().eq('client_id', client.id)
    await supabase.from('client_workout_plans').delete().eq('client_id', client.id)
    await supabase.from('checkin_config').delete().eq('client_id', client.id)
    await supabase.from('messages').delete().eq('client_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)

    router.push('/dashboard/clients')
  }

  if (loading) return <p className="text-gray-500 text-sm p-8">{tCommon('loading')}</p>
  if (!client) return <p className="text-gray-500 text-sm p-8">{tDetail('notFound')}</p>

  const initials = client.full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const genderColor = client.gender === 'F' ? '#e11d48' : client.gender === 'M' ? '#2563eb' : accentHex
  const avatarGrad = client.gender === 'F'
    ? 'linear-gradient(135deg, #f43f5e, #be123c)'
    : client.gender === 'M'
    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
    : `linear-gradient(135deg, ${accentHex}, color-mix(in srgb, ${accentHex} 70%, #000))`

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className={`rounded-2xl overflow-hidden border ${isDark ? 'border-white/8' : 'border-gray-100 shadow-sm'}`}
        style={{ background: isDark
          ? `linear-gradient(to right, ${genderColor}22 0%, transparent 50%), oklch(0.195 0.018 264)`
          : `linear-gradient(to right, ${genderColor}12 0%, transparent 60%), white`
        }}>
        <div className="px-5 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/clients')}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${isDark ? 'bg-white/8 hover:bg-white/15 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
          >
            <ArrowLeft size={15} />
          </button>

          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: isDark
                ? client.gender === 'F'
                  ? 'linear-gradient(135deg, rgba(244,63,94,0.4), rgba(190,18,60,0.28))'
                  : client.gender === 'M'
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.4), rgba(29,78,216,0.28))'
                  : `linear-gradient(135deg, ${accentHex}55, ${accentHex}30)`
                : avatarGrad,
              boxShadow: isDark
                ? `0 0 0 1px ${genderColor}35, 0 4px 14px ${genderColor}25`
                : `0 2px 8px ${genderColor}35, 0 0 0 2px ${genderColor}18`,
            }}
          >
            <span
              className="font-bold text-sm tracking-wide"
              style={{ color: isDark
                ? client.gender === 'F' ? '#fda4af' : client.gender === 'M' ? '#93c5fd' : 'white'
                : 'white'
              }}
            >
              {initials}
            </span>
          </div>

          {/* Name / info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`font-bold text-xl leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{client.full_name}</h1>
              {client.gender && (
                <span className="text-sm font-semibold" style={{ color: genderColor }}>
                  {client.gender === 'M' ? '♂' : '♀'}
                </span>
              )}
              {!client.active && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-white/8 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{tDetail('inactiveLabel')}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{client.email}</p>
              {activePackage && (
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                  style={{
                    backgroundColor: `${activePackage.color}${isDark ? '22' : '18'}`,
                    color: isDark ? `color-mix(in srgb, ${activePackage.color} 80%, white)` : activePackage.color,
                    border: `1px solid ${activePackage.color}${isDark ? '35' : '30'}`,
                  }}
                >
                  <CreditCard size={10} />
                  {activePackage.name}
                  {activePackage.end_date && (
                    <span className="opacity-60"> · do {formatDate(activePackage.end_date, locale)}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Prev / picker / next navigation */}
            {hasNav && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => prevNavId && goTo(prevNavId)}
                  title="Prethodni klijent"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'bg-white/8 hover:bg-white/15 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                >
                  <ChevronLeft size={14} />
                </button>

                {/* Dropdown picker */}
                <div className="relative">
                  <button
                    ref={navBtnRef}
                    onClick={openNavPicker}
                    title="Odaberi klijenta"
                    className={`h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-medium transition-colors ${isDark ? 'bg-white/8 hover:bg-white/15 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                  >
                    <span className="tabular-nums">{currentNavIdx + 1}/{navList.length}</span>
                    <ChevronDown size={10} className={`transition-transform ${showNavPicker ? 'rotate-180' : ''}`} />
                  </button>
                  {showNavPicker && navPickerRect && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNavPicker(false)} />
                      <div
                        className={`fixed z-50 rounded-xl border shadow-xl overflow-hidden min-w-[220px] max-h-72 overflow-y-auto ${isDark ? 'bg-[oklch(0.14_0.018_264)] border-white/12' : 'bg-white border-gray-100'}`}
                        style={{
                          top: navPickerRect.bottom + 6,
                          right: window.innerWidth - navPickerRect.right,
                        }}
                      >
                        <div className={`px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'border-white/8 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
                          Klijenti ({navList.length})
                        </div>
                        {navList.map((c, i) => {
                          const isCurrentClient = c.id === (id as string)
                          const initials = c.full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
                          const avatarBg = c.gender === 'F'
                            ? isDark ? 'linear-gradient(135deg,rgba(244,63,94,0.3),rgba(190,18,60,0.2))' : 'linear-gradient(135deg,#f43f5e,#be123c)'
                            : c.gender === 'M'
                            ? isDark ? 'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(29,78,216,0.2))' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
                            : isDark ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#6b7280,#4b5563)'
                          const avatarText = isDark
                            ? c.gender === 'F' ? '#fda4af' : c.gender === 'M' ? '#93c5fd' : '#9ca3af'
                            : 'white'
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => goTo(c.id)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                                isCurrentClient
                                  ? isDark ? 'bg-white/10' : 'bg-violet-50'
                                  : isDark ? 'hover:bg-white/6' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[9px] font-bold"
                                style={{ background: avatarBg, color: avatarText }}>
                                {initials}
                              </div>
                              <span className={`flex-1 text-xs font-medium truncate ${
                                isCurrentClient
                                  ? isDark ? 'text-white' : 'text-violet-700'
                                  : isDark ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                {c.full_name}
                              </span>
                              <span className={`text-[10px] tabular-nums shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{i + 1}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => nextNavId && goTo(nextNavId)}
                  title="Sljedeći klijent"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'bg-white/8 hover:bg-white/15 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowEditDialog(true)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-white/8 hover:bg-white/15 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
              title={tDetail('editTooltip')}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-white/8 hover:bg-red-500/30 text-gray-400 hover:text-red-400' : 'bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500'}`}
              title={tDetail('deleteTooltip')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {!attention.loading && attention.needsAttention && (
          <div className={`border-t px-4 py-2.5 sm:px-6 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200/70'}`}>
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 shrink-0 ring-2 ring-amber-200/80" aria-hidden />
            <span className={`text-xs sm:text-sm flex flex-wrap gap-x-2 gap-y-1 ${isDark ? 'text-amber-300' : 'text-amber-900/85'}`}>
              {attention.checkinLate && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100/90'}`}>{tDetail('attentionReasonLate')}</span>
              )}
              {attention.missingPlan && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100/90'}`}>{tDetail('attentionReasonNoPlan')}</span>
              )}
              {attention.unreadMessages > 0 && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100/90'}`}>
                  {tDetail('attentionReasonUnread', { n: attention.unreadMessages })}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Compact stats strip */}
      <div className={`rounded-xl border transition-all ${isDark ? 'border-white/8 bg-white/[0.03]' : 'border-gray-100 bg-white'}`}>
        {/* Always-visible single-line summary */}
        <div className="w-full flex items-center gap-2 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowStats(v => !v)}
            className={`flex-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0 text-left rounded-lg transition-colors px-1 -mx-1 py-0.5 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
          >
            {client.goal && <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{client.goal}</span>}
            {client.gender && <span className="text-xs text-gray-400">{client.gender === 'M' ? tDetail('genderMale') : tDetail('genderFemale')}</span>}
            {client.active !== undefined && (
              <span className={`text-xs font-medium ${client.active ? 'text-emerald-500' : 'text-red-400'}`}>
                {client.active ? tCommon('active') : tCommon('inactive')}
              </span>
            )}
            {client.weight && <span className="text-xs text-gray-400">{client.weight} {tDetail('weightUnitFull')}</span>}
            {client.height && <span className="text-xs text-gray-400">{client.height} {tDetail('heightUnitFull')}</span>}
            {client.date_of_birth && <span className="text-xs text-gray-400">{calcAge(client.date_of_birth)}{tDetail('ageUnit')}</span>}
            {client.start_date && <span className="text-xs text-gray-400">{tDetail('collabSince')} {formatDate(client.start_date, locale)}</span>}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <ClientCalculator
              clientId={client.id}
              client={client}
              onSaved={() => { fetchClient(); setMealPlansRefreshKey(k => k + 1) }}
            />
            <button
              type="button"
              onClick={() => setShowStats(v => !v)}
              className={`p-1 rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/8' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              {showStats ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* Expandable full stats */}
        {showStats && (
          <div className={`border-t px-4 py-3 ${isDark ? 'border-white/8' : 'border-gray-50'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-3">
              {client.goal && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{t('stats.goal')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{client.goal}</p>
                </div>
              )}
              {client.gender && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{tDetail('genderLabel')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{client.gender === 'M' ? tDetail('genderMale') : tDetail('genderFemale')}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">{t('stats.status')}</p>
                <p className={`text-sm font-medium ${client.active ? 'text-emerald-500' : 'text-red-400'}`}>{client.active ? tCommon('active') : tCommon('inactive')}</p>
              </div>
              {client.weight && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{t('stats.weight')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{client.weight}{tDetail('weightUnitFull')}</p>
                </div>
              )}
              {client.height && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{t('stats.height')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{client.height}{tDetail('heightUnitFull')}</p>
                </div>
              )}
              {client.date_of_birth && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{t('stats.dateOfBirth')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formatDate(client.date_of_birth, locale)}</p>
                  <p className="text-[11px] text-gray-400">{calcAge(client.date_of_birth)}{tDetail('ageUnit')}</p>
                </div>
              )}
              {client.start_date && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{t('stats.startDate')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{formatDate(client.start_date, locale)}</p>
                </div>
              )}
              {client.activity_level && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{tDetail('activityLabel')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{ACTIVITY_LABELS[client.activity_level] || client.activity_level}</p>
                </div>
              )}
              {client.step_goal && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{tDetail('dailyStepsLabel')}</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{client.step_goal.toLocaleString('hr-HR')} {tDetail('stepsUnit')}</p>
                </div>
              )}
            </div>
            {client.notes && (
              <div className={`mt-3 pt-3 border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                <p className="text-[11px] text-gray-400 mb-1">{tDetail('notesLabel')}</p>
                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{client.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit client dialog */}
      {showEditDialog && (
        <EditClientDialog
          client={client}
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSuccess={() => { fetchClient(); setShowEditDialog(false) }}
        />
      )}

      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={tab => { setActiveTab(tab); setMountedTabs(prev => new Set([...prev, tab])) }} className="flex-1">
          <TabsList className="flex-nowrap overflow-x-auto sm:flex-wrap h-auto gap-1 bg-gray-100/80 scrollbar-hide">
            <TabsTrigger value="pregled" className="flex items-center gap-1.5">
              <LayoutDashboard size={13} />{tDetail('overviewTab')}
            </TabsTrigger>
            <TabsTrigger value="pracenje" className="flex items-center gap-1.5">
              <ActivitySquare size={13} />{t('tabs.pracenje')}
            </TabsTrigger>
            <TabsTrigger value="checkin" className="flex items-center gap-1.5">
              <ClipboardList size={13} />{t('tabs.weeklyCheckin')}
            </TabsTrigger>
            <TabsTrigger value="treninzi" className="flex items-center gap-1.5">
              <Dumbbell size={13} />{t('tabs.training')}
            </TabsTrigger>
            <TabsTrigger value="prehrana" className="flex items-center gap-1.5">
              <UtensilsCrossed size={13} />{t('tabs.nutrition')}
            </TabsTrigger>
            <TabsTrigger value="ostalo" className="flex items-center gap-1.5">
              <MoreHorizontal size={13} />Ostalo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pregled" className="mt-6">
            {mountedTabs.has('pregled') && <ClientOverview clientId={id as string} />}
          </TabsContent>

          <TabsContent value="pracenje" className="mt-6">
            {mountedTabs.has('pracenje') && <ClientHistory clientId={id as string} />}
          </TabsContent>

          {/* Check-in with internal sub-tabs */}
          <TabsContent value="checkin" className="mt-4">
            {(() => {
              const CI_SUBS = [
                { value: 'parametri', label: 'Parametri', icon: ClipboardList },
                { value: 'slike',     label: t('tabs.slike'),     icon: History },
                { value: 'grafovi',   label: t('tabs.graphs'),    icon: BarChart2 },
                { value: 'izvjestaji',label: tReports('tabLabel'),icon: FileText },
                { value: 'postavke',  label: t('tabs.checkinSettings'), icon: Settings2 },
              ]
              return (
                <>
                  {/* Sub-tab bar */}
                  <div
                    className="flex gap-1 overflow-x-auto scrollbar-hide mb-5 pb-1"
                    style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f3f4f6' }}
                  >
                    {CI_SUBS.map(sub => {
                      const Icon = sub.icon
                      const isActive = checkinSubTab === sub.value
                      return (
                        <button
                          key={sub.value}
                          type="button"
                          onClick={() => {
                            setCheckinSubTab(sub.value)
                            setMountedTabs(prev => new Set([...prev, `ci_${sub.value}`]))
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors mb-1 ${
                            isActive
                              ? isDark ? 'bg-white/10 text-white' : 'bg-white text-gray-900 shadow-sm'
                              : isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon size={12} />
                          {sub.label}
                        </button>
                      )
                    })}
                  </div>
                  {/* Sub-tab content — keep-alive pattern */}
                  <div className={checkinSubTab === 'parametri' ? '' : 'hidden'}>
                    {mountedTabs.has('ci_parametri') && <CheckinOverview clientId={id as string} />}
                  </div>
                  <div className={checkinSubTab === 'slike' ? '' : 'hidden'}>
                    {mountedTabs.has('ci_slike') && <CheckinHistory clientId={id as string} />}
                  </div>
                  <div className={checkinSubTab === 'grafovi' ? '' : 'hidden'}>
                    {mountedTabs.has('ci_grafovi') && <CheckinGraphs clientId={id as string} />}
                  </div>
                  <div className={checkinSubTab === 'izvjestaji' ? '' : 'hidden'}>
                    {mountedTabs.has('ci_izvjestaji') && <ClientWeeklyReports clientId={id as string} clientName={client.full_name} />}
                  </div>
                  <div className={checkinSubTab === 'postavke' ? '' : 'hidden'}>
                    {mountedTabs.has('ci_postavke') && <CheckinConfig clientId={id as string} />}
                  </div>
                </>
              )
            })()}
          </TabsContent>

          <TabsContent value="treninzi" className="mt-6">
            {mountedTabs.has('treninzi') && <ClientWorkoutPlans clientId={id as string} />}
          </TabsContent>

          <TabsContent value="prehrana" className="mt-6">
            {mountedTabs.has('prehrana') && <ClientMealPlans clientId={id as string} refreshKey={mealPlansRefreshKey} />}
          </TabsContent>

          {/* Ostalo with internal sub-tabs */}
          <TabsContent value="ostalo" className="mt-4">
            {(() => {
              const OST_SUBS = [
                { value: 'paketi',   label: t('tabs.packages'), icon: Package },
                { value: 'timeline', label: tDetail('timelineTab'), icon: GitCommitHorizontal },
              ]
              return (
                <>
                  <div
                    className="flex gap-1 overflow-x-auto scrollbar-hide mb-5 pb-1"
                    style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f3f4f6' }}
                  >
                    {OST_SUBS.map(sub => {
                      const Icon = sub.icon
                      const isActive = ostaloSubTab === sub.value
                      return (
                        <button
                          key={sub.value}
                          type="button"
                          onClick={() => {
                            setOstaloSubTab(sub.value)
                            setMountedTabs(prev => new Set([...prev, `ost_${sub.value}`]))
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors mb-1 ${
                            isActive
                              ? isDark ? 'bg-white/10 text-white' : 'bg-white text-gray-900 shadow-sm'
                              : isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon size={12} />
                          {sub.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className={ostaloSubTab === 'paketi' ? '' : 'hidden'}>
                    {mountedTabs.has('ost_paketi') && <ClientPackages clientId={id as string} />}
                  </div>
                  <div className={ostaloSubTab === 'timeline' ? '' : 'hidden'}>
                    {mountedTabs.has('ost_timeline') && <ClientTimeline clientId={id as string} />}
                  </div>
                </>
              )
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Check-in settings dialog removed — now a sub-tab inside Check-in */}

      <ConfirmDialog
        open={confirmDelete}
        title={tDetail('deleteDialogTitle', { name: client.full_name })}
        description={
          <div className="space-y-3">
            <p>Brisanjem ovog klijenta trajno će se ukloniti <span className="font-semibold text-gray-800">svi podaci vezani za njega</span>:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
              <li>Svi check-inovi i fotografije napretka</li>
              <li>Planovi prehrane i treninga</li>
              <li>Paketi i evidencija plaćanja</li>
              <li>Sve poruke u chatu</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2">
              <span className="text-amber-500 text-base leading-none mt-0.5">💡</span>
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{tDetail('deleteDialogRecommend')}:</span> Umjesto brisanja, razmotrite{' '}
                <button
                  type="button"
                  className="underline font-semibold hover:text-amber-900"
                  onClick={async () => {
                    setConfirmDelete(false)
                    const { data: { session } } = await supabase.auth.getSession()
                    await fetch(`/api/clients/${client.id}/set-active`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ active: false }),
                    })
                    fetchClient()
                  }}
                >
                  deaktivaciju klijenta
                </button>
                . Na taj način zadržavate sve podatke i povijest, ali klijent više nije aktivan.
              </p>
            </div>
            <p className="font-bold text-red-600">{tDetail('deleteDialogWarning')}</p>
            <p className="text-gray-700">Želite li nastaviti s brisanjem klijenta?</p>
          </div>
        }
        onConfirm={deleteClient}
        onCancel={() => setConfirmDelete(false)}
        confirmLabel={tDetail('deleteDialogConfirm')}
        cancelLabel={tDetail('deleteDialogCancel')}
        destructive
        loading={deleting}
      />
    </div>
  )
}

export default function ClientDetailPage() {
  const isLg = useIsLg()
  if (isLg === undefined) return null
  if (isLg) return (
    <Suspense fallback={null}>
      <ClientDetailPageContent />
    </Suspense>
  )
  return <MobileClientDetail />
}
