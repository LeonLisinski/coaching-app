'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type AccentColor =
  | 'violet' | 'blue' | 'indigo' | 'sky' | 'teal'
  | 'green' | 'orange' | 'red' | 'rose' | 'amber' | 'yellow' | 'slate'

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
    document.documentElement.setAttribute('data-accent', accent)
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
