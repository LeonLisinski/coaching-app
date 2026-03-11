'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Check } from 'lucide-react'

type Props = { clientId: string }

const PHOTO_POSITIONS = ['front', 'side', 'back'] as const

export default function CheckinConfig({ clientId }: Props) {
  const t = useTranslations('checkins')
  const tDays = useTranslations('days')
  const tCommon = useTranslations('common')

  const tConfig = (key: string) => t(`detail.config.${key}` as any)
  const tForm = (key: string) => t(`detail.form.${key}` as any)

  const PHOTO_FREQUENCIES = [
    { value: 'none', label: tConfig('frequencies.none') },
    { value: 'every', label: tConfig('frequencies.every') },
    { value: 'biweekly', label: tConfig('frequencies.biweekly') },
    { value: 'monthly', label: tConfig('frequencies.monthly') },
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
      .single()

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
    const { data: { user } } = await supabase.auth.getUser()
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

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="space-y-3 max-w-lg">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  const DAY_NAMES = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']

  return (
    <div className="space-y-3 max-w-lg">

      {/* Check-in day */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 space-y-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{tConfig('checkinDay')}</p>
          <p className="text-[11px] text-gray-400">Dan kada klijent šalje tjedni check-in</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <button key={i} type="button" onClick={() => setConfig({ ...config, checkin_day: i })}
              className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
                config.checkin_day === i
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
              }`}>
              {DAY_NAMES[i]}
            </button>
          ))}
        </div>
      </div>

      {/* Photo frequency */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 space-y-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{tConfig('photoFrequency')}</p>
          <p className="text-[11px] text-gray-400">Koliko često klijent šalje fotografije napretka</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PHOTO_FREQUENCIES.map(f => (
            <button key={f.value} type="button" onClick={() => setConfig({ ...config, photo_frequency: f.value })}
              className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
                config.photo_frequency === f.value
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {config.photo_frequency !== 'none' && (
          <div className="pt-2 border-t border-gray-50 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{tConfig('photoPositionsLabel')}</p>
            <div className="flex gap-1.5">
              {PHOTO_POSITIONS.map(pos => (
                <button key={pos} type="button" onClick={() => togglePosition(pos)}
                  className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
                    config.photo_positions.includes(pos)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}>
                  {tForm(`photoPositions.${pos}` as any)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 space-y-2">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{tConfig('clientInstructions')}</p>
          <p className="text-[11px] text-gray-400">Upute vidljive klijentu u aplikaciji</p>
        </div>
        <textarea
          value={config.notes}
          onChange={(e) => setConfig({ ...config, notes: e.target.value })}
          placeholder={tConfig('clientInstructionsPlaceholder')}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-24 resize-none focus:outline-none focus:border-teal-300 transition-colors"
        />
      </div>

      {/* Save */}
      <button type="button" onClick={handleSave} disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          saved
            ? 'bg-emerald-600 text-white'
            : 'bg-teal-600 hover:bg-teal-700 text-white'
        } disabled:opacity-60 disabled:cursor-not-allowed`}>
        {saved && <Check size={15} />}
        {saving ? tCommon('saving') : saved ? tConfig('savedSuccess') : tConfig('save')}
      </button>

    </div>
  )
}
