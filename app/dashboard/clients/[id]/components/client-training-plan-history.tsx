'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CalendarRange, ChevronRight, Dumbbell } from 'lucide-react'
import { logsForAssignment, TrainingAssignment, TrainingWorkoutLog } from '@/lib/training-metrics'
import { setsWithLoggedData, volumeFromSets } from '@/lib/workout-log-sets'

type Props = {
  assignments: TrainingAssignment[]
  workouts: TrainingWorkoutLog[]
  onSelectLog: (log: TrainingWorkoutLog) => void
  isDark: boolean
}

export default function ClientTrainingPlanHistory({ assignments, workouts, onSelectLog, isDark }: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.trainingTracking')
  const [detailAssignment, setDetailAssignment] = useState<TrainingAssignment | null>(null)

  const rows = useMemo(() => {
    return [...assignments]
      .sort((a, b) => b.assigned_at.localeCompare(a.assigned_at))
      .map(a => {
        const logs = logsForAssignment(a, assignments, workouts)
        return { assignment: a, count: logs.length }
      })
  }, [assignments, workouts])

  const detailLogs = useMemo(() => {
    if (!detailAssignment) return []
    return logsForAssignment(detailAssignment, assignments, workouts).sort((a, b) =>
      b.date.localeCompare(a.date),
    )
  }, [detailAssignment, assignments, workouts])

  if (!assignments.length) {
    return (
      <div
        className={`rounded-xl p-8 text-center text-sm ${isDark ? 'text-gray-500' : 'border border-dashed border-gray-200 text-gray-400'}`}
        style={isDark ? { border: '1px dashed rgba(255,255,255,0.14)', background: 'transparent' } : undefined}
      >
        {t('planHistoryEmpty')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('planHistoryIntro')}</p>
      <div className="space-y-2">
        {rows.map(({ assignment: a, count }) => {
          const start = new Date(a.assigned_at)
          const end = a.active ? new Date() : a.ended_at ? new Date(a.ended_at) : start
          const periodLabel = `${start.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })} — ${
            a.active
              ? t('planHistoryActive')
              : end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
          }`
          return (
            <div
              key={a.id}
              className="rounded-xl overflow-hidden transition-colors"
              style={isDark ? {
                background: 'transparent',
                border: `1px solid ${a.active ? 'rgba(52,211,153,0.22)' : 'rgba(255,255,255,0.08)'}`,
              } : {
                background: a.active ? 'rgba(236,253,245,0.4)' : 'white',
                border: `1px solid ${a.active ? 'rgb(167,243,208)' : 'rgb(229,231,235)'}`,
              }}
            >
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                {a.active && (
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    isDark ? 'text-emerald-400 bg-emerald-500/15' : 'text-emerald-800 bg-emerald-100'
                  }`}>
                    {t('planHistoryActiveBadge')}
                  </span>
                )}
                <span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  {a.workout_plan.name}
                </span>
                <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  <CalendarRange className="h-3.5 w-3.5 opacity-70" />
                  {periodLabel}
                </span>
                <span className={`text-xs ml-auto tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('planHistorySessionCount', { count })}
                </span>
                <button
                  type="button"
                  className={`text-xs font-medium flex items-center gap-0.5 px-2 py-1 rounded-md transition-colors ${
                    isDark
                      ? 'text-teal-400 hover:bg-teal-500/10'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={() => setDetailAssignment(a)}
                >
                  {t('planHistoryOpen')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Sheet open={!!detailAssignment} onOpenChange={open => !open && setDetailAssignment(null)}>
        <SheetContent side="right" className={`w-full sm:max-w-lg overflow-y-auto ${isDark ? 'bg-[#0a0a0a] border-white/10' : ''}`}>
          {detailAssignment && (
            <>
              <SheetHeader className="mb-4 pr-8 text-left">
                <SheetTitle className={`flex items-start gap-2 ${isDark ? 'text-gray-100' : ''}`}>
                  <Dumbbell className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    {detailAssignment.workout_plan.name}
                    <span className={`block text-sm font-normal mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {t('planHistorySheetSubtitle')}
                    </span>
                  </span>
                </SheetTitle>
              </SheetHeader>
              <ul className="space-y-2">
                {detailLogs.length === 0 && (
                  <li className={`text-sm py-6 text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    {t('planHistoryNoLogs')}
                  </li>
                )}
                {detailLogs.map(log => {
                  const vol = (log.exercises || []).reduce((acc, ex) => {
                    const cs = setsWithLoggedData(ex.sets as unknown[])
                    return acc + volumeFromSets(cs)
                  }, 0)
                  return (
                    <li key={log.id}>
                      <button
                        type="button"
                        className={`w-full text-left rounded-xl px-4 py-3 transition-colors ${
                          isDark ? '' : 'border border-gray-100 hover:bg-gray-50'
                        }`}
                        style={isDark ? {
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.07)',
                        } : undefined}
                        onMouseEnter={isDark ? e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' } : undefined}
                        onMouseLeave={isDark ? e => { e.currentTarget.style.background = 'transparent' } : undefined}
                        onClick={() => {
                          onSelectLog(log)
                          setDetailAssignment(null)
                        }}
                      >
                        <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                          {new Date(log.date).toLocaleDateString(locale, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{log.day_name}</p>
                        {vol > 0 && (
                          <p className={`text-xs mt-1 tabular-nums ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            {t('planHistoryLoadApprox', { load: Math.round(vol) })}
                          </p>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
