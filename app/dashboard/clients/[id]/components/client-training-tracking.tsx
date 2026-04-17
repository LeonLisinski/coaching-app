'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ClientWorkoutDetailSheetContent from '@/app/dashboard/clients/[id]/components/client-workout-detail-sheet'
import ClientTrainingProgress from '@/app/dashboard/clients/[id]/components/client-training-progress'
import ClientTrainingOverview from '@/app/dashboard/clients/[id]/components/client-training-overview'
import ClientTrainingPlanHistory from '@/app/dashboard/clients/[id]/components/client-training-plan-history'
import { getWeekDays, isoDate } from '@/lib/client-tracking-week'
import { buildPlannedRows, logVolume, TrainingAssignment, TrainingWorkoutLog } from '@/lib/training-metrics'
import { findAssignmentForPlanId } from '@/lib/workout-log-sets'

type Props = {
  clientId: string
  weekOffset: number
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>
  checkinDay: number
}

type WorkoutLog = TrainingWorkoutLog

export default function ClientTrainingTracking({
  clientId,
  weekOffset,
  setWeekOffset,
  checkinDay,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.history')
  const tTrack = useTranslations('clients.trainingTracking')
  const [subTab, setSubTab] = useState<'overview' | 'week' | 'analytics' | 'plans'>('overview')

  const [assignments, setAssignments] = useState<TrainingAssignment[]>([])
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetLog, setSheetLog] = useState<WorkoutLog | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: assigns }, { data: w }] = await Promise.all([
        supabase
          .from('client_workout_plans')
          .select('id, active, assigned_at, ended_at, days, workout_plan:workout_plans(id, name, days)')
          .eq('client_id', clientId)
          .order('assigned_at', { ascending: true }),
        supabase
          .from('workout_logs')
          .select('id, date, day_name, plan_id, exercises')
          .eq('client_id', clientId)
          .order('date', { ascending: false })
          .limit(2000),
      ])
      setAssignments((assigns as unknown as TrainingAssignment[]) || [])
      setWorkouts((w as WorkoutLog[]) || [])
      setLoading(false)
    }
    load()
  }, [clientId])

  const weekDays = useMemo(() => getWeekDays(checkinDay, weekOffset), [checkinDay, weekOffset])
  const weekStart = isoDate(weekDays[0])
  const weekEnd = isoDate(weekDays[6])

  const plannedRows = useMemo(() => {
    const findPlanName = (planId: string | null) => {
      if (!planId) return tTrack('legacyLogs')
      const a = findAssignmentForPlanId(planId, assignments)
      return a?.workout_plan.name ?? tTrack('unknownPlan')
    }
    return buildPlannedRows(
      weekStart,
      weekEnd,
      assignments,
      workouts,
      n => tTrack('dayNumber', { n }),
      findPlanName,
      t('other'),
      tTrack('legacyLogs'),
    )
  }, [assignments, workouts, weekStart, weekEnd, tTrack, t])

  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  const todayIso = isoDate(new Date())

  if (loading) return <p className="text-sm text-gray-400">{t('loading')}</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap border-b border-gray-200 gap-0">
        {(
          [
            ['overview', tTrack('subTabOverview')] as const,
            ['week', tTrack('subTabWeek')] as const,
            ['analytics', tTrack('subTabAnalytics')] as const,
            ['plans', tTrack('subTabPlans')] as const,
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <ClientTrainingOverview
          assignments={assignments}
          workouts={workouts}
          checkinDay={checkinDay}
          loading={loading}
        />
      )}

      {subTab === 'analytics' && (
        <ClientTrainingProgress clientId={clientId} logs={workouts} />
      )}

      {subTab === 'plans' && (
        <ClientTrainingPlanHistory
          assignments={assignments}
          workouts={workouts}
          onSelectLog={setSheetLog}
        />
      )}

      {subTab === 'week' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">
                {fmt(weekDays[0])} — {fmt(weekDays[6])}
              </p>
              {weekOffset === 0 && <p className="text-xs text-blue-500">{t('thisWeek')}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
              <ChevronRight size={14} />
            </Button>
          </div>

          <Card className="overflow-hidden border-gray-200/80 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
                    {tTrack('colTrainingDay')}
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 min-w-[120px]">
                    {tTrack('colPlan')}
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">{tTrack('colStatus')}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">{tTrack('colLoad')}</th>
                  <th className="w-24 px-2 py-2.5 text-xs font-semibold text-gray-500 text-right">
                    {tTrack('openDetail')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {plannedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                      {tTrack('emptyWeek')}
                    </td>
                  </tr>
                )}
                {plannedRows.map((row, i) => {
                  const log = row.log
                  const done = !!log
                  const vol = log ? Math.round(logVolume(log)) : null
                  const exCount = log?.exercises?.length ?? 0
                  const sessionDate = log?.date
                  const isTodayRow = sessionDate === todayIso
                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-gray-50 last:border-0 ${
                        isTodayRow ? 'bg-blue-50' : i % 2 !== 0 ? 'bg-gray-50/40' : ''
                      } ${done ? 'cursor-pointer hover:bg-gray-50/80' : ''}`}
                      onClick={() => {
                        if (done && log) setSheetLog(log)
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                          <div>
                            <p className={`text-xs font-semibold ${isTodayRow ? 'text-blue-600' : 'text-gray-800'}`}>
                              {row.trainingDayName}
                            </p>
                            {row.isOrphan && sessionDate && (
                              <p className="text-xs text-gray-400">{sessionDate}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-[200px]">
                        <span className="line-clamp-2">{row.planName}</span>
                      </td>
                      <td className="px-4 py-3">
                        {done ? (
                          <span className="text-xs text-gray-700">
                            <span className="text-green-600 font-medium">{tTrack('statusDone')}</span>
                            {sessionDate && (
                              <span className="text-gray-500 ml-1">
                                ·{' '}
                                {new Date(sessionDate).toLocaleDateString(locale, {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            )}
                            {exCount > 0 && (
                              <span className="text-gray-400 ml-1">
                                · {tTrack('exerciseCount', { count: exCount })}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">{tTrack('statusNotDone')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {vol != null && vol > 0 ? (
                          <span>
                            <span className="font-semibold text-gray-800">{vol}</span>
                            <span className="text-gray-400 ml-1 text-xs">{tTrack('loadUnit')}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {done ? (
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            onClick={e => {
                              e.stopPropagation()
                              if (log) setSheetLog(log)
                            }}
                          >
                            {tTrack('openDetail')}
                          </button>
                        ) : (
                          <span className="text-gray-200 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-gray-400 ml-0.5">{tTrack('weekHint')}</p>
        </div>
      )}

      <Sheet open={!!sheetLog} onOpenChange={open => !open && setSheetLog(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {sheetLog && <ClientWorkoutDetailSheetContent log={sheetLog} allLogs={workouts} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}
