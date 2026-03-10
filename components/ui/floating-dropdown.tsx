'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** Ref of the input/anchor element */
  anchorRef: React.RefObject<HTMLElement>
  open: boolean
  children: React.ReactNode
  maxHeight?: number
}

/**
 * Renders children in a portal fixed to the viewport beneath the anchor element.
 * Solves the classic "overflow:auto clips absolute dropdown" problem.
 */
export default function FloatingDropdown({ anchorRef, open, children, maxHeight = 176 }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open && anchorRef.current) {
      setRect(anchorRef.current.getBoundingClientRect())
    }
  }, [open, anchorRef])

  // Recompute on scroll / resize
  useEffect(() => {
    if (!open) return
    const update = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  if (!open || !rect || !mounted) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        maxHeight,
        zIndex: 9999,
        overscrollBehavior: 'contain',
      }}
      className="border rounded-md overflow-y-auto bg-white shadow-lg"
      onWheel={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
