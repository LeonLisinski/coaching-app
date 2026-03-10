'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type ActivityLevel = '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

const ACTIVITY_OPTIONS: { value: Exclude<ActivityLevel, ''>; label: string; desc: string }[] = [
  { value: 'sedentary',   label: 'Sjedilački',       desc: 'Malo ili bez vježbanja' },
  { value: 'light',       label: 'Lagano aktivan',   desc: '1–3× tjedno' },
  { value: 'moderate',    label: 'Umjereno aktivan', desc: '3–5× tjedno' },
  { value: 'active',      label: 'Jako aktivan',     desc: '6–7× tjedno' },
  { value: 'very_active', label: 'Izuzetno aktivan', desc: 'Fizički posao + trening' },
]

function ActivityLevelPicker({ value, onChange }: { value: ActivityLevel; onChange: (v: ActivityLevel) => void }) {
  return (
    <div className="space-y-2">
      <Label>Razina aktivnosti</Label>
      <div className="grid grid-cols-1 gap-1.5">
        {ACTIVITY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(value === opt.value ? '' : opt.value)}
            className={`flex items-center justify-between px-3 py-2 rounded-md border text-left text-sm transition-colors ${
              value === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input bg-background hover:bg-accent'
            }`}
          >
            <span className="font-medium">{opt.label}</span>
            <span className={`text-xs ${value === opt.value ? 'opacity-80' : 'text-gray-400'}`}>{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

/** Converts "dd/mm/yyyy" display string → "yyyy-mm-dd" ISO string */
function dobDisplayToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** Auto-formats digit-only input as "dd/mm/yyyy" */
function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Converts "yyyy-mm-dd" → "dd/mm/yyyy" for display */
function isoToDisplay(iso: string): string {
  if (!iso || !iso.match(/^\d{4}-\d{2}-\d{2}$/)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function AddClientDialog({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('clients.dialogs.add')
  const tCommon = useTranslations('common')

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    goal: '',
    dob_display: '',
    date_of_birth: '',
    weight: '',
    height: '',
    gender: '' as '' | 'M' | 'F',
    activity_level: '' as '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDobInput = (raw: string) => {
    const formatted = formatDobInput(raw)
    const iso = dobDisplayToIso(formatted)
    setForm(f => ({ ...f, dob_display: formatted, date_of_birth: iso }))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user: trainer } } = await supabase.auth.getUser()
    if (!trainer) return

    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(
      'https://nvlrlubvxelrwdzggmno.supabase.co/functions/v1/create-client',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          trainer_id: trainer.id,
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          goal: form.goal || null,
          date_of_birth: form.date_of_birth || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          height: form.height ? parseFloat(form.height) : null,
          gender: form.gender || null,
          activity_level: form.activity_level || null,
          notes: form.notes || null,
        }),
      }
    )

    const result = await response.json()
    if (result.error) { setError(result.error); setLoading(false); return }

    setLoading(false)
    onSuccess()
    onClose()
    setForm({ full_name: '', email: '', password: '', goal: '', dob_display: '', date_of_birth: '', weight: '', height: '', gender: '', activity_level: '', notes: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('fullName')}</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder={t('fullNamePlaceholder')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('email')}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={t('emailPlaceholder')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('password')}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t('passwordPlaceholder')}
              required
            />
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label>Spol</Label>
            <div className="flex gap-2">
              {(['M', 'F'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm({ ...form, gender: form.gender === g ? '' : g })}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                    form.gender === g
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {g === 'M' ? '♂ Muško' : '♀ Žensko'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('goal')}</Label>
            <Input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder={t('goalPlaceholder')}
            />
          </div>

          {/* Activity level */}
          <ActivityLevelPicker
            value={form.activity_level}
            onChange={v => setForm({ ...form, activity_level: v })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('weight')}</Label>
              <Input
                type="text" inputMode="decimal"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value.replace(',', '.') })}
                placeholder="80"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('height')}</Label>
              <Input
                type="text" inputMode="decimal"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value.replace(',', '.') })}
                placeholder="180"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('dateOfBirth')}</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              value={form.dob_display}
              onChange={(e) => handleDobInput(e.target.value)}
              maxLength={10}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Bilješke</Label>
            <Textarea
              value={form.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, notes: e.target.value })}
              placeholder="Veganska prehrana, ozljede, alergije..."
              rows={3}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? t('adding') : t('submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
