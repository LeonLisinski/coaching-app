'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dumbbell } from 'lucide-react'
import { logVolume, TrainingWorkoutLog } from '@/lib/training-metrics'
import { setsWithLoggedData } from '@/lib/workout-log-sets'
import {
  findExerciseMatch,
  findPreviousSameTrainingLog,
  maxWeightDeltaKind,
  maxWeightInExercise,
  sessionVolumeVerdict,
} from '@/lib/workout-session-compare'

type Props = {
  log: TrainingWorkoutLog
  allLogs: TrainingWorkoutLog[]
}

type ExerciseUiState =
  | 'noSessionBaseline'
  | 'exerciseFirstTime'
  | 'noWeightData'
  | 'up'
  | 'down'
  | 'flat'

export default function ClientWorkoutDetailSheetContent({ log, allLogs }: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.trainingTracking.detailSheet')

  const previous = useMemo(() => findPreviousSameTrainingLog(log, allLogs), [log, allLogs])

  const currentVol = useMemo(() => logVolume(log), [log])
  const previousVol = useMemo(
    () => (previous ? logVolume(previous) : null),
    [previous],
  )

  const verdict = useMemo(
    () => sessionVolumeVerdict(currentVol, previousVol),
    [currentVol, previousVol],
  )

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  return (
    <>
      <SheetHeader className="mb-4 pr-8 space-y-3 text-left">
        <SheetTitle className="flex items-start gap-2 text-left">
          <Dumbbell size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <span className="space-y-1">
            <span className="block text-[15px] font-semibold text-gray-900 leading-snug">
              {(log.day_name || '').trim() || t('fallbackTrainingName')}
            </span>
            <span className="block text-sm font-normal text-gray-600">
              <span className="font-medium text-gray-800">{t('labelThisSession')}</span>{' '}
              {dateFmt(log.date)}
            </span>
            <span className="block text-sm font-normal text-gray-500">
              {previous ? (
                <>
                  <span className="font-medium text-gray-700">{t('labelPreviousSession')}</span>{' '}
                  {dateFmt(previous.date)}
                </>
              ) : (
                t('noPreviousSession')
              )}
            </span>
          </span>
        </SheetTitle>
      </SheetHeader>

      <div className="space-y-5 pb-6">
        {log.exercises?.map((ex, ei) => {
          const currSets = setsWithLoggedData(ex.sets as unknown[])
          const currMax = maxWeightInExercise(ex)

          const prevEx = previous ? findExerciseMatch(previous, ex.name, ex.exercise_id) : null
          const prevSets = prevEx ? setsWithLoggedData(prevEx.sets as unknown[]) : []
          const prevMax = prevEx ? maxWeightInExercise(prevEx) : null

          const maxRows = Math.max(currSets.length, prevSets.length)

          let ui: ExerciseUiState
          if (!previous) {
            ui = 'noSessionBaseline'
          } else if (!prevEx) {
            ui = 'exerciseFirstTime'
          } else if (currMax == null || prevMax == null) {
            ui = 'noWeightData'
          } else {
            const k = maxWeightDeltaKind(currMax, prevMax)
            if (k === 'first') ui = 'noWeightData'
            else if (k === 'up') ui = 'up'
            else if (k === 'down') ui = 'down'
            else ui = 'flat'
          }

          const barClass =
            ui === 'up'
              ? 'bg-emerald-500'
              : ui === 'down'
                ? 'bg-rose-500'
                : ui === 'flat'
                  ? 'bg-gray-300'
                  : 'bg-gray-400'

          const rowClass = (side: 'prev' | 'this', has: boolean) =>
            side === 'prev'
              ? has
                ? 'bg-gray-50 text-gray-800'
                : 'bg-gray-50/50 text-gray-300'
              : has
                ? 'bg-blue-50 text-blue-900'
                : 'bg-blue-50/30 text-gray-300'

          const deltaText = () => {
            if (ui === 'noSessionBaseline') return t('exerciseNoSessionBaseline')
            if (ui === 'exerciseFirstTime') return t('exerciseFirstTime')
            if (ui === 'noWeightData') return t('exerciseNoWeightData')
            if (currMax == null || prevMax == null) return t('exerciseNoWeightData')
            const d = currMax - prevMax
            if (ui === 'up') return t('maxDeltaUp', { delta: d.toFixed(1) })
            if (ui === 'down') return t('maxDeltaDown', { delta: Math.abs(d).toFixed(1) })
            return t('maxDeltaFlat', { kg: currMax.toFixed(1) })
          }

          const bandClass =
            ui === 'up'
              ? 'bg-emerald-50 text-emerald-900'
              : ui === 'down'
                ? 'bg-rose-50 text-rose-900'
                : ui === 'flat'
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-gray-50 text-gray-600'

          return (
            <div
              key={`${ex.exercise_id}-${ei}`}
              className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm"
            >
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{ex.name}</p>
              </div>

              <div className="px-3 py-3 sm:px-4">
                <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  <div>{t('prevColumn')}</div>
                  <div>{t('thisColumn')}</div>
                </div>
                <div className="space-y-1.5">
                  {Array.from({ length: maxRows }, (_, i) => {
                    const p = prevSets[i]
                    const c = currSets[i]
                    return (
                      <div key={i} className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                        <div className={`rounded-lg px-2 py-1.5 ${rowClass('prev', !!p)}`}>
                          {p ? t('setFormat', { reps: p.reps, weight: p.weight }) : '—'}
                        </div>
                        <div className={`rounded-lg px-2 py-1.5 ${rowClass('this', !!c)}`}>
                          {c ? t('setFormat', { reps: c.reps, weight: c.weight }) : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${bandClass}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${barClass}`} aria-hidden />
                  <span>{deltaText()}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-4 -mx-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('summaryTitle')}</p>
        {previous && previousVol != null ? (
          <>
            <p className="text-sm text-gray-800">
              {t('summaryVolume', {
                current: Math.round(currentVol),
                previous: Math.round(previousVol),
              })}
            </p>
            <p
              className={`text-sm font-semibold ${
                verdict === 'better'
                  ? 'text-emerald-700'
                  : verdict === 'worse'
                    ? 'text-rose-700'
                    : 'text-gray-700'
              }`}
            >
              {verdict === 'better'
                ? t('verdictBetter')
                : verdict === 'worse'
                  ? t('verdictWorse')
                  : t('verdictSame')}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-600">{t('summaryNoCompare')}</p>
        )}
        <p className="text-[11px] text-gray-400">{t('summaryFootnote')}</p>
      </div>
    </>
  )
}
