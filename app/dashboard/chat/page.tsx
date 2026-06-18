'use client'
import { useEffect, useState, Suspense } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Search, MessageCircle } from 'lucide-react'
import ChatWindow from './components/chat-window'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useActiveChat } from '@/app/contexts/active-chat'
import { useSearchParams } from 'next/navigation'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type Client = {
  id: string
  full_name: string
  last_message: string | null
  last_message_time: string | null
  unread: number
}

function ChatPageContent() {
  const t = useTranslations('chat')
  const tChat = useTranslations('chatPage')
  const searchParams = useSearchParams()
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isDark = mode === 'dark'
  const { setInActiveChat } = useActiveChat()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Auto-select client from URL param or last stored chat
  useEffect(() => {
    const preselect = searchParams.get('clientId')
    if (preselect) {
      setSelectedClientId(preselect)
    } else {
      const stored = localStorage.getItem('last_chat_client_id')
      if (stored) setSelectedClientId(stored)
    }
  }, [searchParams])

  // Persist selected chat + signal layout to hide tabs
  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem('last_chat_client_id', selectedClientId)
      setInActiveChat(true)
      // Mark message notifications for this specific client as read
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch('/api/notifications/mark-read', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ href: `/dashboard/chat?clientId=${selectedClientId}` }),
        })
      })
    } else {
      localStorage.removeItem('last_chat_client_id')
      setInActiveChat(false)
    }
    return () => setInActiveChat(false)
  }, [selectedClientId, setInActiveChat])

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    // Run clients list and chat summary RPC in parallel.
    // RPC uses DISTINCT ON + indexed scans — O(clients) instead of fetching every message row.
    const [{ data: clientsData }, { data: summaryData }] = await Promise.all([
      supabase
        .from('clients')
        .select(`id, profiles!clients_user_id_fkey (full_name)`)
        .eq('trainer_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_trainer_chat_summary', { p_trainer_id: user.id }),
    ])

    if (!clientsData) { setLoading(false); return }

    const summaryMap: Record<string, { content: string; time: string; unread: number }> = {}
    ;(summaryData ?? []).forEach((s: any) => {
      summaryMap[s.client_id] = {
        content: s.last_content,
        time: s.last_created_at,
        unread: Number(s.unread_count) || 0,
      }
    })

    const mapped: Client[] = clientsData.map((c: any) => ({
      id: c.id,
      full_name: c.profiles?.full_name || tChat('fallbackName'),
      last_message: summaryMap[c.id]?.content || null,
      last_message_time: summaryMap[c.id]?.time || null,
      unread: summaryMap[c.id]?.unread || 0,
    }))

    mapped.sort((a, b) => {
      if (!a.last_message_time) return 1
      if (!b.last_message_time) return -1
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    })

    setClients(mapped)
    setLoading(false)
  }

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const formatTime = (time: string | null) => {
    if (!time) return ''
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return tChat('yesterday')
    if (days < 7) return date.toLocaleDateString(locale, { weekday: 'short' })
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  }

  const AVATAR_COLORS = isDark ? [
    'bg-violet-500/20 text-violet-300',
    'bg-blue-500/20 text-blue-300',
    'bg-emerald-500/20 text-emerald-300',
    'bg-amber-500/20 text-amber-300',
    'bg-rose-500/20 text-rose-300',
    'bg-cyan-500/20 text-cyan-300',
  ] : [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ]

  return (
    <div className={`flex h-full overflow-hidden rounded-2xl border shadow-sm ${isDark ? 'bg-[oklch(0.13_0.014_264)] border-white/8' : 'bg-white border-gray-100'}`}>
      {/* Sidebar */}
      <div className={`${selectedClientId ? 'hidden lg:flex' : 'flex'} w-full lg:w-72 border-r flex-col flex-shrink-0 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
        {/* Header */}
        <div className={`px-4 pt-4 pb-3 border-b ${isDark ? 'bg-white/[0.03] border-white/8' : 'border-gray-100'}`}
          style={!isDark ? { background: `linear-gradient(135deg, ${accentHex}12, ${accentHex}06)` } : undefined}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}18` }}>
              <MessageCircle size={14} style={{ color: accentHex }} />
            </div>
            <h2 className={`text-sm font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('page.title')}</h2>
            {clients.some(c => c.unread > 0) && (
              <span className="ml-auto text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: accentHex }}>
                {clients.reduce((s, c) => s + c.unread, 0)}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
            <Input
              placeholder={t('page.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`pl-8 h-8 text-sm ${isDark ? 'bg-white/8 border-white/10' : 'bg-white/80 border-gray-200'}`}
            />
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className={`w-9 h-9 rounded-full flex-shrink-0 ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />
                  <div className="flex-1 space-y-1.5">
                    <div className={`h-3 rounded w-3/4 ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />
                    <div className={`h-2.5 rounded w-1/2 ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('page.noClients')}</p>
          ) : (
            <div className="py-1">
              {filtered.map(client => {
                const isSelected = selectedClientId === client.id
                const avatarColor = AVATAR_COLORS[client.full_name.charCodeAt(0) % AVATAR_COLORS.length]
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={isSelected
                      ? { backgroundColor: `${accentHex}${isDark ? '18' : '10'}`, borderRight: `2px solid ${accentHex}` }
                      : { borderRight: '2px solid transparent' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentHex}${isDark ? '0e' : '06'}` }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '' }}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-semibold ${avatarColor}`}>
                      {client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-sm truncate ${client.unread > 0 ? `font-semibold ${isDark ? 'text-white' : 'text-gray-900'}` : `font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}`}>
                          {client.full_name}
                        </p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">
                          {formatTime(client.last_message_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className={`text-xs truncate ${client.unread > 0 ? (isDark ? 'text-gray-300' : 'text-gray-600') : 'text-gray-400'}`}>
                          {client.last_message || t('page.noMessages')}
                        </p>
                        {client.unread > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center" style={{ backgroundColor: accentHex }}>
                            {client.unread > 9 ? '9+' : client.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {!selectedClientId && <div className="lg:hidden h-14" />}
        </div>
      </div>

      {/* Chat area */}
      <div className={`${!selectedClientId ? 'hidden lg:flex' : 'flex'} flex-1 flex-col overflow-hidden`}
        style={{ backgroundColor: isDark ? 'oklch(0.13 0.014 264)' : `${accentHex}04` }}>
        {selectedClientId ? (
          <ChatWindow
            clientId={selectedClientId}
            clientName={clients.find(c => c.id === selectedClientId)?.full_name || ''}
            accentHex={accentHex}
            onMessageSent={fetchClients}
            onBack={() => setSelectedClientId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${accentHex}15` }}>
              <MessageCircle size={28} style={{ color: accentHex }} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{tChat('selectClient')}</p>
              <p className="text-xs text-gray-400 mt-1">{tChat('selectClientHint')}</p>
            </div>
            <div className="flex gap-2 mt-2">
              {clients.slice(0, 3).map(c => (
                <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${isDark ? 'bg-white/8 border-white/15 text-gray-300 hover:border-white/30' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {c.full_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const PageSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-8 w-48 bg-gray-100 dark:bg-white/5 rounded-lg" />
    <div className="h-10 bg-gray-100 dark:bg-white/5 rounded-xl" />
    {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-white/5 rounded-2xl" />)}
  </div>
)

export default function ChatPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChatPageContent />
    </Suspense>
  )
}
