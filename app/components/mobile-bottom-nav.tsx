'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ListChecks, MessageSquare,
  MoreHorizontal, Dumbbell, UtensilsCrossed, Banknote, User, X, LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import UnitLiftLogo from '@/app/components/unitlift-logo'

type Props = {
  lastClientHref:  string
  lastCheckinHref: string
  lastChatHref:    string
  notifCount?:     number
  userName?:       string
  userInitials?:   string
  onLogout:        () => void
}

export default function MobileBottomNav({
  lastClientHref, lastCheckinHref, lastChatHref,
  notifCount = 0, userName = '', userInitials = '?', onLogout,
}: Props) {
  const pathname   = usePathname()
  const tNav       = useTranslations('nav')
  const tCommon    = useTranslations('common')
  const [showMore, setShowMore] = useState(false)

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href)

  const primaryItems = [
    { href: '/dashboard',          effectiveHref: '/dashboard',        labelKey: 'overview',  icon: LayoutDashboard },
    { href: '/dashboard/clients',  effectiveHref: lastClientHref,      labelKey: 'clients',   icon: Users           },
    { href: '/dashboard/checkins', effectiveHref: lastCheckinHref,     labelKey: 'checkins',  icon: ListChecks      },
    { href: '/dashboard/chat',     effectiveHref: lastChatHref,        labelKey: 'chat',      icon: MessageSquare   },
  ] as const

  const moreItems = [
    { href: '/dashboard/training',  labelKey: 'training',  icon: Dumbbell        },
    { href: '/dashboard/nutrition', labelKey: 'nutrition', icon: UtensilsCrossed },
    { href: '/dashboard/financije', labelKey: 'finance',   icon: Banknote        },
    { href: '/dashboard/profile',   labelKey: 'profile',   icon: User            },
  ] as const

  const isMoreActive = moreItems.some(({ href }) => pathname.startsWith(href))

  return (
    <>
      {/* ── BOTTOM BAR ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-gray-100"
      >
        <div className="flex items-center justify-around h-14">
          {primaryItems.map(({ href, effectiveHref, labelKey, icon: Icon }) => {
            const active = isActive(href)
            const hasBadge = labelKey === 'chat' && notifCount > 0
            return (
              <Link
                key={href}
                href={effectiveHref}
                className="flex items-center justify-center flex-1 h-full transition-colors"
                style={{ color: active ? 'var(--app-accent)' : '#9ca3af' }}
              >
                <div className="relative">
                  <Icon size={24} strokeWidth={active ? 2.2 : 1.7} />
                  {hasBadge && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className="flex items-center justify-center flex-1 h-full transition-colors"
            style={{ color: isMoreActive ? 'var(--app-accent)' : '#9ca3af' }}
          >
            <MoreHorizontal size={24} strokeWidth={1.7} />
          </button>
        </div>
      </nav>

      {/* ── MORE DRAWER ── */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/30 lg:hidden"
            onClick={() => setShowMore(false)}
          />

          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--app-accent)' }}>
                  <UnitLiftLogo fill="white" tight={false} className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{userName || 'UnitLift'}</p>
                  <p className="text-[11px] text-gray-400">Coaching Platform</p>
                </div>
              </div>
              <button
                onClick={() => setShowMore(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Nav grid */}
            <div className="grid grid-cols-4 gap-1 px-4 py-2">
              {moreItems.map(({ href, labelKey, icon: Icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
                    style={active
                      ? { color: 'var(--app-accent)', backgroundColor: 'color-mix(in srgb, var(--app-accent) 10%, transparent)' }
                      : { color: '#4b5563', backgroundColor: '#f9fafb' }
                    }
                  >
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={active
                        ? { backgroundColor: 'color-mix(in srgb, var(--app-accent) 15%, transparent)' }
                        : { backgroundColor: '#f3f4f6' }
                      }
                    >
                      <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
                    </div>
                    <span className="text-xs font-semibold text-center leading-tight">
                      {tNav(labelKey as any)}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Logout row */}
            <div className="px-4 pt-2 pb-1">
              <button
                onClick={() => { setShowMore(false); onLogout() }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 bg-red-50 hover:bg-red-100 transition-colors active:scale-[0.98]"
              >
                <LogOut size={17} />
                <span className="text-sm font-semibold">{tCommon('logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
