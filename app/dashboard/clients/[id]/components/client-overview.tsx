'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Dumbbell, UtensilsCrossed, MessageSquare, ClipboardCheck,
  ArrowRight, Calendar, Activity, Percent, ClipboardList, Scale,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock, Footprints,
} from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTranslations } from 'next-intl'
import { getCheckinStatus } from '@/lib/checkin-engagement'
import { getWeekDays, isoDate } from '@/lib/client-tracking-week'
import {
  buildPlannedRows,
  countPlannedVsDone,
  type TrainingAssignment,
  type TrainingWorkoutLog,
} from '@/lib/training-metrics'
import { findAssignmentForPlanId } from '@/lib/workout-log-sets'
import { parseNumericCheckinValue, type CheckinParamRow } from '@/lib/checkin-weight-parameter'
import { Button } from '@/components/ui/button'
import EngagementCard from './engagement-card'

type ParamSnapshot = {
  parameterId: string
  name: string
  unit: string
  weekAverage: number | null
  samplesInWeek: number
}

function fmtWeekAvg(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type Props = { clientId: string }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ClientOverview({ clientId }: Props) {
  const router = useRouter()
  const { accent, mode } = useAppTheme()
  const isDark = mode === 'dark'
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const t = useTranslations('clientDetail')
  const tDays = useTranslations('days')
  const tTrack = useTranslations('clients.trainingTracking')
  const tHist = useTranslations('clients.history')

  function fmtRelTime(dateStr: string) {
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    if (diffMins < 60) return t('timeMinutes', { n: diffMins })
    if (diffHours < 24) return t('timeHours', { n: diffHours })
    if (diffDays === 1) return t('timeYesterday')
    if (diffDays < 7) return t('timeDays', { n: diffDays })
    return fmtDate(dateStr.split('T')[0])
  }

  const [loading, setLoading] = useState(true)
  const [lastCheckin, setLastCheckin] = useState<{ date: string; id: string } | null>(null)
  const [activeWorkout, setActiveWorkout] = useState<{ name: string; id: string } | null>(null)
  const [activeMeal, setActiveMeal] = useState<{ name: string; id: string } | null>(null)
  const [lastMessage, setLastMessage] = useState<{ content: string; created_at: string; isTrainer: boolean } | null>(null)
  const [startDate, setStartDate] = useState<string | null>(null)

  const [paramSnapshots, setParamSnapshots] = useState<ParamSnapshot[]>([])
  const [eligibleParams, setEligibleParams] = useState<CheckinParamRow[]>([])
  const [snapshotWorkoutsDone, setSnapshotWorkoutsDone] = useState(0)
  const [snapshotWorkoutsPlanned, setSnapshotWorkoutsPlanned] = useState(0)
  const [snapshotCheckinStatus, setSnapshotCheckinStatus] = useState<'submitted' | 'late' | 'neutral'>('neutral')
  const [checkinDay, setCheckinDay] = useState<number | null>(null)
  const [snapshotAdherence, setSnapshotAdherence] = useState<number | null>(null)
  const [paramSnapIdx, setParamSnapIdx] = useState(0)
  const [stepGoal, setStepGoal] = useState<number | null>(null)
  const [weekStepsAvg, setWeekStepsAvg] = useState<number | null>(null)

  useEffect(() => { fetchOverview() }, [clientId])

  const paramSnapKey = paramSnapshots.map(s => s.parameterId).join('|')
  useEffect(() => { setParamSnapIdx(0) }, [paramSnapKey])

  const fetchOverview = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    const [
      { data: recentCheckins, error: e1 },
      { data: clientRow },
      { data: assignsData },
      { data: meal },
      { data: workoutLogs },
      { data: msgs },
      { data: paramsData },
      { data: dailyLogsData },
    ] = await Promise.all([
      // Reduced limit 120→20: overview only uses last week + most recent entry
      supabase.from('checkins').select('id, date, values').eq('client_id', clientId).order('date', { ascending: false }).limit(20),
      // checkin_config embedded: saves a full round trip (was a separate query)
      supabase.from('clients').select('start_date, step_goal, checkin_config(checkin_day)').eq('id', clientId).maybeSingle(),
      supabase.from('client_workout_plans').select('id, active, assigned_at, ended_at, days, workout_plan:workout_plans(id, name, days)').eq('client_id', clientId).order('assigned_at', { ascending: true }).limit(50),
      supabase.from('client_meal_plans').select('id, active, meal_plan:meal_plans(id, name)').eq('client_id', clientId).eq('active', true).limit(1).maybeSingle(),
      // Removed `exercises` from select (not used in overview) + limit 300→52 (≈1yr of weekly workouts)
      supabase.from('workout_logs').select('id, date, day_name, plan_id').eq('client_id', clientId).order('date', { ascending: false }).limit(52),
      supabase.from('messages').select('content, created_at, sender_id, trainer_id').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('checkin_parameters').select('id, name, type, unit, frequency, order_index, show_in_overview').eq('trainer_id', user.id).order('order_index'),
      // Reduced limit 180→21 (3 weeks of daily logs)
      supabase.from('daily_logs').select('date, values, steps').eq('client_id', clientId).order('date', { ascending: false }).limit(21),
    ])

    if (e1) console.error('client-overview checkins', e1)

    setStartDate(clientRow?.start_date ?? null)
    setStepGoal((clientRow as { step_goal?: number | null } | null)?.step_goal ?? null)

    // Extract checkin_config that was embedded in the clients query (saves a round trip)
    const checkinCfg = (clientRow?.checkin_config as { checkin_day?: number } | null) ?? null

    const assignments = (assignsData as unknown as TrainingAssignment[]) || []
    const workouts = (workoutLogs as unknown as TrainingWorkoutLog[]) || []

    const sorted = [...(recentCheckins || [])].sort((a, b) => b.date.localeCompare(a.date))
    if (sorted[0]) setLastCheckin({ id: sorted[0].id, date: sorted[0].date })

    const params = (paramsData as CheckinParamRow[] | null) ?? []
    const dailyRows = (dailyLogsData as { date: string; values: Record<string, unknown>; steps: number | null }[] | null) ?? []

    const resolvedCheckinDay = checkinCfg?.checkin_day ?? 1
    const weekDaysBounds = getWeekDays(resolvedCheckinDay, 0)
    const weekStartStr = isoDate(weekDaysBounds[0])
    const weekEndStr = isoDate(weekDaysBounds[6])
    const inSnapshotWeek = (dateStr: string) => {
      const d = dateStr.slice(0, 10)
      return d >= weekStartStr && d <= weekEndStr
    }

    const mergedByDate: Record<string, Record<string, unknown>> = {}
    for (const row of dailyRows) {
      if (!inSnapshotWeek(row.date)) continue
      const d = row.date.slice(0, 10)
      mergedByDate[d] = { ...mergedByDate[d], ...(row.values as Record<string, unknown> | undefined) }
    }
    for (const c of sorted) {
      if (!inSnapshotWeek(c.date)) continue
      const d = c.date.slice(0, 10)
      const vals = (c.values as Record<string, unknown> | undefined) || {}
      mergedByDate[d] = { ...mergedByDate[d], ...vals }
    }

    // Steps — average of days with a recorded count within the snapshot week
    const weekStepValues: number[] = []
    for (const row of dailyRows) {
      if (!inSnapshotWeek(row.date)) continue
      if (typeof row.steps === 'number') weekStepValues.push(row.steps)
    }
    setWeekStepsAvg(
      weekStepValues.length > 0
        ? Math.round(weekStepValues.reduce((a, b) => a + b, 0) / weekStepValues.length)
        : null,
    )

    const numericDailyWeekly = params.filter(p => p.type === 'number' && (p.frequency === 'daily' || p.frequency === 'weekly'))
    setEligibleParams(numericDailyWeekly)

    const orderedParamIds = numericDailyWeekly
      .filter(p => p.show_in_overview === true)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .slice(0, 3)
      .map(p => p.id)

    setParamSnapshots(orderedParamIds.map(pid => {
      const p = params.find(x => x.id === pid)
      const nums: number[] = []
      for (const day of Object.keys(mergedByDate).sort()) {
        const v = parseNumericCheckinValue(mergedByDate[day]?.[pid])
        if (v != null) nums.push(v)
      }
      const n = nums.length
      const weekAverage = n > 0 ? nums.reduce((a, b) => a + b, 0) / n : null
      return { parameterId: pid, name: p?.name ?? '—', unit: p?.unit?.trim() ?? '', weekAverage, samplesInWeek: n }
    }))

    const activeAssign = assignments.find(a => a.active)
    if (activeAssign?.workout_plan) setActiveWorkout({ name: activeAssign.workout_plan.name, id: activeAssign.id })
    else setActiveWorkout(null)

    if (meal?.meal_plan) setActiveMeal({ name: (meal.meal_plan as any).name, id: meal.id })
    else setActiveMeal(null)

    if (msgs) setLastMessage({ content: msgs.content, created_at: msgs.created_at, isTrainer: msgs.sender_id === msgs.trainer_id })
    else setLastMessage(null)

    const checkinDayVal = checkinCfg?.checkin_day ?? null
    const lastDate = sorted[0]?.date ?? null
    setCheckinDay(checkinDayVal)
    setSnapshotCheckinStatus(getCheckinStatus(checkinDayVal, lastDate))

    const findPlanName = (planId: string | null) => {
      if (!planId) return tTrack('legacyLogs')
      const a = findAssignmentForPlanId(planId, assignments)
      return a?.workout_plan.name ?? tTrack('unknownPlan')
    }
    const rows = buildPlannedRows(weekStartStr, weekEndStr, assignments, workouts, n => tTrack('dayNumber', { n }), findPlanName, tHist('other'), tTrack('legacyLogs'))
    const { planned, done } = countPlannedVsDone(rows)
    setSnapshotWorkoutsDone(done)
    setSnapshotWorkoutsPlanned(planned)
    setSnapshotAdherence(planned === 0 ? null : Math.round((done / planned) * 100))

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className={`h-20 rounded-2xl animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className={`h-28 rounded-2xl animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1,2].map(i => <div key={i} className={`h-24 rounded-2xl animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
        </div>
      </div>
    )
  }

  const goTrainingTab = () => router.push(`/dashboard/clients/${clientId}?tab=treninzi`)
  const goCheckinTab = () => router.push(`/dashboard/clients/${clientId}?tab=checkin`)
  const goChat = () => router.push(`/dashboard/chat?clientId=${clientId}`)

  const paramSnapSafe = Math.min(paramSnapIdx, Math.max(0, paramSnapshots.length - 1))
  const paramDisplay = paramSnapshots.length > 0 ? paramSnapshots[paramSnapSafe] : null
  const paramNavCount = paramSnapshots.length

  // Check-in status config
  const checkinIsLate = snapshotCheckinStatus === 'late'
  const checkinOk = snapshotCheckinStatus === 'submitted'

  // Card base
  const card = `rounded-2xl border p-4 transition-all ${isDark ? 'border-white/8' : 'border-gray-100 bg-white shadow-sm'}`
  const cardStyle = isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined
  const cardClickable = `${card} cursor-pointer group ${isDark ? 'hover:bg-white/[0.07] hover:border-white/15' : 'hover:shadow-md hover:border-gray-200'}`

  // Icon container
  const iconBox = (color: string, bg: string) =>
    `w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? '' : bg}`

  return (
    <div className="space-y-3">

      {/* ── Status tjedna: horizontalni strip ── */}
      <div className={`rounded-2xl border px-4 py-3 ${isDark ? 'border-white/8' : 'border-gray-100 bg-white shadow-sm'}`} style={cardStyle}>
        <p className={`text-[11px] font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('snapshotSectionTitle')}</p>
        <div className={`grid grid-cols-2 gap-3 ${(stepGoal != null || weekStepsAvg != null) ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'}`}>

          {/* Check-in status */}
          <button type="button" onClick={goCheckinTab}
            className={`rounded-xl px-3 py-2.5 text-left transition-all border ${
              checkinIsLate
                ? isDark ? 'bg-red-500/10 border-red-500/25 hover:bg-red-500/15' : 'bg-red-50 border-red-200 hover:bg-red-100'
                : checkinOk
                  ? isDark ? 'bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  : isDark ? 'bg-white/[0.03] border-white/8 hover:bg-white/8' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}>
            <div className="flex items-center gap-1.5 mb-1">
              {checkinIsLate
                ? <AlertCircle size={12} className="text-red-400" />
                : checkinOk
                  ? <CheckCircle2 size={12} className="text-emerald-400" />
                  : <Clock size={12} className="text-gray-400" />
              }
              <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('snapshotCheckinTitle')}</span>
            </div>
            <p className={`text-base font-bold leading-tight ${
              checkinIsLate ? 'text-red-500' : checkinOk ? 'text-emerald-500' : isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {checkinIsLate ? t('snapshotCheckinLate') : checkinOk ? t('snapshotCheckinSubmitted') : t('snapshotCheckinNeutral')}
            </p>
          </button>

          {/* Treninzi */}
          <button type="button" onClick={goTrainingTab}
            className={`rounded-xl px-3 py-2.5 text-left transition-all border ${isDark ? 'bg-white/[0.03] border-white/8 hover:bg-white/8' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={12} className="text-emerald-400" />
              <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('snapshotWorkoutsTitle')}</span>
            </div>
            {snapshotWorkoutsPlanned > 0 ? (
              <p className={`text-base font-bold leading-tight ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                {snapshotWorkoutsDone}<span className={`text-sm font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/{snapshotWorkoutsPlanned}</span>
              </p>
            ) : (
              <p className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</p>
            )}
          </button>

          {/* Pridržavanje */}
          <button type="button" onClick={goTrainingTab}
            className={`rounded-xl px-3 py-2.5 text-left transition-all border ${isDark ? 'bg-white/[0.03] border-white/8 hover:bg-white/8' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Percent size={12} style={{ color: accentHex }} />
              <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('snapshotAdherenceTitle')}</span>
            </div>
            {snapshotAdherence != null ? (
              <p className="text-base font-bold leading-tight" style={{ color: accentHex }}>{snapshotAdherence}%</p>
            ) : (
              <p className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</p>
            )}
          </button>

          {/* Dan check-ina */}
          {(() => {
            const dayName = checkinDay !== null ? tDays(String(checkinDay)) : null
            return (
              <button type="button" onClick={goCheckinTab}
                className={`rounded-xl px-3 py-2.5 text-left transition-all border ${isDark ? 'bg-white/[0.03] border-white/8 hover:bg-white/8' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar size={12} className="text-teal-400" />
                  <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('engagementCheckinDay')}</span>
                </div>
                <p className={`text-base font-bold leading-tight ${dayName ? (isDark ? 'text-gray-100' : 'text-gray-800') : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>
                  {dayName ?? '—'}
                </p>
              </button>
            )
          })()}

          {/* Koraci */}
          {(stepGoal != null || weekStepsAvg != null) && (() => {
            const reached = stepGoal != null && weekStepsAvg != null && weekStepsAvg >= stepGoal
            return (
              <button type="button" onClick={goCheckinTab}
                className={`rounded-xl px-3 py-2.5 text-left transition-all border ${
                  reached
                    ? isDark ? 'bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                    : isDark ? 'bg-white/[0.03] border-white/8 hover:bg-white/8' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Footprints size={12} className={reached ? 'text-emerald-400' : 'text-indigo-400'} />
                  <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('snapshotStepsTitle')}</span>
                </div>
                {weekStepsAvg != null ? (
                  <p className={`text-base font-bold leading-tight ${reached ? 'text-emerald-500' : isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                    {weekStepsAvg.toLocaleString('hr-HR')}
                    {stepGoal != null && (
                      <span className={`text-sm font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/{stepGoal.toLocaleString('hr-HR')}</span>
                    )}
                  </p>
                ) : (
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {stepGoal != null ? `${t('snapshotStepsNoData')} · ${stepGoal.toLocaleString('hr-HR')}` : t('snapshotStepsNoData')}
                  </p>
                )}
              </button>
            )
          })()}

        </div>
      </div>

      {/* ── Srednji red: Parametri + Zadnji check-in ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Check-in parametri */}
        <div className={`${card} flex flex-col`} style={cardStyle}>
          <button type="button" className={`flex items-center gap-2 mb-3 text-left rounded-lg p-0.5 -m-0.5 transition-colors ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`} onClick={goCheckinTab}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/8' : 'bg-slate-50'}`}>
              <Scale size={14} className={isDark ? 'text-gray-300' : 'text-slate-600'} />
            </div>
            <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('snapshotParamsCardTitle')}</p>
          </button>
          <div className="flex-1 flex items-center gap-0">
            {paramNavCount > 1 && (
              <button type="button" className={`shrink-0 w-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setParamSnapIdx(i => (i - 1 + paramNavCount) % paramNavCount)}>
                <ChevronLeft size={18} />
              </button>
            )}
            <button type="button" className={`flex-1 flex flex-col justify-center items-center text-center rounded-xl py-3 transition-colors ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`} onClick={goCheckinTab}>
              {paramSnapshots.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {eligibleParams.length > 0 ? t('snapshotParamsEmpty') : t('snapshotParamsNoNumeric')}
                </p>
              ) : paramDisplay?.weekAverage != null ? (
                <>
                  <p className={`text-xs mb-1 truncate max-w-full ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {paramDisplay.name}{paramDisplay.unit ? ` · ${paramDisplay.unit}` : ''}
                  </p>
                  <p className={`text-3xl font-extrabold tabular-nums ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {fmtWeekAvg(paramDisplay.weekAverage)}
                    {paramDisplay.unit && <span className={`text-base font-normal ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{paramDisplay.unit}</span>}
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('snapshotParamsWeekAvgCaption')}</p>
                  {paramNavCount > 1 && (
                    <div className="flex gap-1 mt-2">
                      {paramSnapshots.map((_, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === paramSnapSafe ? '' : isDark ? 'bg-white/15' : 'bg-gray-200'}`}
                          style={i === paramSnapSafe ? { backgroundColor: accentHex } : {}} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('snapshotParamsNoValueWeek')}</p>
              )}
            </button>
            {paramNavCount > 1 && (
              <button type="button" className={`shrink-0 w-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setParamSnapIdx(i => (i + 1) % paramNavCount)}>
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Zadnji check-in */}
        <div className={cardClickable} style={cardStyle} onClick={() => router.push(`/dashboard/checkins/${clientId}`)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-teal-500/15' : 'bg-teal-50'}`}>
                <ClipboardCheck size={14} className="text-teal-500" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('lastCheckin')}</p>
            </div>
            <ArrowRight size={14} className={`transition-colors ${isDark ? 'text-white/20 group-hover:text-white/40' : 'text-gray-300 group-hover:text-gray-400'}`} />
          </div>
          {lastCheckin ? (
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-gray-400" />
              <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{fmtDate(lastCheckin.date)}</span>
            </div>
          ) : (
            <>
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('noCheckins')}</p>
              <Button type="button" variant="outline" size="sm" onClick={e => { e.stopPropagation(); goCheckinTab() }}>
                {t('snapshotCtaOpenCheckin')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Donji red: Aktivni planovi + Zadnja poruka ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Aktivni planovi */}
        <div className={card} style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${accentHex}20` }}>
              <Dumbbell size={14} style={{ color: accentHex }} />
            </div>
            <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('activePlans')}</p>
          </div>
          <div className="space-y-1">
            {activeWorkout ? (
              <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer group/row transition-colors ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`}
                onClick={() => router.push(`/dashboard/clients/${clientId}?tab=treninzi`)}>
                <Dumbbell size={12} className="text-gray-400 shrink-0" />
                <span className={`text-sm font-medium truncate flex-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{activeWorkout.name}</span>
                <ArrowRight size={12} className={`shrink-0 transition-colors ${isDark ? 'text-white/20 group-hover/row:text-white/40' : 'text-gray-300 group-hover/row:text-gray-400'}`} />
              </div>
            ) : (
              <p className={`text-xs flex items-center gap-1.5 px-2 py-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Dumbbell size={11} /> {t('noTrainingPlan')}
              </p>
            )}
            {activeMeal ? (
              <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer group/row transition-colors ${isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50'}`}
                onClick={() => router.push(`/dashboard/clients/${clientId}?tab=prehrana`)}>
                <UtensilsCrossed size={12} className="text-gray-400 shrink-0" />
                <span className={`text-sm font-medium truncate flex-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{activeMeal.name}</span>
                <ArrowRight size={12} className={`shrink-0 transition-colors ${isDark ? 'text-white/20 group-hover/row:text-white/40' : 'text-gray-300 group-hover/row:text-gray-400'}`} />
              </div>
            ) : (
              <p className={`text-xs flex items-center gap-1.5 px-2 py-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <UtensilsCrossed size={11} /> {t('noMealPlan')}
              </p>
            )}
            {!activeWorkout && !activeMeal && (
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={goTrainingTab}>{t('snapshotCtaAssignTraining')}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/dashboard/clients/${clientId}?tab=prehrana`)}>{t('snapshotCtaAssignMeal')}</Button>
              </div>
            )}
          </div>
        </div>

        {/* Zadnja poruka */}
        <div className={cardClickable} style={cardStyle} onClick={goChat}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-sky-500/15' : 'bg-sky-50'}`}>
                <MessageSquare size={14} className="text-sky-500" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('lastMessage')}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium transition-colors" style={{ color: accentHex }}>
              {t('openChat')} <ArrowRight size={11} />
            </span>
          </div>
          {lastMessage ? (
            <div className="flex items-start gap-2.5">
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                lastMessage.isTrainer
                  ? isDark ? 'bg-white/8 text-gray-400' : 'bg-gray-100 text-gray-500'
                  : isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-700'
              }`}>
                {lastMessage.isTrainer ? t('senderYou') : t('senderClient')}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{lastMessage.content}</p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{fmtRelTime(lastMessage.created_at)}</p>
              </div>
            </div>
          ) : (
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('noMessages')}</p>
          )}
        </div>

      </div>

      {/* ── Angažman — full card ── */}
      <EngagementCard
        clientId={clientId}
        startDate={startDate}
        isDark={isDark}
        accentHex={accentHex}
      />

    </div>
  )
}
