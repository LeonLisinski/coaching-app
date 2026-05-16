'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Eye, EyeOff, FileText, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import WeeklyReportCreateDialog from '@/app/dashboard/clients/[id]/components/weekly-report-create-dialog'
import WeeklyReportDetailDialog, {
  type SavedReport,
} from '@/app/dashboard/clients/[id]/components/weekly-report-detail-dialog'

type Props = {
  clientId: string
  clientName: string
}

export default function ClientWeeklyReports({ clientId, clientName }: Props) {
  const t = useTranslations('clients.weeklyReports')
  const tList = useTranslations('clients.weeklyReports.list')
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<SavedReport[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<SavedReport | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('client_weekly_reports')
      .select('id, range_start, range_end, is_partial, visible_to_client, created_at, trainer_notes, snapshot')
      .eq('client_id', clientId)
      .order('range_end', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('fetch reports error:', error.message)
      setReports([])
    } else {
      setReports((data ?? []) as SavedReport[])
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchReports() }, [fetchReports])

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  const fmtCreated = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="space-y-5">
      {/* Header / hero */}
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              {t('title')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus size={16} className="mr-1" />
            {t('createBtn')}
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <FileText size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-700">{t('emptyTitle')}</p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">{t('emptySub')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map(r => {
            const summary = r.snapshot?.summary
            return (
              <button
                key={r.id}
                onClick={() => { setSelected(r); setDetailOpen(true) }}
                className="text-left rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">
                    {fmtDate(r.range_start)} — {fmtDate(r.range_end)}
                  </p>
                  {r.is_partial ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      {tList('partialBadge')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">{tList('createdAtFmt', { date: fmtCreated(r.created_at) })}</p>

                {summary ? (
                  <p className="mt-2 text-xs text-gray-600">
                    {tList('summaryChip', {
                      done: summary.workoutsCompletedCount,
                      planned: summary.workoutsPlannedCount,
                      confirmed: summary.nutritionConfirmedDays,
                      total: summary.nutritionTotalDays,
                    })}
                  </p>
                ) : null}

                {summary?.weightDelta != null ? (
                  <p className={`mt-1 text-xs font-semibold ${
                    summary.weightDelta > 0
                      ? 'text-emerald-700'
                      : summary.weightDelta < 0
                        ? 'text-rose-700'
                        : 'text-gray-700'
                  }`}>
                    {summary.weightDelta > 0 ? '+' : ''}{summary.weightDelta} kg
                  </p>
                ) : null}

                <div className="mt-3 flex items-center gap-1.5">
                  {r.visible_to_client ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                      <Eye size={10} />
                      {tList('visibleToClient')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 border border-gray-200">
                      <EyeOff size={10} />
                      {tList('hiddenFromClient')}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <WeeklyReportCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clientId={clientId}
        clientName={clientName}
        onSaved={fetchReports}
      />

      <WeeklyReportDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        report={selected}
        onChanged={fetchReports}
        onDeleted={fetchReports}
      />
    </div>
  )
}
