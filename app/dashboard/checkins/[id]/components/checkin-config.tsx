'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Check } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'

type Props = { clientId: string }

const PHOTO_POSITIONS = ['front', 'side', 'back'] as const

export default function CheckinConfig({ clientId }: Props) {
  const t = useTranslations('checkins')
  const t2 = useTranslations('checkins2')
  const tDays = useTranslations('days')
  const tDaysShort = useTranslations('daysShort')
  const tCommon = useTranslations('common')
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const inactivePill = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.06)', color: '#9ca3af', borderColor: 'rgba(255,255,255,0.12)' }
    : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }

  const tConfig = (key: string) => t(`detail.config.${key}` as any)
  const tForm = (key: string) => t(`detail.form.${key}` as any)

  const PHOTO_FREQUENCIES = [
    { value: 'none', label: tConfig('frequencies.none') },
    { value: 'every', label: tConfig('frequencies.every') },
  ]

  const [config, setConfig] = useState({
    checkin_day: 1,
    photo_frequency: 'every',
    photo_positions: ['front', 'side', 'back'],
    notes: '',
  })
  const [configId, setConfigId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [clientId])

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('checkin_config')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle()

    if (data) {
      setConfigId(data.id)
      setConfig({
        checkin_day: data.checkin_day ?? 1,
        photo_frequency: data.photo_frequency || 'every',
        photo_positions: data.photo_positions || ['front', 'side', 'back'],
        notes: data.notes || '',
      })
    }
    setLoading(false)
  }

  const togglePosition = (pos: string) => {
    setConfig(prev => ({
      ...prev,
      photo_positions: prev.photo_positions.includes(pos)
        ? prev.photo_positions.filter(p => p !== pos)
        : [...prev.photo_positions, pos]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const payload = {
        trainer_id: user.id,
        client_id: clientId,
        checkin_day: config.checkin_day,
        photo_frequency: config.photo_frequency,
        photo_positions: config.photo_positions,
        notes: config.notes || null,
      }

      if (configId) {
        await supabase.from('checkin_config').update(payload).eq('id', configId)
      } else {
        const { data } = await supabase.from('checkin_config').insert(payload).select('id').single()
        if (data) setConfigId(data.id)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="space-y-3 max-w-lg">
      {[1,2,3].map(i => <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
    </div>
  )

  const DAY_NAMES = [0, 1, 2, 3, 4, 5, 6].map(i => tDaysShort(String(i) as any))

  const cardCls = `rounded-xl border px-4 py-3.5 space-y-3 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-gray-100 bg-white'}`
  const sectionLabelCls = `text-xs font-bold uppercase tracking-wide mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`
  const dividerCls = `pt-2 border-t space-y-2 ${isDark ? 'border-white/8' : 'border-gray-50'}`

  return (
    <div className="space-y-3 max-w-lg">

      {/* Check-in day */}
      <div className={cardCls}>
        <div>
          <p className={sectionLabelCls}>{tConfig('checkinDay')}</p>
          <p className="text-[11px] text-gray-400">{t2('checkinDayHint')}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <button key={i} type="button" onClick={() => setConfig({ ...config, checkin_day: i })}
              className="text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors"
              style={config.checkin_day === i
                ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                : inactivePill}>
              {DAY_NAMES[i]}
            </button>
          ))}
        </div>
      </div>

      {/* Photo frequency */}
      <div className={cardCls}>
        <div>
          <p className={sectionLabelCls}>{tConfig('photoFrequency')}</p>
          <p className="text-[11px] text-gray-400">{t2('photoFreqHint')}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PHOTO_FREQUENCIES.map(f => (
            <button key={f.value} type="button" onClick={() => setConfig({ ...config, photo_frequency: f.value })}
              className="text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors"
              style={config.photo_frequency === f.value
                ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                : inactivePill}>
              {f.label}
            </button>
          ))}
        </div>

        {config.photo_frequency !== 'none' && (
          <div className={dividerCls}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>{tConfig('photoPositionsLabel')}</p>
            <div className="flex gap-1.5">
              {PHOTO_POSITIONS.map(pos => (
                <button key={pos} type="button" onClick={() => togglePosition(pos)}
                  className="text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors"
                  style={config.photo_positions.includes(pos)
                    ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                    : inactivePill}>
                  {tForm(`photoPositions.${pos}` as any)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className={cardCls}>
        <div>
          <p className={sectionLabelCls}>{tConfig('clientInstructions')}</p>
          <p className="text-[11px] text-gray-400">{t2('instructionsHint')}</p>
        </div>
        <textarea
          value={config.notes}
          onChange={(e) => setConfig({ ...config, notes: e.target.value })}
          placeholder={tConfig('clientInstructionsPlaceholder')}
          className={`w-full border rounded-xl px-3 py-2.5 text-sm min-h-24 resize-none focus:outline-none transition-colors ${
            isDark
              ? 'bg-white/[0.05] border-white/12 text-gray-100 placeholder:text-gray-500 focus:border-white/25'
              : 'border-gray-200 focus:border-gray-300'
          }`}
        />
      </div>

      {/* Save */}
      <button type="button" onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: saved ? '#059669' : 'var(--app-accent)' }}>
        {saved && <Check size={15} />}
        {saving ? tCommon('saving') : saved ? tConfig('savedSuccess') : tConfig('save')}
      </button>

    </div>
  )
}
