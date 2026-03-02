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

const navItems = [
  { href: '/dashboard', label: 'Pregled', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Klijenti', icon: Users },
  { href: '/dashboard/training', label: 'Treninzi', icon: Dumbbell },
  { href: '/dashboard/nutrition', label: 'Prehrana', icon: UtensilsCrossed },
  { href: '/dashboard/checkins', label: 'Checkini', icon: ListChecks },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboard/profile', label: 'Profil', icon: User },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
          {!collapsed && <h1 className="text-xl font-bold">Coaching App</h1>}
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
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Odjava' : undefined}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={20} />
            {!collapsed && <span>Odjava</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-hidden flex flex-col ${isChat ? '' : 'overflow-auto'}`}>
        <div className={`flex-1 ${isChat ? 'flex flex-col overflow-hidden' : 'overflow-auto p-8'}`}>
          {children}
        </div>
      </main>
    </div>
  )
}