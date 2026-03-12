'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Dumbbell, UtensilsCrossed, ArrowRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX_MAP: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type SearchResult = {
  id: string
  type: 'client' | 'exercise' | 'food'
  title: string
  subtitle?: string
  href: string
}

const TYPE_CONFIG = {
  client:   { label: 'Klijenti',   icon: Users,           color: '#3b82f6' },
  exercise: { label: 'Vježbe',     icon: Dumbbell,        color: '#8b5cf6' },
  food:     { label: 'Namirnice',  icon: UtensilsCrossed, color: '#10b981' },
} as const

export default function GlobalSearch() {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'

  // Cmd+K / Ctrl+K to open, Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus & reset when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setSelectedIdx(0)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const lower = q.toLowerCase()
      const [{ data: clients }, { data: exercises }, { data: foods }] = await Promise.all([
        supabase
          .from('clients')
          .select('id, profiles!clients_user_id_fkey(full_name, email)')
          .limit(100),
        supabase
          .from('exercises')
          .select('id, name, primary_muscle_group')
          .ilike('name', `%${q}%`)
          .limit(5),
        supabase
          .from('foods')
          .select('id, name, calories')
          .ilike('name', `%${q}%`)
          .limit(5),
      ])

      const r: SearchResult[] = []

      clients
        ?.filter(c => {
          const p = c.profiles as any
          return p?.full_name?.toLowerCase().includes(lower) || p?.email?.toLowerCase().includes(lower)
        })
        .slice(0, 5)
        .forEach(c => {
          const p = c.profiles as any
          r.push({ id: c.id, type: 'client', title: p?.full_name || 'Nepoznat', subtitle: p?.email, href: `/dashboard/clients/${c.id}` })
        })

      exercises?.forEach(e => {
        r.push({ id: e.id, type: 'exercise', title: e.name, subtitle: e.primary_muscle_group || undefined, href: '/dashboard/training' })
      })

      foods?.forEach(f => {
        r.push({ id: f.id, type: 'food', title: f.name, subtitle: f.calories ? `${f.calories} kcal` : undefined, href: '/dashboard/nutrition' })
      })

      setResults(r)
      setSelectedIdx(0)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 220)
    return () => clearTimeout(timer)
  }, [query, search])

  const navigate = (href: string) => {
    router.push(href)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) navigate(results[selectedIdx].href)
  }

  if (!open) return null

  const byType = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {} as Record<string, SearchResult[]>)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[560px] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pretraži klijente, vježbe, namirnice..."
            className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent min-w-0"
          />
          {loading && (
            <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin shrink-0" />
          )}
          <button
            onClick={() => setOpen(false)}
            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Results body */}
        <div className="max-h-[360px] overflow-y-auto">
          {query.length < 2 ? (
            /* Empty / hint state */
            <div className="px-5 py-9 text-center">
              <div className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3 border border-gray-100">
                <Search size={18} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Pretraži UnitLift</p>
              <p className="text-xs text-gray-400 mt-1">Klijenti · Vježbe · Namirnice</p>
              <div className="flex items-center gap-1.5 justify-center mt-5">
                <kbd className="px-1.5 py-0.5 text-[11px] bg-gray-100 text-gray-500 rounded border border-gray-200 font-mono">⌘ K</kbd>
                <span className="text-[11px] text-gray-400">ili</span>
                <kbd className="px-1.5 py-0.5 text-[11px] bg-gray-100 text-gray-500 rounded border border-gray-200 font-mono">Ctrl K</kbd>
                <span className="text-[11px] text-gray-400 ml-1">za brzi pristup</span>
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-5 py-9 text-center">
              <p className="text-sm text-gray-500">Nema rezultata za <span className="font-medium text-gray-700">"{query}"</span></p>
              <p className="text-xs text-gray-400 mt-1">Pokušaj s drugačijim pojmom</p>
            </div>
          ) : (
            <div className="py-2">
              {(['client', 'exercise', 'food'] as const).map(type => {
                const items = byType[type]
                if (!items?.length) return null
                const { label, icon: Icon, color } = TYPE_CONFIG[type]
                return (
                  <div key={type} className="mb-1">
                    {/* Category header */}
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <Icon size={11} style={{ color }} />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                    </div>
                    {/* Items */}
                    {items.map(item => {
                      const globalIdx = results.indexOf(item)
                      const isSelected = globalIdx === selectedIdx
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors"
                          style={isSelected ? { backgroundColor: `${accentHex}0d` } : undefined}
                        >
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${color}18` }}
                          >
                            <Icon size={14} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                            {item.subtitle && <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>}
                          </div>
                          {isSelected && (
                            <div className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}18` }}>
                              <ArrowRight size={11} style={{ color: accentHex }} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/60 flex items-center gap-4">
          <div className="flex items-center gap-1 text-gray-400">
            <kbd className="px-1 py-0.5 text-[10px] bg-white text-gray-500 rounded border border-gray-200 font-mono">↑</kbd>
            <kbd className="px-1 py-0.5 text-[10px] bg-white text-gray-500 rounded border border-gray-200 font-mono">↓</kbd>
            <span className="text-[10px] ml-1">navigacija</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white text-gray-500 rounded border border-gray-200 font-mono">↵</kbd>
            <span className="text-[10px] ml-1">otvori</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400 ml-auto">
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white text-gray-500 rounded border border-gray-200 font-mono">Esc</kbd>
            <span className="text-[10px] ml-1">zatvori</span>
          </div>
        </div>
      </div>
    </div>
  )
}

