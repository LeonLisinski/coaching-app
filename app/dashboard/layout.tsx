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
  LogOut
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Pregled', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Klijenti', icon: Users },
  { href: '/dashboard/training', label: 'Treninzi', icon: Dumbbell },
  { href: '/dashboard/nutrition', label: 'Prehrana', icon: UtensilsCrossed },
  { href: '/dashboard/checkins', label: 'Checkini', icon: ListChecks },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isChat = pathname.startsWith('/dashboard/chat')

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">Coaching App</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full"
          >
            <LogOut size={20} />
            <span>Odjava</span>
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