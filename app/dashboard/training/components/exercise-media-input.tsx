'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trash2, Upload, ExternalLink, ImageIcon, PlayCircle } from 'lucide-react'
import {
  createExerciseMediaSignedUrl,
  compressImageForUpload,
  readVideoDuration,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SEC,
  MAX_IMAGE_BYTES,
} from '@/lib/exercise-media'

export type ExerciseMediaTab = 'youtube' | 'video' | 'image'

export type ExerciseMediaValue = {
  tab: ExerciseMediaTab
  // For YouTube
  videoUrl: string
  // For uploaded video/image — existing record (already in storage)
  existingPath: string | null
  existingMime: string | null
  existingSizeBytes: number | null
  // A newly picked file that will be uploaded on save
  pendingFile: File | Blob | null
  pendingMime: string | null
  pendingSize: number | null
  // True if user clicked "remove" on an existing upload
  removeExisting: boolean
}

export function emptyMediaValue(): ExerciseMediaValue {
  return {
    tab: 'youtube',
    videoUrl: '',
    existingPath: null,
    existingMime: null,
    existingSizeBytes: null,
    pendingFile: null,
    pendingMime: null,
    pendingSize: null,
    removeExisting: false,
  }
}

export function mediaValueFromExercise(ex: {
  media_type?: 'youtube' | 'video' | 'image' | null
  media_path?: string | null
  media_mime?: string | null
  media_size_bytes?: number | null
  video_url?: string | null
}): ExerciseMediaValue {
  const base = emptyMediaValue()
  if (ex.media_type === 'video' || ex.media_type === 'image') {
    return {
      ...base,
      tab: ex.media_type,
      existingPath: ex.media_path ?? null,
      existingMime: ex.media_mime ?? null,
      existingSizeBytes: ex.media_size_bytes ?? null,
      videoUrl: ex.video_url ?? '',
    }
  }
  // Default: YouTube tab (covers media_type='youtube' or missing media_type)
  return { ...base, tab: 'youtube', videoUrl: ex.video_url ?? '' }
}

type Props = {
  value: ExerciseMediaValue
  onChange: (next: ExerciseMediaValue) => void
  isDark?: boolean
}

const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime'
const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp'

export default function ExerciseMediaInput({ value, onChange, isDark = false }: Props) {
  const t = useTranslations('training.dialogs.exercise')
  const tCommon = useTranslations('common')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)

  // Fetch signed URL for the existing upload preview (unless marked for removal)
  useEffect(() => {
    let cancelled = false
    if (value.existingPath && !value.removeExisting) {
      createExerciseMediaSignedUrl(value.existingPath).then(url => {
        if (!cancelled) setSignedUrl(url)
      })
    } else {
      setSignedUrl(null)
    }
    return () => { cancelled = true }
  }, [value.existingPath, value.removeExisting])

  // Object URL for the pending file (revoked on unmount/change)
  useEffect(() => {
    if (!value.pendingFile) {
      setPendingPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(value.pendingFile)
    setPendingPreviewUrl(url)
    return () => { URL.revokeObjectURL(url) }
  }, [value.pendingFile])

  const setTab = (tab: ExerciseMediaTab) => {
    setLocalError(null)
    if (tab === value.tab) return
    // Switching tabs clears pending pick + any cached preview, but keeps
    // existingPath untouched (so user can switch away and back).
    onChange({
      ...value,
      tab,
      pendingFile: null,
      pendingMime: null,
      pendingSize: null,
    })
  }

  const pickFile = () => {
    setLocalError(null)
    fileInputRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return

    setLocalError(null)
    setProcessing(true)

    try {
      if (value.tab === 'video') {
        if (file.size > MAX_VIDEO_BYTES) {
          throw new Error(t('mediaVideoTooBig', { mb: 10 }))
        }
        const duration = await readVideoDuration(file)
        // NaN means we couldn't read metadata — skip duration check, rely on file size
        if (!isNaN(duration) && duration > MAX_VIDEO_DURATION_SEC + 0.5) {
          throw new Error(t('mediaVideoTooLong', { sec: MAX_VIDEO_DURATION_SEC }))
        }
        onChange({
          ...value,
          tab: 'video',
          pendingFile: file,
          pendingMime: file.type || 'video/mp4',
          pendingSize: file.size,
          removeExisting: !!value.existingPath, // replacing
        })
      } else if (value.tab === 'image') {
        if (file.size > MAX_IMAGE_BYTES) {
          throw new Error(t('mediaImageTooBig', { mb: 5 }))
        }
        const compressed = await compressImageForUpload(file)
        onChange({
          ...value,
          tab: 'image',
          pendingFile: compressed,
          pendingMime: 'image/webp',
          pendingSize: compressed.size,
          removeExisting: !!value.existingPath, // replacing
        })
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('mediaPickFailed'))
    } finally {
      setProcessing(false)
    }
  }

  const clearPending = () => {
    setLocalError(null)
    onChange({
      ...value,
      pendingFile: null,
      pendingMime: null,
      pendingSize: null,
      removeExisting: false, // restore existing if it was being replaced
    })
  }

  const removeExisting = () => {
    setLocalError(null)
    onChange({ ...value, removeExisting: true })
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const tabBtn = (tab: ExerciseMediaTab, label: string, Icon: typeof PlayCircle) => {
    const active = value.tab === tab
    return (
      <button
        key={tab}
        type="button"
        onClick={() => setTab(tab)}
        className={`flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
          active
            ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
            : isDark
              ? 'text-gray-400 border-white/10 bg-white/[0.04] hover:border-emerald-500'
              : 'text-gray-500 border-gray-200 hover:border-emerald-300'
        }`}
      >
        <Icon size={13} />
        {label}
      </button>
    )
  }

  const hasExistingVisible = !!value.existingPath && !value.removeExisting && (value.tab === 'video' || value.tab === 'image')
  const hasPending = !!value.pendingFile
  const showExistingPreview = hasExistingVisible && !hasPending

  return (
    <div className="space-y-2">
      <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {t('mediaSectionLabel')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>({tCommon('optional')})</span>
      </Label>

      <div className="flex gap-2">
        {tabBtn('youtube', t('mediaTabYoutube'), ExternalLink)}
        {tabBtn('video', t('mediaTabVideo'), PlayCircle)}
        {tabBtn('image', t('mediaTabImage'), ImageIcon)}
      </div>

      {value.tab === 'youtube' && (
        <Input
          value={value.videoUrl}
          onChange={e => onChange({ ...value, videoUrl: e.target.value })}
          placeholder="https://youtube.com/..."
          className={isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}
        />
      )}

      {(value.tab === 'video' || value.tab === 'image') && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={value.tab === 'video' ? ACCEPT_VIDEO : ACCEPT_IMAGE}
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />

          {/* Pending (just picked) preview */}
          {hasPending && pendingPreviewUrl && (
            <div className={`rounded-lg border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              {value.tab === 'video' ? (
                <video
                  src={pendingPreviewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full rounded-t-lg bg-black"
                  style={{ maxHeight: '260px', display: 'block' }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingPreviewUrl} alt="preview" className="w-full rounded-t-lg max-h-64 object-contain bg-black" />
              )}
              <div className={`flex items-center justify-between px-2 py-1.5 text-[11px] rounded-b-lg ${isDark ? 'bg-white/[0.04] text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                <span>{t('mediaPendingBadge')} · {humanBytes(value.pendingSize ?? 0)}</span>
                <button type="button" onClick={clearPending} className="hover:text-red-500 transition-colors flex items-center gap-1">
                  <Trash2 size={11} /> {t('mediaUndoPick')}
                </button>
              </div>
            </div>
          )}

          {/* Existing upload preview */}
          {showExistingPreview && (
            <div className={`rounded-lg border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              {signedUrl ? (
                value.tab === 'video' ? (
                  <>
                    <video
                      src={signedUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full rounded-t-lg bg-black"
                      style={{ maxHeight: '260px', display: 'block' }}
                    />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signedUrl} alt="current" className="w-full rounded-t-lg max-h-64 object-contain bg-black" />
                )
              ) : (
                <div className={`w-full h-32 flex items-center justify-center text-xs rounded-t-lg ${isDark ? 'bg-white/[0.03] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                  <Loader2 className="animate-spin mr-1" size={14} /> {t('mediaLoading')}
                </div>
              )}
              <div className={`flex items-center justify-between px-2 py-1.5 text-[11px] rounded-b-lg ${isDark ? 'bg-white/[0.04] text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                <div className="flex items-center gap-3">
                  <span>{t('mediaCurrentBadge')} · {humanBytes(value.existingSizeBytes ?? 0)}</span>
                  {/* Fallback for formats browser can't play inline (e.g. MOV) */}
                  {value.tab === 'video' && signedUrl && (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                    >
                      <ExternalLink size={10} /> {t('mediaOpenExternal')}
                    </a>
                  )}
                </div>
                <button type="button" onClick={removeExisting} className="hover:text-red-500 transition-colors flex items-center gap-1">
                  <Trash2 size={11} /> {t('mediaRemove')}
                </button>
              </div>
            </div>
          )}

          {/* Pick / Replace button */}
          <button
            type="button"
            onClick={pickFile}
            disabled={processing}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed text-xs transition-colors disabled:opacity-60 ${
              isDark
                ? 'border-white/10 text-gray-400 hover:border-emerald-500/60 hover:bg-white/[0.03]'
                : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50/40'
            }`}
          >
            {processing ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            {processing
              ? t('mediaProcessing')
              : hasPending || hasExistingVisible
                ? t('mediaReplaceBtn', { type: value.tab === 'video' ? t('mediaTabVideo').toLowerCase() : t('mediaTabImage').toLowerCase() })
                : t('mediaPickBtn', { type: value.tab === 'video' ? t('mediaTabVideo').toLowerCase() : t('mediaTabImage').toLowerCase() })}
          </button>

          <p className={`text-[10px] leading-snug ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {value.tab === 'video'
              ? t('mediaVideoHint', { sec: MAX_VIDEO_DURATION_SEC, mb: 10 })
              : t('mediaImageHint', { mb: 5 })}
          </p>

          {localError && (
            <p className="text-[11px] text-rose-500">{localError}</p>
          )}
        </div>
      )}
    </div>
  )
}

function humanBytes(n: number): string {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
