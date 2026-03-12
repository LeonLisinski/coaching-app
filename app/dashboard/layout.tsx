'use client'

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
} from 'lucide-react'
// Dumbbell kept for navItems training icon
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import LocaleSwitcher from '@/components/locale-switcher'
import SettingsDialog from '@/app/components/settings-dialog'
import UnitLiftLogo from '@/app/components/unitlift-logo'
import GlobalSearch from '@/app/components/global-search'

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
  const tApp    = useTranslations('app')
  const tCommon = useTranslations('common')
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [userInitials, setUserInitials] = useState('')
  const [userName, setUserName]         = useState('')
  const [showSettings, setShowSettings] = useState(false)

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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('full_name').eq('id', user.id).single().then(({ data }) => {
        const name = data?.full_name || user.email || ''
        setUserName(name)
        setUserInitials(name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?')
      })
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isChat = pathname.startsWith('/dashboard/chat')

  return (
    <div className="flex h-screen bg-background">

      {/* ── SIDEBAR ── */}
      <aside className={`${collapsed ? 'w-[68px]' : 'w-60'} flex flex-col shrink-0 transition-all duration-200 relative`} style={{ backgroundColor: '#0f0f14' }}>

        {/* Accent-tinted gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(170deg, color-mix(in srgb, var(--app-accent) 45%, #0f0f14) 0%, #0f0f14 45%)' }}
        />

        {/* Logo */}
        <div className={`relative z-10 flex items-center h-16 px-4 border-b border-white/5 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {/* UL monogram mark */}
          <div className="w-8 h-8 rounded-xl bg-app-accent flex items-center justify-center shrink-0 shadow-lg select-none"
            style={{ boxShadow: '0 2px 8px var(--app-accent-muted)' }}>
            <span className="text-white font-black text-sm leading-none" style={{ letterSpacing: '-0.05em' }}>UL</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-black text-sm leading-tight tracking-tight">{tApp('name')}</p>
              <p className="text-white/35 text-[10px] leading-tight mt-0.5 font-medium tracking-wide uppercase">Coaching Platform</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="relative z-10 flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, labelKey, icon: Icon, color }) => {
            const isActive = pathname.startsWith(href) && (href !== '/dashboard' || pathname === '/dashboard')
            const label    = tNav(labelKey as any)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
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
          {!collapsed && userName && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-app-accent flex items-center justify-center shrink-0 opacity-80">
                <span className="text-white text-xs font-bold">{userInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-medium truncate">{userName}</p>
              </div>
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

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-[72px] z-20 w-6 h-6 rounded-full bg-[#1e1e2a] border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all shadow-md"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="shrink-0 bg-white border-b border-gray-100 z-40 flex items-center h-12 px-6 gap-3">
          {/* Search trigger */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors text-xs min-w-[180px]"
          >
            <Search size={13} />
            <span className="flex-1 text-left">Pretraži...</span>
            <kbd className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 font-mono leading-none">⌘K</kbd>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Postavke"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>
        <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
        <GlobalSearch />

        <main className={`flex-1 min-h-0 ${isChat ? 'flex flex-col overflow-hidden' : 'overflow-auto p-8'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
