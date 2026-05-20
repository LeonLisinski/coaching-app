'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ExternalLink, Loader2, PlayCircle, ImageIcon } from 'lucide-react'
import { createExerciseMediaSignedUrl } from '@/lib/exercise-media'
import { useAppTheme } from '@/app/contexts/app-theme'

type MediaExercise = {
  name: string
  media_type?: 'youtube' | 'video' | 'image' | null
  media_path?: string | null
  media_mime?: string | null
  video_url?: string | null
}

type Props = {
  exercise: MediaExercise | null
  open: boolean
  onClose: () => void
}

/**
 * Modal viewer for exercise media. For YouTube it just opens the URL
 * externally and closes (mobile-friendly). For uploaded video/image it
 * resolves a signed URL and renders an inline player.
 */
export default function ExerciseMediaPreview({ exercise, open, onClose }: Props) {
  const t = useTranslations('training.dialogs.exercise')
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Short-circuit YouTube: open in new tab and close the modal.
  useEffect(() => {
    if (!open || !exercise) return
    if (exercise.media_type === 'youtube' || (!exercise.media_type && exercise.video_url)) {
      if (exercise.video_url) window.open(exercise.video_url, '_blank', 'noopener,noreferrer')
      onClose()
    }
  }, [open, exercise, onClose])

  useEffect(() => {
    let cancelled = false
    if (!open || !exercise?.media_path || (exercise.media_type !== 'video' && exercise.media_type !== 'image')) {
      setSignedUrl(null)
      return
    }
    setLoading(true)
    createExerciseMediaSignedUrl(exercise.media_path).then(url => {
      if (cancelled) return
      setSignedUrl(url)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, exercise?.media_path, exercise?.media_type])

  if (!exercise) return null
  // YouTube case is handled in the effect above; nothing to render here.
  if (exercise.media_type !== 'video' && exercise.media_type !== 'image') return null

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden"
        style={{ background: isDark ? 'oklch(0.165 0.025 264)' : 'white' }}
      >
        <DialogTitle className="sr-only">{exercise.name}</DialogTitle>
        <DialogDescription className="sr-only">{exercise.name}</DialogDescription>

        <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          {exercise.media_type === 'video'
            ? <PlayCircle size={16} className="text-emerald-500" />
            : <ImageIcon size={16} className="text-emerald-500" />}
          <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'} flex-1 truncate`}>
            {exercise.name}
          </p>
          {exercise.video_url && (
            <a
              href={exercise.video_url}
              target="_blank"
              rel="noreferrer"
              className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-gray-400 hover:text-emerald-300' : 'text-gray-500 hover:text-emerald-600'}`}
            >
              <ExternalLink size={11} /> YouTube
            </a>
          )}
        </div>

        <div className="bg-black flex items-center justify-center" style={{ minHeight: 200 }}>
          {loading && (
            <div className="flex items-center gap-2 text-gray-300 text-sm py-12">
              <Loader2 className="animate-spin" size={16} /> {t('mediaLoading')}
            </div>
          )}
          {!loading && signedUrl && exercise.media_type === 'video' && (
            <video src={signedUrl} controls autoPlay className="w-full max-h-[70vh]" />
          )}
          {!loading && signedUrl && exercise.media_type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedUrl} alt={exercise.name} className="max-w-full max-h-[70vh] object-contain" />
          )}
          {!loading && !signedUrl && (
            <p className="text-gray-400 text-sm py-12">{t('mediaPickFailed')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
