'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Award, BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { setsWithLoggedData, volumeFromSets } from '@/lib/workout-log-sets'
import {
  exerciseProgressRows,
  exerciseSessionSeries,
  logSeriesNameForExerciseId,
  mondayKeyOfDateStr,
  TrainingWorkoutLog,
} from '@/lib/training-metrics'

type WorkoutLog = TrainingWorkoutLog

function volSession(ex: WorkoutLog['exercises'][0]) {
  return volumeFromSets(setsWithLoggedData(ex.sets as unknown[]))
}

function logVolume(log: WorkoutLog) {
  return (log.exercises || []).reduce((acc, ex) => acc + volSession(ex), 0)
}

type TrackedRow = { exercise_id: string; name: string; sort_order: number }

type Props = {
  clientId: string
  /** When set, skip fetching and use shared data from parent (Tracking tab). */
  logs?: WorkoutLog[]
}

/** ~7 rows visible (text-sm + py-3 per row). */
const TABLE_BODY_SCROLL = 'max-h-[21rem] overflow-auto overscroll-contain'

type PrSortKey = 'name' | 'bestWeight' | 'bestDate' | 'sessions'
type ProgSortKey = 'name' | 'improvement' | 'lastMax' | 'sessions'

function SortCol({
  label,
  active,
  direction,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-medium text-gray-600 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 hover:text-gray-900 ${align === 'right' ? 'justify-end' : 'justify-start'} w-full`}
      >
        <span>{label}</span>
        {active &&
          (direction === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
          ))}
      </button>
    </th>
  )
}

const CHART_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#d97706',
  '#db2777',
  '#0d9488',
  '#dc2626',
  '#4f46e5',
  '#ca8a04',
  '#64748b',
]

export default function ClientTrainingProgress({ clientId, logs: logsProp }: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.trainingProgress')
  const [logsFetched, setLogsFetched] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(logsProp === undefined)
  const [trackedRows, setTrackedRows] = useState<TrackedRow[]>([])
  const [trackedLoading, setTrackedLoading] = useState(true)
  const [prFilter, setPrFilter] = useState('')
  const [prSortKey, setPrSortKey] = useState<PrSortKey>('bestWeight')
  const [prSortDir, setPrSortDir] = useState<'asc' | 'desc'>('desc')
  const [progFilter, setProgFilter] = useState('')
  const [progSortKey, setProgSortKey] = useState<ProgSortKey>('improvement')
  const [progSortDir, setProgSortDir] = useState<'asc' | 'desc'>('desc')

  const embedded = logsProp !== undefined
  const logs = embedded ? logsProp : logsFetched

  useEffect(() => {
    if (embedded) return
    const load = async () => {
      setLoading(true)
      const { data: w } = await supabase
        .from('workout_logs')
        .select('id, date, day_name, plan_id, exercises')
        .eq('client_id', clientId)
        .order('date', { ascending: true })
        .limit(2000)
      setLogsFetched((w as WorkoutLog[]) || [])
      setLoading(false)
    }
    load()
  }, [clientId, embedded])

  useEffect(() => {
    const loadTracked = async () => {
      setTrackedLoading(true)
      const { data: rows, error } = await supabase
        .from('client_tracked_exercises')
        .select('exercise_id, sort_order')
        .eq('client_id', clientId)
        .order('sort_order', { ascending: true })
      if (error || !rows?.length) {
        setTrackedRows([])
        setTrackedLoading(false)
        return
      }
      const ids = rows.map(r => r.exercise_id)
      const { data: exRows } = await supabase.from('exercises').select('id, name').in('id', ids)
      const nameById = new Map((exRows || []).map(e => [e.id, e.name]))
      setTrackedRows(
        rows.map(r => ({
          exercise_id: r.exercise_id,
          sort_order: r.sort_order ?? 0,
          name: String(nameById.get(r.exercise_id) ?? ''),
        })),
      )
      setTrackedLoading(false)
    }
    loadTracked()
  }, [clientId])

  const byExercise = useMemo(() => {
    const map = new Map<string, { sessions: { date: string; maxW: number; vol: number }[] }>()
    logs.forEach(log => {
      log.exercises?.forEach(ex => {
        const cs = setsWithLoggedData(ex.sets as unknown[])
        if (!cs.length) return
        const maxW = Math.max(...cs.map(s => s.weight))
        const vol = volSession(ex)
        if (!map.has(ex.name)) map.set(ex.name, { sessions: [] })
        map.get(ex.name)!.sessions.push({ date: log.date, maxW, vol })
      })
    })
    map.forEach(v => v.sessions.sort((a, b) => a.date.localeCompare(b.date)))
    return map
  }, [logs])

  const exerciseSeriesData = useMemo(() => {
    const series = exerciseSessionSeries(logs)
    return trackedRows.map((row, idx) => {
      const seriesName = logSeriesNameForExerciseId(logs, row.exercise_id, row.name)
      const pts = series.get(seriesName) || []
      return {
        key: row.exercise_id,
        name: seriesName || row.name,
        color: CHART_COLORS[idx % CHART_COLORS.length],
        data: pts.map(p => ({
          date: p.date.slice(0, 10),
          label: new Date(p.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
          maxW: p.maxW,
        })),
      }
    })
  }, [logs, trackedRows, locale])

  const weeklyVolumeLine = useMemo(() => {
    const m = new Map<string, number>()
    logs.forEach(log => {
      const k = mondayKeyOfDateStr(log.date)
      m.set(k, (m.get(k) || 0) + logVolume(log))
    })
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-16)
      .map(([weekStart, vol]) => ({
        weekStart,
        label: new Date(weekStart).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        volume: Math.round(vol),
      }))
  }, [logs, locale])

  const lastTwoWeeks = useMemo(() => {
    if (weeklyVolumeLine.length < 2) return null
    const a = weeklyVolumeLine[weeklyVolumeLine.length - 2]
    const b = weeklyVolumeLine[weeklyVolumeLine.length - 1]
    const pct = a.volume > 0 ? Math.round(((b.volume - a.volume) / a.volume) * 100) : null
    return { a, b, pct }
  }, [weeklyVolumeLine])

  const prTableData = useMemo(() => {
    return [...byExercise.entries()]
      .map(([name, { sessions }]) => {
        if (!sessions.length) return null
        const best = sessions.reduce((m, s) => (s.maxW > m.maxW ? s : m), sessions[0])
        return { name, bestWeight: best.maxW, bestDate: best.date, count: sessions.length }
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
  }, [byExercise])

  const prRows = useMemo(() => {
    const q = prFilter.trim().toLowerCase()
    const rows = prTableData.filter(r => !q || r.name.toLowerCase().includes(q))
    const dir = prSortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      switch (prSortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        case 'bestWeight':
          return dir * (a.bestWeight - b.bestWeight)
        case 'bestDate':
          return dir * a.bestDate.localeCompare(b.bestDate)
        case 'sessions':
          return dir * (a.count - b.count)
        default:
          return 0
      }
    })
  }, [prTableData, prFilter, prSortKey, prSortDir])

  const progressRowsRaw = useMemo(() => exerciseProgressRows(logs), [logs])

  const progressRows = useMemo(() => {
    const q = progFilter.trim().toLowerCase()
    const rows = progressRowsRaw.filter(r => !q || r.name.toLowerCase().includes(q))
    const dir = progSortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      switch (progSortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        case 'improvement':
          return dir * (a.improvement - b.improvement)
        case 'lastMax':
          return dir * (a.lastMax - b.lastMax)
        case 'sessions':
          return dir * (a.sessionCount - b.sessionCount)
        default:
          return 0
      }
    })
  }, [progressRowsRaw, progFilter, progSortKey, progSortDir])

  const cyclePrSort = useCallback((key: PrSortKey) => {
    if (prSortKey === key) {
      setPrSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setPrSortKey(key)
      setPrSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }, [prSortKey])

  const cycleProgSort = useCallback((key: ProgSortKey) => {
    if (progSortKey === key) {
      setProgSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setProgSortKey(key)
      setProgSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }, [progSortKey])

  if (loading) return <p className="text-sm text-gray-400">{t('loading')}</p>

  if (!logs.length) {
    return <Card className="p-10 text-center text-sm text-gray-400 border-dashed">{t('empty')}</Card>
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 border-gray-200/80 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-600" />
            {t('weeklyVolumeLineTitle')}
          </h3>
          {lastTwoWeeks && lastTwoWeeks.pct != null && (
            <p className="text-xs text-gray-500">
              {t('weeklyVolumeCompare', {
                prev: lastTwoWeeks.a.volume,
                curr: lastTwoWeeks.b.volume,
                pct: lastTwoWeeks.pct,
              })}
            </p>
          )}
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyVolumeLine} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8 }}
                formatter={(v: number | undefined) => [String(v ?? 0), t('loadLabel')]}
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="px-0.5">
          <h3 className="text-sm font-semibold text-gray-900">{t('exerciseLinesTitle')}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('exerciseLinesSubtitle')}</p>
        </div>

        {trackedLoading ? (
          <p className="text-sm text-gray-400">{t('trackedLoading')}</p>
        ) : trackedRows.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-gray-200 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-800">{t('graphsNoTrackedTitle')}</p>
            <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">{t('graphsNoTrackedHint')}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {exerciseSeriesData.map(ex => (
              <Card key={ex.key} className="p-4 border-gray-200/80 shadow-sm">
                <p className="text-xs font-semibold text-gray-700 mb-2 truncate">{ex.name}</p>
                <div className="h-44 w-full">
                  {ex.data.length === 0 ? (
                    <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3">
                      <p className="text-xs text-gray-400 text-center">{t('graphNoDataYet')}</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ex.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9 }} width={36} />
                        <Tooltip
                          formatter={(v: number | undefined) => [`${v?.toFixed(1) ?? 0} kg`, t('maxWeight')]}
                          labelFormatter={(_, payload) => {
                            const p = payload?.[0]?.payload as { date?: string } | undefined
                            return p?.date ? String(p.date) : ''
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="maxW"
                          stroke={ex.color}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="overflow-hidden border-gray-200/80 shadow-sm">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-600" />
            {t('prsTitle')}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{t('prsSubtitle')}</p>
        </div>
        <div className="px-4 pt-3 pb-2 space-y-1.5 border-b border-gray-100 bg-white">
          <Input
            value={prFilter}
            onChange={e => setPrFilter(e.target.value)}
            placeholder={t('tableFilterPlaceholder')}
            className="h-8 text-sm max-w-sm"
          />
          <p className="text-[11px] text-gray-400">{t('tableScrollHint')}</p>
        </div>
        {prRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 px-4">
            {prTableData.length === 0 ? t('tableEmptyData') : t('tableNoFilterResults')}
          </p>
        ) : (
          <div className={`${TABLE_BODY_SCROLL} border-b border-gray-100`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-gray-50 shadow-[0_1px_0_0_rgb(243_244_246)]">
                <tr>
                  <SortCol
                    label={t('colExercise')}
                    active={prSortKey === 'name'}
                    direction={prSortDir}
                    onClick={() => cyclePrSort('name')}
                  />
                  <SortCol
                    label={t('colPR')}
                    align="right"
                    active={prSortKey === 'bestWeight'}
                    direction={prSortDir}
                    onClick={() => cyclePrSort('bestWeight')}
                  />
                  <SortCol
                    label={t('colPrDate')}
                    align="right"
                    active={prSortKey === 'bestDate'}
                    direction={prSortDir}
                    onClick={() => cyclePrSort('bestDate')}
                  />
                  <SortCol
                    label={t('colSessions')}
                    align="right"
                    active={prSortKey === 'sessions'}
                    direction={prSortDir}
                    onClick={() => cyclePrSort('sessions')}
                  />
                </tr>
              </thead>
              <tbody>
                {prRows.map(row => (
                  <tr key={row.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 tabular-nums text-right">{row.bestWeight.toFixed(1)} kg</td>
                    <td className="px-4 py-3 text-gray-500 text-xs text-right">
                      {new Date(row.bestDate).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden border-gray-200/80 shadow-sm">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">{t('progressTableTitle')}</h3>
          <p className="text-xs text-gray-500 mt-1">{t('progressTableSubtitle')}</p>
        </div>
        <div className="px-4 pt-3 pb-2 space-y-1.5 border-b border-gray-100 bg-white">
          <Input
            value={progFilter}
            onChange={e => setProgFilter(e.target.value)}
            placeholder={t('tableFilterPlaceholder')}
            className="h-8 text-sm max-w-sm"
          />
          <p className="text-[11px] text-gray-400">{t('tableScrollHint')}</p>
        </div>
        {progressRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 px-4">
            {progressRowsRaw.length === 0 ? t('tableEmptyData') : t('tableNoFilterResults')}
          </p>
        ) : (
          <div className={`${TABLE_BODY_SCROLL} border-b border-gray-100`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-gray-50 shadow-[0_1px_0_0_rgb(243_244_246)]">
                <tr>
                  <SortCol
                    label={t('colExercise')}
                    active={progSortKey === 'name'}
                    direction={progSortDir}
                    onClick={() => cycleProgSort('name')}
                  />
                  <SortCol
                    label={t('colProgressDelta')}
                    align="right"
                    active={progSortKey === 'improvement'}
                    direction={progSortDir}
                    onClick={() => cycleProgSort('improvement')}
                  />
                  <SortCol
                    label={t('colFirstVsLast')}
                    align="right"
                    active={progSortKey === 'lastMax'}
                    direction={progSortDir}
                    onClick={() => cycleProgSort('lastMax')}
                  />
                  <SortCol
                    label={t('colSessions')}
                    align="right"
                    active={progSortKey === 'sessions'}
                    direction={progSortDir}
                    onClick={() => cycleProgSort('sessions')}
                  />
                </tr>
              </thead>
              <tbody>
                {progressRows.map(row => {
                  const stagnant = row.status === 'flat'
                  return (
                    <tr
                      key={row.name}
                      className={`border-b border-gray-50 last:border-0 ${
                        stagnant ? 'bg-gray-50/80 text-gray-500' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <td className={`px-4 py-3 font-medium ${stagnant ? 'text-gray-500' : 'text-gray-800'}`}>
                        {row.name}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-right">
                        <span
                          className={
                            row.status === 'up'
                              ? 'text-emerald-600 font-semibold'
                              : row.status === 'down'
                                ? 'text-rose-600 font-semibold'
                                : 'text-gray-400'
                          }
                        >
                          {row.improvement > 0 ? '+' : ''}
                          {row.improvement.toFixed(1)} kg
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs text-right">
                        {row.firstMax.toFixed(1)} → {row.lastMax.toFixed(1)} kg
                      </td>
                      <td className="px-4 py-3 text-right">{row.sessionCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
