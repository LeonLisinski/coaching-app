'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

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

  if (loading) return <p className="text-gray-500 text-sm">{tCommon('loading')}</p>

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>{tConfig('checkinDay')}</Label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <Button
                  key={i}
                  variant={config.checkin_day === i ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConfig({ ...config, checkin_day: i })}
                >
                  {tDays(String(i)).slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tConfig('photoFrequency')}</Label>
            <div className="flex gap-2 flex-wrap">
              {PHOTO_FREQUENCIES.map(f => (
                <Button
                  key={f.value}
                  variant={config.photo_frequency === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConfig({ ...config, photo_frequency: f.value })}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {config.photo_frequency !== 'none' && (
            <div className="space-y-2">
              <Label>{tConfig('photoPositionsLabel')}</Label>
              <div className="flex gap-2">
                {PHOTO_POSITIONS.map(pos => (
                  <Button
                    key={pos}
                    variant={config.photo_positions.includes(pos) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => togglePosition(pos)}
                  >
                    {tForm(`photoPositions.${pos}` as any)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{tConfig('clientInstructions')}</Label>
            <textarea
              value={config.notes}
              onChange={(e) => setConfig({ ...config, notes: e.target.value })}
              placeholder={tConfig('clientInstructionsPlaceholder')}
              className="w-full border rounded-md px-3 py-2 text-sm min-h-24 resize-none"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? tCommon('saving') : saved ? tConfig('savedSuccess') : tConfig('save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
