'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'

type Props = { clientId: string }
type Parameter = { id: string; name: string; type: string; unit: string | null; frequency: string }
type DailyLog = { id: string; date: string; values: Record<string, any> }
type Checkin = { id: string; date: string; values: Record<string, any>; trainer_note: string | null; trainer_comment: string | null }

function isoDate(d: Date) { return d.toISOString().split('T')[0] }
function parseVal(v: any): number {
  if (v === undefined || v === null || v === '') return NaN
  return parseFloat(String(v).replace(',', '.'))
}

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

export default function CheckinOverview({ clientId }: Props) {
  const locale = useLocale()
  const t = useTranslations('checkins.detail.overview')
  const tDays = useTranslations('days')
  const tDaysShort = useTranslations('daysShort')
  const [dailyParams, setDailyParams] = useState<Parameter[]>([])
  const [weeklyParams, setWeeklyParams] = useState<Parameter[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [checkin, setCheckin] = useState<Checkin | null>(null)
  const [checkinDay, setCheckinDay] = useState<number>(1)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  // trainer_id for sending messages
  const [trainerId, setTrainerId] = useState<string | null>(null)

  useEffect(() => { fetchConfig() }, [clientId])
  useEffect(() => { fetchData() }, [clientId, weekOffset, checkinDay])

  const fetchConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setTrainerId(user.id)
    const { data } = await supabase.from('checkin_config').select('checkin_day').eq('client_id', clientId).single()
    if (data?.checkin_day != null) setCheckinDay(data.checkin_day)
  }

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const days = getWeekDays(checkinDay, weekOffset)
    const startDate = isoDate(days[0])
    const endDate = isoDate(days[6])

    const [{ data: params }, { data: logsData }, { data: checkinData }] = await Promise.all([
      supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('order_index'),
      supabase.from('daily_logs').select('*').eq('client_id', clientId).gte('date', startDate).lte('date', endDate).order('date'),
      supabase.from('checkins').select('*').eq('client_id', clientId).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }).limit(1),
    ])

    if (params) {
      setDailyParams(params.filter((p: Parameter) => p.frequency === 'daily'))
      setWeeklyParams(params.filter((p: Parameter) => p.frequency === 'weekly'))
    }
    if (logsData) setDailyLogs(logsData)
    const c = checkinData?.[0] || null
    setCheckin(c)
    setComment('')
    setSent(false)
    setLoading(false)
  }

  const sendComment = async () => {
    if (!comment.trim() || !checkin || !trainerId) return
    setSending(true)

    // Get client's user_id for receiver
    const { data: clientData } = await supabase
      .from('clients').select('user_id').eq('id', clientId).single()

    const checkinDate = new Date(checkin.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    const messageContent = `📋 ${t('clientCommentLabel')} (${checkinDate}):\n\n${comment}`

    await supabase.from('messages').insert({
      sender_id: trainerId,
      receiver_id: clientData?.user_id,
      trainer_id: trainerId,
      client_id: clientId,
      content: messageContent,
      read: false,
      private: false,
    })

    // Also save to checkin record
    await supabase.from('checkins').update({ trainer_comment: comment }).eq('id', checkin.id)

    setSending(false)
    setSent(true)
    setComment('')
  }

  const avg = (paramId: string) => {
    const vals = dailyLogs.map(l => parseVal(l.values[paramId])).filter(v => !isNaN(v))
    if (!vals.length) return null
    const a = vals.reduce((a, b) => a + b, 0) / vals.length
    return a % 1 === 0 ? String(a) : a.toFixed(1)
  }

  const days = getWeekDays(checkinDay, weekOffset)
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft size={14} />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">{fmt(days[0])} — {fmt(days[6])}</p>
          {weekOffset === 0 && <p className="text-xs text-blue-500">{t('thisWeek')}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
          <ChevronRight size={14} />
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-8">{t('loading')}</p>
      ) : (
        <>
          {/* Tjedni check-in — compact */}
          <Card className={checkin ? 'border-green-200' : ''}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{t('weeklyCheckin')}</p>
                  <span className="text-xs text-gray-400">· {tDays(String(checkinDay))}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${checkin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {checkin ? `✓ ${new Date(checkin.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}` : t('notSent')}
                </span>
              </div>

              {/* Weekly values inline */}
              {weeklyParams.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {weeklyParams.map(p => {
                    const raw = checkin?.values?.[p.id]
                    const val = parseVal(raw)
                    const hasVal = !isNaN(val)
                    return (
                      <div key={p.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-md px-2.5 py-1.5">
                        <span className="text-xs text-gray-400">{p.name}</span>
                        <span className={`text-sm font-semibold ${hasVal ? 'text-gray-800' : 'text-gray-300'}`}>
                          {hasVal ? `${val % 1 === 0 ? val : val.toFixed(1)}${p.unit ? ` ${p.unit}` : ''}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Send comment as chat message */}
              {checkin && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('commentToClient')}</p>
                    <p className="text-xs text-gray-400">{t('sendAsChat')}</p>
                  </div>
                  {checkin.trainer_comment && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 border border-gray-100">
                      {t('lastLabel')}: "{checkin.trainer_comment}"
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendComment()}
                      placeholder={t('commentPlaceholder')}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                    <Button size="sm" onClick={sendComment} disabled={sending || !comment.trim() || sent} className="flex-shrink-0 gap-1.5">
                      <Send size={13} />
                      {sending ? t('sending') : sent ? t('sent') : t('send')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Daily table */}
          {dailyParams.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('dailyEntries')}</p>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-28">{t('day')}</th>
                        {dailyParams.map(p => (
                          <th key={p.id} className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">
                            {p.name}{p.unit && <span className="font-normal text-gray-400"> ({p.unit})</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day, i) => {
                        const iso = isoDate(day)
                        const log = dailyLogs.find(l => l.date === iso)
                        const isToday = iso === isoDate(new Date())
                        const isCheckinDayRow = day.getDay() === checkinDay
                        return (
                          <tr key={iso} className={['border-b border-gray-50 last:border-0', isToday ? 'bg-blue-50' : i % 2 !== 0 ? 'bg-gray-50/40' : ''].join(' ')}>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${log ? 'bg-green-400' : 'bg-gray-200'}`} />
                                <div>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{tDaysShort(String(day.getDay()))}</span>
                                    {isCheckinDayRow && <span className="text-purple-400 text-xs">●</span>}
                                  </div>
                                  <div className="text-xs text-gray-400">{fmt(day)}</div>
                                </div>
                              </div>
                            </td>
                            {dailyParams.map(p => {
                              const raw = log?.values?.[p.id]
                              const val = parseVal(raw)
                              const display = !isNaN(val) ? (val % 1 === 0 ? val : val.toFixed(1)) : (raw !== undefined && raw !== null && raw !== '' ? raw : null)
                              return (
                                <td key={p.id} className="text-center px-4 py-2">
                                  {display !== null ? <span className="font-medium text-gray-800">{display}</span> : <span className="text-gray-200">—</span>}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                      <tr className="border-t-2 border-gray-100 bg-gray-50">
                        <td className="px-4 py-2 text-xs font-semibold text-gray-500">{t('average')}</td>
                        {dailyParams.map(p => (
                          <td key={p.id} className="text-center px-4 py-2 text-xs font-semibold text-gray-600">
                            {p.type === 'number' ? (avg(p.id) ?? '—') : '—'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
              <p className="text-xs text-gray-400 mt-1 ml-0.5">{t('checkinDayLegend')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
