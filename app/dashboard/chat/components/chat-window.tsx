'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'

type Props = {
  clientId: string
  clientName: string
  onMessageSent: () => void
}

type Message = {
  id: string
  content: string
  sender_id: string
  created_at: string
  read: boolean
  trainer_id: string
  client_id: string
}

export default function ChatWindow({ clientId, clientName, onMessageSent }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    initChat()
    return () => {
      supabase.removeAllChannels()
    }
  }, [clientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initChat = async () => {
    setLoading(true)
    setMessages([])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    userIdRef.current = user.id
    await fetchMessages(user.id)
    await markAsRead(user.id)
    subscribeToMessages(user.id)
  }

  const fetchMessages = async (uid: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('client_id', clientId)
      .eq('trainer_id', uid)
      .order('created_at', { ascending: true })

    if (data) setMessages(data)
    setLoading(false)
  }

  const markAsRead = async (uid: string) => {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('client_id', clientId)
      .eq('trainer_id', uid)
      .neq('sender_id', uid)
      .eq('read', false)
  }

  const subscribeToMessages = (uid: string) => {
    supabase
      .channel(`chat-${clientId}-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as Message
          if (msg.client_id === clientId && msg.trainer_id === uid) {
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            markAsRead(uid)
          }
        }
      )
      .subscribe()
  }

  const sendMessage = async () => {
    if (!input.trim() || !userIdRef.current || sending) return
    setSending(true)

    const content = input.trim()
    setInput('')

    const { error } = await supabase.from('messages').insert({
      trainer_id: userIdRef.current,
      client_id: clientId,
      sender_id: userIdRef.current,
      content,
      read: false,
    })

    if (error) {
      console.error('Send error:', error.message)
      setInput(content)
    } else {
      onMessageSent()
    }

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (time: string) => {
    return new Date(time).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const groupedMessages = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at)
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {} as Record<string, Message[]>)

  return (
    <>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#4b5563' }}>
            {clientName.charAt(0).toUpperCase()}
          </span>
        </div>
        <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{clientName}</p>
      </div>

      {/* Poruke */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>Učitavanje...</p>
        ) : messages.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 32 }}>Početak razgovora s {clientName}</p>
        ) : (
          Object.entries(groupedMessages).map(([date, dayMessages]) => (
            <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Datum separator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <span style={{ fontSize: 12, color: '#9ca3af', padding: '0 8px' }}>{date}</span>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              </div>
              {dayMessages.map(msg => {
                const isTrainer = msg.sender_id === msg.trainer_id
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: isTrainer ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '70%',
                        padding: '8px 12px',
                        borderRadius: isTrainer ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        backgroundColor: isTrainer ? '#3b82f6' : '#e5e7eb',
                        color: isTrainer ? '#ffffff' : '#1f2937',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 14 }}>{msg.content}</p>
                      <p style={{
                        margin: '4px 0 0 0',
                        fontSize: 11,
                        textAlign: 'right',
                        color: isTrainer ? '#bfdbfe' : '#6b7280',
                      }}>
                        {formatTime(msg.created_at)}
                        {isTrainer && <span style={{ marginLeft: 4 }}>{msg.read ? '✓✓' : '✓'}</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Napiši poruku..."
          style={{ flex: 1 }}
          disabled={sending}
          autoFocus
        />
        <Button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          size="sm"
        >
          <Send size={14} />
        </Button>
      </div>
    </>
  )
}