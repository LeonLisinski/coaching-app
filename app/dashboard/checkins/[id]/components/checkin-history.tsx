'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, GitCompare, ArrowUpDown, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'

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

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseVal(v: any): number {
  if (v === undefined || v === null || v === '') return NaN
  return parseFloat(String(v).replace(',', '.'))
}

function fmt(v: number) { return v % 1 === 0 ? String(v) : v.toFixed(1) }

function formatCheckinVal(raw: any, type: string): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (type === 'boolean') return raw === true || raw === 'true' ? 'Da' : 'Ne'
  const num = parseFloat(String(raw).replace(',', '.'))
  if (!isNaN(num)) return num % 1 === 0 ? String(num) : num.toFixed(1)
  return String(raw)
}

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
  const t2 = useTranslations('checkins2')
  const [params, setParams] = useState<Parameter[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [checkinDay, setCheckinDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [compareLightbox, setCompareLightbox] = useState<{ positionIdx: number } | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelected, setCompareSelected] = useState<string[]>([])
  const [sortDesc, setSortDesc] = useState(true) // true = newest first (default)
  const MAX_COMPARE = 5

  useEffect(() => { fetchData() }, [clientId])

  const resolvePhotoUrls = async (checkinList: Checkin[]): Promise<Checkin[]> => {
    const paths = checkinList.flatMap(c =>
      (c.photo_urls ?? []).map((p: any) => p?.url).filter((u: string) => u && !u.startsWith('http'))
    )
    if (!paths.length) return checkinList
    const { data: signed } = await supabase.storage.from('checkin-images').createSignedUrls(paths, 3600)
    if (!signed) return checkinList
    const urlMap = Object.fromEntries(signed.map(s => [s.path, s.signedUrl]))
    return checkinList.map(c => ({
      ...c,
      photo_urls: (c.photo_urls ?? []).map((p: any) =>
        p?.url && !p.url.startsWith('http') ? { ...p, url: urlMap[p.url] ?? p.url } : p
      ),
    }))
  }

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const [{ data: paramsData }, { data: checkinsData }, { data: configData }, { data: dailyData }] = await Promise.all([
      supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('order_index'),
      supabase.from('checkins').select('id, date, values, photo_urls, trainer_comment').eq('client_id', clientId).order('date', { ascending: false }),
      supabase.from('checkin_config').select('checkin_day').eq('client_id', clientId).maybeSingle(),
      supabase.from('daily_logs').select('date, values').eq('client_id', clientId).order('date'),
    ])

    if (paramsData) setParams(paramsData)
    if (checkinsData) setCheckins(await resolvePhotoUrls(checkinsData))
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

  const checkinsWithPhotos = checkins.filter(c => (c.photo_urls as any[])?.length > 0)

  // Build compare view — supports multiple selected check-ins
  const compareCheckins = compareSelected
    .map(date => checkins.find(c => c.date === date))
    .filter(Boolean) as Checkin[]
  const comparePositions = compareCheckins.length >= 2
    ? [...new Set(compareCheckins.flatMap(c => (c.photo_urls || []).map((p: any) => p.position)))]
    : []

  const toggleCompareSelect = (date: string) => {
    setCompareSelected(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : prev.length < MAX_COMPARE ? [...prev, date] : prev
    )
  }

  return (
    <div className="space-y-3">
      {/* Single photo lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
            <X size={28} />
          </button>
          <img src={lightbox} className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain" />
        </div>
      )}

      {/* Compare fullscreen lightbox */}
      {compareLightbox && comparePositions.length > 0 && (() => {
        const posIdx = Math.max(0, Math.min(compareLightbox.positionIdx, comparePositions.length - 1))
        const position = comparePositions[posIdx]
        const sortedForNum = [...checkinsWithPhotos].sort((a, b) => b.date.localeCompare(a.date))
        return (
          <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <p className="text-white font-semibold text-sm uppercase tracking-wide">{position}</p>
                <div className="flex gap-1">
                  {comparePositions.map((pos, i) => (
                    <button
                      key={pos}
                      onClick={() => setCompareLightbox({ positionIdx: i })}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors capitalize ${
                        i === posIdx ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setCompareLightbox(null)} className="text-white/70 hover:text-white transition-colors p-1">
                <X size={24} />
              </button>
            </div>
            {/* Photos */}
            <div className="flex-1 flex items-center gap-4 px-4 py-4 overflow-x-auto min-h-0">
              {compareCheckins.map((checkin) => {
                const photo = (checkin.photo_urls as any[])?.find((p: any) => p.position === position)
                const weekNum = sortedForNum.length - sortedForNum.findIndex(c => c.date === checkin.date)
                return (
                  <div key={checkin.date} className="flex-none flex flex-col items-center gap-2 h-full">
                    <div className="text-center">
                      <p className="text-white text-sm font-bold">{t2('weekLabel', { n: weekNum })}</p>
                      <p className="text-white/50 text-xs">{fmtDate(checkin.date)}</p>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center">
                      {photo ? (
                        <img
                          src={photo.url}
                          alt={position}
                          className="max-h-full max-w-[80vw] object-contain rounded-lg cursor-zoom-in"
                          style={{ maxHeight: 'calc(100vh - 140px)' }}
                          onClick={() => setLightbox(photo.url)}
                        />
                      ) : (
                        <div className="w-48 h-64 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                          <p className="text-white/30 text-xs text-center px-3">Nema {position} foto</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Position nav arrows */}
            {comparePositions.length > 1 && (
              <div className="flex justify-center gap-4 pb-4 flex-shrink-0">
                <button
                  onClick={() => setCompareLightbox({ positionIdx: posIdx - 1 })}
                  disabled={posIdx === 0}
                  className="flex items-center gap-1.5 text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  <ChevronLeft size={16} /> Prethodna pozicija
                </button>
                <button
                  onClick={() => setCompareLightbox({ positionIdx: posIdx + 1 })}
                  disabled={posIdx === comparePositions.length - 1}
                  className="flex items-center gap-1.5 text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  Sljedeća pozicija <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )
      })()}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{t('totalCount', { count: checkins.length })}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDesc(v => !v)}
            className="flex items-center gap-1.5 text-xs"
          >
            <ArrowUpDown size={12} />
            {sortDesc ? t2('sortNewest') : t2('sortOldest')}
          </Button>
          {checkinsWithPhotos.length >= 1 && (
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setCompareMode(v => !v); setCompareSelected([]) }}
              className="flex items-center gap-1.5"
            >
              <GitCompare size={13} />
              {compareMode ? t2('closeCompare') : t2('comparePhotos')}
            </Button>
          )}
        </div>
      </div>

      {/* Compare mode */}
      {compareMode && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t2('selectWeeks')}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {compareSelected.length === 0
                  ? t2('clickWeekHint', { max: MAX_COMPARE })
                  : `${t2('selectedCount', { count: compareSelected.length })}${compareSelected.length < 2 ? ' ' + t2('selectMoreHint') : ''}`}
              </p>
            </div>
            <div className="flex gap-2">
              {checkinsWithPhotos.length >= 2 && (
                <button type="button"
              onClick={() => {
                  const sorted = [...checkinsWithPhotos].sort((a, b) => a.date.localeCompare(b.date))
                  setCompareSelected([sorted[0].date, sorted[sorted.length - 1].date])
                }}
                  className="text-xs text-primary underline font-medium whitespace-nowrap">
                  {t2('firstToLast')}
                </button>
              )}
              {compareSelected.length > 0 && (
                <button type="button"
                  onClick={() => setCompareSelected([])}
                  className="text-xs text-gray-400 underline whitespace-nowrap">
                  {t2('clearSelection')}
                </button>
              )}
            </div>
          </div>

          {/* Thumbnail grid — newest (highest week #) first */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {[...checkinsWithPhotos]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((c, idx, arr) => {
                const selected = compareSelected.includes(c.date)
                const selIdx = compareSelected.indexOf(c.date)
                const atMax = !selected && compareSelected.length >= MAX_COMPARE
                const thumbPhoto = (c.photo_urls as any[])?.[0]
                const weekNum = arr.length - idx  // T(max) first, T1 last
                return (
                  <button
                    key={c.date}
                    type="button"
                    onClick={() => !atMax && toggleCompareSelect(c.date)}
                    title={atMax ? t2('maxWeeks', { max: MAX_COMPARE }) : fmtDateYear(c.date)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      selected
                        ? 'border-primary shadow-md ring-2 ring-primary/30'
                        : atMax
                        ? 'border-gray-200 opacity-40 cursor-not-allowed'
                        : 'border-gray-200 hover:border-primary/50 cursor-pointer'
                    }`}
                  >
                    {thumbPhoto ? (
                      <img src={thumbPhoto.url} alt="" className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-400">—</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1">
                      <p className="text-[11px] text-white font-bold leading-tight">{t2('weekLabel', { n: weekNum })}</p>
                      <p className="text-[9px] text-white/60 leading-tight">{fmtDate(c.date)}</p>
                    </div>
                    {selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                        {selIdx + 1}
                      </div>
                    )}
                  </button>
                )
              })}
          </div>

          {/* Comparison result */}
          {compareCheckins.length >= 2 && (
            <div className="border-t border-gray-200 pt-4 space-y-5">
              {comparePositions.map((position, posIdx) => {
                const sortedForNum = [...checkinsWithPhotos].sort((a, b) => b.date.localeCompare(a.date))
                return (
                  <div key={position}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">{position}</p>
                      <button
                        type="button"
                        onClick={() => setCompareLightbox({ positionIdx: posIdx })}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        <ZoomIn size={13} />
                        Proširi
                      </button>
                    </div>
                    {/* Horizontally scrollable row of photos */}
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {compareCheckins.map((checkin) => {
                        const photo = (checkin.photo_urls as any[])?.find((p: any) => p.position === position)
                        const weekNum = sortedForNum.length - sortedForNum.findIndex(c => c.date === checkin.date)
                        return (
                          <div key={checkin.date} className="flex-none w-40">
                            <div className="text-center mb-1">
                              <p className="text-xs font-bold text-gray-800">{t2('weekLabel', { n: weekNum })}</p>
                              <p className="text-[10px] text-gray-400">{fmtDate(checkin.date)}</p>
                            </div>
                            {photo ? (
                              <img
                                src={photo.url}
                                alt={position}
                                className="w-full aspect-[3/4] object-cover rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity"
                                onClick={() => setCompareLightbox({ positionIdx: posIdx })}
                              />
                            ) : (
                              <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg border flex items-center justify-center">
                                <p className="text-xs text-gray-400 text-center px-2">Nema {position} foto</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {compareCheckins.length === 1 && (
            <p className="text-xs text-center text-gray-400 pt-2">{t2('selectAnotherWeek')}</p>
          )}
        </div>
      )}

      {(() => {
        // Assign week numbers based on chronological order (oldest = week 1)
        const chronological = [...checkins].sort((a, b) => a.date.localeCompare(b.date))
        const weekNumberMap = Object.fromEntries(chronological.map((c, i) => [c.date, i + 1]))
        const sorted = [...checkins].sort((a, b) =>
          sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
        )
        return sorted.map(c => {
        const weekNum = weekNumberMap[c.date]
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
                  <p className="text-sm font-semibold">{t2('weekLabel', { n: weekNum })}</p>
                  <p className="text-xs text-gray-400">
                    {fmtDate(weekStart)} — {fmtDateYear(weekEnd)}
                    {photos.length > 0 && ` · ${photos.length} ${t('foto')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {weeklyParams.slice(0, 2).map(p => {
                  const display = formatCheckinVal(c.values?.[p.id], p.type)
                  if (!display) return null
                  return (
                    <span key={p.id} className="hidden sm:block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {p.name}: {display}{p.type !== 'boolean' && p.unit ? ` ${p.unit}` : ''}
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
                      const raw = c.values?.[p.id]
                      const display = formatCheckinVal(raw, p.type)
                      const isBoolean = p.type === 'boolean'
                      const boolYes = isBoolean && (raw === true || raw === 'true')
                      return (
                        <div key={p.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-center min-w-[72px]">
                          <p className="text-xs text-gray-400">{p.name}</p>
                          <p className={`font-bold text-sm mt-0.5 ${
                            !display ? 'text-gray-300' :
                            isBoolean ? (boolYes ? 'text-emerald-600' : 'text-red-500') :
                            'text-gray-800'
                          }`}>
                            {display ? `${display}${!isBoolean && p.unit ? ` ${p.unit}` : ''}` : '—'}
                          </p>
                        </div>
                      )
                    })}
                    {dailyAvgs && dailyParams.map(p => {
                      const a = dailyAvgs[p.id]
                      if (!a) return null
                      return (
                        <div key={p.id} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-center min-w-[72px]">
                          <p className="text-xs text-blue-400">{p.name} <span className="text-blue-300">{t2('avgSuffix')}</span></p>
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
      })})()}
    </div>
  )
}
