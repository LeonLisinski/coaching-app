'use client'
import { createContext, useContext, useState } from 'react'

const Ctx = createContext<{ inActiveChat: boolean; setInActiveChat: (v: boolean) => void }>({
  inActiveChat: false, setInActiveChat: () => {},
})

export function ActiveChatProvider({ children }: { children: React.ReactNode }) {
  const [inActiveChat, setInActiveChat] = useState(false)
  return <Ctx.Provider value={{ inActiveChat, setInActiveChat }}>{children}</Ctx.Provider>
}

export const useActiveChat = () => useContext(Ctx)
