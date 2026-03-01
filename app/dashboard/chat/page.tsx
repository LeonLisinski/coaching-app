'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import ChatWindow from './components/chat-window'

type Client = {
  id: string
  full_name: string
  last_message: string | null
  last_message_time: string | null
  unread: number
}

export default function ChatPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

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
    if (days === 0) return date.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Jučer'
    if (days < 7) return date.toLocaleDateString('hr-HR', { weekday: 'short' })
    return date.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="flex h-full">
      {/* Lista klijenata */}
      <div className="w-72 border-r flex flex-col bg-white">
        <div className="p-4 border-b">
          <h2 className="font-semibold mb-3">Chat</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <Input
              placeholder="Pretraži..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-gray-500 text-sm p-4">Učitavanje...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm p-4">Nema klijenata</p>
          ) : (
            filtered.map(client => (
              <div
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b transition-colors ${
                  selectedClientId === client.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-gray-600">
                    {client.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${client.unread > 0 ? 'font-semibold' : 'font-medium'}`}>
                      {client.full_name}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                      {formatTime(client.last_message_time)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 truncate">
                      {client.last_message || 'Nema poruka'}
                    </p>
                    {client.unread > 0 && (
                      <span className="ml-1 flex-shrink-0 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {client.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat prozor */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedClientId ? (
          <ChatWindow
            clientId={selectedClientId}
            clientName={clients.find(c => c.id === selectedClientId)?.full_name || ''}
            onMessageSent={fetchClients}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-lg font-medium">Odaberi klijenta</p>
              <p className="text-sm">za početak razgovora</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}