'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ClientWorkoutDetailSheetContent from '@/app/dashboard/clients/[id]/components/client-workout-detail-sheet'
import ClientTrainingProgress from '@/app/dashboard/clients/[id]/components/client-training-progress'
import ClientTrainingPlanHistory from '@/app/dashboard/clients/[id]/components/client-training-plan-history'
import { getWeekDays, isoDate, MAX_WEEK_OFFSET_BACK } from '@/lib/client-tracking-week'
import { buildPlannedRows, logVolume, TrainingAssignment, TrainingWorkoutLog } from '@/lib/training-metrics'
import { findAssignmentForPlanId } from '@/lib/workout-log-sets'

type Props = {
  clientId: string
  weekOffset: number
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>
  checkinDay: number
  isDark: boolean
}

type WorkoutLog = TrainingWorkoutLog

export default function ClientTrainingTracking({
  clientId,
  weekOffset,
  setWeekOffset,
  checkinDay,
  isDark,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.history')
  const tTrack = useTranslations('clients.trainingTracking')
  const [subTab, setSubTab] = useState<'week' | 'analytics' | 'plans'>('week')
  const mountedSubTabsRef = useRef(new Set<string>(['week']))

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
          .order('assigned_at', { ascending: true })
          .limit(50),
        supabase
          .from('workout_logs')
          .select('id, date, day_name, plan_id, exercises')
          .eq('client_id', clientId)
          .order('date', { ascending: false })
          .limit(300),
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

  const subTabBorder = isDark ? 'border-white/10' : 'border-gray-200'
  const subTabActive = isDark ? 'border-white text-white' : 'border-gray-900 text-gray-900'
  const subTabInactive = isDark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600'

  return (
    <div className="space-y-4">
      {/* Sub-tab nav: Tjedan | Pregled | Analitika | Planovi */}
      <div className={`flex flex-wrap border-b ${subTabBorder} gap-0`}>
        {(
          [
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
              subTab === id ? subTabActive : subTabInactive
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(() => { mountedSubTabsRef.current.add(subTab); return null })()}

      {/* TJEDAN — weekly training table */}
      {mountedSubTabsRef.current.has('week') && (
        <div className={subTab === 'week' ? '' : 'hidden'}>
          <div className="space-y-3">
            {/* Week navigator */}
            <div className={`flex items-center justify-between rounded-xl px-3 py-2 border ${isDark ? 'border-white/10 bg-transparent' : 'border-gray-200 bg-gray-50'}`}>
              <Button variant="ghost" size="sm"
                onClick={() => setWeekOffset(w => Math.max(w - 1, MAX_WEEK_OFFSET_BACK))}
                disabled={weekOffset <= MAX_WEEK_OFFSET_BACK}
                className={`h-8 w-8 p-0 ${isDark ? 'text-gray-400 hover:text-gray-100 hover:bg-white/10' : ''}`}>
                <ChevronLeft size={14} />
              </Button>
              <div className="text-center">
                <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                  {fmt(weekDays[0])} — {fmt(weekDays[6])}
                </p>
                {weekOffset === 0
                  ? <p className="text-xs text-teal-400">{t('thisWeek')}</p>
                  : <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{Math.abs(weekOffset) === 1 ? t('weeksAgo1') : Math.abs(weekOffset) === 2 ? t('weeksAgo2') : Math.abs(weekOffset) === 3 ? t('weeksAgo3') : `${Math.abs(weekOffset)}w`}</p>
                }
              </div>
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}
                className={`h-8 w-8 p-0 ${isDark ? 'text-gray-400 hover:text-gray-100 hover:bg-white/10' : ''}`}>
                <ChevronRight size={14} />
              </Button>
            </div>

            {/* Quick jump pills */}
            <div className="flex gap-2">
              {([1, 2, 3] as const).map(n => (
                <button key={n} type="button" onClick={() => setWeekOffset(-n)}
                  className={`text-[11px] px-3 py-1.5 rounded-full font-medium border transition-colors ${
                    weekOffset === -n
                      ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                      : isDark
                        ? 'border-white/15 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/40'
                  }`}>
                  {n === 1 ? t('weeksAgo1') : n === 2 ? t('weeksAgo2') : t('weeksAgo3')}
                </button>
              ))}
            </div>

            {/* Training table */}
            <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-transparent' : 'border-gray-200'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                    <th className={`text-left px-4 py-2.5 text-xs font-semibold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {tTrack('colTrainingDay')}
                    </th>
                    <th className={`text-left px-4 py-2.5 text-xs font-semibold min-w-[120px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {tTrack('colPlan')}
                    </th>
                    <th className={`text-left px-4 py-2.5 text-xs font-semibold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {tTrack('colStatus')}
                    </th>
                    <th className={`text-right px-4 py-2.5 text-xs font-semibold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {tTrack('colLoad')}
                    </th>
                    <th className={`w-24 px-2 py-2.5 text-xs font-semibold text-right ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {tTrack('openDetail')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plannedRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className={`px-4 py-10 text-center text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
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
                    const rowBg = isTodayRow
                      ? isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                      : i % 2 !== 0
                        ? isDark ? '' : 'bg-gray-50/40'
                        : ''
                    return (
                      <tr
                        key={row.key}
                        className={`border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-50'} ${rowBg} ${done ? 'cursor-pointer' : ''}`}
                        onClick={() => { if (done && log) setSheetLog(log) }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-green-400' : isDark ? 'bg-white/15' : 'bg-gray-200'}`} />
                            <div>
                              <p className={`text-xs font-semibold ${isTodayRow ? 'text-blue-400' : isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                {row.trainingDayName}
                              </p>
                              {row.isOrphan && sessionDate && (
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{sessionDate}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-xs max-w-[200px] ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                          <span className="line-clamp-2">{row.planName}</span>
                        </td>
                        <td className="px-4 py-3">
                          {done ? (
                            <span className="text-xs">
                              <span className="text-green-500 font-medium">{tTrack('statusDone')}</span>
                              {sessionDate && (
                                <span className={`ml-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                  ·{' '}
                                  {new Date(sessionDate).toLocaleDateString(locale, {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </span>
                              )}
                              {exCount > 0 && (
                                <span className={`ml-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                  · {tTrack('exerciseCount', { count: exCount })}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
                              {tTrack('statusNotDone')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {vol != null && vol > 0 ? (
                            <span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{vol}</span>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-white/15' : 'text-gray-300'}`}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {done ? (
                            <button
                              type="button"
                              className={`text-xs font-medium ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-blue-600 hover:text-blue-800'}`}
                              onClick={e => { e.stopPropagation(); if (log) setSheetLog(log) }}
                            >
                              {tTrack('openDetail')}
                            </button>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-white/10' : 'text-gray-200'}`}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className={`text-xs ml-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{tTrack('weekHint')}</p>
          </div>
        </div>
      )}

      {mountedSubTabsRef.current.has('analytics') && (
        <div className={subTab === 'analytics' ? '' : 'hidden'}>
          <ClientTrainingProgress clientId={clientId} logs={workouts} isDark={isDark} />
        </div>
      )}

      {mountedSubTabsRef.current.has('plans') && (
        <div className={subTab === 'plans' ? '' : 'hidden'}>
          <ClientTrainingPlanHistory
            assignments={assignments}
            workouts={workouts}
            onSelectLog={setSheetLog}
            isDark={isDark}
          />
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
