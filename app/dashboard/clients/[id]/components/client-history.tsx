'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UtensilsCrossed, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import ClientTrainingTracking from '@/app/dashboard/clients/[id]/components/client-training-tracking'
import { getWeekDays, isoDate, MAX_WEEK_OFFSET_BACK } from '@/lib/client-tracking-week'

type Props = { clientId: string }

type NutritionLog = {
  id: string; date: string; confirmed: boolean
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null
}

const TABS = ['Prehrana', 'Trening'] as const
type Tab = typeof TABS[number]


export default function ClientHistory({ clientId }: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.history')
  const tDaysShort = useTranslations('daysShort')
  const [tab, setTab] = useState<Tab>('Prehrana')
  const [nutritionByDate, setNutritionByDate] = useState<Record<string, NutritionLog>>({})
  const [checkinDay, setCheckinDay] = useState<number>(6)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: cfg } = await supabase
        .from('checkin_config')
        .select('checkin_day')
        .eq('client_id', clientId)
        .maybeSingle()
      if (cancelled) return
      if (cfg?.checkin_day != null) setCheckinDay(cfg.checkin_day)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    if (tab !== 'Prehrana') return
    let cancelled = false
    ;(async () => {
      const days = getWeekDays(checkinDay, weekOffset)
      const start = isoDate(days[0])
      const end = isoDate(days[6])
      const { data } = await supabase
        .from('nutrition_logs')
        .select('id, date, confirmed, calories, protein, carbs, fat')
        .eq('client_id', clientId)
        .gte('date', start)
        .lte('date', end)
      if (cancelled) return
      const map: Record<string, NutritionLog> = {}
      data?.forEach(n => {
        map[n.date] = n
      })
      setNutritionByDate(map)
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, weekOffset, checkinDay, tab])

  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })

  if (loading) return <p className="text-sm text-gray-400">{t('loading')}</p>

  const days = getWeekDays(checkinDay, weekOffset)
  const todayIso = isoDate(new Date())

  const nutritionDays = days.map(d => nutritionByDate[isoDate(d)]).filter(Boolean)
  const avg = (f: keyof NutritionLog) => {
    const vals = nutritionDays.filter(l => l[f] != null).map(l => l[f] as number)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  return (
    <>
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
              tab === tabKey ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {tabKey === 'Prehrana' ? <UtensilsCrossed size={14} /> : <Dumbbell size={14} />}
            {tabKey === 'Prehrana' ? t('tabNutrition') : t('tabTraining')}
          </button>
        ))}
      </div>

      {tab === 'Prehrana' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(w => Math.max(w - 1, MAX_WEEK_OFFSET_BACK))}
              disabled={weekOffset <= MAX_WEEK_OFFSET_BACK}
            >
              <ChevronLeft size={14} />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">{fmt(days[0])} — {fmt(days[6])}</p>
              {weekOffset === 0 && <p className="text-xs text-blue-500">{t('thisWeek')}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
              <ChevronRight size={14} />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5 mb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{t('quickJumpWeeks')}</p>
            <div className="flex flex-wrap gap-2">
              {([1, 2, 3] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWeekOffset(-n)}
                  className="text-[11px] px-3 py-1.5 rounded-full font-medium border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                >
                  {n === 1 ? t('weeksAgo1') : n === 2 ? t('weeksAgo2') : t('weeksAgo3')}
                </button>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-[140px]">{t('day')}</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[130px]">{t('calories')}</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[110px]">{t('protein')}</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[110px]">{t('carbs')}</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[100px]">{t('fat')}</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {days.map((day, i) => {
                  const iso = isoDate(day)
                  const log = nutritionByDate[iso]
                  const isToday = iso === todayIso
                  const isCheckinDay = day.getDay() === checkinDay
                  return (
                    <tr key={iso} className={`border-b border-gray-50 last:border-0 ${isToday ? 'bg-blue-50' : i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${log ? 'bg-green-400' : 'bg-gray-200'}`} />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{tDaysShort(String(day.getDay()))}</span>
                              {isCheckinDay && <span className="text-purple-400 text-xs">●</span>}
                            </div>
                            <div className="text-xs text-gray-400">{fmt(day)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.calories != null ? <><span className="font-semibold text-gray-800">{log.calories}</span><span className="text-gray-400 ml-1 text-xs">kcal</span></> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.protein != null ? <><span className="font-semibold text-gray-800">{log.protein}</span><span className="text-gray-400 ml-1 text-xs">g</span></> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.carbs != null ? <><span className="font-semibold text-gray-800">{log.carbs}</span><span className="text-gray-400 ml-1 text-xs">g</span></> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.fat != null ? <><span className="font-semibold text-gray-800">{log.fat}</span><span className="text-gray-400 ml-1 text-xs">g</span></> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {log?.confirmed && <span className="text-green-500 text-xs">✓</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {nutritionDays.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-500">{t('average')}</td>
                    <td className="px-6 py-2.5 text-right text-xs font-semibold text-gray-700">{avg('calories') != null ? <>{avg('calories')} <span className="text-gray-400 font-normal">kcal</span></> : '—'}</td>
                    <td className="px-6 py-2.5 text-right text-xs font-semibold text-gray-700">{avg('protein') != null ? <>{avg('protein')} <span className="text-gray-400 font-normal">g</span></> : '—'}</td>
                    <td className="px-6 py-2.5 text-right text-xs font-semibold text-gray-700">{avg('carbs') != null ? <>{avg('carbs')} <span className="text-gray-400 font-normal">g</span></> : '—'}</td>
                    <td className="px-6 py-2.5 text-right text-xs font-semibold text-gray-700">{avg('fat') != null ? <>{avg('fat')} <span className="text-gray-400 font-normal">g</span></> : '—'}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>
          <p className="text-xs text-gray-400 ml-0.5">{t('checkinDayLegend')}</p>
        </div>
      )}

      {tab === 'Trening' && (
        <ClientTrainingTracking
          clientId={clientId}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          checkinDay={checkinDay}
        />
      )}
    </>
  )
}
