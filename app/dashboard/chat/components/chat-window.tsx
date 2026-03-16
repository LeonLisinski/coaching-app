'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Send, Zap, ArrowLeft } from 'lucide-react'

const QUICK_TEMPLATES = [
  { label: 'Podsjetnik check-in', text: 'Ne zaboravi predati check-in ovaj tjedan! 💪' },
  { label: 'Bravo na napretku', text: 'Odlično si napredovao/la — nastavi tako! 🎉' },
  { label: 'Kako se osjećaš?', text: 'Kako se osjećaš nakon posljednjeg treninga?' },
  { label: 'Trening sutra', text: 'Podsjetnik: trening sutra — ne zaboravi se zagrijati! 🔥' },
  { label: 'Provjera prehrane', text: 'Javi mi kako ide s prehranom ovaj tjedan.' },
  { label: 'Motivacija', text: 'Svaki korak naprijed je napredak. Nastavi raditi, rezultati dolaze! 💯' },
]

type Props = {
  clientId: string
  clientName: string
  accentHex?: string
  onMessageSent: () => void
  onBack?: () => void
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

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const COLORS = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ]
  const color = COLORS[name.charCodeAt(0) % COLORS.length]
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function ChatWindow({ clientId, clientName, accentHex = '#7c3aed', onMessageSent, onBack }: Props) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userIdRef = useRef<string | null>(null)
  const templatesRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // On mobile: fixed overlay covering the full screen (top:0 → covers safe area too).
  // The gradient header inside has padding-top:env(safe-area-inset-top) so content
  // sits below the Dynamic Island / notch on every iPhone.
  // When keyboard opens, we adjust `bottom` = keyboard height so the input stays visible.
  useEffect(() => {
    const el = outerRef.current
    if (!el || window.innerWidth >= 1024) return

    el.style.position = 'fixed'
    el.style.top = '0'
    el.style.left = '0'
    el.style.right = '0'
    el.style.bottom = '0'

    const vv = (window as any).visualViewport
    if (!vv) return

    const update = () => {
      // In PWA mode on iOS, when keyboard opens the visual viewport can scroll
      // (vv.offsetTop > 0). We must track both top AND bottom to keep the overlay
      // anchored to what the user actually sees.
      el.style.top = `${vv.offsetTop}px`
      el.style.bottom = `${Math.max(0, window.innerHeight - vv.offsetTop - vv.height)}px`
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      el.style.position = ''
      el.style.top = ''
      el.style.left = ''
      el.style.right = ''
      el.style.bottom = ''
    }
  }, [])

  useEffect(() => {
    initChat()
    return () => { supabase.removeAllChannels() }
  }, [clientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close templates panel on outside click
  useEffect(() => {
    if (!showTemplates) return
    const handler = (e: MouseEvent) => {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTemplates])

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        if (msg.client_id === clientId && msg.trainer_id === uid) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
          markAsRead(uid)

          // Send push if tab is hidden (app in background)
          if (msg.sender_id !== uid && document.visibilityState === 'hidden') {
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trainer_id: uid,
                title: `💬 ${clientName}`,
                body: msg.content?.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content,
                url: '/dashboard/chat',
                tag: `message-${clientId}`,
              }),
            }).catch(() => {})
          }
        }
      })
      .subscribe()
  }

  const sendMessage = async () => {
    if (!input.trim() || !userIdRef.current || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')

    // Optimistic update — show message immediately without waiting for real-time subscription
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      content,
      sender_id: userIdRef.current,
      trainer_id: userIdRef.current,
      client_id: clientId,
      created_at: new Date().toISOString(),
      read: false,
    }
    setMessages(prev => [...prev, optimistic])

    const { data: inserted, error } = await supabase.from('messages').insert({
      trainer_id: userIdRef.current,
      client_id: clientId,
      sender_id: userIdRef.current,
      content,
      read: false,
    }).select().single()

    if (error) {
      console.error('Send error:', error.message)
      setInput(content)
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } else {
      setMessages(prev => prev.map(m => m.id === tempId ? inserted : m))
      onMessageSent()
    }
    setSending(false)
    // Keep keyboard open on mobile after sending
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const fmtTime = (t: string) => new Date(t).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (t: string) => {
    const d = new Date(t)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return 'Danas'
    if (diff === 1) return 'Jučer'
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const grouped = messages.reduce((acc, msg) => {
    const key = new Date(msg.created_at).toLocaleDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(msg)
    return acc
  }, {} as Record<string, Message[]>)

  return (
    {/* h-full only on desktop — on mobile JS sets top/bottom, h-full conflicts with that */}
    <div ref={outerRef} className="flex flex-col bg-white z-[60] lg:z-auto lg:h-full">
      {/* Gradient header — covers safe area on mobile (top:0 overlay), matches app style */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0 lg:border-b lg:bg-white lg:shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${accentHex}, color-mix(in srgb, ${accentHex} 55%, #0b0018))`,
          paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
          paddingBottom: '14px',
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/15 transition-colors -ml-1 shrink-0 lg:hidden"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold flex-shrink-0 text-sm bg-white/20 text-white`}>
          {clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{clientName}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <p className="text-xs text-white/70">Klijent</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">{tCommon('loading')}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Send size={18} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Nema poruka</p>
            <p className="text-xs text-gray-400">{t('window.startOfConversation')}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([key, dayMessages]) => (
            <div key={key} className="space-y-1">
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] text-gray-400 font-medium px-1">{fmtDate(dayMessages[0].created_at)}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {dayMessages.map((msg, i) => {
                const isTrainer = msg.sender_id === msg.trainer_id
                const prev = dayMessages[i - 1]
                const isSameAuthorAsPrev = prev && prev.sender_id === msg.sender_id
                return (
                  <div key={msg.id} className={`flex ${isTrainer ? 'justify-end' : 'justify-start'} ${isSameAuthorAsPrev ? 'mt-0.5' : 'mt-3'}`}>
                    <div className={`max-w-[72%] ${isTrainer ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                          isTrainer
                            ? 'text-white rounded-2xl rounded-br-sm'
                            : 'bg-white border border-gray-100 text-gray-900 rounded-2xl rounded-bl-sm'
                        }`}
                        style={isTrainer ? { background: `linear-gradient(135deg, ${accentHex}, ${accentHex}dd)` } : undefined}
                      >
                        {msg.content}
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 px-1 ${isTrainer ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[10px] text-gray-400">{fmtTime(msg.created_at)}</span>
                        {isTrainer && (
                          <span className={`text-[10px] ${msg.read ? 'text-emerald-400' : 'text-gray-300'}`}>
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
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
      <div className="flex-shrink-0 px-4 py-3 border-t bg-white">
        {/* Quick templates panel */}
        {showTemplates && (
          <div ref={templatesRef} className="mb-2 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-gray-100">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Brze poruke</span>
            </div>
            <div className="flex flex-col">
              {QUICK_TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  onClick={() => { setInput(tpl.text); setShowTemplates(false) }}
                  className="text-left px-3 py-2 hover:bg-white transition-colors group border-b border-gray-100 last:border-0"
                >
                  <span className="text-[11px] font-semibold block" style={{ color: accentHex }}>{tpl.label}</span>
                  <span className="text-xs text-gray-500 leading-tight">{tpl.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 transition-colors focus-within:bg-white">
          {/* Templates toggle */}
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
            style={showTemplates
              ? { backgroundColor: `${accentHex}20`, color: accentHex }
              : { color: '#9ca3af' }
            }
            title="Brze poruke"
          >
            <Zap size={14} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('window.messagePlaceholder')}
            // Never disable textarea — disabling blurs it and closes the iOS keyboard
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 text-gray-900 resize-none max-h-24 overflow-y-auto leading-relaxed"
            style={{ minHeight: '1.5rem' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            aria-label={t('window.send')}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:scale-105 flex-shrink-0 mb-0.5"
            style={{ backgroundColor: accentHex }}
          >
            <Send size={13} />
          </button>
        </div>
        <p className="hidden lg:block text-[10px] text-gray-400 text-center mt-1.5">Enter za slanje · Shift+Enter za novi red</p>
      </div>
    </div>
  )
}

