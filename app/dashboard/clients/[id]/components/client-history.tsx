'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { UtensilsCrossed, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import ClientTrainingTracking from '@/app/dashboard/clients/[id]/components/client-training-tracking'
import { getWeekDays, isoDate, MAX_WEEK_OFFSET_BACK } from '@/lib/client-tracking-week'
import { useAppTheme } from '@/app/contexts/app-theme'

type Props = { clientId: string }

type NutritionLog = {
  id: string; date: string; confirmed: boolean
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null
}

const TABS = ['Trening', 'Prehrana'] as const
type Tab = typeof TABS[number]


export default function ClientHistory({ clientId }: Props) {
  const locale = useLocale()
  const t = useTranslations('clients.history')
  const tDaysShort = useTranslations('daysShort')
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const [tab, setTab] = useState<Tab>('Trening')
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
    return () => { cancelled = true }
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
      data?.forEach(n => { map[n.date] = n })
      setNutritionByDate(map)
    })()
    return () => { cancelled = true }
  }, [clientId, weekOffset, checkinDay, tab])

  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })

  if (loading) return <p className="text-sm text-gray-400">{t('loading')}</p>

  const days = getWeekDays(checkinDay, weekOffset)
  const todayIso = isoDate(new Date())

  const nutritionDays = days.map(d => nutritionByDate[isoDate(d)]).filter(Boolean)
  const confirmedDays = nutritionDays.filter(l => l.confirmed)
  const avg = (f: keyof NutritionLog) => {
    const vals = confirmedDays.filter(l => l[f] != null).map(l => l[f] as number)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  const tabBorder = isDark ? 'border-white/10' : 'border-gray-200'
  const tabActive = isDark ? 'border-white text-white' : 'border-gray-900 text-gray-900'
  const tabInactive = isDark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600'

  return (
    <>
      {/* Main tab selector: Trening | Prehrana */}
      <div className={`flex border-b ${tabBorder} mb-5`}>
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
              tab === tabKey ? tabActive : tabInactive
            }`}>
            {tabKey === 'Prehrana' ? <UtensilsCrossed size={14} /> : <Dumbbell size={14} />}
            {tabKey === 'Prehrana' ? t('tabNutrition') : t('tabTraining')}
          </button>
        ))}
      </div>

      {/* Keep both panels mounted; only hide inactive to avoid re-fetch on tab switch */}
      <div className={tab === 'Trening' ? '' : 'hidden'}>
        <ClientTrainingTracking
          clientId={clientId}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          checkinDay={checkinDay}
          isDark={isDark}
        />
      </div>

      <div className={tab === 'Prehrana' ? '' : 'hidden'}>
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
                {fmt(days[0])} — {fmt(days[6])}
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

          {/* Table */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-transparent' : 'border-gray-200'}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                  <th className={`text-left px-4 py-2.5 text-xs font-semibold w-[140px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('day')}</th>
                  <th className={`text-right px-6 py-2.5 text-xs font-semibold w-[130px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('calories')}</th>
                  <th className={`text-right px-6 py-2.5 text-xs font-semibold w-[110px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('protein')}</th>
                  <th className={`text-right px-6 py-2.5 text-xs font-semibold w-[110px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('carbs')}</th>
                  <th className={`text-right px-6 py-2.5 text-xs font-semibold w-[100px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('fat')}</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {days.map((day, i) => {
                  const iso = isoDate(day)
                  const log = nutritionByDate[iso]
                  const isToday = iso === todayIso
                  const isCheckinDay = day.getDay() === checkinDay
                  const rowBg = isToday
                    ? isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                    : i % 2 !== 0
                      ? isDark ? '' : 'bg-gray-50/40'
                      : ''
                  return (
                    <tr key={iso} className={`border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-50'} ${rowBg}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${log ? 'bg-green-400' : isDark ? 'bg-white/15' : 'bg-gray-200'}`} />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className={`text-xs font-semibold ${isToday ? 'text-blue-400' : isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                {tDaysShort(String(day.getDay()))}
                              </span>
                              {isCheckinDay && <span className="text-purple-400 text-xs">●</span>}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{fmt(day)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.calories != null
                          ? <><span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{log.calories}</span><span className={`ml-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>kcal</span></>
                          : <span className={`text-xs ${isDark ? 'text-white/15' : 'text-gray-300'}`}>—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.protein != null
                          ? <><span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{log.protein}</span><span className={`ml-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>g</span></>
                          : <span className={`text-xs ${isDark ? 'text-white/15' : 'text-gray-300'}`}>—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.carbs != null
                          ? <><span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{log.carbs}</span><span className={`ml-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>g</span></>
                          : <span className={`text-xs ${isDark ? 'text-white/15' : 'text-gray-300'}`}>—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {log?.fat != null
                          ? <><span className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{log.fat}</span><span className={`ml-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>g</span></>
                          : <span className={`text-xs ${isDark ? 'text-white/15' : 'text-gray-300'}`}>—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {log?.confirmed && <span className="text-green-500 text-xs">✓</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {confirmedDays.length > 0 && (
                <tfoot>
                  <tr className={`border-t-2 ${isDark ? 'border-white/10' : 'border-gray-100 bg-gray-50'}`}>
                    <td className={`px-4 py-2.5 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('average')}
                      <span className={`ml-1 font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>({confirmedDays.length} {t('confirmedDaysCount')})</span>
                    </td>
                    <td className={`px-6 py-2.5 text-right text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {avg('calories') != null ? <>{avg('calories')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>kcal</span></> : '—'}
                    </td>
                    <td className={`px-6 py-2.5 text-right text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {avg('protein') != null ? <>{avg('protein')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>g</span></> : '—'}
                    </td>
                    <td className={`px-6 py-2.5 text-right text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {avg('carbs') != null ? <>{avg('carbs')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>g</span></> : '—'}
                    </td>
                    <td className={`px-6 py-2.5 text-right text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {avg('fat') != null ? <>{avg('fat')} <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>g</span></> : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className={`text-xs ml-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('checkinDayLegend')}</p>
        </div>
      </div>
    </>
  )
}
