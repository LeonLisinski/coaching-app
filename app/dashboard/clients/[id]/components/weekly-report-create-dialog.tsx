'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import {
  buildWeeklyReportSnapshot,
  checkinPairs,
  computeDefaultRange,
  daysBetween,
  makeRange,
  type WeeklyReportRange,
  type WeeklyReportSnapshot,
} from '@/lib/weekly-report'
import WeeklyReportView from '@/app/dashboard/clients/[id]/components/weekly-report-view'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId: string
  clientName: string
  onSaved: () => void
}

type PresetKey = 'sinceLast' | 'lastFull' | 'last7' | 'custom' | 'specificWeek'

const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function WeeklyReportCreateDialog({
  open, onOpenChange, clientId, clientName, onSaved,
}: Props) {
  const t = useTranslations('clients.weeklyReports.create')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkinDates, setCheckinDates] = useState<string[]>([])
  const [checkinDay, setCheckinDay] = useState<number | null>(null)
  const [clientStartDate, setClientStartDate] = useState<string | null>(null)

  const [preset, setPreset] = useState<PresetKey>('sinceLast')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [specificWeekIdx, setSpecificWeekIdx] = useState<number>(0)

  const [trainerNotes, setTrainerNotes] = useState<string>('')

  const [previewSnapshot, setPreviewSnapshot] = useState<WeeklyReportSnapshot | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Reset state when reopened
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setPreviewSnapshot(null)
    setPreset('sinceLast')
    setTrainerNotes('')

    const today = todayIso()
    Promise.all([
      supabase
        .from('checkins')
        .select('date')
        .eq('client_id', clientId)
        .order('date', { ascending: true }),
      supabase
        .from('checkin_config')
        .select('checkin_day')
        .eq('client_id', clientId)
        .maybeSingle(),
      supabase
        .from('clients')
        .select('start_date')
        .eq('id', clientId)
        .maybeSingle(),
    ]).then(([checkinsRes, cfgRes, clientRes]) => {
      const dates = (checkinsRes.data || []).map(c => c.date.slice(0, 10))
      setCheckinDates(dates)
      setCheckinDay(cfgRes.data?.checkin_day ?? null)
      setClientStartDate(clientRes.data?.start_date ?? null)

      const def = computeDefaultRange({
        today,
        checkinDay: cfgRes.data?.checkin_day ?? null,
        checkinDates: dates,
        clientStartDate: clientRes.data?.start_date ?? null,
      })
      setCustomStart(def.start)
      setCustomEnd(def.end)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
      setError('Greška pri učitavanju podataka klijenta.')
    })
  }, [open, clientId])

  const pairs = useMemo(() => checkinPairs(checkinDates), [checkinDates])

  // Compute the active range based on current preset selection
  const activeRange: WeeklyReportRange | null = useMemo(() => {
    if (loading) return null
    const today = todayIso()

    if (preset === 'sinceLast') {
      return computeDefaultRange({
        today,
        checkinDay,
        checkinDates,
        clientStartDate,
      })
    }
    if (preset === 'lastFull') {
      if (pairs.length > 0) return makeRange(pairs[0].start, pairs[0].end)
      const since = computeDefaultRange({ today, checkinDay, checkinDates, clientStartDate })
      return since
    }
    if (preset === 'last7') {
      const end = today
      const startDate = new Date(end + 'T12:00:00')
      startDate.setDate(startDate.getDate() - 6)
      const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
      return makeRange(start, end)
    }
    if (preset === 'specificWeek') {
      const p = pairs[specificWeekIdx]
      if (p) return makeRange(p.start, p.end)
      return null
    }
    // custom
    if (customStart && customEnd && customStart <= customEnd) {
      return makeRange(customStart, customEnd)
    }
    return null
  }, [preset, customStart, customEnd, specificWeekIdx, pairs, loading, checkinDates, checkinDay, clientStartDate])

  const validRange = activeRange != null && activeRange.start <= activeRange.end
  const futureWarning = activeRange != null && activeRange.end > todayIso()
  const noCheckinsNotice = !loading && checkinDates.length === 0

  // Live preview rebuild whenever range changes
  useEffect(() => {
    if (!open || !validRange || !activeRange) return
    let cancelled = false
    setPreviewLoading(true)
    buildWeeklyReportSnapshot(supabase, clientId, activeRange, { trainerNotes })
      .then(snap => {
        if (cancelled) return
        // Override the client name with the parent-supplied one (already in scope)
        snap.client.name = clientName || snap.client.name
        setPreviewSnapshot(snap)
        setPreviewLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setPreviewLoading(false)
        setPreviewSnapshot(null)
      })
    return () => { cancelled = true }
    // trainerNotes is consciously not a dep here — we update its display via override
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, validRange, activeRange?.start, activeRange?.end, clientId, clientName])

  const handleSave = async () => {
    if (!activeRange || !validRange || !previewSnapshot) return
    setSaving(true)
    setError(null)
    const { data: sess } = await supabase.auth.getSession()
    const trainerId = sess.session?.user?.id
    if (!trainerId) {
      setSaving(false)
      setError(t('saveError'))
      return
    }

    const finalSnapshot: WeeklyReportSnapshot = {
      ...previewSnapshot,
      trainerNotes: trainerNotes || null,
    }

    const { error: insertErr } = await supabase.from('client_weekly_reports').insert({
      client_id: clientId,
      trainer_id: trainerId,
      range_start: activeRange.start,
      range_end: activeRange.end,
      is_partial: activeRange.isPartial,
      snapshot: finalSnapshot,
      trainer_notes: trainerNotes || null,
    })
    setSaving(false)
    if (insertErr) {
      console.warn('weekly_reports insert error:', insertErr.message)
      setError(t('saveError'))
      return
    }
    onSaved()
    onOpenChange(false)
  }

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            <>
              {/* Range picker */}
              <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{t('rangeSection')}</p>
                  {activeRange ? (
                    <span className="text-[11px] text-gray-500">
                      {fmtDate(activeRange.start)} — {fmtDate(activeRange.end)}{' '}
                      <span className="ml-1 inline-block rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 border border-gray-200">
                        {activeRange.isPartial
                          ? t('rangePartialBadge', { days: activeRange.days })
                          : t('rangeFullBadge')}
                      </span>
                    </span>
                  ) : null}
                </div>

                {noCheckinsNotice ? (
                  <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    {t('noticeNoCheckins')}
                  </p>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <PresetButton
                    active={preset === 'sinceLast'}
                    onClick={() => setPreset('sinceLast')}
                    label={t('rangePresetSinceLastCheckin')}
                    badge={t('rangeDefaultLabel')}
                  />
                  <PresetButton
                    active={preset === 'lastFull'}
                    onClick={() => setPreset('lastFull')}
                    label={t('rangePresetLastFullWeek')}
                    disabled={pairs.length === 0}
                  />
                  <PresetButton
                    active={preset === 'last7'}
                    onClick={() => setPreset('last7')}
                    label={t('rangePresetLast7')}
                  />
                  <PresetButton
                    active={preset === 'specificWeek'}
                    onClick={() => setPreset('specificWeek')}
                    label={t('rangeOtherWeeks')}
                    disabled={pairs.length === 0}
                  />
                </div>

                {preset === 'specificWeek' && pairs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto border border-gray-200 rounded-md bg-white p-1">
                    {pairs.map((p, i) => (
                      <button
                        key={`${p.start}-${p.end}`}
                        type="button"
                        onClick={() => setSpecificWeekIdx(i)}
                        className={`text-left text-xs px-2.5 py-1.5 rounded ${
                          specificWeekIdx === i
                            ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {fmtDate(p.start)} → {fmtDate(p.end)}{' '}
                        <span className="text-gray-400">({daysBetween(p.start, p.end) + 1}d)</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="custom-range-toggle"
                      checked={preset === 'custom'}
                      onChange={() => setPreset(preset === 'custom' ? 'sinceLast' : 'custom')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="custom-range-toggle" className="text-sm cursor-pointer">
                      {t('rangePresetCustom')}
                    </Label>
                  </div>
                  {preset === 'custom' ? (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <Label className="text-[11px] uppercase tracking-wide text-gray-500 mb-1 block">
                          {t('rangeCustomFrom')}
                        </Label>
                        <Input
                          type="date"
                          value={customStart}
                          onChange={e => setCustomStart(e.target.value)}
                          max={customEnd || todayIso()}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-wide text-gray-500 mb-1 block">
                          {t('rangeCustomTo')}
                        </Label>
                        <Input
                          type="date"
                          value={customEnd}
                          onChange={e => setCustomEnd(e.target.value)}
                          max={todayIso()}
                          min={customStart}
                        />
                      </div>
                    </div>
                  ) : null}

                  {preset === 'custom' && customStart && customEnd && customStart > customEnd ? (
                    <p className="mt-1.5 text-xs text-rose-600">{t('rangeError')}</p>
                  ) : null}
                  {futureWarning ? (
                    <p className="mt-1.5 text-xs text-amber-700">{t('noticeFutureRange')}</p>
                  ) : null}
                </div>
              </section>

              {/* Trainer notes */}
              <section className="space-y-1.5">
                <Label htmlFor="trainer-notes" className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                  {t('trainerNotes')}
                </Label>
                <Textarea
                  id="trainer-notes"
                  value={trainerNotes}
                  onChange={e => setTrainerNotes(e.target.value)}
                  placeholder={t('trainerNotesPlaceholder')}
                  rows={3}
                  className="resize-none"
                />
              </section>

              {/* Preview */}
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{t('preview')}</p>
                {previewLoading || !previewSnapshot ? (
                  <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-8 text-gray-500">
                    <Loader2 className="animate-spin" size={18} />
                  </div>
                ) : (
                  <WeeklyReportView
                    snapshot={previewSnapshot}
                    trainerNotesOverride={trainerNotes || null}
                  />
                )}
              </section>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-gray-100 pt-3 mt-2">
          {error ? <p className="mr-auto text-xs text-rose-600">{error}</p> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !validRange || !previewSnapshot || previewLoading}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={14} />
                {t('savingBtn')}
              </span>
            ) : t('saveBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PresetButton({
  active, onClick, label, badge, disabled,
}: {
  active: boolean
  onClick: () => void
  label: string
  badge?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-900 ring-1 ring-blue-200'
          : disabled
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          {badge}
        </span>
      ) : null}
    </button>
  )
}
