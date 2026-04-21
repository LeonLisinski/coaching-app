'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Dumbbell, UtensilsCrossed, MessageSquare, ClipboardCheck,
  TrendingUp, ArrowRight, Calendar, Activity, Percent, ClipboardList, Scale,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTranslations } from 'next-intl'
import { consistencyScore, getCheckinStatus } from '@/lib/checkin-engagement'
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
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const t = useTranslations('clientDetail')
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
  const [engagementScore, setEngagementScore] = useState<number | null>(null)

  const [paramSnapshots, setParamSnapshots] = useState<ParamSnapshot[]>([])
  const [eligibleParams, setEligibleParams] = useState<CheckinParamRow[]>([])
  const [snapshotWorkoutsDone, setSnapshotWorkoutsDone] = useState(0)
  const [snapshotWorkoutsPlanned, setSnapshotWorkoutsPlanned] = useState(0)
  const [snapshotCheckinStatus, setSnapshotCheckinStatus] = useState<'submitted' | 'late' | 'neutral'>('neutral')
  const [snapshotAdherence, setSnapshotAdherence] = useState<number | null>(null)
  const [paramSnapIdx, setParamSnapIdx] = useState(0)

  useEffect(() => { fetchOverview() }, [clientId])

  const paramSnapKey = paramSnapshots.map(s => s.parameterId).join('|')
  useEffect(() => {
    setParamSnapIdx(0)
  }, [paramSnapKey])

  const fetchOverview = async () => {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      setLoading(false)
      return
    }

    const [
      { data: recentCheckins, error: e1 },
      { count: checkinTotal },
      { data: clientRow },
      { data: checkinCfg },
      { data: assignsData },
      { data: meal },
      { data: workoutLogs },
      { data: msgs },
      { data: paramsData },
      { data: dailyLogsData },
    ] = await Promise.all([
      supabase.from('checkins').select('id, date, values').eq('client_id', clientId).order('date', { ascending: false }).limit(120),
      supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      supabase.from('clients').select('start_date').eq('id', clientId).maybeSingle(),
      supabase.from('checkin_config').select('checkin_day').eq('client_id', clientId).maybeSingle(),
      supabase
        .from('client_workout_plans')
        .select('id, active, assigned_at, ended_at, days, workout_plan:workout_plans(id, name, days)')
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: true }),
      supabase.from('client_meal_plans').select('id, active, meal_plan:meal_plans(id, name)').eq('client_id', clientId).eq('active', true).limit(1).maybeSingle(),
      supabase
        .from('workout_logs')
        .select('id, date, day_name, plan_id, exercises')
        .eq('client_id', clientId)
        .order('date', { ascending: false })
        .limit(2000),
      supabase.from('messages').select('content, created_at, sender_id, trainer_id').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('checkin_parameters').select('id, name, type, unit, frequency, order_index, show_in_overview').eq('trainer_id', user.id).order('order_index'),
      supabase.from('daily_logs').select('date, values').eq('client_id', clientId).order('date', { ascending: false }).limit(500),
    ])

    if (e1) console.error('client-overview checkins', e1)

    const assignments = (assignsData as unknown as TrainingAssignment[]) || []
    const workouts = (workoutLogs as unknown as TrainingWorkoutLog[]) || []

    setEngagementScore(consistencyScore(checkinTotal ?? 0, clientRow?.start_date ?? null))

    const sorted = [...(recentCheckins || [])].sort((a, b) => b.date.localeCompare(a.date))
    if (sorted[0]) setLastCheckin({ id: sorted[0].id, date: sorted[0].date })

    const params = (paramsData as CheckinParamRow[] | null) ?? []
    const dailyRows = (dailyLogsData as { date: string; values: Record<string, unknown> }[] | null) ?? []

    // Isti default kao Check-in pregled (checkin-overview): nedostajući dan → ponedjeljak
    const resolvedCheckinDay = checkinCfg?.checkin_day ?? 1
    const weekDaysBounds = getWeekDays(resolvedCheckinDay, 0)
    const weekStartStr = isoDate(weekDaysBounds[0])
    const weekEndStr = isoDate(weekDaysBounds[6])
    const inSnapshotWeek = (dateStr: string) => {
      const d = dateStr.slice(0, 10)
      return d >= weekStartStr && d <= weekEndStr
    }

    // Jedan zapis po datumu: daily_logs + checkins (isto kao grafovi) — inače daily vrijednosti iz check-ina ne ulaze
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

    const numericDailyWeekly = params.filter(
      p => p.type === 'number' && (p.frequency === 'daily' || p.frequency === 'weekly'),
    )
    setEligibleParams(numericDailyWeekly)

    const orderedParamIds = numericDailyWeekly
      .filter(p => p.show_in_overview === true)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .slice(0, 3)
      .map(p => p.id)
    setParamSnapshots(
      orderedParamIds.map(pid => {
        const p = params.find(x => x.id === pid)
        const nums: number[] = []
        for (const day of Object.keys(mergedByDate).sort()) {
          const v = parseNumericCheckinValue(mergedByDate[day]?.[pid])
          if (v != null) nums.push(v)
        }
        const n = nums.length
        const weekAverage = n > 0 ? nums.reduce((a, b) => a + b, 0) / n : null
        return {
          parameterId: pid,
          name: p?.name ?? '—',
          unit: p?.unit?.trim() ?? '',
          weekAverage,
          samplesInWeek: n,
        }
      }),
    )

    const activeAssign = assignments.find(a => a.active)
    if (activeAssign?.workout_plan) setActiveWorkout({ name: activeAssign.workout_plan.name, id: activeAssign.id })
    else setActiveWorkout(null)

    if (meal?.meal_plan) setActiveMeal({ name: (meal.meal_plan as any).name, id: meal.id })
    else setActiveMeal(null)

    if (msgs) setLastMessage({ content: msgs.content, created_at: msgs.created_at, isTrainer: msgs.sender_id === msgs.trainer_id })
    else setLastMessage(null)

    const checkinDay = checkinCfg?.checkin_day ?? null
    const lastDate = sorted[0]?.date ?? null
    setSnapshotCheckinStatus(getCheckinStatus(checkinDay, lastDate))

    const weekStart = weekStartStr
    const weekEnd = weekEndStr

    const findPlanName = (planId: string | null) => {
      if (!planId) return tTrack('legacyLogs')
      const a = findAssignmentForPlanId(planId, assignments)
      return a?.workout_plan.name ?? tTrack('unknownPlan')
    }

    const rows = buildPlannedRows(
      weekStart,
      weekEnd,
      assignments,
      workouts,
      n => tTrack('dayNumber', { n }),
      findPlanName,
      tHist('other'),
      tTrack('legacyLogs'),
    )
    const { planned, done } = countPlannedVsDone(rows)
    setSnapshotWorkoutsDone(done)
    setSnapshotWorkoutsPlanned(planned)
    setSnapshotAdherence(planned === 0 ? null : Math.round((done / planned) * 100))

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const goTrainingTab = () => router.push(`/dashboard/clients/${clientId}?tab=treninzi`)
  const goCheckinTab = () => router.push(`/dashboard/clients/${clientId}?tab=checkin`)
  const goChat = () => router.push(`/dashboard/chat?clientId=${clientId}`)

  const checkinLabel =
    snapshotCheckinStatus === 'submitted' ? t('snapshotCheckinSubmitted')
      : snapshotCheckinStatus === 'late' ? t('snapshotCheckinLate')
        : t('snapshotCheckinNeutral')

  const paramSnapSafe = Math.min(paramSnapIdx, Math.max(0, paramSnapshots.length - 1))
  const paramDisplay = paramSnapshots.length > 0 ? paramSnapshots[paramSnapSafe] : null
  const paramNavCount = paramSnapshots.length

  const snapCard =
    'bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col min-h-[140px] cursor-pointer transition-all hover:shadow-md hover:border-gray-200'

  return (
    <div className="space-y-6">
      {/* Weekly snapshot — sve iz jednog Promise.all */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{t('snapshotSectionTitle')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className={`${snapCard} text-left w-full flex flex-col`}>
            <button
              type="button"
              className="flex items-center gap-2 mb-2 shrink-0 w-full text-left rounded-lg -m-1 p-1 hover:bg-gray-50/80 transition-colors"
              onClick={goCheckinTab}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-50">
                <Scale size={14} className="text-slate-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{t('snapshotParamsCardTitle')}</p>
            </button>
            <div className="flex-1 flex items-stretch gap-0 min-h-[88px]">
              {paramNavCount > 1 ? (
                <button
                  type="button"
                  className="shrink-0 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 -ml-1 self-center"
                  aria-label={t('snapshotParamsPrevAria')}
                  onClick={() => setParamSnapIdx(i => (i - 1 + paramNavCount) % paramNavCount)}
                >
                  <ChevronLeft size={20} strokeWidth={2} />
                </button>
              ) : null}
              <button
                type="button"
                className="flex-1 flex flex-col justify-center items-center text-center min-w-0 px-0.5 rounded-xl -my-1 py-1 hover:bg-gray-50/80 transition-colors cursor-pointer"
                onClick={goCheckinTab}
              >
                {paramSnapshots.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    {eligibleParams.length > 0 ? t('snapshotParamsEmpty') : t('snapshotParamsNoNumeric')}
                  </p>
                ) : paramDisplay?.weekAverage != null ? (
                  <>
                    <p className="text-xs text-gray-500 mb-1 truncate max-w-full">
                      {paramDisplay.name}{paramDisplay.unit ? ` · ${paramDisplay.unit}` : ''}
                    </p>
                    <p className="text-2xl font-extrabold tabular-nums text-gray-900">
                      {fmtWeekAvg(paramDisplay.weekAverage)}
                      {paramDisplay.unit ? ` ${paramDisplay.unit}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{t('snapshotParamsWeekAvgCaption')}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">{t('snapshotParamsNoValueWeek')}</p>
                )}
              </button>
              {paramNavCount > 1 ? (
                <button
                  type="button"
                  className="shrink-0 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 -mr-1 self-center"
                  aria-label={t('snapshotParamsNextAria')}
                  onClick={() => setParamSnapIdx(i => (i + 1) % paramNavCount)}
                >
                  <ChevronRight size={20} strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>

          <button type="button" className={`${snapCard} text-left w-full`} onClick={goTrainingTab}>
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50">
                <Activity size={14} className="text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{t('snapshotWorkoutsTitle')}</p>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center text-center min-h-[88px]">
              {snapshotWorkoutsPlanned > 0 ? (
                <>
                  <p className="text-2xl font-extrabold tabular-nums text-gray-900">
                    {t('snapshotWorkoutsRatio', { done: snapshotWorkoutsDone, planned: snapshotWorkoutsPlanned })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{t('snapshotWorkoutsHint')}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">{t('snapshotEmptyWorkouts')}</p>
              )}
            </div>
          </button>

          <button type="button" className={`${snapCard} text-left w-full`} onClick={goCheckinTab}>
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-50">
                <ClipboardList size={14} className="text-teal-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{t('snapshotCheckinTitle')}</p>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center text-center min-h-[88px]">
              <p
                className={`text-2xl font-extrabold ${
                  snapshotCheckinStatus === 'late'
                    ? 'text-rose-600'
                    : snapshotCheckinStatus === 'submitted'
                      ? 'text-emerald-600'
                      : 'text-gray-600'
                }`}
              >
                {checkinLabel}
              </p>
            </div>
          </button>

          <button type="button" className={`${snapCard} text-left w-full`} onClick={goTrainingTab}>
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-50">
                <Percent size={14} className="text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{t('snapshotAdherenceTitle')}</p>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center text-center min-h-[88px]">
              {snapshotAdherence != null ? (
                <>
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: accentHex }}>
                    {t('snapshotAdherenceValue', { n: snapshotAdherence })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('snapshotWorkoutsRatio', { done: snapshotWorkoutsDone, planned: snapshotWorkoutsPlanned })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">{t('snapshotEmptyAdherence')}</p>
              )}
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Last check-in — full card click */}
        <div
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer group transition-all hover:shadow-md hover:border-gray-200"
          onClick={() => router.push(`/dashboard/checkins/${clientId}`)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-50">
                <ClipboardCheck size={14} className="text-teal-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{t('lastCheckin')}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
          {lastCheckin ? (
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-gray-400" />
              <span className="text-sm text-gray-700 font-medium">{fmtDate(lastCheckin.date)}</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">{t('noCheckins')}</p>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={e => { e.stopPropagation(); goCheckinTab() }}>
                {t('snapshotCtaOpenCheckin')}
              </Button>
            </>
          )}
        </div>

        {/* Consistency / engagement score */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-50">
                <TrendingUp size={14} className="text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t('consistencyTitle')}</p>
                <p className="text-[11px] text-gray-400 leading-snug">{t('consistencyHint')}</p>
              </div>
            </div>
            {engagementScore !== null && (
              <span className="text-lg font-extrabold tabular-nums" style={{ color: accentHex }}>{engagementScore}%</span>
            )}
          </div>
          {engagementScore !== null && (
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${engagementScore}%`,
                  backgroundColor: engagementScore >= 70 ? '#34d399' : engagementScore >= 40 ? '#fbbf24' : '#fb7185',
                }}
              />
            </div>
          )}
        </div>

        {/* Active plans — each plan row is clickable */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15` }}>
              <Dumbbell size={14} style={{ color: accentHex }} />
            </div>
            <p className="text-sm font-semibold text-gray-900">{t('activePlans')}</p>
          </div>
          <div className="space-y-1.5">
            {activeWorkout ? (
              <div
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer group/row hover:bg-gray-50 transition-colors"
                onClick={() => router.push(`/dashboard/clients/${clientId}?tab=treninzi`)}
              >
                <Dumbbell size={12} className="text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate flex-1">{activeWorkout.name}</span>
                <ArrowRight size={12} className="text-gray-300 group-hover/row:text-gray-400 shrink-0 transition-colors" />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 flex items-center gap-1.5 px-2 py-1">
                  <Dumbbell size={11} /> {t('noTrainingPlan')}
                </p>
                <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={goTrainingTab}>
                  {t('snapshotCtaAssignTraining')}
                </Button>
              </div>
            )}
            {activeMeal ? (
              <div
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer group/row hover:bg-gray-50 transition-colors"
                onClick={() => router.push(`/dashboard/clients/${clientId}?tab=prehrana`)}
              >
                <UtensilsCrossed size={12} className="text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate flex-1">{activeMeal.name}</span>
                <ArrowRight size={12} className="text-gray-300 group-hover/row:text-gray-400 shrink-0 transition-colors" />
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-gray-400 flex items-center gap-1.5 px-2 py-1">
                  <UtensilsCrossed size={11} /> {t('noMealPlan')}
                </p>
                <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => router.push(`/dashboard/clients/${clientId}?tab=prehrana`)}>
                  {t('snapshotCtaAssignMeal')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Last message */}
        <div
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer group transition-all hover:shadow-md hover:border-gray-200"
          onClick={goChat}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-50">
                <MessageSquare size={14} className="text-sky-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{t('lastMessage')}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium transition-colors" style={{ color: accentHex }}>
              {t('openChat')} <ArrowRight size={11} />
            </span>
          </div>
          {lastMessage ? (
            <div className="flex items-start gap-3">
              <div className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                lastMessage.isTrainer ? 'bg-gray-100 text-gray-500' : 'bg-sky-100 text-sky-700'
              }`}>
                {lastMessage.isTrainer ? t('senderYou') : t('senderClient')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{lastMessage.content}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{fmtRelTime(lastMessage.created_at)}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">{t('noMessages')}</p>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={e => { e.stopPropagation(); goChat() }}>
                {t('snapshotCtaChat')}
              </Button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
