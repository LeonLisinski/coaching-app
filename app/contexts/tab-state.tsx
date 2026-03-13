'use client'

import { useState, useCallback, useLayoutEffect } from 'react'

// Provider kept in layout.tsx but is a no-op — state now lives on window directly
export function TabStateProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// ---------------------------------------------------------------------------
// Two-layer persistence:
//   window.__tabState  – survives client-side navigation (immediate, no flash)
//   localStorage       – survives hard reload (read via useLayoutEffect before paint)
// ---------------------------------------------------------------------------

function winStore(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(window as any).__tabState) (window as any).__tabState = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__tabState
}

function lsRead(key: string): string | null {
  try { return localStorage.getItem(`tab:${key}`) } catch { return null }
}
function lsWrite(key: string, val: string): void {
  try { localStorage.setItem(`tab:${key}`, val) } catch {}
}

export function usePersistedTab(key: string, initial: string): [string, (v: string) => void] {
  // Lazy initialiser: on first app load / SSR → returns `initial`
  // On subsequent client-side navigations: window.__tabState already has the value → no flash
  const [value, setValueState] = useState<string>(
    () => winStore()[key] ?? initial
  )

  // After hard reload window.__tabState is empty, so read localStorage before paint
  useLayoutEffect(() => {
    const stored = lsRead(key)
    if (stored) {
      winStore()[key] = stored   // repopulate win store too
      setValueState(stored)      // sync React state (batched, before paint → no flash)
    }
  // key changes when navigating between e.g. different clients
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = useCallback((newValue: string) => {
    winStore()[key] = newValue   // immediate, survives navigation
    lsWrite(key, newValue)       // persists across hard reload
    setValueState(newValue)
  }, [key])

  return [value, setValue]
}
