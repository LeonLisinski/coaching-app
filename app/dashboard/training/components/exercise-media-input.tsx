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

// ── Value shape ──────────────────────────────────────────────────────────────
// Three independent slots: YouTube URL, uploaded video, uploaded image.
// Each can be set, changed, or removed independently.
export type ExerciseMediaValue = {
  // YouTube / external URL
  videoUrl: string

  // Uploaded video (storage: exercise-media bucket, media_path column)
  existingVideoPath: string | null
  existingVideoMime: string | null
  existingVideoSizeBytes: number | null
  pendingVideoFile: File | Blob | null
  pendingVideoMime: string | null
  pendingVideoSize: number | null
  removeVideo: boolean

  // Uploaded image (storage: exercise-media bucket, image_path column)
  existingImagePath: string | null
  existingImageMime: string | null
  existingImageSizeBytes: number | null
  pendingImageFile: File | Blob | null
  pendingImageMime: string | null
  pendingImageSize: number | null
  removeImage: boolean
}

export function emptyMediaValue(): ExerciseMediaValue {
  return {
    videoUrl: '',
    existingVideoPath: null, existingVideoMime: null, existingVideoSizeBytes: null,
    pendingVideoFile: null, pendingVideoMime: null, pendingVideoSize: null, removeVideo: false,
    existingImagePath: null, existingImageMime: null, existingImageSizeBytes: null,
    pendingImageFile: null, pendingImageMime: null, pendingImageSize: null, removeImage: false,
  }
}

export function mediaValueFromExercise(ex: {
  video_url?: string | null
  media_path?: string | null
  media_mime?: string | null
  media_size_bytes?: number | null
  image_path?: string | null
  image_mime?: string | null
  image_size_bytes?: number | null
}): ExerciseMediaValue {
  return {
    ...emptyMediaValue(),
    videoUrl: ex.video_url ?? '',
    existingVideoPath: ex.media_path ?? null,
    existingVideoMime: ex.media_mime ?? null,
    existingVideoSizeBytes: ex.media_size_bytes ?? null,
    existingImagePath: ex.image_path ?? null,
    existingImageMime: ex.image_mime ?? null,
    existingImageSizeBytes: ex.image_size_bytes ?? null,
  }
}

type Props = {
  value: ExerciseMediaValue
  onChange: (next: ExerciseMediaValue) => void
  isDark?: boolean
}

const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime'
const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp'

// ── Single upload slot ────────────────────────────────────────────────────────
function UploadSlot({
  type,
  existingPath,
  existingMime,
  existingSizeBytes,
  pendingFile,
  pendingMime,
  pendingSize,
  isRemoving,
  onPick,
  onRemoveExisting,
  onClearPending,
  processing,
  error,
  isDark,
  t,
}: {
  type: 'video' | 'image'
  existingPath: string | null
  existingMime: string | null
  existingSizeBytes: number | null
  pendingFile: File | Blob | null
  pendingMime: string | null
  pendingSize: number | null
  isRemoving: boolean
  onPick: () => void
  onRemoveExisting: () => void
  onClearPending: () => void
  processing: boolean
  error: string | null
  isDark: boolean
  t: ReturnType<typeof useTranslations>
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (existingPath && !isRemoving) {
      createExerciseMediaSignedUrl(existingPath).then(url => {
        if (!cancelled) setSignedUrl(url)
      })
    } else {
      setSignedUrl(null)
    }
    return () => { cancelled = true }
  }, [existingPath, isRemoving])

  useEffect(() => {
    if (!pendingFile) { setPendingPreviewUrl(null); return }
    const url = URL.createObjectURL(pendingFile)
    setPendingPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingFile])

  const hasExisting = !!existingPath && !isRemoving
  const hasPending = !!pendingFile
  const showExisting = hasExisting && !hasPending

  const sectionBorder = `rounded-lg border ${isDark ? 'border-white/10' : 'border-gray-200'}`
  const metaBar = `flex items-center justify-between px-2 py-1.5 text-[11px] rounded-b-lg ${isDark ? 'bg-white/[0.04] text-gray-400' : 'bg-gray-50 text-gray-500'}`

  return (
    <div className="space-y-1.5">
      {/* Pending preview */}
      {hasPending && pendingPreviewUrl && (
        <div className={sectionBorder}>
          {type === 'video' ? (
            <video src={pendingPreviewUrl} controls playsInline preload="metadata"
              className="w-full rounded-t-lg bg-black" style={{ maxHeight: 240, display: 'block' }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pendingPreviewUrl} alt="" className="w-full rounded-t-lg max-h-56 object-contain bg-black" />
          )}
          <div className={metaBar}>
            <span>{t('mediaPendingBadge')} · {humanBytes(pendingSize ?? 0)}</span>
            <button type="button" onClick={onClearPending} className="hover:text-red-500 flex items-center gap-1 transition-colors">
              <Trash2 size={11} /> {t('mediaUndoPick')}
            </button>
          </div>
        </div>
      )}

      {/* Existing preview */}
      {showExisting && (
        <div className={sectionBorder}>
          {signedUrl ? (
            type === 'video' ? (
              <video src={signedUrl} controls playsInline preload="metadata"
                className="w-full rounded-t-lg bg-black" style={{ maxHeight: 240, display: 'block' }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signedUrl} alt="current" className="w-full rounded-t-lg max-h-56 object-contain bg-black" />
            )
          ) : (
            <div className={`w-full h-28 flex items-center justify-center text-xs rounded-t-lg ${isDark ? 'bg-white/[0.03] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
              <Loader2 className="animate-spin mr-1" size={14} /> {t('mediaLoading')}
            </div>
          )}
          <div className={metaBar}>
            <div className="flex items-center gap-3">
              <span>{t('mediaCurrentBadge')} · {humanBytes(existingSizeBytes ?? 0)}</span>
              {type === 'video' && signedUrl && (
                <a href={signedUrl} target="_blank" rel="noreferrer"
                  className={`flex items-center gap-1 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  <ExternalLink size={10} /> {t('mediaOpenExternal')}
                </a>
              )}
            </div>
            <button type="button" onClick={onRemoveExisting} className="hover:text-red-500 flex items-center gap-1 transition-colors">
              <Trash2 size={11} /> {t('mediaRemove')}
            </button>
          </div>
        </div>
      )}

      {/* Upload / replace button */}
      <button
        type="button"
        onClick={onPick}
        disabled={processing}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed text-xs transition-colors disabled:opacity-60 ${
          isDark
            ? 'border-white/10 text-gray-400 hover:border-emerald-500/60 hover:bg-white/[0.03]'
            : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50/40'
        }`}
      >
        {processing ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
        {processing
          ? t('mediaProcessing')
          : hasPending || hasExisting
            ? t(type === 'video' ? 'mediaReplaceVideo' : 'mediaReplaceImage')
            : t(type === 'video' ? 'mediaPickVideo' : 'mediaPickImage')}
      </button>

      {error && <p className="text-[11px] text-rose-500">{error}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExerciseMediaInput({ value, onChange, isDark = false }: Props) {
  const t = useTranslations('training.dialogs.exercise')
  const tCommon = useTranslations('common')

  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [processingVideo, setProcessingVideo] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setVideoError(null)
    setProcessingVideo(true)
    try {
      if (file.size > MAX_VIDEO_BYTES) throw new Error(t('mediaVideoTooBig', { mb: 10 }))
      const duration = await readVideoDuration(file)
      if (!isNaN(duration) && duration > MAX_VIDEO_DURATION_SEC + 0.5) {
        throw new Error(t('mediaVideoTooLong', { sec: MAX_VIDEO_DURATION_SEC }))
      }
      onChange({
        ...value,
        pendingVideoFile: file,
        pendingVideoMime: file.type || 'video/mp4',
        pendingVideoSize: file.size,
        removeVideo: !!value.existingVideoPath,
      })
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : t('mediaPickFailed'))
    } finally {
      setProcessingVideo(false)
    }
  }

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError(null)
    setProcessingImage(true)
    try {
      if (file.size > MAX_IMAGE_BYTES) throw new Error(t('mediaImageTooBig', { mb: 5 }))
      const compressed = await compressImageForUpload(file)
      onChange({
        ...value,
        pendingImageFile: compressed,
        pendingImageMime: 'image/webp',
        pendingImageSize: compressed.size,
        removeImage: !!value.existingImagePath,
      })
    } catch (err) {
      setImageError(err instanceof Error ? err.message : t('mediaPickFailed'))
    } finally {
      setProcessingImage(false)
    }
  }

  const sectionHeader = (label: string, Icon: typeof PlayCircle) => (
    <div className="flex items-center gap-1.5">
      <Icon size={12} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
    </div>
  )

  return (
    <div className="space-y-4">
      <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {t('mediaSectionLabel')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>({tCommon('optional')})</span>
      </Label>

      {/* ── YouTube URL ─────────────────────────────────────────────────── */}
      <div className="space-y-1">
        {sectionHeader('YouTube URL', ExternalLink)}
        <Input
          value={value.videoUrl}
          onChange={e => onChange({ ...value, videoUrl: e.target.value })}
          placeholder="https://youtube.com/..."
          className={isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}
        />
      </div>

      {/* ── Uploaded video ──────────────────────────────────────────────── */}
      <div className="space-y-1">
        {sectionHeader(t('mediaTabVideo'), PlayCircle)}
        <input ref={videoInputRef} type="file" accept={ACCEPT_VIDEO} capture="environment" className="hidden" onChange={handleVideoFile} />
        <UploadSlot
          type="video"
          existingPath={value.existingVideoPath}
          existingMime={value.existingVideoMime}
          existingSizeBytes={value.existingVideoSizeBytes}
          pendingFile={value.pendingVideoFile}
          pendingMime={value.pendingVideoMime}
          pendingSize={value.pendingVideoSize}
          isRemoving={value.removeVideo}
          onPick={() => videoInputRef.current?.click()}
          onRemoveExisting={() => onChange({ ...value, removeVideo: true })}
          onClearPending={() => onChange({ ...value, pendingVideoFile: null, pendingVideoMime: null, pendingVideoSize: null, removeVideo: false })}
          processing={processingVideo}
          error={videoError}
          isDark={isDark}
          t={t}
        />
        <p className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('mediaVideoHint', { sec: MAX_VIDEO_DURATION_SEC, mb: 10 })}</p>
      </div>

      {/* ── Uploaded image ──────────────────────────────────────────────── */}
      <div className="space-y-1">
        {sectionHeader(t('mediaTabImage'), ImageIcon)}
        <input ref={imageInputRef} type="file" accept={ACCEPT_IMAGE} capture="environment" className="hidden" onChange={handleImageFile} />
        <UploadSlot
          type="image"
          existingPath={value.existingImagePath}
          existingMime={value.existingImageMime}
          existingSizeBytes={value.existingImageSizeBytes}
          pendingFile={value.pendingImageFile}
          pendingMime={value.pendingImageMime}
          pendingSize={value.pendingImageSize}
          isRemoving={value.removeImage}
          onPick={() => imageInputRef.current?.click()}
          onRemoveExisting={() => onChange({ ...value, removeImage: true })}
          onClearPending={() => onChange({ ...value, pendingImageFile: null, pendingImageMime: null, pendingImageSize: null, removeImage: false })}
          processing={processingImage}
          error={imageError}
          isDark={isDark}
          t={t}
        />
        <p className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('mediaImageHint', { mb: 5 })}</p>
      </div>
    </div>
  )
}

function humanBytes(n: number): string {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
