import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

export const EXERCISE_MEDIA_BUCKET = 'exercise-media'

// Limits enforced in the UI. Bucket has its own 15 MB safety cap.
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_VIDEO_DURATION_SEC = 30
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB original
export const COMPRESSED_IMAGE_TARGET_MB = 0.5
export const COMPRESSED_IMAGE_MAX_DIM = 1920

export type ExerciseMediaType = 'youtube' | 'video' | 'image' | null

export type UploadedExerciseMedia = {
  path: string
  mime: string
  size: number
}

const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

function extForMime(mime: string): string {
  return VIDEO_EXTENSIONS[mime] || IMAGE_EXTENSIONS[mime] || 'bin'
}

/**
 * Try to read the video duration from a File object.
 * Returns the duration in seconds, or NaN if the browser cannot parse the
 * metadata (e.g. unsupported codec, DRM, quirky encoding). Callers should
 * treat NaN as "unknown duration" and skip the check rather than blocking upload.
 */
export async function readVideoDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    const cleanup = (duration: number) => {
      URL.revokeObjectURL(url)
      video.src = ''
      resolve(duration)
    }

    video.onloadedmetadata = () => cleanup(video.duration)
    // Any error → resolve with NaN so the caller can skip the duration check
    video.onerror = () => cleanup(NaN)
    // Some browsers never fire either event for certain formats; time out after 4s
    const timeout = setTimeout(() => cleanup(NaN), 4000)
    video.onloadedmetadata = () => { clearTimeout(timeout); cleanup(video.duration) }
    video.src = url
  })
}

export async function compressImageForUpload(file: File): Promise<File> {
  // browser-image-compression returns a File-like Blob with a name
  return imageCompression(file, {
    maxSizeMB: COMPRESSED_IMAGE_TARGET_MB,
    maxWidthOrHeight: COMPRESSED_IMAGE_MAX_DIM,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
  })
}

export async function uploadExerciseMedia(
  trainerId: string,
  exerciseId: string,
  file: File | Blob,
  mime: string,
): Promise<UploadedExerciseMedia> {
  const ext = extForMime(mime)
  // Stable path per exercise; upsert overwrites any previous upload.
  const path = `${trainerId}/${exerciseId}.${ext}`

  const { error } = await supabase.storage
    .from(EXERCISE_MEDIA_BUCKET)
    .upload(path, file, {
      contentType: mime,
      upsert: true,
      cacheControl: '3600',
    })

  if (error) throw error

  return {
    path,
    mime,
    size: (file as File).size ?? (file as Blob).size,
  }
}

export async function deleteExerciseMedia(path: string): Promise<void> {
  // Storage `remove` swallows "not found" errors quietly, which is what we want.
  await supabase.storage.from(EXERCISE_MEDIA_BUCKET).remove([path])
}

export async function createExerciseMediaSignedUrl(
  path: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EXERCISE_MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSec)
  if (error) return null
  return data?.signedUrl ?? null
}
