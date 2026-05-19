'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, ClipboardList, Calendar, Dumbbell } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Period = 'all' | 'month'

type EngagementData = {
  // tjedni check-ini
  weeklyCheckins: number
  weeklyExpected: number
  // dnevni log
  dailyLogs: number
  dailyExpected: number
  // treninzi
  workoutsDone: number
  workoutsExpected: number
  // meta
  periodDays: number
}

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000))
}

function weeksBetween(a: string, b: string) {
  return Math.max(1, Math.round(daysBetween(a, b) / 7))
}

function scoreColor(pct: number) {
  if (pct >= 75) return '#34d399'
  if (pct >= 45) return '#fbbf24'
  return '#fb7185'
}

type MetricRowProps = {
  icon: React.ReactNode
  label: string
  done: number
  total: number
  isDark: boolean
  accentColor?: string
}

function MetricRow({ icon, label, done, total, isDark, accentColor }: MetricRowProps) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const color = accentColor || scoreColor(pct)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{icon}</span>
          <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs tabular-nums font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            {done}<span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/{total}</span>
          </span>
          <span className="text-xs font-bold w-9 text-right" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

type Props = {
  clientId: string
  startDate: string | null
  isDark: boolean
  accentHex: string
}

export default function EngagementCard({ clientId, startDate, isDark, accentHex }: Props) {
  const [period, setPeriod] = useState<Period>('all')
  const [data, setData] = useState<EngagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const t = useTranslations('clientDetail')

  useEffect(() => { load() }, [clientId, period, startDate])

  async function load() {
    setLoading(true)

    const today = isoLocal(new Date())
    const monthStart = isoLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    const effectiveStart = period === 'month'
      ? monthStart
      : (startDate ? startDate.slice(0, 10) : monthStart)

    if (effectiveStart > today) {
      setData({ weeklyCheckins: 0, weeklyExpected: 1, dailyLogs: 0, dailyExpected: 1, workoutsDone: 0, workoutsExpected: 0, periodDays: 0 })
      setLoading(false)
      return
    }

    const [
      { count: ciCount },
      { count: dlCount },
      { data: wlData },
      { data: assignData },
    ] = await Promise.all([
      supabase.from('checkins').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('date', effectiveStart)
        .lte('date', today),
      supabase.from('daily_logs').select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('date', effectiveStart)
        .lte('date', today),
      supabase.from('workout_logs').select('date')
        .eq('client_id', clientId)
        .gte('date', effectiveStart)
        .lte('date', today),
      supabase.from('client_workout_plans')
        .select('id, active, assigned_at, ended_at, days, workout_plan:workout_plans(id, name, days)')
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: true })
        .limit(20),
    ])

    const totalDays = daysBetween(effectiveStart, today) + 1
    const totalWeeks = weeksBetween(effectiveStart, today)

    // Distinct workout dates in period
    const distinctDates = new Set((wlData || []).map((r: any) => r.date.slice(0, 10)))
    const workoutsDone = distinctDates.size

    // Expected workouts = plan days per week × weeks in period
    const assignments = (assignData as any[] | null) ?? []
    let daysPerWeek = 0
    const activeAssign = assignments.find((a: any) => a.active)
    if (activeAssign) {
      const days = activeAssign.days?.length ? activeAssign.days : activeAssign.workout_plan?.days ?? []
      daysPerWeek = Array.isArray(days) ? days.length : 0
    }
    const workoutsExpected = daysPerWeek > 0 ? Math.round(daysPerWeek * totalWeeks) : workoutsDone

    setData({
      weeklyCheckins: ciCount ?? 0,
      weeklyExpected: totalWeeks,
      dailyLogs: dlCount ?? 0,
      dailyExpected: totalDays,
      workoutsDone,
      workoutsExpected: Math.max(workoutsExpected, workoutsDone),
      periodDays: totalDays,
    })
    setLoading(false)
  }

  // Overall score = weighted average of available metrics
  const overallScore = data
    ? (() => {
        const scores: number[] = []
        if (data.weeklyExpected > 0) scores.push(Math.min(100, Math.round((data.weeklyCheckins / data.weeklyExpected) * 100)))
        if (data.dailyExpected > 0) scores.push(Math.min(100, Math.round((data.dailyLogs / data.dailyExpected) * 100)))
        if (data.workoutsExpected > 0) scores.push(Math.min(100, Math.round((data.workoutsDone / data.workoutsExpected) * 100)))
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      })()
    : null

  const pillBase = `text-xs px-2.5 py-1 rounded-full border font-medium transition-colors`
  const pillActive = { backgroundColor: accentHex, color: 'white', borderColor: accentHex }
  const pillInactive = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.06)', color: '#9ca3af', borderColor: 'rgba(255,255,255,0.12)' }
    : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }

  return (
    <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/8 bg-white/[0.04]' : 'border-gray-100 bg-white shadow-sm'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-violet-500/15' : 'bg-violet-50'}`}>
            <TrendingUp size={14} className="text-violet-500" />
          </div>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('consistencyTitle')}</p>
            {data && (
              <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {period === 'month' ? t('engagementThisMonth') : t('engagementDaysSince', { n: data.periodDays })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Period toggle */}
          <div className="flex gap-1">
            <button type="button" className={pillBase}
              style={period === 'all' ? pillActive : pillInactive}
              onClick={() => setPeriod('all')}>
              {t('engagementFromStart')}
            </button>
            <button type="button" className={pillBase}
              style={period === 'month' ? pillActive : pillInactive}
              onClick={() => setPeriod('month')}>
              {t('engagementThisMonth')}
            </button>
          </div>
          {/* Overall score */}
          {overallScore !== null && !loading && (
            <span className="text-lg font-extrabold tabular-nums min-w-[3rem] text-right" style={{ color: scoreColor(overallScore) }}>
              {overallScore}%
            </span>
          )}
        </div>
      </div>

      {/* Progress bar overall */}
      {overallScore !== null && !loading && (
        <div className={`h-1 rounded-full overflow-hidden mb-4 ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${overallScore}%`, backgroundColor: scoreColor(overallScore) }} />
        </div>
      )}

      {/* Metrics */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className={`h-8 rounded animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
        </div>
      ) : data ? (
        <div className="space-y-3">
          <MetricRow
            icon={<ClipboardList size={12} />}
            label={t('engagementWeeklyCheckins')}
            done={data.weeklyCheckins}
            total={data.weeklyExpected}
            isDark={isDark}
          />
          <MetricRow
            icon={<Calendar size={12} />}
            label={t('engagementDailyLog')}
            done={data.dailyLogs}
            total={data.dailyExpected}
            isDark={isDark}
          />
          {data.workoutsExpected > 0 && (
            <MetricRow
              icon={<Dumbbell size={12} />}
              label={t('snapshotWorkoutsTitle')}
              done={data.workoutsDone}
              total={data.workoutsExpected}
              isDark={isDark}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
