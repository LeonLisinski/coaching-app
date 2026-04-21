'use client'
import 'driver.js/dist/driver.css'
export const dynamic = 'force-dynamic'
import nextDynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Dumbbell,
  UtensilsCrossed,
  MessageSquare,
  ListChecks,
  LayoutDashboard,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  Settings,
  Banknote,
  Search,
  Bell,
  ClipboardCheck,
  CreditCard,
  UserPlus,
  Package,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import LocaleSwitcher from '@/components/locale-switcher'
import SettingsDialog from '@/app/components/settings-dialog'
import UnitLiftLogo from '@/app/components/unitlift-logo'
import GlobalSearch from '@/app/components/global-search'
import { TabStateProvider } from '@/app/contexts/tab-state'
import { TrainerSettingsProvider } from '@/app/contexts/trainer-settings-context'
import MobileBottomNav from '@/app/components/mobile-bottom-nav'
import { useActiveChat } from '@/app/contexts/active-chat'
const TrainerOnboardingWizard = nextDynamic(
  () => import('@/app/components/onboarding/trainer-onboarding-wizard'),
  { ssr: false },
)
import { runTrainerTour, type TourStrings } from '@/lib/trainer-tour'
import { LS_ONBOARDING_COMPLETE, LS_TOUR_COMPLETE } from '@/lib/trainer-onboarding-storage'

const navItems = [
  { href: '/dashboard',             labelKey: 'overview',  icon: LayoutDashboard, color: 'text-violet-400' },
  { href: '/dashboard/clients',     labelKey: 'clients',   icon: Users,           color: 'text-sky-400'    },
  { href: '/dashboard/training',    labelKey: 'training',  icon: Dumbbell,        color: 'text-indigo-400' },
  { href: '/dashboard/nutrition',   labelKey: 'nutrition', icon: UtensilsCrossed, color: 'text-orange-400' },
  { href: '/dashboard/checkins',    labelKey: 'checkins',  icon: ListChecks,      color: 'text-teal-400'   },
  { href: '/dashboard/financije',   labelKey: 'finance',   icon: Banknote,        color: 'text-emerald-400'},
  { href: '/dashboard/chat',        labelKey: 'chat',      icon: MessageSquare,   color: 'text-amber-400'  },
  { href: '/dashboard/profile',     labelKey: 'profile',   icon: User,            color: 'text-rose-400'   },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tNav    = useTranslations('nav')
  const tCommon = useTranslations('common')
  const tLayout = useTranslations('layout')
  const tTour = useTranslations('onboarding.tour')
  const locale = useLocale()
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  // Track last visited client/chat/checkin so nav items bring you back
  const [lastClientHref, setLastClientHref]   = useState('/dashboard/clients')
  const [lastChatHref, setLastChatHref]       = useState('/dashboard/chat')
  const [lastCheckinHref, setLastCheckinHref] = useState('/dashboard/checkins')
  const [userInitials, setUserInitials] = useState('')
  const [userName, setUserName]         = useState('')
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [authChecked, setAuthChecked]   = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifs, setShowNotifs]     = useState(false)
  const [notifCount, setNotifCount]     = useState(0)
  const [seenIds, setSeenIds]           = useState<Set<string>>(new Set())
  const [notifications, setNotifications] = useState<{ id: string; title: string; subtitle: string; time: string; type: 'checkin' | 'message' | 'payment' | 'package'; href?: string; isNew?: boolean }[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [tourFarewell, setTourFarewell] = useState(false)
  const [helpMobileHint, setHelpMobileHint] = useState(false)

  /** Uvijek pokreće vođeni obilazak (driver.js) — nakon onboardinga ili s većeg ekrana. */
  const startProductTour = useCallback(() => {
    const strings: TourStrings = {
      step1Title: tTour('step1Title'),
      step1Desc: tTour('step1Desc'),
      step2Title: tTour('step2Title'),
      step2Desc: tTour('step2Desc'),
      step3Title: tTour('step3Title'),
      step3Desc: tTour('step3Desc'),
      step4Title: tTour('step4Title'),
      step4Desc: tTour('step4Desc'),
      step5Title: tTour('step5Title'),
      step5Desc: tTour('step5Desc'),
      step6Title: tTour('step6Title'),
      step6Desc: tTour('step6Desc'),
      prevBtn: tTour('prevBtn'),
      nextBtn: tTour('nextBtn'),
      doneBtn: tTour('doneBtn'),
    }
    void runTrainerTour({
      locale,
      strings,
      onFarewell: () => setTourFarewell(true),
    })
  }, [locale, tTour])

  /** Gumb „?” u headeru: na mobitelu kratka poruka (tura zahtijeva širinu kao u trainer-tour). */
  const openHelpFromHeader = useCallback(() => {
    if (typeof window === 'undefined') return
    const wideEnough = window.matchMedia('(min-width: 1024px)').matches
    if (!wideEnough) {
      setHelpMobileHint(true)
      return
    }
    startProductTour()
  }, [startProductTour])

  const handleWizardFinished = useCallback(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(LS_TOUR_COMPLETE) === 'true') return
    setTimeout(() => startProductTour(), 450)
  }, [startProductTour])

  const fetchNotifications = useCallback(async (userId: string) => {
    const now = new Date()
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0]

    const stored = localStorage.getItem('notif_seen_ids')
    const storedSeen: Set<string> = stored ? new Set(JSON.parse(stored)) : new Set()
    setSeenIds(storedSeen)

    const sevenDaysAheadDate = new Date(now); sevenDaysAheadDate.setDate(now.getDate() + 7)
    const sevenDaysAhead = sevenDaysAheadDate.toISOString().split('T')[0]
    const oneDayAgoDate = new Date(now); oneDayAgoDate.setDate(now.getDate() - 1)
    const oneDayAgo = oneDayAgoDate.toISOString().split('T')[0]

    const [{ data: msgs }, { data: checkins }, { data: pkgAlerts }] = await Promise.all([
      supabase.from('messages')
        .select('id, content, created_at, client_id, clients(profiles(full_name))')
        .eq('trainer_id', userId).neq('sender_id', userId).eq('read', false)
        .order('created_at', { ascending: false }).limit(30),
      supabase.from('checkins')
        .select('id, date, client_id, clients(profiles(full_name))')
        .eq('trainer_id', userId)
        .gte('date', sevenDaysAgoDate)
        .order('date', { ascending: false }).limit(30),
      supabase.from('client_packages')
        .select('id, end_date, client_id, packages(name), clients(profiles(full_name))')
        .eq('trainer_id', userId)
        .eq('status', 'active')
        .gte('end_date', oneDayAgo)
        .lte('end_date', sevenDaysAhead)
        .order('end_date', { ascending: true }),
    ])

    const formatTime = (dateStr: string) => {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
      const diffMs = now.getTime() - d.getTime()
      const diffH = Math.floor(diffMs / 3600000)
      const diffD = Math.floor(diffH / 24)
      if (diffH < 1) return tLayout('timeJustNow')
      if (diffH < 24) return tLayout('timeHours', { n: diffH })
      if (diffD === 1) return tLayout('timeYesterday')
      return tLayout('timeDays', { n: diffD })
    }

    const notifs: typeof notifications = []

    type MsgN = {
      id: string
      content?: string | null
      created_at: string
      client_id: string
      clients?: { profiles?: { full_name?: string | null } | null } | null
    }
    type CiN = {
      id: string
      date: string
      client_id: string
      clients?: { profiles?: { full_name?: string | null } | null } | null
    }
    type PkgN = {
      id: string
      end_date: string
      client_id: string
      packages?: { name?: string | null } | null
      clients?: { profiles?: { full_name?: string | null } | null } | null
    }

    ;((msgs ?? []) as MsgN[]).forEach((m) => {
      const name = m.clients?.profiles?.full_name || tLayout('fallbackClient')
      const id = `msg-${m.id}`
      notifs.push({
        id,
        title: name,
        subtitle: m.content?.slice(0, 55) || tLayout('notifNewMessage'),
        time: formatTime(m.created_at),
        type: 'message',
        href: `/dashboard/chat?clientId=${m.client_id}`,
        isNew: !storedSeen.has(id),
      })
    })

    ;((checkins ?? []) as CiN[]).forEach((c) => {
      const name = c.clients?.profiles?.full_name || tLayout('fallbackClient')
      const id = `ci-${c.id}`
      notifs.push({
        id,
        title: name,
        subtitle: tLayout('notifSubmittedCheckin'),
        time: formatTime(c.date),
        type: 'checkin',
        href: `/dashboard/checkins/${c.client_id}`,
        isNew: !storedSeen.has(id),
      })
    })

    ;((pkgAlerts ?? []) as PkgN[]).forEach((cp) => {
      const name = cp.clients?.profiles?.full_name || tLayout('fallbackClient')
      const pkgName = cp.packages?.name || tLayout('fallbackPackage')
      const endDate = cp.end_date as string
      const daysLeft = Math.ceil((new Date(endDate).getTime() - now.getTime()) / 86400000)
      const id = `pkg-${cp.id}-${endDate}`
      const subtitle = daysLeft < 0
        ? tLayout('notifPackageExpired', { name: pkgName })
        : daysLeft === 0
        ? tLayout('notifPackageExpiresToday', { name: pkgName })
        : tLayout('notifPackageExpiresIn', { name: pkgName, days: daysLeft, unit: daysLeft === 1 ? tLayout('notifDaysSingular') : tLayout('notifDaysPlural') })
      notifs.push({
        id,
        title: name,
        subtitle,
        time: daysLeft < 0 ? tLayout('notifTimeExpiredDays', { n: Math.abs(daysLeft) }) : daysLeft === 0 ? tLayout('notifTimeToday') : tLayout('notifTimeIn', { n: daysLeft }),
        type: 'package',
        href: `/dashboard/clients/${cp.client_id}?tab=paketi`,
        isNew: !storedSeen.has(id),
      })
    })

    notifs.sort((a, b) => {
      if (a.isNew && !b.isNew) return -1
      if (!a.isNew && b.isNew) return 1
      return 0
    })

    setNotifications(notifs)
    setNotifCount(notifs.filter(n => n.isNew).length)
  }, [tLayout])

  // Update last-visited client / chat / checkin whenever the pathname changes
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // Client detail page: /dashboard/clients/[id]
      const clientMatch = pathname.match(/^\/dashboard\/clients\/([^/]+)$/)
      if (clientMatch) {
        const cid = clientMatch[1]
        localStorage.setItem('last_client_id', cid)
        setLastClientHref(`/dashboard/clients/${cid}`)
      } else if (pathname === '/dashboard/clients') {
        localStorage.removeItem('last_client_id')
        setLastClientHref('/dashboard/clients')
      } else {
        const storedId = localStorage.getItem('last_client_id')
        setLastClientHref(storedId ? `/dashboard/clients/${storedId}` : '/dashboard/clients')
      }

      const checkinMatch = pathname.match(/^\/dashboard\/checkins\/([^/]+)$/)
      if (checkinMatch) {
        const cid = checkinMatch[1]
        localStorage.setItem('last_checkin_client_id', cid)
        setLastCheckinHref(`/dashboard/checkins/${cid}`)
      } else if (pathname === '/dashboard/checkins') {
        localStorage.removeItem('last_checkin_client_id')
        setLastCheckinHref('/dashboard/checkins')
      } else {
        const storedId = localStorage.getItem('last_checkin_client_id')
        setLastCheckinHref(storedId ? `/dashboard/checkins/${storedId}` : '/dashboard/checkins')
      }

      const storedChatId = localStorage.getItem('last_chat_client_id')
      setLastChatHref(storedChatId ? `/dashboard/chat?clientId=${storedChatId}` : '/dashboard/chat')
    })
    return () => cancelAnimationFrame(id)
  }, [pathname])

  // Global: comma → period for decimal inputs
  useEffect(() => {
    const handleComma = (e: KeyboardEvent) => {
      if (e.key !== ',') return
      const el = e.target as HTMLInputElement
      if (!el || el.tagName !== 'INPUT') return
      if (el.type === 'number' || el.inputMode === 'decimal' || el.inputMode === 'numeric') {
        e.preventDefault()
        if (el.type !== 'number') {
          const start = el.selectionStart ?? el.value.length
          const end   = el.selectionEnd   ?? el.value.length
          const newVal = el.value.slice(0, start) + '.' + el.value.slice(end)
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          setter?.call(el, newVal)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          requestAnimationFrame(() => { try { el.setSelectionRange(start + 1, start + 1) } catch {} })
        }
      }
    }
    document.addEventListener('keydown', handleComma, true)
    return () => document.removeEventListener('keydown', handleComma, true)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }

      // ── Subscription gate ──────────────────────────────────────────────────
      const checkAccess = (sub: { status: string; trial_end?: string | null; locked_at?: string | null } | null) => {
        if (!sub) return false
        const now = new Date()
        if (sub.status === 'active') return true
        if (sub.status === 'trialing') {
          if (!sub.trial_end) return true
          return new Date(sub.trial_end) > now
        }
        if (sub.status === 'past_due') {
          if (!sub.locked_at) return true
          return new Date(sub.locked_at) > now
        }
        return false
      }

      const isPending = typeof window !== 'undefined' && window.location.search.includes('setup=pending')

      // If coming back from Stripe, sync directly from Stripe (bypasses webhook timing)
      if (isPending) {
        try {
          const { data: { session: authSession } } = await supabase.auth.getSession()
          if (authSession?.access_token) {
            const res = await fetch('/api/billing/sync', {
              method: 'POST',
              headers: { Authorization: `Bearer ${authSession.access_token}` },
            })
            const json = await res.json()
            if (json.hasAccess) {
              window.history.replaceState({}, '', '/dashboard')
            }
          }
        } catch {
          // Fallback: poll Supabase for up to 10s
          const deadline = Date.now() + 10_000
          while (Date.now() < deadline) {
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('status, trial_end, locked_at')
              .eq('trainer_id', user.id)
              .maybeSingle()
            if (checkAccess(sub)) { window.history.replaceState({}, '', '/dashboard'); break }
            await new Promise(r => setTimeout(r, 1500))
          }
        }
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, trial_end, locked_at')
        .eq('trainer_id', user.id)
        .maybeSingle()

      if (!checkAccess(sub)) {
        router.replace('/choose-plan')
        return
      }
      // ──────────────────────────────────────────────────────────────────────
      setAuthChecked(true)

      supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single().then(({ data }) => {
        const name = data?.full_name || user.email || ''
        setUserName(name)
        setUserInitials(name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?')
        setUserAvatarUrl(data?.avatar_url || null)
      })
      // Fetch notifications: unread messages + recent checkins
      fetchNotifications(user.id)
    })
  }, [fetchNotifications])

  useEffect(() => {
    if (!authChecked) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem(LS_ONBOARDING_COMPLETE) === 'true') return
    const id = requestAnimationFrame(() => setShowOnboarding(true))
    return () => cancelAnimationFrame(id)
  }, [authChecked])

  useEffect(() => {
    const handler = () => setShowOnboarding(true)
    window.addEventListener('unitlift-restart-onboarding', handler)
    return () => window.removeEventListener('unitlift-restart-onboarding', handler)
  }, [])

  useEffect(() => {
    if (!tourFarewell) return
    const tid = setTimeout(() => setTourFarewell(false), 5000)
    return () => clearTimeout(tid)
  }, [tourFarewell])

  useEffect(() => {
    if (!helpMobileHint) return
    const tid = setTimeout(() => setHelpMobileHint(false), 6000)
    return () => clearTimeout(tid)
  }, [helpMobileHint])

  const markAllSeen = () => {
    const allIds = notifications.map(n => n.id)
    const newSeen = new Set([...seenIds, ...allIds])
    setSeenIds(newSeen)
    localStorage.setItem('notif_seen_ids', JSON.stringify([...newSeen]))
    setNotifications(n => n.map(x => ({ ...x, isNew: false })))
    setNotifCount(0)
  }

  const markOneSeen = (id: string) => {
    if (seenIds.has(id)) return
    const newSeen = new Set([...seenIds, id])
    setSeenIds(newSeen)
    localStorage.setItem('notif_seen_ids', JSON.stringify([...newSeen]))
    setNotifications(n => n.map(x => x.id === id ? { ...x, isNew: false } : x))
    setNotifCount(c => Math.max(0, c - 1))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isChat = pathname.startsWith('/dashboard/chat')
  const isFixedLayout = isChat || pathname === '/dashboard/training' || pathname === '/dashboard/nutrition'
  const { inActiveChat } = useActiveChat()

  return (
    <TrainerSettingsProvider>
    <TabStateProvider>
    <div className="flex bg-background" style={{ height: '100dvh' }}>

      {/* ── SIDEBAR — hidden on mobile, visible on lg+ ── */}
      <aside className={`${collapsed ? 'w-[68px]' : 'w-60'} hidden lg:flex flex-col shrink-0 transition-all duration-200 relative`} style={{ backgroundColor: '#0f0f14' }}>

        {/* Accent-tinted gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(170deg, color-mix(in srgb, var(--app-accent) 45%, #0f0f14) 0%, #0f0f14 45%)' }}
        />

        {/* Logo */}
        <Link href="/dashboard" className={`relative z-10 flex items-center h-16 px-4 border-b border-white/5 hover:opacity-90 transition-opacity ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {/* Icon mark — always shown */}
          <div className="w-9 h-9 rounded-xl bg-app-accent flex items-center justify-center shrink-0 select-none"
            style={{ boxShadow: '0 2px 8px var(--app-accent-muted)' }}>
            <UnitLiftLogo fill="white" tight={false} className="w-6 h-6" />
          </div>
          {/* Name — only when expanded */}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-black text-sm leading-tight tracking-tight">UnitLift</p>
              <p className="text-white/30 text-[9px] font-semibold tracking-widest uppercase mt-0.5">Coaching Platform</p>
            </div>
          )}
        </Link>

        {/* Nav items */}
        <nav className="relative z-10 flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" data-tour="sidebar-nav">
          {navItems.map(({ href, labelKey, icon: Icon, color }) => {
            const isActive = pathname.startsWith(href) && (href !== '/dashboard' || pathname === '/dashboard')
            const label = tNav(labelKey as 'overview' | 'clients' | 'training' | 'nutrition' | 'checkins' | 'finance' | 'chat' | 'profile')
            // If on a DETAIL page of this section (e.g. /dashboard/checkins/[id]) → reset to root
            // If on the section ROOT or a different section → restore last visited detail (if any)
            const isOnSectionDetailPage = href !== '/dashboard' && pathname.startsWith(href + '/')
            const effectiveHref = isOnSectionDetailPage                  ? href
                                : labelKey === 'clients'                 ? lastClientHref
                                : labelKey === 'chat'                    ? lastChatHref
                                : labelKey === 'checkins'                ? lastCheckinHref
                                : href
            const tourAttr =
              labelKey === 'overview' ? 'tour-dashboard'
              : labelKey === 'chat' ? 'tour-chat'
              : labelKey === 'finance' ? 'tour-finance'
              : undefined
            return (
              <Link
                key={href}
                href={effectiveHref}
                title={collapsed ? label : undefined}
                data-tour={tourAttr}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${collapsed ? 'justify-center' : ''} ${isActive ? 'shadow-sm' : 'hover:bg-white/5 text-white/50 hover:text-white/80'}`}
                style={isActive ? { backgroundColor: 'color-mix(in srgb, var(--app-accent) 22%, transparent)' } : {}}
              >
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors ${isActive ? color : 'text-white/40 group-hover:text-white/60'}`}
                />
                {!collapsed && (
                  <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : ''}`}>
                    {label}
                  </span>
                )}
                {/* Active dot */}
                {isActive && !collapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0 bg-app-accent" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: user + logout */}
        <div className="relative z-10 border-t border-white/5 p-2 space-y-1">
          {/* User avatar */}
          {userName && (
            <div
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors ${collapsed ? 'justify-center' : ''}`}
              onClick={() => router.push('/dashboard/profile')}
              title={collapsed ? userName : undefined}
              data-tour="tour-profile"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                style={!userAvatarUrl ? { backgroundColor: 'color-mix(in srgb, var(--app-accent) 70%, transparent)' } : undefined}>
                {userAvatarUrl
                  ? <img src={userAvatarUrl} alt={userName} className="w-full h-full object-cover object-top" />
                  : <span className="text-white text-xs font-bold">{userInitials}</span>
                }
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-xs font-medium truncate">{userName}</p>
                  <p className="text-white/35 text-[10px]">{tLayout('myProfile')}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleLogout}
            title={collapsed ? tCommon('logout') : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={17} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{tCommon('logout')}</span>}
          </button>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-[72px] z-20 w-6 h-6 rounded-full bg-[#1e1e2a] border border-white/10 hidden lg:flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all shadow-md"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="mobile-accent-header shrink-0 bg-white border-b border-gray-100 z-40 flex items-center h-12 px-4 lg:px-6 gap-3">
          {/* Mobile logo — only shown when sidebar is hidden */}
          <Link href="/dashboard" className="lg:hidden flex items-center gap-2 shrink-0">
            <div className="hdr-logo-bg w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--app-accent)' }}>
              <UnitLiftLogo fill="white" tight={false} className="w-4 h-4" />
            </div>
            <span className="hdr-logo-text font-black text-sm text-gray-900 tracking-tight">UnitLift</span>
          </Link>
          {/* Search trigger */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            className="hdr-search flex items-center gap-2 h-8 px-3 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors text-xs flex-1 lg:flex-none lg:min-w-[180px]"
          >
            <Search size={13} />
            <span className="flex-1 text-left">{tLayout('searchPlaceholder')}</span>
            <kbd className="hidden lg:block text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 font-mono leading-none">⌘K</kbd>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <button
              type="button"
              data-tour="tour-help"
              onClick={() => openHelpFromHeader()}
              className="hdr-icon w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title={tLayout('helpTooltip')}
              aria-label={tLayout('helpTooltip')}
            >
              <span className="text-sm font-bold text-gray-500">?</span>
            </button>
            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(v => !v)}
                className="hdr-icon w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors relative"
                title={tLayout('notificationsTitle')}
              >
                <Bell size={16} />
                {notifCount > 0 && (
                  <span className="hdr-badge absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none"
                    style={{ backgroundColor: 'var(--app-accent)' }}>
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              {/* Notification dropdown */}
              {showNotifs && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                  <div className="fixed top-12 right-2 z-50 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[480px]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{tLayout('notificationsTitle')}</p>
                        {notifCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--app-accent)' }}>
                            {notifCount}
                          </span>
                        )}
                      </div>
                      {notifCount > 0 && (
                        <button onClick={markAllSeen} className="text-[11px] font-medium text-gray-400 hover:text-gray-700 transition-colors">
                          {tLayout('markAllRead')}
                        </button>
                      )}
                    </div>
                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-8">{tLayout('noNotifications')}</p>
                      ) : (
                        notifications.map(n => {
                          const isMsg = n.type === 'message'
                          const isCi  = n.type === 'checkin'
                          const isPkg = n.type === 'package'
                          const iconEl = isMsg
                            ? <MessageSquare size={12} className="text-sky-500" />
                            : isCi
                            ? <ClipboardCheck size={12} style={{ color: 'var(--app-accent)' }} />
                            : isPkg
                            ? <Package size={12} className="text-amber-500" />
                            : <CreditCard size={12} className="text-emerald-500" />
                          const iconBg = isMsg ? '#e0f2fe' : isCi ? 'var(--app-accent-muted)' : isPkg ? '#fef3c7' : '#d1fae5'
                          return (
                            <button key={n.id}
                              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${n.isNew ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-gray-50'}`}
                              onClick={() => { markOneSeen(n.id); if (n.href) router.push(n.href); setShowNotifs(false) }}>
                              <div className="relative mt-0.5 shrink-0">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
                                  {iconEl}
                                </div>
                                {n.isNew && (
                                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white" style={{ backgroundColor: 'var(--app-accent)' }} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs ${n.isNew ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{n.title}</p>
                                <p className="text-xs text-gray-500 truncate">{n.subtitle}</p>
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">{n.time}</span>
                            </button>
                          )
                        })
                      )}
                    </div>
                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 shrink-0">
                      <button className="text-xs font-medium w-full text-center transition-colors" style={{ color: 'var(--app-accent)' }}
                        onClick={() => {
                          // Clear last chat so we land on the list, not the last conversation
                          localStorage.removeItem('last_chat_client_id')
                          router.push('/dashboard/chat')
                          setShowNotifs(false)
                        }}>
                        {tLayout('goToMessages')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="hdr-icon w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title={tLayout('settingsTooltip')}
            >
              <Settings size={16} />
            </button>
          </div>
        </header>
        <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
        <TrainerOnboardingWizard
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
          onFinished={handleWizardFinished}
        />
        {tourFarewell && (
          <div
            className="fixed bottom-20 left-1/2 z-[100] max-w-sm -translate-x-1/2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-center text-sm font-medium text-gray-800 shadow-xl dark:border-white/10 dark:bg-[oklch(0.165_0.025_264)] dark:text-white"
            role="status"
          >
            {tTour('farewell')}
          </div>
        )}
        {helpMobileHint && (
          <div
            className="fixed bottom-20 left-1/2 z-[100] max-w-[min(100vw-2rem,22rem)] -translate-x-1/2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-center text-xs leading-snug text-gray-700 shadow-xl dark:border-white/10 dark:bg-[oklch(0.165_0.025_264)] dark:text-gray-100"
            role="status"
          >
            {tLayout('helpTourDesktopOnly')}
          </div>
        )}
        <GlobalSearch />

        {/* Global FAB — hidden on mobile when in active chat */}
        <div
          className={`fixed lg:bottom-6 right-4 lg:right-6 z-40 ${inActiveChat ? 'hidden lg:flex' : ''}`}
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
        >
          <button
            type="button"
            data-tour="tour-add-client"
            onClick={() => router.push('/dashboard/clients?action=add')}
            className="w-12 h-12 rounded-2xl text-white shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'var(--app-accent)' }}
            title={tLayout('newClientTooltip')}
          >
            <UserPlus size={20} />
          </button>
        </div>

        <main
          className={`flex-1 min-h-0 ${isFixedLayout ? 'flex flex-col overflow-hidden' : 'mobile-tinted-bg overflow-auto p-4 lg:p-8 lg:pb-8'}`}
          style={isFixedLayout
            ? undefined
            : { WebkitOverflowScrolling: 'touch', paddingBottom: '3.5rem' }
          }
        >
          {authChecked ? children : null}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV — hidden only when inside an active client chat ── */}
      {!inActiveChat && (
        <MobileBottomNav
          lastClientHref={lastClientHref}
          lastCheckinHref={lastCheckinHref}
          lastChatHref={lastChatHref}
          notifCount={notifCount}
          userName={userName}
          userInitials={userInitials}
          onLogout={handleLogout}
        />
      )}
    </div>
    </TabStateProvider>
    </TrainerSettingsProvider>
  )
}

