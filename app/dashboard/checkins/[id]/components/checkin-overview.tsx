'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Send, CalendarCheck, CalendarX } from 'lucide-react'

type Props = { clientId: string }
type Parameter = { id: string; name: string; type: string; unit: string | null; frequency: string }
type DailyLog = { id: string; date: string; values: Record<string, any> }
type Checkin = { id: string; date: string; values: Record<string, any>; trainer_note: string | null; trainer_comment: string | null }

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
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
  const t2 = useTranslations('checkins2')
  const tDays = useTranslations('days')
  const tDaysShort = useTranslations('daysShort')
  const [dailyParams, setDailyParams] = useState<Parameter[]>([])
  const [weeklyParams, setWeeklyParams] = useState<Parameter[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [checkin, setCheckin] = useState<Checkin | null>(null)
  const [checkinDay, setCheckinDay] = useState<number | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  // trainer_id for sending messages
  const [trainerId, setTrainerId] = useState<string | null>(null)
  const [pinging, setPinging] = useState(false)
  const [pinged, setPinged] = useState(false)
  const [remindError, setRemindError] = useState<string | null>(null)

  useEffect(() => { fetchConfig() }, [clientId])
  useEffect(() => { if (checkinDay !== null) fetchData() }, [clientId, weekOffset, checkinDay])

  const fetchConfig = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (user) setTrainerId(user.id)
    const { data } = await supabase.from('checkin_config').select('checkin_day').eq('client_id', clientId).maybeSingle()
    setCheckinDay(data?.checkin_day ?? 1)
  }

  const fetchData = async () => {
    if (checkinDay === null) return
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }
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

  const pingClient = async (message: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setPinging(true)
    setRemindError(null)
    try {
      const res = await fetch('/api/push/notify-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ client_id: clientId, message, locale }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        const ek = data.errorKey as string | undefined
        if (ek === 'no_client_email') setRemindError(t2('remindErrorNoClientEmail'))
        else if (ek === 'email_config') setRemindError(t2('remindErrorEmailConfig'))
        else if (ek === 'send_failed') setRemindError(t2('remindErrorSendFailed'))
        else setRemindError(t2('remindFailed'))
        return
      }
      setPinged(true)
      setTimeout(() => setPinged(false), 4000)
    } catch {
      setRemindError(t2('remindFailed'))
    } finally {
      setPinging(false)
    }
  }

  const avg = (paramId: string) => {
    const vals = dailyLogs.map(l => parseVal(l.values[paramId])).filter(v => !isNaN(v))
    if (!vals.length) return null
    const a = vals.reduce((a, b) => a + b, 0) / vals.length
    return a % 1 === 0 ? String(a) : a.toFixed(1)
  }

  if (checkinDay === null) return <p className="text-sm text-gray-400 text-center py-8">...</p>

  const days = getWeekDays(checkinDay, weekOffset)
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between bg-gray-50/80 rounded-xl px-4 py-2.5 border border-gray-100">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all text-gray-500"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">{fmt(days[0])} — {fmt(days[6])}</p>
          {weekOffset === 0 && <p className="text-[11px] text-teal-500 font-medium">{t('thisWeek')}</p>}
          {weekOffset < 0 && <p className="text-[11px] text-gray-400">{Math.abs(weekOffset)} {Math.abs(weekOffset) === 1 ? t2('weekEarlier') : t2('weeksEarlier')}</p>}
        </div>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          disabled={weekOffset >= 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <>
          {/* Weekly check-in card */}
          <div className={`rounded-xl border transition-all ${checkin ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100 bg-white'}`}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {checkin
                    ? <CalendarCheck size={15} className="text-emerald-500" />
                    : <CalendarX size={15} className="text-gray-300" />
                  }
                  <p className="font-semibold text-sm text-gray-800">{t('weeklyCheckin')}</p>
                  <span className="text-xs text-gray-400">· {tDays(String(checkinDay))}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                  {/* Remind: email (Resend) + push; prije je bio samo push */}
                  {!checkin && weekOffset === 0 && (
                    <button
                      onClick={() => pingClient(t2('remindMessage'))}
                      disabled={pinging || pinged}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border transition-all ${pinged ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                    >
                      {pinged ? t2('remindSent') : pinging ? '...' : t2('remindBtn')}
                    </button>
                  )}
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${checkin ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                    {checkin
                      ? `✓ ${new Date(checkin.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}`
                      : t('notSent')
                    }
                  </span>
                  </div>
                  {remindError && (
                    <p className="text-[10px] text-red-600 max-w-[220px] text-right leading-tight">{remindError}</p>
                  )}
                </div>
              </div>

              {/* Weekly param values */}
              {weeklyParams.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {weeklyParams.map(p => {
                    const raw = checkin?.values?.[p.id]
                    const val = parseVal(raw)
                    const hasVal = !isNaN(val)
                    return (
                      <div key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${hasVal ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
                        <span className="text-[11px] text-gray-400 font-medium">{p.name}</span>
                        <span className={`text-sm font-bold ${hasVal ? 'text-gray-800' : 'text-gray-300'}`}>
                          {hasVal ? `${val % 1 === 0 ? val : val.toFixed(1)}${p.unit ? ` ${p.unit}` : ''}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Trainer comment */}
              {checkin && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('commentToClient')}</p>
                    <p className="text-[11px] text-gray-400">{t('sendAsChat')}</p>
                  </div>
                  {checkin.trainer_comment && (
                    <div className="bg-teal-50 rounded-lg px-3 py-2 text-xs text-teal-700 border border-teal-100">
                      {t('lastLabel')}: &ldquo;{checkin.trainer_comment}&rdquo;
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendComment()}
                      placeholder={t('commentPlaceholder')}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-300 transition-colors"
                    />
                    <Button size="sm" onClick={sendComment} disabled={sending || !comment.trim() || sent}
                      className={`flex-shrink-0 gap-1.5 h-9 text-xs px-3 ${sent ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
                      <Send size={13} />
                      {sending ? t('sending') : sent ? t('sent') : t('send')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Daily table */}
          {dailyParams.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('dailyEntries')}</p>
              <div className="rounded-xl border border-gray-100 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 w-28">{t('day')}</th>
                        {dailyParams.map(p => (
                          <th key={p.id} className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400">
                            {p.name}{p.unit && <span className="font-normal text-gray-300"> ({p.unit})</span>}
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
                          <tr key={iso} className={`border-b border-gray-50 last:border-0 transition-colors ${
                            isToday ? 'bg-teal-50/60' : i % 2 !== 0 ? 'bg-gray-50/30' : ''
                          }`}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${log ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                                <div>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs font-semibold ${isToday ? 'text-teal-600' : 'text-gray-700'}`}>{tDaysShort(String(day.getDay()))}</span>
                                    {isCheckinDayRow && <span className="text-indigo-400 text-[10px] font-bold">●</span>}
                                  </div>
                                  <div className="text-[11px] text-gray-400">{fmt(day)}</div>
                                </div>
                              </div>
                            </td>
                            {dailyParams.map(p => {
                              const raw = log?.values?.[p.id]
                              const val = parseVal(raw)
                              const display = !isNaN(val) ? (val % 1 === 0 ? val : val.toFixed(1)) : (raw !== undefined && raw !== null && raw !== '' ? raw : null)
                              return (
                                <td key={p.id} className="text-center px-4 py-2.5">
                                  {display !== null
                                    ? <span className="font-semibold text-gray-800 text-sm">{display}</span>
                                    : <span className="text-gray-200 text-sm">—</span>
                                  }
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                      <tr className="border-t-2 border-gray-100 bg-gray-50">
                        <td className="px-4 py-2.5 text-xs font-bold text-gray-500">{t('average')}</td>
                        {dailyParams.map(p => (
                          <td key={p.id} className="text-center px-4 py-2.5 text-xs font-bold text-teal-600">
                            {p.type === 'number' ? (avg(p.id) ?? <span className="text-gray-300">—</span>) : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 ml-1 flex items-center gap-1">
                <span className="text-indigo-400 font-bold">●</span> {t('checkinDayLegend')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
