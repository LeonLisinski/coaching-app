'use client'
import { createContext, useContext, useMemo, useState } from 'react'

const Ctx = createContext<{ inActiveChat: boolean; setInActiveChat: (v: boolean) => void }>({
  inActiveChat: false, setInActiveChat: () => {},
})

export function ActiveChatProvider({ children }: { children: React.ReactNode }) {
  const [inActiveChat, setInActiveChat] = useState(false)
  const value = useMemo(() => ({ inActiveChat, setInActiveChat }), [inActiveChat])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useActiveChat = () => useContext(Ctx)
