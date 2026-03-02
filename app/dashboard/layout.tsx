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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import LocaleSwitcher from '@/components/locale-switcher'

const navItems = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/dashboard/clients', labelKey: 'clients', icon: Users },
  { href: '/dashboard/training', labelKey: 'training', icon: Dumbbell },
  { href: '/dashboard/nutrition', labelKey: 'nutrition', icon: UtensilsCrossed },
  { href: '/dashboard/checkins', labelKey: 'checkins', icon: ListChecks },
  { href: '/dashboard/chat', labelKey: 'chat', icon: MessageSquare },
  { href: '/dashboard/profile', labelKey: 'profile', icon: User },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tNav = useTranslations('nav')
  const tApp = useTranslations('app')
  const tCommon = useTranslations('common')
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isChat = pathname.startsWith('/dashboard/chat')

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-gray-900 text-white flex flex-col transition-all duration-200`}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {!collapsed && <h1 className="text-xl font-bold">{tApp('name')}</h1>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white transition-colors ml-auto"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
            const label = tNav(item.labelKey as any)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={handleLogout}
            title={collapsed ? tCommon('logout') : undefined}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={20} />
            {!collapsed && <span>{tCommon('logout')}</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 bg-white border-b border-gray-200 shadow-sm z-40 flex items-center h-12 px-6">
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
          </div>
        </header>

        <main className={`flex-1 min-h-0 ${isChat ? 'flex flex-col overflow-hidden' : 'overflow-auto p-8'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
