'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'
import {
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Plus, Phone,
  ClipboardCheck, Sparkles, X, Loader2, Trash2, CheckCircle2, Circle, Check,
} from 'lucide-react'
import nextDynamic from 'next/dynamic'
const DateTimePicker = nextDynamic(() => import('@/app/components/date-time-picker'), { ssr: false })

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type EventType = 'call' | 'checkin' | 'custom'

type CalEvent = {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  type: EventType
  color: string | null
  notes: string | null
  lead_submission_id: string | null
  client_id: string | null
  client_name?: string | null
  lead_name?: string | null
  completed: boolean
}

type Client = { id: string; user_id: string; full_name: string }
type Lead   = { id: string; name: string }

// Virtual check-in schedule (generated from checkin_config, NOT stored in DB)
type CheckinSchedule = {
  client_id: string
  client_user_id: string
  full_name: string
  checkin_day: number   // 0=Sun … 6=Sat (Date.getDay() convention)
  end_date: string | null  // latest active package end_date, null = no limit
}

type ModalState = {
  open: boolean
  mode: 'create' | 'edit'
  event: Partial<CalEvent> & { starts_at_local?: string; ends_at_local?: string }
}

const TYPE_ICONS: Record<EventType, typeof Phone> = {
  call: Phone, checkin: ClipboardCheck, custom: Sparkles,
}

const TYPE_COLORS: Record<EventType, string> = {
  call: '#0284c7', checkin: '#0d9488', custom: '#7c3aed',
}

// ─── Custom Select ────────────────────────────────────────────────────────────
function CustomSelect({
  value, options, placeholder, isDark, border, textMain, textMuted, accentHex, onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder?: string
  isDark: boolean
  border: string
  textMain: string
  textMuted: string
  accentHex: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const selected = options.find(o => o.value === value)
  const bg = isDark ? '#0f0f1a' : '#f9fafb'
  const dropBg = isDark ? 'oklch(0.195 0.018 264)' : 'white'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm text-left transition-all"
        style={{ borderColor: open ? accentHex : border, background: bg, color: selected ? textMain : textMuted }}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? '—'}</span>
        <ChevronDown size={14} style={{ color: textMuted, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-hidden z-[70]"
          style={{ background: dropBg, borderColor: border }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(opt.value); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors hover:opacity-80"
              style={{
                background: opt.value === value ? accentHex + '18' : 'transparent',
                color: opt.value === value ? accentHex : textMain,
                fontWeight: opt.value === value ? 600 : 400,
              }}
            >
              {opt.value === value && <Check size={12} style={{ color: accentHex, flexShrink: 0 }} />}
              {opt.value !== value && <span className="w-3 shrink-0" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toLocalDT(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const pad = (first.getDay() + 6) % 7 // Mon = 0
  const start = new Date(first)
  start.setDate(start.getDate() - pad)
  return start
}

// ─────────────────────────────────────────────────────────────────────────────
export default function KalendarPage() {
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isDark = mode === 'dark'
  const router = useRouter()
  const t = useTranslations('calendar')
  const locale = useLocale()
  const dateLocale = locale === 'en' ? 'en-GB' : 'hr-HR'

  const cardBg   = isDark ? 'oklch(0.195 0.018 264)' : 'white'
  const border   = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const textMain = isDark ? '#f9fafb' : '#111827'
  const textMuted = isDark ? '#9ca3af' : '#6b7280'
  const cellHover = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'

  const today = new Date()
  const [userId, setUserId] = useState<string | null>(null)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [clients, setClients]   = useState<Client[]>([])
  const [leads, setLeads]       = useState<Lead[]>([])
  const [schedules, setSchedules] = useState<CheckinSchedule[]>([])
  // Keys: "clientId-YYYY-MM-DD" for days with actual submitted checkins
  const [submittedCheckins, setSubmittedCheckins] = useState<Set<string>>(new Set())
  // Keys: "clientUserId-YYYY-MM-DD" for manually marked auto-checkins
  const [manualDone, setManualDone] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // Month navigation
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Modal
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', event: {} })
  const [saving, setSaving]   = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const modalScrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll modal content to top when opened
  useEffect(() => {
    if (modal.open && modalScrollRef.current) {
      modalScrollRef.current.scrollTop = 0
    }
  }, [modal.open])

  // Prevent background scroll on iOS while modal is open (use main scroll container, not body)
  useEffect(() => {
    const main = document.querySelector('main') as HTMLElement | null
    if (!main) return
    if (modal.open) {
      main.style.overflow = 'hidden'
    } else {
      main.style.overflow = ''
    }
    return () => { if (main) main.style.overflow = '' }
  }, [modal.open])

  // ── Load month events ─────────────────────────────────────────────────────
  const loadEvents = useCallback(async (uid: string, year: number, month: number) => {
    const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const toDate   = `${year}-${String(month + 2).padStart(2, '0')}-01`
    const from = new Date(year, month, 1).toISOString()
    const to   = new Date(year, month + 1, 1).toISOString()

    const [evRes, checkinRes] = await Promise.all([
      supabase.from('trainer_events')
        .select('id, title, starts_at, ends_at, type, color, notes, completed, client_id, lead_submission_id')
        .eq('trainer_id', uid).gte('starts_at', from).lt('starts_at', to).order('starts_at'),
      // Actual submitted check-ins this month
      supabase.from('checkins').select('client_id, date')
        .eq('trainer_id', uid).gte('date', fromDate).lt('date', toDate),
    ])

    const { data } = evRes

    // Build submitted checkins set: "clientId-YYYY-MM-DD"
    const subSet = new Set<string>()
    for (const ci of checkinRes.data ?? []) {
      subSet.add(`${ci.client_id}-${ci.date}`)
    }
    setSubmittedCheckins(subSet)

    // Build manual-done set from trainer_events with type=checkin, completed=true, client_id set
    const manualSet = new Set<string>()
    for (const ev of data ?? []) {
      if (ev.type === 'checkin' && ev.completed && ev.client_id) {
        const d = new Date(ev.starts_at)
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        manualSet.add(`${ev.client_id}-${dateStr}`)
      }
    }
    setManualDone(manualSet)

    if (!data) return

    // Batch-fetch all needed profiles and lead answers in 2 queries instead of N+1
    const clientIds   = [...new Set(data.filter(e => e.client_id).map(e => e.client_id as string))]
    const leadIds     = [...new Set(data.filter(e => e.lead_submission_id).map(e => e.lead_submission_id as string))]

    const [profilesRes, leadsRes2] = await Promise.all([
      clientIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', clientIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      leadIds.length
        ? supabase.from('lead_submissions').select('id, answers').in('id', leadIds)
        : Promise.resolve({ data: [] as { id: string; answers: Record<string, unknown> }[] }),
    ])

    const profileMap = new Map<string, string>()
    for (const p of profilesRes.data ?? []) profileMap.set(p.id, p.full_name)

    const leadNameMap = new Map<string, string>()
    for (const l of leadsRes2.data ?? []) {
      if (l.answers) {
        const entries = Object.entries(l.answers as Record<string, unknown>)
        const val = entries.find(([k]) => /ime|name/i.test(k))?.[1]
          ?? entries.find(([k]) => /email/i.test(k))?.[1]
        if (val) leadNameMap.set(l.id, String(val))
      }
    }

    const withNames: CalEvent[] = data.map(ev => ({
      ...ev,
      client_name: ev.client_id ? (profileMap.get(ev.client_id) ?? null) : null,
      lead_name:   ev.lead_submission_id ? (leadNameMap.get(ev.lead_submission_id) ?? null) : null,
    }))

    setEvents(withNames)
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }
        const uid = session.user.id

        const [clientsRes, leadsRes, schedRes] = await Promise.all([
          supabase.from('clients')
            .select('id, user_id, profiles!clients_user_id_fkey(full_name)')
            .eq('trainer_id', uid).eq('active', true),
          supabase.from('lead_submissions')
            .select('id, answers').eq('trainer_id', uid)
            .order('created_at', { ascending: false }).limit(50),
          supabase.from('checkin_config')
            .select(`
              client_id,
              checkin_day,
              clients!inner(
                user_id,
                active,
                profiles!clients_user_id_fkey(full_name),
                client_packages(client_id, end_date, status)
              )
            `)
            .eq('trainer_id', uid),
        ])

        if (clientsRes.data) {
          setClients(clientsRes.data.map((c: any) => ({
            id: c.id, user_id: c.user_id, full_name: c.profiles?.full_name ?? c.user_id,
          })))
        }
        if (leadsRes.data) {
          setLeads(leadsRes.data.map((l: any) => {
            const entries = Object.entries(l.answers || {})
            const name = entries.find(([k]) => /ime|name/i.test(k))?.[1]
              ?? entries.find(([k]) => /email/i.test(k))?.[1] ?? l.id
            return { id: l.id, name: String(name) }
          }))
        }

        if (schedRes.data) {
          const activeConfigs = (schedRes.data as any[]).filter(r => r.clients?.active)

          const schedulesWithEnd: CheckinSchedule[] = activeConfigs.map(r => {
            const activePkgs: any[] = (r.clients?.client_packages ?? [])
              .filter((p: any) => p.status === 'active')
              .sort((a: any, b: any) => (a.end_date > b.end_date ? -1 : 1))
            return {
              client_id:      r.client_id,
              client_user_id: r.clients.user_id,
              full_name:      r.clients.profiles?.full_name ?? '—',
              checkin_day:    r.checkin_day,
              end_date:       activePkgs[0]?.end_date ?? null,
            }
          })
          setSchedules(schedulesWithEnd)
        }
        await loadEvents(uid, today.getFullYear(), today.getMonth())
        // Set userId AFTER loadEvents so the month-change effect (below) doesn't re-fire
        // for the initial month — init already loaded it.
        setUserId(uid)
        setLoading(false)
      } catch (err) {
        console.error('Kalendar init error:', err)
        setPageError('Greška pri učitavanju kalendara. Pokušajte osvježiti stranicu.')
        setLoading(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadEvents])

  useEffect(() => {
    // Skip the initial month — init() already fetched it.
    // Only fires when the user navigates to a different month.
    const isInitialMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()
    if (userId && !isInitialMonth) loadEvents(userId, viewYear, viewMonth)
  }, [viewYear, viewMonth, userId, loadEvents])

  // ── Month grid ────────────────────────────────────────────────────────────
  const gridStart = startOfMonthGrid(viewYear, viewMonth)
  // 6 rows × 7 cols = 42 cells
  const gridCells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const eventsForDay = (day: Date) => events.filter(e => isSameDay(new Date(e.starts_at), day))

  // Generate virtual check-in events from schedules (not stored in DB)
  const autoCheckinsForDay = (day: Date): CheckinSchedule[] => {
    const dow = day.getDay() // 0=Sun … 6=Sat
    return schedules.filter(s => {
      if (s.checkin_day !== dow) return false
      // Don't show if client's package ended before this day
      if (s.end_date && new Date(s.end_date) < day) return false
      // Don't show past events (before today — keep history visible)
      // Actually user said "not delete history", so we show from today onwards
      // But past check-ins are real historical data, not virtual → don't show virtual past ones
      const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
      if (day < todayMidnight) return false
      return true
    })
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(today) }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreate = (day: Date) => {
    const p = (n: number) => String(n).padStart(2, '0')
    const base = `${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}T09:00`
    setModal({ open: true, mode: 'create', event: { type: 'call', starts_at_local: base, ends_at_local: '', title: '', notes: '', color: null, lead_submission_id: null, client_id: null } })
    setSavedOk(false); setConfirmDelete(false)
  }

  const openEdit = (ev: CalEvent) => {
    setModal({ open: true, mode: 'edit', event: { ...ev, starts_at_local: toLocalDT(ev.starts_at), ends_at_local: ev.ends_at ? toLocalDT(ev.ends_at) : '' } })
    setSavedOk(false); setConfirmDelete(false)
  }

  const closeModal = () => { setModal(m => ({ ...m, open: false })); setModalError(null); setConfirmDelete(false) }
  const setField = (key: string, val: unknown) => setModal(m => ({ ...m, event: { ...m.event, [key]: val } }))

  const [modalError, setModalError] = useState<string | null>(null)

  const saveEvent = async () => {
    if (!userId || !modal.event.title?.trim() || !modal.event.starts_at_local) return
    setSaving(true)
    setModalError(null)
    try {
      const payload = {
        trainer_id: userId,
        title: modal.event.title.trim(),
        starts_at: new Date(modal.event.starts_at_local).toISOString(),
        ends_at: modal.event.ends_at_local ? new Date(modal.event.ends_at_local).toISOString() : null,
        type: modal.event.type || 'custom',
        color: modal.event.color || null,
        notes: modal.event.notes?.trim() || null,
        lead_submission_id: modal.event.lead_submission_id || null,
        client_id: modal.event.client_id || null,
        completed: modal.event.completed ?? false,
      }
      const { error } = modal.mode === 'create'
        ? await supabase.from('trainer_events').insert(payload)
        : await supabase.from('trainer_events').update(payload).eq('id', modal.event.id!)
      if (error) throw error
      setSaving(false); setSavedOk(true)
      setTimeout(() => { setSavedOk(false); closeModal(); if (userId) loadEvents(userId, viewYear, viewMonth) }, 900)
    } catch {
      setModalError('Greška pri spremanju događaja. Pokušajte ponovo.')
      setSaving(false)
    }
  }

  const deleteEvent = async () => {
    if (!modal.event.id || !userId) return
    setDeleting(true)
    setModalError(null)
    try {
      const { error } = await supabase.from('trainer_events').delete().eq('id', modal.event.id)
      if (error) throw error
      setDeleting(false); closeModal()
      loadEvents(userId, viewYear, viewMonth)
    } catch {
      setModalError('Greška pri brisanju događaja. Pokušajte ponovo.')
      setDeleting(false)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })

  const isAutoCheckinDone = (schedule: CheckinSchedule, day: Date): boolean => {
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    // Done if client actually submitted a checkin OR trainer manually marked it
    return submittedCheckins.has(`${schedule.client_id}-${dateStr}`)
        || manualDone.has(`${schedule.client_user_id}-${dateStr}`)
  }

  const toggleAutoCheckinDone = async (schedule: CheckinSchedule, day: Date) => {
    if (!userId) return
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const manualKey = `${schedule.client_user_id}-${dateStr}`
    const alreadySubmitted = submittedCheckins.has(`${schedule.client_id}-${dateStr}`)

    if (alreadySubmitted) return // can't un-mark actual submissions

    if (manualDone.has(manualKey)) {
      // Remove manual mark
      setManualDone(prev => { const s = new Set(prev); s.delete(manualKey); return s })
      // Delete the trainer_event marker
      await supabase.from('trainer_events')
        .delete()
        .eq('trainer_id', userId)
        .eq('client_id', schedule.client_user_id)
        .eq('type', 'checkin')
        .eq('completed', true)
        .gte('starts_at', new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString())
        .lt('starts_at', new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString())
    } else {
      // Add manual mark → upsert trainer_event
      setManualDone(prev => new Set([...prev, manualKey]))
      await supabase.from('trainer_events').insert({
        trainer_id: userId,
        title: schedule.full_name,
        type: 'checkin',
        starts_at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0).toISOString(),
        client_id: schedule.client_user_id,
        completed: true,
      })
    }
  }

  const toggleComplete = async (ev: CalEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !ev.completed
    setEvents(prev => prev.map(x => x.id === ev.id ? { ...x, completed: next } : x))
    await supabase.from('trainer_events').update({ completed: next }).eq('id', ev.id)
  }

  const DAY_LABELS = locale === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin" style={{ color: accentHex }} />
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
        <p className="text-red-500 text-sm font-medium">{pageError}</p>
        <button
          onClick={() => { setPageError(null); setLoading(true); window.location.reload() }}
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: accentHex, color: '#fff' }}
        >
          Pokušaj ponovo
        </button>
      </div>
    )
  }

  const selectedDayEvents       = selectedDay ? eventsForDay(selectedDay) : []
  const selectedDayAutoCheckins = selectedDay ? autoCheckinsForDay(selectedDay) : []

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-6 space-y-3 sm:space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accentHex + '20' }}>
            <CalendarDays size={18} style={{ color: accentHex }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold leading-tight truncate" style={{ color: textMain }}>{t('pageTitle')}</h1>
            <p className="text-xs capitalize" style={{ color: textMuted }}>
              {new Date(viewYear, viewMonth).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={goToday}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: border, color: textMuted, background: cardBg }}>
            {t('today')}
          </button>
          <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: border }}>
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity"
              style={{ color: textMuted }}>
              <ChevronLeft size={15} />
            </button>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity"
              style={{ color: textMuted }}>
              <ChevronRight size={15} />
            </button>
          </div>
          <button type="button"
            onClick={() => selectedDay ? openCreate(selectedDay) : openCreate(today)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ backgroundColor: accentHex }}>
            <Plus size={13} />
            <span className="hidden sm:inline">{t('newEvent')}</span>
          </button>
        </div>
      </div>

      {/* ── Legend — desktop only ── */}
      {schedules.length > 0 && (
        <div className="hidden sm:flex items-center gap-4 text-xs" style={{ color: textMuted }}>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#0d948830' }} />
            <span style={{ color: '#0d9488' }}>{locale === 'en' ? 'Scheduled check-in (auto)' : 'Zakazani check-in (auto)'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: accentHex + '30' }} />
            <span>{locale === 'en' ? 'Your events' : 'Tvoji događaji'}</span>
          </div>
        </div>
      )}

      {/* ── Month grid ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: border, background: cardBg }}>
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: border }}>
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide" style={{ color: textMuted }}>
              {d}
            </div>
          ))}
        </div>

        {/* 6 rows — compact on mobile, spacious on desktop */}
        <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(52px, 1fr)' }}>
          {gridCells.map((day, i) => {
            const isCurrentMonth = day.getMonth() === viewMonth
            const isToday    = isSameDay(day, today)
            const isSel      = selectedDay ? isSameDay(day, selectedDay) : false
            const dayEvents  = eventsForDay(day)
            const autoCheckins = autoCheckinsForDay(day)
            const totalEvents = dayEvents.length + autoCheckins.length
            const isLastRow  = i >= 35

            return (
              <div
                key={i}
                onClick={() => setSelectedDay(isSel ? null : day)}
                className="p-1 sm:p-1.5 cursor-pointer transition-colors flex flex-col"
                style={{
                  borderRight: i % 7 === 6 ? 'none' : `1px solid ${border}`,
                  borderBottom: isLastRow ? 'none' : `1px solid ${border}`,
                  background: isSel ? accentHex + '10' : 'transparent',
                  minHeight: 52,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = isSel ? accentHex + '10' : cellHover)}
                onMouseLeave={e => (e.currentTarget.style.background = isSel ? accentHex + '10' : 'transparent')}
              >
                {/* Day number */}
                <div className="flex items-center justify-center sm:justify-between mb-0.5 sm:mb-1">
                  <span
                    className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                    style={isToday
                      ? { backgroundColor: accentHex, color: 'white' }
                      : isSel
                      ? { backgroundColor: accentHex + '25', color: accentHex }
                      : { color: isCurrentMonth ? textMain : textMuted, opacity: isCurrentMonth ? 1 : 0.35 }
                    }
                  >
                    {day.getDate()}
                  </span>
                  {/* Quick add — desktop only on hover */}
                  {isCurrentMonth && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); openCreate(day) }}
                      className="hidden sm:flex w-5 h-5 rounded items-center justify-center opacity-0 hover:!opacity-100 transition-opacity"
                      style={{ color: textMuted }}
                      title={t('newEvent')}
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </div>

                {/* ── Desktop: text pills ── */}
                <div className="hidden sm:flex flex-col gap-0.5 overflow-hidden flex-1">
                  {dayEvents.slice(0, 2).map(ev => {
                    const c = ev.color || TYPE_COLORS[ev.type] || accentHex
                    return (
                      <button key={ev.id} type="button"
                        onClick={e => { e.stopPropagation(); openEdit(ev) }}
                        className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold leading-tight flex items-center gap-1"
                        style={{ backgroundColor: ev.completed ? '#e5e7eb' : c + '22', color: ev.completed ? '#9ca3af' : c, textDecoration: ev.completed ? 'line-through' : 'none' }}>
                        {ev.completed ? <CheckCircle2 size={8} style={{ color: '#10b981', flexShrink: 0 }} /> : <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: c }} />}
                        <span className="truncate">{ev.title}</span>
                      </button>
                    )
                  })}
                  {autoCheckins.slice(0, 2).map(s => {
                    const done = isAutoCheckinDone(s, day)
                    return (
                      <div key={`auto-${s.client_id}`}
                        className="w-full px-1.5 py-0.5 rounded text-[10px] font-semibold leading-tight flex items-center gap-1"
                        style={{ backgroundColor: done ? '#e5e7eb' : '#0d948818', color: done ? '#9ca3af' : '#0d9488', textDecoration: done ? 'line-through' : 'none' }}>
                        {done ? <CheckCircle2 size={8} style={{ color: '#10b981', flexShrink: 0 }} /> : <ClipboardCheck size={8} className="shrink-0" />}
                        <span className="truncate">{s.full_name}</span>
                      </div>
                    )
                  })}
                  {totalEvents > 4 && <p className="text-[10px] pl-1" style={{ color: textMuted }}>+{totalEvents - 4}</p>}
                </div>

                {/* ── Mobile: colored dots only ── */}
                {totalEvents > 0 && (
                  <div className="flex sm:hidden justify-center gap-0.5 mt-0.5 flex-wrap">
                    {dayEvents.slice(0, 3).map(ev => {
                      const c = ev.completed ? '#10b981' : (ev.color || TYPE_COLORS[ev.type] || accentHex)
                      return <span key={ev.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                    })}
                    {autoCheckins.slice(0, 2).map(s => {
                      const done = isAutoCheckinDone(s, day)
                      return <span key={s.client_id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: done ? '#10b981' : '#0d9488' }} />
                    })}
                    {totalEvents > 5 && <span className="text-[8px] leading-none" style={{ color: textMuted }}>+</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Selected day detail ── */}
      {selectedDay && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: border, background: cardBg }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: border }}>
            <h2 className="text-sm font-bold capitalize" style={{ color: textMain }}>
              {selectedDay.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <button type="button" onClick={() => openCreate(selectedDay)}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: accentHex }}>
              <Plus size={12} /> {t('newEvent')}
            </button>
          </div>

          {selectedDayEvents.length === 0 && selectedDayAutoCheckins.length === 0 ? (
            <div className="py-6 sm:py-10 text-center">
              <CalendarDays size={22} className="mx-auto mb-2 opacity-30" style={{ color: textMuted }} />
              <p className="text-sm" style={{ color: textMuted }}>{t('noEvents')}</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: border }}>
              {/* Auto check-ins first */}
              {selectedDayAutoCheckins.map(s => {
                const done = isAutoCheckinDone(s, selectedDay!)
                const isActualSubmission = submittedCheckins.has(`${s.client_id}-${selectedDay!.getFullYear()}-${String(selectedDay!.getMonth() + 1).padStart(2, '0')}-${String(selectedDay!.getDate()).padStart(2, '0')}`)
                return (
                  <div key={`auto-${s.client_id}`} className="flex items-center gap-0">
                    {/* Done toggle */}
                    <button
                      type="button"
                      onClick={() => toggleAutoCheckinDone(s, selectedDay!)}
                      disabled={isActualSubmission}
                      className="pl-4 pr-2 py-3.5 flex items-center justify-center shrink-0 transition-all hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
                      title={isActualSubmission
                        ? (locale === 'en' ? 'Client submitted check-in' : 'Klijent je predao check-in')
                        : done
                        ? (locale === 'en' ? 'Mark as not done' : 'Označi kao nije gotovo')
                        : (locale === 'en' ? 'Mark as done' : 'Označi kao gotovo')
                      }
                    >
                      {done
                        ? <CheckCircle2 size={20} className="text-emerald-500" />
                        : <Circle size={20} style={{ color: textMuted, opacity: 0.4 }} />
                      }
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0 px-3 py-3.5 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: done ? '#f3f4f6' : '#0d948820' }}>
                        <ClipboardCheck size={14} style={{ color: done ? '#9ca3af' : '#0d9488' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate"
                          style={{ color: done ? textMuted : textMain, textDecoration: done ? 'line-through' : 'none' }}>
                          {s.full_name}
                        </p>
                        <p className="text-xs" style={{ color: done ? textMuted : '#0d9488' }}>
                          {isActualSubmission
                            ? (locale === 'en' ? 'Check-in submitted ✓' : 'Check-in predan ✓')
                            : (locale === 'en' ? 'Scheduled check-in' : 'Zakazani check-in')
                          }
                          {s.end_date && !isActualSubmission && (
                            <span style={{ color: textMuted }}>
                              {' · '}{locale === 'en' ? 'until' : 'do'} {new Date(s.end_date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: isActualSubmission ? '#d1fae5' : '#0d948815', color: isActualSubmission ? '#059669' : '#0d9488' }}>
                          {isActualSubmission ? (locale === 'en' ? 'Submitted' : 'Predano') : 'Auto'}
                        </span>
                        {done && !isActualSubmission && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                            {locale === 'en' ? 'Done' : 'Gotovo'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Manual events */}
              {selectedDayEvents.map(ev => {
                const TypeIcon = TYPE_ICONS[ev.type] || Sparkles
                const typeColor = ev.color || TYPE_COLORS[ev.type] || accentHex
                return (
                  <div key={ev.id} className="flex items-center gap-0">
                    {/* Done toggle */}
                    <button
                      type="button"
                      onClick={e => toggleComplete(ev, e)}
                      className="pl-4 pr-2 py-3.5 flex items-center justify-center shrink-0 transition-all hover:scale-110"
                      title={ev.completed
                        ? (locale === 'en' ? 'Mark as not done' : 'Označi kao nije gotovo')
                        : (locale === 'en' ? 'Mark as done' : 'Označi kao gotovo')
                      }
                    >
                      {ev.completed
                        ? <CheckCircle2 size={20} className="text-emerald-500" />
                        : <Circle size={20} style={{ color: textMuted, opacity: 0.4 }} />
                      }
                    </button>

                    {/* Event body — click to edit */}
                    <button
                      type="button"
                      onClick={() => openEdit(ev)}
                      className="flex-1 min-w-0 px-3 py-3.5 flex items-start gap-3 text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: ev.completed ? '#f3f4f6' : typeColor + '18' }}>
                        <TypeIcon size={14} style={{ color: ev.completed ? '#9ca3af' : typeColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{
                            color: ev.completed ? textMuted : textMain,
                            textDecoration: ev.completed ? 'line-through' : 'none',
                          }}
                        >
                          {ev.title}
                        </p>
                        {(ev.client_name || ev.lead_name) && (
                          <p className="text-xs truncate" style={{ color: textMuted }}>{ev.client_name || ev.lead_name}</p>
                        )}
                        {ev.notes && <p className="text-xs truncate mt-0.5 italic" style={{ color: textMuted }}>{ev.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-xs" style={{ color: textMuted }}>
                          {fmtTime(ev.starts_at)}{ev.ends_at ? ` – ${fmtTime(ev.ends_at)}` : ''}
                        </span>
                        {ev.completed && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                            {locale === 'en' ? 'Done' : 'Gotovo'}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Event modal ── */}
      {modal.open && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div
            className="fixed inset-x-0 bottom-0 sm:inset-x-4 sm:bottom-auto sm:top-[5vh] sm:mx-auto sm:max-w-lg z-[60] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
            style={{ background: isDark ? 'oklch(0.195 0.018 264)' : 'white', maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle – mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb' }} />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 sm:py-4 border-b" style={{ borderColor: border }}>
              <h3 className="text-base font-bold" style={{ color: textMain }}>
                {modal.mode === 'create' ? t('createEvent') : t('editEvent')}
              </h3>
              <button type="button" onClick={closeModal} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-60" style={{ color: textMuted }}>
                <X size={16} />
              </button>
            </div>

            <div ref={modalScrollRef} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Title */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>{t('eventTitle')}</label>
                <input type="text" value={modal.event.title || ''}
                  onChange={e => setField('title', e.target.value)}
                  placeholder={t('eventTitlePlaceholder')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: border, background: isDark ? '#0f0f1a' : '#f9fafb', color: textMain }} />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>{t('eventType')}</label>
                <div className="flex gap-2">
                  {(['call', 'checkin', 'custom'] as EventType[]).map(tp => {
                    const TpIcon = TYPE_ICONS[tp]
                    const isActive = (modal.event.type || 'call') === tp
                    return (
                      <button key={tp} type="button" onClick={() => setField('type', tp)}
                        className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                        style={{
                          borderColor: isActive ? TYPE_COLORS[tp] : border,
                          background: isActive ? TYPE_COLORS[tp] + '14' : 'transparent',
                          color: isActive ? TYPE_COLORS[tp] : textMuted,
                        }}>
                        <TpIcon size={14} />
                        {t(tp === 'call' ? 'typeCall' : tp === 'checkin' ? 'typeCheckin' : 'typeCustom')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Start */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>{t('eventDate')}</label>
                <DateTimePicker
                  value={modal.event.starts_at_local || ''}
                  onChange={v => setField('starts_at_local', v)}
                  locale={locale} isDark={isDark} accentHex={accentHex}
                  textMain={textMain} textMuted={textMuted} border={border}
                  placeholder={t('eventDate')} clearable={false}
                />
              </div>

              {/* End */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>{t('eventEnd')}</label>
                <DateTimePicker
                  value={modal.event.ends_at_local || ''}
                  onChange={v => setField('ends_at_local', v)}
                  locale={locale} isDark={isDark} accentHex={accentHex}
                  textMain={textMain} textMuted={textMuted} border={border}
                  placeholder={t('eventEnd')}
                />
              </div>

              {/* Client */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>{t('linkedClient')}</label>
                <CustomSelect
                  value={modal.event.client_id || ''}
                  options={[
                    { value: '', label: t('noLinkedClient') },
                    ...clients.map(c => ({ value: c.user_id, label: c.full_name })),
                  ]}
                  isDark={isDark} border={border} textMain={textMain} textMuted={textMuted} accentHex={accentHex}
                  onChange={v => setField('client_id', v || null)}
                />
              </div>

              {/* Lead */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>{t('linkedLead')}</label>
                <CustomSelect
                  value={modal.event.lead_submission_id || ''}
                  options={[
                    { value: '', label: t('noLinkedLead') },
                    ...leads.map(l => ({ value: l.id, label: l.name })),
                  ]}
                  isDark={isDark} border={border} textMain={textMain} textMuted={textMuted} accentHex={accentHex}
                  onChange={v => setField('lead_submission_id', v || null)}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>{t('eventNotes')}</label>
                <textarea value={modal.event.notes || ''} onChange={e => setField('notes', e.target.value)}
                  rows={3} placeholder={t('eventNotesPlaceholder')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
                  style={{ borderColor: border, background: isDark ? '#0f0f1a' : '#f9fafb', color: textMain }} />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t space-y-2" style={{ borderColor: border }}>
              {/* Inline error */}
              {modalError && (
                <p className="text-red-500 text-xs font-medium py-1 px-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                  {modalError}
                </p>
              )}
              {/* Primary actions */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={saveEvent}
                  disabled={saving || !modal.event.title?.trim() || !modal.event.starts_at_local}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{ backgroundColor: accentHex }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : savedOk ? <CheckCircle2 size={13} /> : null}
                  {savedOk ? t('saved') : t('save')}
                </button>
                <button type="button" onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: textMuted }}>
                  {t('cancel')}
                </button>
              </div>

              {/* Delete — edit mode only */}
              {modal.mode === 'edit' && !confirmDelete && (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ color: '#ef4444', background: isDark ? 'rgba(239,68,68,0.09)' : '#fef2f2' }}>
                  <Trash2 size={13} /> {t('delete')}
                </button>
              )}
              {modal.mode === 'edit' && confirmDelete && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                    style={{ borderColor: border, color: textMuted }}>
                    {t('cancel')}
                  </button>
                  <button type="button" onClick={deleteEvent} disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 disabled:opacity-60">
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    {t('deleteConfirm')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
