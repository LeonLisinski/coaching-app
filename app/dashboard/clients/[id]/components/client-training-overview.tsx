'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Dumbbell,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { getWeekDays, isoDate } from '@/lib/client-tracking-week'
import {
  buildPlannedRows,
  countPlannedVsDone,
  latestPrEvent,
  longTrendFromWeeklyVolumes,
  TrainingAssignment,
  TrainingWorkoutLog,
  volumeByWeek,
  volumeTrendThisVsLast,
} from '@/lib/training-metrics'
import { findAssignmentForPlanId } from '@/lib/workout-log-sets'

type Props = {
  assignments: TrainingAssignment[]
  workouts: TrainingWorkoutLog[]
  checkinDay: number
  loading: boolean
}

export default function ClientTrainingOverview({
  assignments,
  workouts,
  checkinDay,
  loading,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.trainingTracking')
  const tHist = useTranslations('clients.history')

  const m = useMemo(() => {
    const thisWeek = getWeekDays(checkinDay, 0)
    const lastWeek = getWeekDays(checkinDay, -1)
    const ts = isoDate(thisWeek[0])
    const te = isoDate(thisWeek[6])
    const ls = isoDate(lastWeek[0])
    const le = isoDate(lastWeek[6])

    const findPlanName = (planId: string | null) => {
      if (!planId) return t('legacyLogs')
      const a = findAssignmentForPlanId(planId, assignments)
      return a?.workout_plan.name ?? t('unknownPlan')
    }

    const rows = buildPlannedRows(
      ts,
      te,
      assignments,
      workouts,
      n => t('dayNumber', { n }),
      findPlanName,
      tHist('other'),
      t('legacyLogs'),
    )

    const { planned, done } = countPlannedVsDone(rows)
    const volTrend = volumeTrendThisVsLast(workouts, ts, te, ls, le)
    const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date))
    const lastLog = sorted[0] ?? null
    const pr = latestPrEvent(workouts)
    const volByWeek = volumeByWeek(workouts)
    const globalTrend = longTrendFromWeeklyVolumes(volByWeek)

    return { planned, done, volTrend, lastLog, pr, globalTrend }
  }, [assignments, workouts, checkinDay, t, tHist])

  if (loading) {
    return <p className="text-sm text-gray-400">{tHist('loading')}</p>
  }

  const trendIcon =
    m.globalTrend === 'up' ? (
      <TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden />
    ) : m.globalTrend === 'down' ? (
      <TrendingDown className="h-5 w-5 text-rose-600" aria-hidden />
    ) : (
      <Activity className="h-5 w-5 text-amber-600" aria-hidden />
    )

  const trendLabel =
    m.globalTrend === 'up'
      ? t('overviewTrendUp')
      : m.globalTrend === 'down'
        ? t('overviewTrendDown')
        : t('overviewTrendFlat')

  const volArrow =
    m.volTrend.trend === 'up' ? (
      <ArrowUpRight className="h-4 w-4 text-emerald-600 shrink-0" />
    ) : m.volTrend.trend === 'down' ? (
      <ArrowDownRight className="h-4 w-4 text-rose-600 shrink-0" />
    ) : (
      <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
    )

  const volSub =
    m.volTrend.pct != null
      ? t('overviewVolumePct', { pct: Math.round(m.volTrend.pct) })
      : m.volTrend.thisVol > 0 && m.volTrend.lastVol <= 0
        ? t('overviewVolumeBaseline')
        : t('overviewVolumeNoCompare')

  const volDiffRounded = Math.round(m.volTrend.thisVol - m.volTrend.lastVol)
  const hasVolWeekData = m.volTrend.thisVol > 0 || m.volTrend.lastVol > 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-4 border-gray-200/80 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('overviewLastWorkout')}
              </p>
              {m.lastLog ? (
                <>
                  <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight mt-0.5">
                    {new Date(m.lastLog.date).toLocaleDateString(locale, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{m.lastLog.day_name}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-1">{t('overviewNoSessions')}</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4 border-gray-200/80 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('overviewWeekSessions')}
              </p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">
                {m.planned > 0 ? (
                  <>
                    <span className="text-emerald-600">{m.done}</span>
                    <span className="text-gray-300 mx-1">/</span>
                    <span>{m.planned}</span>
                  </>
                ) : (
                  <span className="text-base font-semibold text-gray-400">—</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {m.planned > 0 ? t('overviewWeekPlannedHint') : t('overviewNoPlanDays')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-gray-200/80 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">{volArrow}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('overviewVolumeVsLast')}
              </p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">
                {hasVolWeekData ? (
                  <>
                    <span>
                      {volDiffRounded > 0 ? '+' : ''}
                      {volDiffRounded}
                    </span>
                    <span className="text-gray-400 text-sm font-normal ml-1">{t('loadUnit')}</span>
                  </>
                ) : (
                  <span className="text-base font-semibold text-gray-400">—</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{volSub}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-gray-200/80 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-800">{trendIcon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('overviewTrendLabel')}
              </p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{trendLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('overviewTrendHint')}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-5 border-gray-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 mt-0.5">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('overviewLatestPr')}
              </p>
              {m.pr ? (
                <>
                  <p className="text-base font-bold text-gray-900 mt-1">
                    {m.pr.exerciseName}
                    <span className="text-gray-400 font-normal mx-2">·</span>
                    <span className="tabular-nums">{m.pr.weight} kg</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(m.pr.date).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-1">{t('overviewNoPr')}</p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
