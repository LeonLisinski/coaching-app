'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Props = { clientId: string }

type Parameter = {
  id: string
  name: string
  type: string
  unit: string | null
  frequency: string
}

type Checkin = {
  id: string
  date: string
  values: Record<string, any>
  photo_urls: { position: string; url: string }[] | null
  trainer_comment: string | null
}

type DailyLog = {
  date: string
  values: Record<string, any>
}

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function parseVal(v: any): number {
  if (v === undefined || v === null || v === '') return NaN
  return parseFloat(String(v).replace(',', '.'))
}

function fmt(v: number) { return v % 1 === 0 ? String(v) : v.toFixed(1) }

function getWeekBounds(date: string, checkinDay: number): { start: string; end: string } {
  const d = new Date(date)
  const daysUntil = (checkinDay - d.getDay() + 7) % 7
  const end = new Date(d)
  end.setDate(d.getDate() + daysUntil)
  const start = new Date(end)
  start.setDate(end.getDate() - 6)
  return { start: isoDate(start), end: isoDate(end) }
}

export default function CheckinHistory({ clientId }: Props) {
  const locale = useLocale()
  const t = useTranslations('checkins.detail.history')
  const [params, setParams] = useState<Parameter[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [checkinDay, setCheckinDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: paramsData }, { data: checkinsData }, { data: configData }, { data: dailyData }] = await Promise.all([
      supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('order_index'),
      supabase.from('checkins').select('id, date, values, photo_urls, trainer_comment').eq('client_id', clientId).order('date', { ascending: false }),
      supabase.from('checkin_config').select('checkin_day').eq('client_id', clientId).single(),
      supabase.from('daily_logs').select('date, values').eq('client_id', clientId).order('date'),
    ])

    if (paramsData) setParams(paramsData)
    if (checkinsData) setCheckins(checkinsData)
    if (dailyData) setDailyLogs(dailyData)
    if (configData?.checkin_day != null) setCheckinDay(configData.checkin_day)
    setLoading(false)
  }

  const weeklyParams = params.filter(p => p.frequency === 'weekly')
  const dailyParams = params.filter(p => p.frequency === 'daily' && p.type === 'number')

  const getDailyAvgs = (weekStart: string, weekEnd: string) => {
    const weekLogs = dailyLogs.filter(l => l.date >= weekStart && l.date <= weekEnd)
    if (!weekLogs.length) return null
    const avgs: Record<string, string> = {}
    dailyParams.forEach(p => {
      const vals = weekLogs.map(l => parseVal(l.values[p.id])).filter(v => !isNaN(v))
      if (vals.length) avgs[p.id] = fmt(vals.reduce((a, b) => a + b, 0) / vals.length)
    })
    return Object.keys(avgs).length ? avgs : null
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  const fmtDateYear = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) return <p className="text-gray-400 text-sm text-center py-8">{t('loading')}</p>
  if (!checkins.length) return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-sm">{t('noCheckinsYet')}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        </div>
      )}

      <p className="text-sm text-gray-500">{t('totalCount', { count: checkins.length })}</p>

      {checkins.map(c => {
        const { start: weekStart, end: weekEnd } = getWeekBounds(c.date, checkinDay)
        const isOpen = expanded === weekEnd
        const photos = (c.photo_urls as any[]) || []
        const dailyAvgs = getDailyAvgs(weekStart, weekEnd)

        return (
          <Card key={weekEnd} className="overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : weekEnd)}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{fmtDate(weekStart)} — {fmtDateYear(weekEnd)}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(c.date).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: '2-digit' })}
                    {photos.length > 0 && ` · ${photos.length} ${t('foto')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {weeklyParams.slice(0, 2).map(p => {
                  const val = parseVal(c.values?.[p.id])
                  if (isNaN(val)) return null
                  return (
                    <span key={p.id} className="hidden sm:block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {p.name}: {fmt(val)}{p.unit ? ` ${p.unit}` : ''}
                    </span>
                  )
                })}
                {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">

                {/* Tjedni parametri + dnevni prosjeci u jednoj tablici */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('weekInNumbers')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {weeklyParams.map(p => {
                      const val = parseVal(c.values?.[p.id])
                      return (
                        <div key={p.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-center min-w-[72px]">
                          <p className="text-xs text-gray-400">{p.name}</p>
                          <p className={`font-bold text-sm mt-0.5 ${!isNaN(val) ? 'text-gray-800' : 'text-gray-300'}`}>
                            {!isNaN(val) ? `${fmt(val)}${p.unit ? ` ${p.unit}` : ''}` : '—'}
                          </p>
                        </div>
                      )
                    })}
                    {dailyAvgs && dailyParams.map(p => {
                      const a = dailyAvgs[p.id]
                      if (!a) return null
                      return (
                        <div key={p.id} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-center min-w-[72px]">
                          <p className="text-xs text-blue-400">{p.name} <span className="text-blue-300">avg</span></p>
                          <p className="font-bold text-sm mt-0.5 text-blue-700">
                            {a}{p.unit ? ` ${p.unit}` : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Fotografije */}
                {photos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('photosLabel')}</p>
                    <div className="flex gap-2">
                      {photos.map((photo: any, i: number) => (
                        <div key={i} className="flex-1 min-w-0">
                          <img
                            src={photo.url}
                            alt={photo.position}
                            className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightbox(photo.url)}
                          />
                          <p className="text-xs text-center text-gray-400 mt-1 capitalize">{photo.position}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Komentar trenera */}
                {c.trainer_comment && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-500 font-medium mb-1">💬 {t('trainerComment')}</p>
                    <p className="text-sm text-blue-800">{c.trainer_comment}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
