'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type AccentColor =
  | 'violet' | 'blue' | 'indigo' | 'sky' | 'teal'
  | 'green' | 'orange' | 'red' | 'rose' | 'amber' | 'yellow' | 'slate'

const ACCENT_HEX: Record<AccentColor, string> = {
  violet: '#7c3aed', blue:   '#2563eb', indigo: '#4f46e5', sky:    '#0284c7',
  teal:   '#0d9488', green:  '#16a34a', yellow: '#ca8a04', amber:  '#d97706',
  orange: '#ea580c', red:    '#dc2626', rose:   '#ec4899', slate:  '#475569',
}

export type AppMode = 'light' | 'dark'

interface AppThemeCtx {
  accent: AccentColor
  mode: AppMode
  setAccent: (a: AccentColor) => void
  setMode: (m: AppMode) => void
}

const AppThemeContext = createContext<AppThemeCtx>({
  accent: 'violet', mode: 'light',
  setAccent: () => {}, setMode: () => {},
})

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentColor>('violet')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const a = localStorage.getItem('app-accent') as AccentColor | null
    if (a) setAccentState(a)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const hex = ACCENT_HEX[accent]
    document.documentElement.setAttribute('data-accent', accent)
    // Update PWA theme-color meta tag so the browser banner matches the accent
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', hex)
  }, [accent, mounted])

  const setAccent = (a: AccentColor) => {
    setAccentState(a); localStorage.setItem('app-accent', a)
  }

  return (
    <AppThemeContext.Provider value={{ accent, mode: 'light', setAccent, setMode: () => {} }}>
      {children}
    </AppThemeContext.Provider>
  )
}

export const useAppTheme = () => useContext(AppThemeContext)

