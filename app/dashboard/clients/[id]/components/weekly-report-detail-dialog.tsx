'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Eye, EyeOff, FileDown, Trash2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { supabase } from '@/lib/supabase'
import type { WeeklyReportSnapshot } from '@/lib/weekly-report'
import WeeklyReportView from '@/app/dashboard/clients/[id]/components/weekly-report-view'

export type SavedReport = {
  id: string
  range_start: string
  range_end: string
  is_partial: boolean
  visible_to_client: boolean
  created_at: string
  trainer_notes: string | null
  snapshot: WeeklyReportSnapshot
}

/**
 * Loads a photo URL into a canvas via createImageBitmap (which respects EXIF orientation
 * in modern browsers) and returns a corrected JPEG data URL for embedding in PDF.
 * Falls back to the original URL on any error.
 */
async function normalizeImageOrientation(url: string): Promise<string> {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    // imageOrientation: 'from-image' applies EXIF rotation automatically
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    const MAX = 1600
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return url
  }
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  report: SavedReport | null
  onChanged: () => void
  onDeleted: () => void
}

export default function WeeklyReportDetailDialog({
  open, onOpenChange, report, onChanged, onDeleted,
}: Props) {
  const t = useTranslations('clients.weeklyReports.detail')
  const tList = useTranslations('clients.weeklyReports.list')
  const locale = useLocale()

  const [updatingVisibility, setUpdatingVisibility] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const handleExportPdf = async () => {
    if (!report) return
    setExportingPdf(true)
    try {
      const { downloadReportPdf } = await import('./weekly-report-pdf')

      // Pre-sign photo storage paths so the PDF renderer can embed them as images
      const snap = report.snapshot
      let snapWithPhotos = snap
      const paths = snap.photoSets.flatMap(set =>
        set.photos
          .filter(p => p.storagePath && !p.storagePath.startsWith('http'))
          .map(p => p.storagePath),
      )
      if (paths.length > 0) {
        const { data } = await supabase.storage
          .from('checkin-images')
          .createSignedUrls(paths, 3600)
        if (data) {
          const urlMap: Record<string, string> = {}
          data.forEach((d, i) => { if (d.signedUrl) urlMap[paths[i]] = d.signedUrl })

          // Collect all resolved URLs and convert to EXIF-corrected data URLs
          const resolvedUrls: Record<string, string> = {}
          const allSignedUrls = snap.photoSets.flatMap(set =>
            set.photos.map(p => urlMap[p.storagePath] ?? (p.storagePath.startsWith('http') ? p.storagePath : null))
          ).filter((u): u is string => u !== null)

          await Promise.all(
            allSignedUrls.map(async url => {
              resolvedUrls[url] = await normalizeImageOrientation(url)
            })
          )

          snapWithPhotos = {
            ...snap,
            photoSets: snap.photoSets.map(set => ({
              ...set,
              photos: set.photos.map(p => {
                const signedUrl = urlMap[p.storagePath] ?? (p.storagePath.startsWith('http') ? p.storagePath : null)
                return {
                  ...p,
                  storagePath: signedUrl ? (resolvedUrls[signedUrl] ?? signedUrl) : p.storagePath,
                }
              }),
            })),
          }
        }
      }

      await downloadReportPdf(snapWithPhotos)
    } catch (e) {
      console.error('PDF export failed:', e)
    } finally {
      setExportingPdf(false)
    }
  }

  if (!report) return null

  const visible = report.visible_to_client

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  const handleToggleVisibility = async () => {
    setUpdatingVisibility(true)
    const { error } = await supabase
      .from('client_weekly_reports')
      .update({ visible_to_client: !visible })
      .eq('id', report.id)
    setUpdatingVisibility(false)
    if (error) {
      console.warn('toggle visibility error:', error.message)
      return
    }
    onChanged()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase
      .from('client_weekly_reports')
      .delete()
      .eq('id', report.id)
    setDeleting(false)
    if (error) {
      console.warn('delete report error:', error.message)
      return
    }
    setConfirmDelete(false)
    onOpenChange(false)
    onDeleted()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">
              {t('title')} · {fmtDate(report.range_start)} — {fmtDate(report.range_end)}
            </DialogTitle>
            <DialogDescription>
              {tList('createdAtFmt', {
                date: new Date(report.created_at).toLocaleDateString(locale, {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }),
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Action bar — stacks vertically on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              {visible ? (
                <Eye size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <EyeOff size={16} className="text-gray-400 shrink-0" />
              )}
              <div className="text-xs">
                <p className="font-semibold text-gray-800">{t('toggleVisibility')}</p>
                <p className="text-gray-500">{visible ? t('toggleVisibilityOn') : t('toggleVisibilityOff')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exportingPdf} className="flex-1 sm:flex-none">
                {exportingPdf ? <Loader2 className="animate-spin mr-1" size={14} /> : <FileDown size={14} className="mr-1" />}
                PDF
              </Button>
              <Button
                size="sm"
                variant={visible ? 'outline' : 'default'}
                onClick={handleToggleVisibility}
                disabled={updatingVisibility}
                className="flex-1 sm:flex-none"
              >
                {updatingVisibility ? <Loader2 className="animate-spin" size={14} /> : (visible ? tList('hiddenFromClient') : tList('visibleToClient'))}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} className="mr-1" />
                {t('deleteBtn')}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <WeeklyReportView snapshot={report.snapshot} />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={tList('deleteConfirmTitle')}
        description={<p>{tList('deleteConfirmDesc')}</p>}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        confirmLabel={deleting ? '…' : tList('deleteBtn')}
        destructive
      />
    </>
  )
}
