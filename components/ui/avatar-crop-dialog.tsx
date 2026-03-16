'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react'

type Props = {
  file: File | null
  onConfirm: (croppedBlob: Blob) => void
  onClose: () => void
  accentColor?: string
}

const CANVAS_SIZE = 400
const PREVIEW_SIZE = 120

export default function AvatarCropDialog({ file, onConfirm, onClose, accentColor = '#7c3aed' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setImgSrc(url)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    const img = new Image()
    img.onload = () => { imgRef.current = img }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    const baseScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight)
    const scale = baseScale * zoom
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const cx = CANVAS_SIZE / 2 + offset.x
    const cy = CANVAS_SIZE / 2 + offset.y
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  }, [zoom, offset])

  useEffect(() => { draw() }, [draw])

  const clampOffset = useCallback((ox: number, oy: number, currentZoom: number) => {
    const img = imgRef.current
    if (!img) return { x: ox, y: oy }
    const baseScale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight)
    const scale = baseScale * currentZoom
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const maxX = Math.max(0, (w - CANVAS_SIZE) / 2)
    const maxY = Math.max(0, (h - CANVAS_SIZE) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.mx
    const dy = e.clientY - dragStart.current.my
    const raw = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy }
    setOffset(clampOffset(raw.x, raw.y, zoom))
  }

  const onPointerUp = () => { setDragging(false); dragStart.current = null }

  const changeZoom = (delta: number) => {
    const newZoom = Math.max(1, Math.min(3, zoom + delta))
    setZoom(newZoom)
    setOffset(prev => clampOffset(prev.x, prev.y, newZoom))
  }

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (blob) onConfirm(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <Dialog open={!!file} onOpenChange={onClose}>
      <DialogContent className="max-w-sm flex flex-col p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">Namjesti profilnu sliku</DialogTitle>
        <DialogDescription className="sr-only">Povuci sliku za namještanje, koristite gumbe za zoom</DialogDescription>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Namjesti profilnu sliku</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Canvas crop area */}
        <div className="p-5 flex flex-col items-center gap-4">
          <p className="text-xs text-gray-400">Povuci sliku za namještanje položaja</p>

          {/* Crop container with circular mask overlay */}
          <div className="relative" style={{ width: PREVIEW_SIZE * 2, height: PREVIEW_SIZE * 2 }}>
            <div
              ref={containerRef}
              className="rounded-2xl overflow-hidden border-2 border-gray-200"
              style={{ width: PREVIEW_SIZE * 2, height: PREVIEW_SIZE * 2, cursor: dragging ? 'grabbing' : 'grab' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={{ width: PREVIEW_SIZE * 2, height: PREVIEW_SIZE * 2, display: 'block' }}
              />
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeZoom(-0.2)}
              disabled={zoom <= 1}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomOut size={14} />
            </button>

            <div className="flex items-center gap-1">
              {[1, 1.4, 1.8, 2.2, 2.6, 3].map(z => (
                <button
                  key={z}
                  type="button"
                  onClick={() => { setZoom(z); setOffset(prev => clampOffset(prev.x, prev.y, z)) }}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${zoom >= z ? 'bg-gray-700' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => changeZoom(0.2)}
              disabled={zoom >= 3}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Odustani
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
            style={{ backgroundColor: accentColor }}
          >
            <Check size={14} />
            Postavi sliku
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
