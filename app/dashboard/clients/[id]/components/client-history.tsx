'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dumbbell, UtensilsCrossed, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useLocale } from 'next-intl'

type Props = { clientId: string }
type WorkoutLog = {
  id: string; date: string; day_name: string
  exercises: { name: string; exercise_id: string; sets: { reps: string; weight: string; completed: boolean; set_number: number }[] }[]
}
type NutritionLog = {
  id: string; date: string; confirmed: boolean
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null
}

const TABS = ['Prehrana', 'Trening'] as const
type Tab = typeof TABS[number]

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function getWeekDays(checkinDay: number, weekOffset: number): Date[] {
  const today = new Date()
  const daysUntil = (checkinDay - today.getDay() + 7) % 7
  const baseEnd = new Date(today)
  baseEnd.setDate(today.getDate() + daysUntil + weekOffset * 7)
  baseEnd.setHours(23, 59, 59, 999)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseEnd)
    d.setDate(baseEnd.getDate() - 6 + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

const DAY_SHORT = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']

export default function ClientHistory({ clientId }: Props) {
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('Prehrana')
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([])
  const [nutritionByDate, setNutritionByDate] = useState<Record<string, NutritionLog>>({})
  const [checkinDay, setCheckinDay] = useState<number>(6)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set())
  const [sheetExercise, setSheetExercise] = useState<string | null>(null)

  useEffect(() => { fetchStatic() }, [clientId])
  useEffect(() => { if (tab === 'Prehrana') fetchNutrition() }, [clientId, weekOffset, checkinDay, tab])

  const fetchStatic = async () => {
    const [{ data: w }, { data: cfg }] = await Promise.all([
      supabase.from('workout_logs').select('id, date, day_name, exercises').eq('client_id', clientId).order('date', { ascending: false }).limit(120),
      supabase.from('checkin_config').select('checkin_day').eq('client_id', clientId).single(),
    ])
    if (w) setWorkouts(w)
    if (cfg?.checkin_day != null) setCheckinDay(cfg.checkin_day)
    setLoading(false)
  }

  const fetchNutrition = async () => {
    const days = getWeekDays(checkinDay, weekOffset)
    const start = isoDate(days[0])
    const end = isoDate(days[6])
    const { data } = await supabase.from('nutrition_logs')
      .select('id, date, confirmed, calories, protein, carbs, fat')
      .eq('client_id', clientId).gte('date', start).lte('date', end)
    const map: Record<string, NutritionLog> = {}
    data?.forEach(n => { map[n.date] = n })
    setNutritionByDate(map)
  }

  const toggleExercise = (key: string) => setExpandedExercises(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })

  const fmtDateShort = (d: string) => new Date(d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })

  const trainingByDay = () => {
    const dayMap = new Map<string, WorkoutLog[]>()
    workouts.forEach(w => {
      const key = w.day_name || 'Ostalo'
      if (!dayMap.has(key)) dayMap.set(key, [])
      dayMap.get(key)!.push(w)
    })
    return [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dayName, sessions]) => {
      const exerciseMap = new Map<string, { date: string; sets: { reps: number; weight: number }[] }[]>()
      sessions.forEach(s => {
        s.exercises?.forEach(ex => {
          const completedSets = (ex.sets || [])
            .filter(set => set.completed && set.reps !== '' && set.weight !== '')
            .map(set => ({ reps: parseInt(set.reps) || 0, weight: parseFloat(set.weight) || 0 }))
          if (completedSets.length === 0) return
          if (!exerciseMap.has(ex.name)) exerciseMap.set(ex.name, [])
          exerciseMap.get(ex.name)!.push({ date: s.date, sets: completedSets })
        })
      })
      return {
        dayName, sessionCount: sessions.length,
        exercises: [...exerciseMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, history]) => ({
          name, history: history.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
        })),
      }
    })
  }

  const allExercises = () => {
    const exerciseMap = new Map<string, { date: string; sets: { reps: number; weight: number }[] }[]>()
    workouts.forEach(w => {
      w.exercises?.forEach(ex => {
        const completedSets = (ex.sets || []).filter(s => s.completed && s.reps !== '' && s.weight !== '').map(s => ({ reps: parseInt(s.reps) || 0, weight: parseFloat(s.weight) || 0 }))
        if (completedSets.length === 0) return
        if (!exerciseMap.has(ex.name)) exerciseMap.set(ex.name, [])
        exerciseMap.get(ex.name)!.push({ date: w.date, sets: completedSets })
      })
    })
    return [...exerciseMap.entries()].map(([name, history]) => ({ name, history: history.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10) }))
  }

  if (loading) return <p className="text-sm text-gray-400">Učitavanje...</p>

  const days = getWeekDays(checkinDay, weekOffset)
  const todayIso = isoDate(new Date())
  const COL = { date: 'w-[130px]', max: 'w-[90px]', vol: 'w-[80px]' }
  const days2 = trainingByDay()
  const exerciseList = allExercises()
  const selectedExercise = sheetExercise ? exerciseList.find(e => e.name === sheetExercise) : null

  // Nutrition averages for visible week
  const nutritionDays = days.map(d => nutritionByDate[isoDate(d)]).filter(Boolean)
  const avg = (f: keyof NutritionLog) => {
    const vals = nutritionDays.filter(l => l[f] != null).map(l => l[f] as number)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  return (
    <>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t === 'Prehrana' ? <UtensilsCrossed size={14} /> : <Dumbbell size={14} />}
            {t}
          </button>
        ))}
      </div>

      {/* ─── PREHRANA ─── */}
      {tab === 'Prehrana' && (
        <div className="space-y-3">
          {/* Week navigator */}
          <div className="flex items-center justify-between mb-1">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">{fmt(days[0])} — {fmt(days[6])}</p>
              {weekOffset === 0 && <p className="text-xs text-blue-500">ovaj tjedan</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
              <ChevronRight size={14} />
            </Button>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-[140px]">Dan</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[130px]">Kalorije</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[110px]">Proteini</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[110px]">Ugljiko.</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 w-[100px]">Masti</th>
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
                              <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{DAY_SHORT[day.getDay()]}</span>
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
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-500">Ø Prosjek</td>
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
          <p className="text-xs text-gray-400 ml-0.5">● = check-in dan</p>
        </div>
      )}

      {/* ─── TRENING ─── */}
      {tab === 'Trening' && (
        <div className="space-y-3">
          {days2.length === 0 && (
            <Card><div className="py-8 text-center text-sm text-gray-400">Nema zabilježenih treninga</div></Card>
          )}
          {days2.map(day => {
            if (day.exercises.length === 0) return null
            const lastSession = workouts
              .filter(w => (w.day_name || 'Ostalo') === day.dayName)
              .sort((a, b) => b.date.localeCompare(a.date))[0]

            return (
              <Card key={day.dayName} className="overflow-hidden">
                {/* Day header */}
                <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={13} className="text-blue-400" />
                    <p className="text-sm font-semibold text-gray-800">{day.dayName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {lastSession && <span>zadnji: {fmtDateShort(lastSession.date)}</span>}
                    <span>·</span>
                    <span>{day.sessionCount}× odrađeno</span>
                  </div>
                </div>

                {/* Exercise rows */}
                <div className="divide-y divide-gray-50">
                  {day.exercises.map(ex => {
                    const latest = ex.history[0]
                    const prev = ex.history[1]
                    const latestMax = latest ? Math.max(...latest.sets.map(s => s.weight)) : null
                    const prevMax = prev ? Math.max(...prev.sets.map(s => s.weight)) : null
                    const latestBestSet = latest?.sets.reduce((best, s) => s.weight > best.weight ? s : best, latest.sets[0])
                    const diff = latestMax != null && prevMax != null ? latestMax - prevMax : null

                    return (
                      <div key={ex.name} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
                        {/* Name */}
                        <p className="text-sm font-medium text-gray-800 w-[180px] shrink-0">{ex.name}</p>

                        {/* Last best set badge */}
                        <div className="flex-1">
                          {latestBestSet ? (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                              {latestBestSet.reps} × {latestBestSet.weight} kg
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </div>

                        {/* Trend */}
                        <div className="w-[90px] text-right">
                          {diff == null
                            ? <span className="text-xs text-gray-300">prvi trening</span>
                            : diff > 0
                              ? <span className="text-xs font-semibold text-green-500">↑ +{diff} kg</span>
                              : diff < 0
                                ? <span className="text-xs font-semibold text-red-400">↓ {diff} kg</span>
                                : <span className="text-xs font-semibold text-gray-400">→</span>
                          }
                        </div>

                        {/* Count */}
                        <span className="text-xs text-gray-400 w-[90px] text-right">{ex.history.length}× odrađeno</span>

                        {/* Detalji */}
                        <span
                          className="text-xs text-blue-500 hover:text-blue-700 transition-colors cursor-pointer w-[60px] text-right font-medium"
                          onClick={() => setSheetExercise(ex.name)}
                        >
                          Detalji →
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet open={!!sheetExercise} onOpenChange={() => setSheetExercise(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[400px] overflow-y-auto">
          {selectedExercise && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-blue-500" />
                  {selectedExercise.name}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                {selectedExercise.history.map((session, i) => {
                  const maxW = Math.max(...session.sets.map(s => s.weight))
                  const vol = session.sets.reduce((a, s) => a + s.reps * s.weight, 0)
                  const prev = selectedExercise.history[i + 1]
                  const prevMax = prev ? Math.max(...prev.sets.map(s => s.weight)) : null
                  const diff = prevMax != null ? maxW - prevMax : null
                  return (
                    <div key={`${session.date}-${i}`} className="rounded-xl border border-gray-100 overflow-hidden">
                      {/* Session header */}
                      <div className="px-4 py-2.5 bg-gray-50 flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700">
                          {new Date(session.date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        {diff != null && (
                          <span className={`text-xs font-bold ${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {diff > 0 ? `↑ +${diff} kg` : diff < 0 ? `↓ ${diff} kg` : '→'}
                          </span>
                        )}
                      </div>

                      {/* Sets */}
                      <div className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {session.sets.map((s, si) => (
                            <span key={si} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
                              {s.reps} × {s.weight} kg
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400 pt-2.5 border-t border-gray-50">
                          <span>Maks. <strong className="text-gray-700 ml-1">{maxW} kg</strong></span>
                          <span>Volumen <strong className="text-gray-700 ml-1">{vol} kg</strong></span>
                          <span>{session.sets.length} seta</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
