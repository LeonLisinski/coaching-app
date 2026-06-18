'use client'

import {
  useState, useRef, useEffect, useCallback, useId,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

type OptionItem = string | { value: string; label: string }

function optVal(o: OptionItem) { return typeof o === 'string' ? o : o.value }
function optLabel(o: OptionItem) { return typeof o === 'string' ? o : o.label }

type Props = {
  value: string
  onChange: (value: string) => void
  options: OptionItem[]
  isDark?: boolean
  accentClass?: string
  accentHex?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function SelectDropdown({
  value,
  onChange,
  options,
  isDark = false,
  accentClass = 'focus:ring-[var(--app-accent)]',
  accentHex,
  placeholder,
  disabled = false,
  className = '',
}: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<number>(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const selectedIdx = options.findIndex(o => optVal(o) === value)

  const openDropdown = useCallback(() => {
    if (disabled) return
    const r = triggerRef.current?.getBoundingClientRect() ?? null
    setRect(r)
    setHighlighted(selectedIdx >= 0 ? selectedIdx : 0)
    setOpen(true)
  }, [disabled, selectedIdx])

  const closeDropdown = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const select = useCallback((opt: OptionItem) => {
    onChange(optVal(opt))
    closeDropdown()
  }, [onChange, closeDropdown])

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const idx = highlighted >= 0 ? highlighted : selectedIdx
    const el = listRef.current.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted, selectedIdx])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect() ?? null
      setRect(r)
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  // Click-outside handler
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closeDropdown])

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        openDropdown()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(i => Math.max(i - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (highlighted >= 0) select(options[highlighted])
        break
      case 'Escape':
        e.preventDefault()
        closeDropdown()
        break
      default:
        if (e.key.length === 1) {
          const letter = e.key.toLowerCase()
          const next = options.findIndex(
            (o, i) => i > highlighted && optLabel(o).toLowerCase().startsWith(letter)
          )
          const fallback = options.findIndex(o => optLabel(o).toLowerCase().startsWith(letter))
          const idx = next >= 0 ? next : fallback
          if (idx >= 0) setHighlighted(idx)
        }
    }
  }

  // Compute panel position — prefer below, flip above if not enough room
  const PANEL_MAX_H = 260
  const PANEL_W = rect?.width ?? 200
  let top = 0, left = 0, openAbove = false
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    openAbove = spaceBelow < Math.min(PANEL_MAX_H, options.length * 36) && spaceAbove > spaceBelow
    top = openAbove ? rect.top : rect.bottom + 4
    left = rect.left
  }

  const selectedLabel = selectedIdx >= 0 ? optLabel(options[selectedIdx]) : (placeholder ?? '')
  const triggerBg = isDark ? 'bg-white/[0.05] border-white/10 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
  const panelBg   = isDark ? 'bg-[oklch(0.20_0.018_264)] border-white/10' : 'bg-white border-gray-200'
  const itemBase  = 'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors'
  const itemHover = isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-50'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className={`w-full flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm text-left focus:outline-none focus:ring-1 transition-colors disabled:opacity-50 ${triggerBg} ${accentClass} ${className}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        />
      </button>

      {open && rect && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={id}
          style={{
            position: 'fixed',
            top: openAbove ? undefined : top,
            bottom: openAbove ? window.innerHeight - top : undefined,
            left,
            width: PANEL_W,
            maxHeight: PANEL_MAX_H,
            zIndex: 9999,
          }}
          className={`overflow-y-auto rounded-xl border shadow-xl outline-none py-1 ${panelBg}`}
        >
          {options.map((opt, idx) => {
            const isSelected = optVal(opt) === value
            const isHighlighted = idx === highlighted
            return (
              <li
                key={optVal(opt)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseDown={e => { e.preventDefault(); select(opt) }}
                className={`${itemBase} ${itemHover} ${
                  isHighlighted
                    ? isDark ? 'bg-white/[0.08]' : 'bg-gray-100'
                    : ''
                }`}
              >
                <Check
                  size={13}
                  className={`shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                  style={{ color: accentHex ?? 'var(--app-accent)' }}
                />
                <span
                  className={`flex-1 ${isSelected ? 'font-semibold' : ''}`}
                  style={isSelected ? { color: accentHex ?? 'var(--app-accent)' } : {}}
                >
                  {optLabel(opt)}
                </span>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </>
  )
}
