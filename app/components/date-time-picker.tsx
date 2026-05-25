'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Calendar, X } from 'lucide-react'

type Props = {
  value: string            // '' or 'YYYY-MM-DDTHH:mm'
  onChange: (val: string) => void
  locale: string
  isDark: boolean
  accentHex: string
  textMain: string
  textMuted: string
  border: string
  placeholder?: string
  clearable?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

function parseLocal(val: string) {
  if (!val) return null
  const dt = new Date(val)
  if (isNaN(dt.getTime())) return null
  return { y: dt.getFullYear(), mo: dt.getMonth(), d: dt.getDate(), h: dt.getHours(), mi: dt.getMinutes() }
}

function buildVal(y: number, mo: number, d: number, h: number, mi: number) {
  return `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function DateTimePicker({
  value, onChange, locale, isDark, accentHex, textMain, textMuted, border, placeholder, clearable = true,
}: Props) {
  const dateLocale = locale === 'en' ? 'en-GB' : 'hr-HR'
  const parsed = parseLocal(value)

  const now = new Date()
  const [open, setOpen] = useState(false)
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [viewYear, setViewYear]   = useState(parsed?.y ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.mo ?? now.getMonth())
  const [selY, setSelY] = useState(parsed?.y ?? now.getFullYear())
  const [selMo, setSelMo] = useState(parsed?.mo ?? now.getMonth())
  const [selD, setSelD] = useState(parsed?.d ?? now.getDate())
  const [selH, setSelH] = useState(parsed?.h ?? 9)
  const [selMi, setSelMi] = useState(parsed?.mi ?? 0)
  const [dateSelected, setDateSelected] = useState(!!parsed)

  useEffect(() => {
    const p = parseLocal(value)
    if (p) {
      setViewYear(p.y); setViewMonth(p.mo)
      setSelY(p.y); setSelMo(p.mo); setSelD(p.d)
      setSelH(p.h); setSelMi(p.mi)
      setDateSelected(true)
    } else {
      setDateSelected(false)
    }
  }, [value])

  const emit = (y: number, mo: number, d: number, h: number, mi: number) =>
    onChange(buildVal(y, mo, d, h, mi))

  const handleDayClick = (d: Date) => {
    const y = d.getFullYear(), mo = d.getMonth(), day = d.getDate()
    setSelY(y); setSelMo(mo); setSelD(day)
    setDateSelected(true)
    emit(y, mo, day, selH, selMi)
  }

  const openPicker = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const popW = 300
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      const top = spaceBelow >= 380 || spaceBelow >= spaceAbove
        ? rect.bottom + 6
        : rect.top - 6 - Math.min(380, spaceAbove)
      const left = Math.min(rect.left, window.innerWidth - popW - 8)
      setPopStyle({ position: 'fixed', top, left, width: popW, zIndex: 9999 })
    }
    setOpen(v => !v)
  }, [])

  // Reposition + outside-click handler while open
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const popW = Math.min(300, window.innerWidth - 16)
        const spaceBelow = window.innerHeight - rect.bottom - 8
        const spaceAbove = rect.top - 8
        const top = spaceBelow >= 380 || spaceBelow >= spaceAbove
          ? rect.bottom + 6
          : rect.top - 6 - Math.min(380, spaceAbove)
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - popW - 8))
        setPopStyle({ position: 'fixed', top, left, width: popW, zIndex: 9999 })
      }
    }
    reposition()
    // Close on outside click/touch — does NOT block scrolling
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside, { passive: true })
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

  const adjustHour = (delta: number) => {
    const h = (selH + delta + 24) % 24
    setSelH(h)
    if (dateSelected) emit(selY, selMo, selD, h, selMi)
  }

  const adjustMin = (delta: number) => {
    const mi = (selMi + delta + 60) % 60
    setSelMi(mi)
    if (dateSelected) emit(selY, selMo, selD, selH, mi)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Calendar grid (Monday first)
  const firstDay  = new Date(viewYear, viewMonth, 1)
  const startPad  = (firstDay.getDay() + 6) % 7
  const daysInMo  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const selDate   = dateSelected ? new Date(selY, selMo, selD) : null
  const todayDate = new Date()

  const DAY_LABELS = locale === 'en'
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne']

  const displayText = dateSelected
    ? new Date(selY, selMo, selD, selH, selMi).toLocaleString(dateLocale, {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  const bg      = isDark ? 'oklch(0.195 0.018 264)' : 'white'
  const inputBg = isDark ? '#0f0f1a' : '#f9fafb'
  const dimBg   = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'

  const TimeBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
      style={{ color: textMuted, background: dimBg }}
    >
      {children}
    </button>
  )

  return (
    <div className="relative">
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all"
        style={{ borderColor: open ? accentHex : border, background: inputBg, color: displayText ? textMain : textMuted }}
      >
        <Calendar size={14} style={{ color: accentHex, flexShrink: 0 }} />
        <span className="flex-1 truncate">{displayText ?? (placeholder || '—')}</span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange(''); setDateSelected(false) }}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(''), setDateSelected(false))}
            className="ml-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0 hover:opacity-60 transition-opacity"
            style={{ color: textMuted }}
          >
            <X size={11} />
          </span>
        )}
      </button>

      {/* ── Popover ── */}
      {open && (
        <>
          <div
            ref={popoverRef}
            className="rounded-2xl shadow-2xl border overflow-y-auto"
            style={{ ...popStyle, background: bg, borderColor: border, maxHeight: 'calc(100dvh - 24px)' }}
          >
            {/* ── Calendar ── */}
            <div className="p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-60 transition-opacity"
                  style={{ color: textMuted }}>
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm font-bold capitalize" style={{ color: textMain }}>
                  {new Date(viewYear, viewMonth).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" onClick={nextMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-60 transition-opacity"
                  style={{ color: textMuted }}>
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold uppercase py-1" style={{ color: textMuted }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {Array(startPad).fill(null).map((_, i) => <div key={`p${i}`} />)}
                {Array.from({ length: daysInMo }, (_, i) => {
                  const day    = new Date(viewYear, viewMonth, i + 1)
                  const isToday = isSameDay(day, todayDate)
                  const isSel   = selDate ? isSameDay(day, selDate) : false
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className="aspect-square w-full rounded-lg text-xs font-medium flex items-center justify-center transition-all hover:opacity-75"
                      style={isSel
                        ? { backgroundColor: accentHex, color: 'white', fontWeight: 700 }
                        : isToday
                        ? { backgroundColor: accentHex + '22', color: accentHex, fontWeight: 700 }
                        : { color: textMain }
                      }
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Time picker ── */}
            <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: border }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2.5 mt-3" style={{ color: textMuted }}>
                {locale === 'en' ? 'Time' : 'Vrijeme'}
              </p>
              <div className="flex items-center gap-2">
                {/* Hour */}
                <div className="flex flex-col items-center gap-1">
                  <TimeBtn onClick={() => adjustHour(1)}><ChevronUp size={13} /></TimeBtn>
                  <div
                    className="w-14 h-10 flex items-center justify-center rounded-xl text-xl font-bold tabular-nums"
                    style={{ background: dimBg, color: textMain }}
                  >
                    {pad(selH)}
                  </div>
                  <TimeBtn onClick={() => adjustHour(-1)}><ChevronDown size={13} /></TimeBtn>
                </div>

                <span className="text-2xl font-bold mb-0.5" style={{ color: textMuted }}>:</span>

                {/* Minute */}
                <div className="flex flex-col items-center gap-1">
                  <TimeBtn onClick={() => adjustMin(5)}><ChevronUp size={13} /></TimeBtn>
                  <div
                    className="w-14 h-10 flex items-center justify-center rounded-xl text-xl font-bold tabular-nums"
                    style={{ background: dimBg, color: textMain }}
                  >
                    {pad(selMi)}
                  </div>
                  <TimeBtn onClick={() => adjustMin(-5)}><ChevronDown size={13} /></TimeBtn>
                </div>

                {/* Confirm */}
                <button
                  type="button"
                  onClick={() => { if (dateSelected) setOpen(false) }}
                  className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ backgroundColor: accentHex }}
                  disabled={!dateSelected}
                >
                  {locale === 'en' ? 'Done' : 'Potvrdi'}
                </button>
              </div>
              {!dateSelected && (
                <p className="text-[10px] mt-2" style={{ color: textMuted }}>
                  {locale === 'en' ? 'Pick a day first' : 'Prvo odaberi dan'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

