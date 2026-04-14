'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar,
} from 'recharts'

type Grouping = 'daily' | 'weekly' | 'monthly'

type Props = { clientId: string }
type Parameter = { id: string; name: string; type: string; unit: string | null; frequency: string }
type DataPoint = { date: string; values: Record<string, any> }
type Range = '7d' | '30d' | '90d' | 'all'

function parseVal(v: any): number {
  if (v === undefined || v === null || v === '') return NaN
  return parseFloat(String(v).replace(',', '.'))
}
function fmt(v: number) { return v % 1 === 0 ? String(v) : v.toFixed(1) }

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function round(n: number, dec = 1) { return Math.round(n * 10 ** dec) / 10 ** dec }

export default function CheckinGraphs({ clientId }: Props) {
  const locale = useLocale()
  const t = useTranslations('checkins.detail.graphs')
  const [params, setParams] = useState<Parameter[]>([])
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('all')
  const [grouping, setGrouping] = useState<Grouping>('daily')

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const [{ data: paramsData }, { data: checkinsData }, { data: dailyData }] = await Promise.all([
      supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('order_index'),
      supabase.from('checkins').select('id, date, values').eq('client_id', clientId).order('date'),
      supabase.from('daily_logs').select('date, values').eq('client_id', clientId).order('date'),
    ])
    if (paramsData) setParams(paramsData)

    // Merge checkins.values + daily_logs into a single date-keyed map
    const merged: Record<string, Record<string, any>> = {}
    dailyData?.forEach(d => { merged[d.date] = { ...merged[d.date], ...d.values } })
    checkinsData?.forEach(c => { merged[c.date] = { ...merged[c.date], ...c.values } })

    setDataPoints(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, values })))
    setLoading(false)
  }

  const numericParams = params.filter(p => p.type === 'number')

  const rangeCutoff: Record<Range, number> = {
    '7d': 7, '30d': 30, '90d': 90, 'all': Infinity,
  }

  const filteredPoints = dataPoints.filter(dp => {
    if (range === 'all') return true
    const days = rangeCutoff[range]
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return new Date(dp.date) >= cutoff
  })

  const getGroupKey = (dateStr: string): string => {
    const d = new Date(dateStr)
    if (grouping === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (grouping === 'weekly') {
      const start = new Date(d)
      start.setDate(d.getDate() - d.getDay() + 1)
      return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    }
    return dateStr
  }

  const getChartData = (paramId: string) => {
    const raw = filteredPoints
      .map(dp => ({ date: dp.date, raw: parseVal(dp.values[paramId]) }))
      .filter(d => !isNaN(d.raw))

    if (grouping === 'daily') {
      return raw.map((d, i, arr) => ({
        date: new Date(d.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
        value: d.raw,
        prev: i > 0 ? arr[i - 1].raw : d.raw,
      }))
    }

    // Group by week or month — average values
    const groups: Record<string, number[]> = {}
    raw.forEach(d => {
      const key = getGroupKey(d.date)
      if (!groups[key]) groups[key] = []
      groups[key].push(d.raw)
    })

    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    const avgs = sorted.map(([, vals]) => round(vals.reduce((s, v) => s + v, 0) / vals.length))

    return sorted.map(([key], i) => ({
      date: grouping === 'monthly'
        ? new Date(key + '-01').toLocaleDateString(locale, { month: 'short', year: '2-digit' })
        : new Date(key).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
      value: avgs[i],
      prev: i > 0 ? avgs[i - 1] : avgs[i],
    }))
  }

  const getStats = (data: { value: number }[]) => {
    if (!data.length) return null
    const vals = data.map(d => d.value)
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      last: vals[vals.length - 1],
      trend: vals[vals.length - 1] - vals[0],
      count: vals.length,
    }
  }

  if (loading) return <p className="text-gray-400 text-sm text-center py-8">{t('loading')}</p>
  if (!numericParams.length) return (
    <div className="text-center py-12 text-gray-400"><p className="text-sm">{t('noNumericParams')}</p></div>
  )

  const rangeLabels: Record<Range, string> = { '7d': '7 dana', '30d': '30 dana', '90d': '3 mj.', 'all': 'Sve' }
  const groupingLabels: Record<Grouping, string> = { daily: 'Dnevno', weekly: 'Tjedno', monthly: 'Mjesečno' }

  return (
    <div className="space-y-4">
    {/* Toolbar */}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1">
        {(['7d', '30d', '90d', 'all'] as Range[]).map(r => (
          <button key={r} type="button" onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
              range === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-gray-500 hover:bg-accent'
            }`}>
            {rangeLabels[r]}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {(['daily', 'weekly', 'monthly'] as Grouping[]).map(g => (
          <button key={g} type="button" onClick={() => setGrouping(g)}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
              grouping === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-gray-500 hover:bg-accent'
            }`}>
            {groupingLabels[g]}
          </button>
        ))}
      </div>
    </div>
    <p className="text-xs text-gray-400">{filteredPoints.length} unosa</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {numericParams.map((param, idx) => {
        const data = getChartData(param.id)
        const stats = getStats(data)
        const color = COLORS[idx % COLORS.length]
        const hasChart = data.length >= 2

        return (
          <Card key={param.id} className="overflow-hidden">
            <div className="p-3">
              {/* Top: name left, value+trend right */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm leading-tight">{param.name}</p>
                  {param.unit && <p className="text-xs text-gray-400">{param.unit}</p>}
                </div>
                {stats && (
                  <div className="text-right">
                    <p className="font-bold text-xl leading-tight" style={{ color }}>
                      {fmt(stats.last)}{param.unit ? ` ${param.unit}` : ''}
                    </p>
                    <p className={`text-xs ${stats.trend > 0 ? 'text-green-500' : stats.trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {stats.trend > 0 ? '↑' : stats.trend < 0 ? '↓' : '→'} {fmt(Math.abs(stats.trend))} ukupno
                    </p>
                  </div>
                )}
              </div>

              {/* Chart */}
              {hasChart ? (
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={data} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`g-${param.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    {stats && <ReferenceLine y={stats.avg} stroke={color} strokeDasharray="3 3" strokeOpacity={0.4} />}
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e5e7eb', padding: '3px 8px' }}
                      formatter={(v: any) => [`${v}${param.unit ? ` ${param.unit}` : ''}`, param.name]}
                    />
                    <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
                      fill={`url(#g-${param.id})`} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : data.length === 1 ? (
                /* Single value — show as big centered stat */
                <div className="h-16 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold" style={{ color }}>{fmt(data[0].value)}{param.unit ? ` ${param.unit}` : ''}</p>
                    <p className="text-xs text-gray-400 mt-1">1 unos · treba još za trend</p>
                  </div>
                </div>
              ) : (
                <div className="h-10 flex items-center">
                  <p className="text-xs text-gray-300">Nema podataka</p>
                </div>
              )}

              {/* Bottom stats strip */}
              {stats && stats.count >= 2 && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 text-xs text-gray-500">
                  <span>min <strong className="text-gray-700">{fmt(stats.min)}</strong></span>
                  <span>avg <strong className="text-gray-700">{fmt(stats.avg)}</strong></span>
                  <span>max <strong className="text-gray-700">{fmt(stats.max)}</strong></span>
                  <span className="text-gray-400">{stats.count} unosa</span>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
    </div>
  )
}
