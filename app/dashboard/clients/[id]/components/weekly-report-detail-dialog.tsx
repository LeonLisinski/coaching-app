'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Eye, EyeOff, Trash2, Loader2 } from 'lucide-react'
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
            <DialogTitle>
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

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {visible ? (
                <Eye size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <EyeOff size={18} className="text-gray-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <p className="font-semibold text-gray-800">{t('toggleVisibility')}</p>
                <p className="text-gray-600">
                  {visible ? t('toggleVisibilityOn') : t('toggleVisibilityOff')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={visible ? 'outline' : 'default'}
                onClick={handleToggleVisibility}
                disabled={updatingVisibility}
              >
                {updatingVisibility ? <Loader2 className="animate-spin" size={14} /> : (visible ? tList('hiddenFromClient') : tList('visibleToClient'))}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
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
