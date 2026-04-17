'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CalendarRange, ChevronRight, Dumbbell } from 'lucide-react'
import { logsForAssignment, TrainingAssignment, TrainingWorkoutLog } from '@/lib/training-metrics'
import { setsWithLoggedData, volumeFromSets } from '@/lib/workout-log-sets'

type Props = {
  assignments: TrainingAssignment[]
  workouts: TrainingWorkoutLog[]
  onSelectLog: (log: TrainingWorkoutLog) => void
}

export default function ClientTrainingPlanHistory({ assignments, workouts, onSelectLog }: Props) {
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
      <Card className="p-8 text-center text-sm text-gray-400 border-dashed">{t('planHistoryEmpty')}</Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{t('planHistoryIntro')}</p>
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
            <Card
              key={a.id}
              className={`overflow-hidden border transition-colors ${
                a.active ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                {a.active && (
                  <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {t('planHistoryActiveBadge')}
                  </span>
                )}
                <span className="font-semibold text-gray-900">{a.workout_plan.name}</span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <CalendarRange className="h-3.5 w-3.5 opacity-70" />
                  {periodLabel}
                </span>
                <span className="text-xs text-gray-400 ml-auto tabular-nums">
                  {t('planHistorySessionCount', { count })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1 text-blue-600"
                  onClick={() => setDetailAssignment(a)}
                >
                  {t('planHistoryOpen')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Sheet open={!!detailAssignment} onOpenChange={open => !open && setDetailAssignment(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {detailAssignment && (
            <>
              <SheetHeader className="mb-4 pr-8 text-left">
                <SheetTitle className="flex items-start gap-2">
                  <Dumbbell className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    {detailAssignment.workout_plan.name}
                    <span className="block text-sm font-normal text-gray-500 mt-1">
                      {t('planHistorySheetSubtitle')}
                    </span>
                  </span>
                </SheetTitle>
              </SheetHeader>
              <ul className="space-y-2">
                {detailLogs.length === 0 && (
                  <li className="text-sm text-gray-400 py-6 text-center">{t('planHistoryNoLogs')}</li>
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
                        className="w-full text-left rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          onSelectLog(log)
                          setDetailAssignment(null)
                        }}
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(log.date).toLocaleDateString(locale, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-gray-500">{log.day_name}</p>
                        {vol > 0 && (
                          <p className="text-xs text-gray-400 mt-1 tabular-nums">
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
