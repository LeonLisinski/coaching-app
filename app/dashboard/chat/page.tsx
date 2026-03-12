'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Search, MessageCircle } from 'lucide-react'
import ChatWindow from './components/chat-window'
import { useAppTheme } from '@/app/contexts/app-theme'
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

export default function ChatPage() {
  const t = useTranslations('chat')
  const searchParams = useSearchParams()
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Auto-select client from URL param (e.g. from reminder button)
  useEffect(() => {
    const preselect = searchParams.get('clientId')
    if (preselect) setSelectedClientId(preselect)
  }, [searchParams])

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: clientsData } = await supabase
      .from('clients')
      .select(`id, profiles!clients_user_id_fkey (full_name)`)
      .eq('trainer_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (!clientsData) return

    const clientIds = clientsData.map(c => c.id)
    const { data: messagesData } = await supabase
      .from('messages')
      .select('client_id, content, created_at, read, sender_id')
      .in('client_id', clientIds)
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })

    const lastMessageMap: Record<string, { content: string; time: string }> = {}
    const unreadMap: Record<string, number> = {}

    messagesData?.forEach(m => {
      if (!lastMessageMap[m.client_id]) {
        lastMessageMap[m.client_id] = { content: m.content, time: m.created_at }
      }
      if (!m.read && m.sender_id !== user.id) {
        unreadMap[m.client_id] = (unreadMap[m.client_id] || 0) + 1
      }
    })

    const mapped: Client[] = clientsData.map((c: any) => ({
      id: c.id,
      full_name: c.profiles?.full_name || 'Bez imena',
      last_message: lastMessageMap[c.id]?.content || null,
      last_message_time: lastMessageMap[c.id]?.time || null,
      unread: unreadMap[c.id] || 0,
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
    if (days === 1) return 'Jučer'
    if (days < 7) return date.toLocaleDateString(locale, { weekday: 'short' })
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  }

  const AVATAR_COLORS = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ]

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white">
      {/* Sidebar */}
      <div className="w-72 border-r flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ background: `linear-gradient(135deg, ${accentHex}12, ${accentHex}06)` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}18` }}>
              <MessageCircle size={14} style={{ color: accentHex }} />
            </div>
            <h2 className="text-sm font-bold text-gray-900">{t('page.title')}</h2>
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
              className="pl-8 h-8 text-sm bg-white/80 border-gray-200"
            />
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
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
                      ? { backgroundColor: `${accentHex}10`, borderRight: `2px solid ${accentHex}` }
                      : { borderRight: '2px solid transparent' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentHex}06` }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '' }}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-semibold ${avatarColor}`}>
                      {client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-sm truncate ${client.unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                          {client.full_name}
                        </p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">
                          {formatTime(client.last_message_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className={`text-xs truncate ${client.unread > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
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
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: `${accentHex}04` }}>
        {selectedClientId ? (
          <ChatWindow
            clientId={selectedClientId}
            clientName={clients.find(c => c.id === selectedClientId)?.full_name || ''}
            accentHex={accentHex}
            onMessageSent={fetchClients}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${accentHex}15` }}>
              <MessageCircle size={28} style={{ color: accentHex }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Odaberi klijenta</p>
              <p className="text-xs text-gray-400 mt-1">za početak razgovora s klijentom</p>
            </div>
            <div className="flex gap-2 mt-2">
              {clients.slice(0, 3).map(c => (
                <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                  className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors bg-white border-gray-200 text-gray-600 hover:border-gray-300">
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
