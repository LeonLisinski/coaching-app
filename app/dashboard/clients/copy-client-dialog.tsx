'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { edgeFunctionUrl } from '@/lib/supabase-edge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, X, Check, ChevronDown, ChevronUp, Dumbbell, UtensilsCrossed, ClipboardCheck, Zap, CreditCard } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTranslations } from 'next-intl'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  sourceClientId: string
  sourceClientName: string
}

type SourceData = {
  workout_plan_name: string | null
  meal_plan_name: string | null
  has_checkin_config: boolean
  weight: number | null
  height: number | null
  date_of_birth: string | null
  goal: string | null
  activity_level: string | null
}

function calcAge(dob: string): number {
  const today = new Date(); const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

type CopyCheckRowProps = {
  accentHex: string
  checked: boolean
  onToggle: (v: boolean) => void
  icon: LucideIcon
  label: string
  /** Shown when the row is available (or always as primary detail). */
  sub: string
  available: boolean
  /** Shown in gray when the row cannot be copied (e.g. no plan on source). */
  unavailableHint: string
}

function CopyCheckRow({ accentHex, checked, onToggle, icon: Icon, label, sub, available, unavailableHint }: CopyCheckRowProps) {
  return (
    <button type="button" onClick={() => available && onToggle(!checked)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${!available ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      style={checked && available ? { borderColor: accentHex, backgroundColor: `${accentHex}08` } : { borderColor: '#e5e7eb' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={checked && available ? { backgroundColor: `${accentHex}18`, color: accentHex } : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{available ? sub : unavailableHint}</p>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${checked && available ? 'border-current text-white' : 'border-gray-200'}`}
        style={checked && available ? { backgroundColor: accentHex, borderColor: accentHex } : {}}>
        {checked && available && <Check size={11} />}
      </div>
    </button>
  )
}

export default function CopyClientDialog({ open, onClose, onSuccess, sourceClientId, sourceClientName }: Props) {
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const t = useTranslations('clients.copy')
  const tc = useTranslations('clients.calculator')
  const tCommon = useTranslations('common')

  const [step, setStep] = useState<'info' | 'copy'>('info')
  const [loading, setLoading] = useState(false)
  const [loadingSource, setLoadingSource] = useState(true)
  const [error, setError] = useState('')
  const [sourceData, setSourceData] = useState<SourceData | null>(null)

  const [form, setForm] = useState({ full_name: '', email: '', weight: '', height: '', dob: '', gender: '' as '' | 'M' | 'F' })
  const [copyWorkout, setCopyWorkout]   = useState(true)
  const [copyMeal, setCopyMeal]         = useState(true)
  const [copyCheckin, setCopyCheckin]   = useState(true)
  const [showMacros, setShowMacros]     = useState(false)
  const [trainerPackages, setTrainerPkgs] = useState<{ id: string; name: string; price: number; duration_days: number; color: string }[]>([])
  const [selectedPackage, setSelectedPackage] = useState('')

  // Auto-computed macros (Mifflin-St Jeor TDEE)
  const computedTDEE = (() => {
    const w = parseFloat(form.weight) || null
    const h = parseFloat(form.height) || null
    const age = form.dob ? calcAge(form.dob) : null
    if (!w || !h || !age) return null
    const bmr = form.gender === 'F'
      ? 10 * w + 6.25 * h - 5 * age - 161
      : 10 * w + 6.25 * h - 5 * age + 5
    const srcActivity = sourceData?.activity_level || 'moderate'
    const multiplier = ACTIVITY_MULTIPLIERS[srcActivity] || 1.55
    return Math.round(bmr * multiplier)
  })()

  const goalMacros = (() => {
    if (!computedTDEE) return null
    const goal = sourceData?.goal?.toLowerCase() || ''
    const kcal = goal.includes('mršav') || goal.includes('cut') ? computedTDEE - 300
      : goal.includes('masa') || goal.includes('bulk') ? computedTDEE + 300
      : computedTDEE
    const p = Math.round((kcal * 0.30) / 4)
    const f = Math.round((kcal * 0.30) / 9)
    const c = Math.round((kcal * 0.40) / 4)
    return { kcal, protein: p, fat: f, carbs: c }
  })()

  const fetchPackages = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { data } = await supabase.from('packages').select('id, name, price, duration_days, color').eq('trainer_id', user.id).eq('active', true).order('name')
    setTrainerPkgs(data || [])
  }, [])

  const fetchSource = useCallback(async () => {
    setLoadingSource(true)
    const [{ data: client }, { data: workout }, { data: meal }, { data: cc }] = await Promise.all([
      supabase.from('clients')
        .select('weight, height, date_of_birth, goal, activity_level')
        .eq('id', sourceClientId).single(),
      supabase.from('client_workout_plans')
        .select('workout_plan:workout_plans(name)').eq('client_id', sourceClientId).eq('active', true).limit(1).maybeSingle(),
      supabase.from('client_meal_plans')
        .select('meal_plan:meal_plans(name)').eq('client_id', sourceClientId).eq('active', true).limit(1).maybeSingle(),
      supabase.from('checkin_config')
        .select('id').eq('client_id', sourceClientId).limit(1).maybeSingle(),
    ])
    setSourceData({
      workout_plan_name: (workout?.workout_plan as { name?: string } | null)?.name ?? null,
      meal_plan_name: (meal?.meal_plan as { name?: string } | null)?.name ?? null,
      has_checkin_config: !!cc,
      weight: client?.weight || null,
      height: client?.height || null,
      date_of_birth: client?.date_of_birth || null,
      goal: client?.goal || null,
      activity_level: client?.activity_level || null,
    })
    setLoadingSource(false)
  }, [sourceClientId])

  /* Reset step when dialog opens; async fetches run after. */
  /* eslint-disable react-hooks/set-state-in-effect -- dialog open lifecycle */
  useEffect(() => {
    if (!open) return
    setStep('info')
    setError('')
    setSelectedPackage('')
    void fetchSource()
    void fetchPackages()
  }, [open, sourceClientId, fetchSource, fetchPackages])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCreate = async () => {
    if (!form.full_name || !form.email) { setError(`${t('fullName')}, ${t('email')}`); return }
    setLoading(true); setError('')

    const { data: { user: trainer } } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    if (!trainer || !session) { setLoading(false); return }

    // Create new client account via edge function
    let res: Response
    try {
      res = await fetch(edgeFunctionUrl('create-client'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          trainer_id: trainer.id,
          email: form.email,
          full_name: form.full_name,
          gender: form.gender || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          height: form.height ? parseFloat(form.height) : null,
          date_of_birth: form.dob || null,
          goal: sourceData?.goal || null,
          activity_level: sourceData?.activity_level || null,
        }),
      })
    } catch {
      setError('Greška u mreži. Pokušaj ponovo.')
      setLoading(false)
      return
    }
    const result = await res.json().catch(() => ({ error: 'Server error' })) as {
      error?: string
      message?: string
      client_id?: string
      reactivated?: boolean
    }
    if (result.error) {
      const friendly: Record<string, string> = {
        ALREADY_CLIENT: 'Ova osoba je već tvoj aktivni klijent.',
        HAS_ACTIVE_TRAINER: 'Ova osoba trenutno aktivno trenira s drugim trenerom. Mora završiti tu suradnju prije nego može početi s tobom.',
        SELF_AS_CLIENT: 'Ne možeš dodati sam sebe kao klijenta.',
        CLIENT_LIMIT_REACHED: 'Dosegnut je limit klijenata na tvom planu. Nadogradi plan za više slotova.',
      }
      setError(friendly[result.error] ?? result.message ?? result.error)
      setLoading(false)
      return
    }

    const newClientId = result.client_id
    if (!newClientId) { setError('Greška pri kreiranju klijenta.'); setLoading(false); return }

    // Reactivated relationships already have plans/config from the previous
    // collaboration period — copying again would duplicate or fail UNIQUE
    // constraints. Skip the copy phase; trainer can adjust via edit dialog.
    if (result.reactivated) {
      setLoading(false)
      onSuccess()
      onClose()
      return
    }

    // Copy training plan
    if (copyWorkout) {
      const { data: wp } = await supabase.from('client_workout_plans')
        .select('*').eq('client_id', sourceClientId).eq('active', true).limit(1).maybeSingle()
      if (wp) {
        await supabase.from('client_workout_plans').insert({
          client_id: newClientId,
          workout_plan_id: wp.workout_plan_id,
          trainer_id: trainer.id,
          active: true,
          notes: wp.notes || null,
          days: wp.days || null,
        })
      }
    }

    // Copy meal plan
    if (copyMeal) {
      const { data: mp } = await supabase.from('client_meal_plans')
        .select('*').eq('client_id', sourceClientId).eq('active', true).limit(1).maybeSingle()
      if (mp) {
        await supabase.from('client_meal_plans').insert({
          client_id: newClientId,
          meal_plan_id: mp.meal_plan_id,
          trainer_id: trainer.id,
          active: true,
          notes: mp.notes || null,
          meals: mp.meals || null,
          calories_target: goalMacros?.kcal || mp.calories_target,
          protein_target: goalMacros?.protein || mp.protein_target,
          carbs_target: goalMacros?.carbs || mp.carbs_target,
          fat_target: goalMacros?.fat || mp.fat_target,
        })
      }
    }

    // Copy checkin config
    if (copyCheckin) {
      const { data: cc } = await supabase.from('checkin_config')
        .select('*').eq('client_id', sourceClientId).maybeSingle()
      if (cc) {
        await supabase.from('checkin_config').insert({
          client_id: newClientId,
          trainer_id: trainer.id,
          checkin_day: cc.checkin_day,
          photo_frequency: cc.photo_frequency || 'every',
          photo_positions: cc.photo_positions || ['front', 'side', 'back'],
          notes: cc.notes || null,
        })
        // Copy checkin parameters (without personal data)
        const { data: params } = await supabase.from('checkin_parameters')
          .select('*').eq('client_id', sourceClientId)
        if (params?.length) {
          await supabase.from('checkin_parameters').insert(
            params.map(p => ({
              client_id: newClientId,
              name: p.name,
              type: p.type,
              unit: p.unit,
              required: p.required,
              frequency: p.frequency,
              order_index: p.order_index,
            }))
          )
        }
      }
    }

      // Assign payment package
      if (selectedPackage) {
        const pkg = trainerPackages.find(p => p.id === selectedPackage)
        if (pkg) {
          const start = new Date()
          const startDate = start.toISOString().slice(0, 10)
          const end = new Date(start)
          end.setMonth(end.getMonth() + Math.round(pkg.duration_days / 30))
          const endDate = end.toISOString().slice(0, 10)
        await supabase.from('client_packages').insert({
          client_id: newClientId, package_id: pkg.id, trainer_id: trainer.id,
          price: pkg.price, start_date: startDate, end_date: endDate, status: 'active',
        })
      }
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = accentHex; e.currentTarget.style.boxShadow = `0 0 0 3px ${accentHex}20` }
  const inputBlur  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        {/* Header */}
        <div className="px-6 py-4 shrink-0 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accentHex} 75%, #0f0a1e), color-mix(in srgb, ${accentHex} 55%, #0f0a1e))` }}>
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Copy size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-sm">{t('title')}</h2>
            <p className="text-white/55 text-xs">{t('sourceLabel')}: <span className="font-semibold text-white/80">{sourceClientName}</span></p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Step tabs */}
        <div className="flex shrink-0 border-b border-gray-100">
          {(['info', 'copy'] as const).map((s, i) => (
            <button key={s} onClick={() => step === 'copy' && setStep(s)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${step === s ? 'border-b-2 text-gray-900' : 'text-gray-400'}`}
              style={step === s ? { borderBottomColor: accentHex, color: accentHex } : {}}>
              {i + 1}. {s === 'info' ? t('stepInfo') : t('stepCopy')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Step 1: New client info */}
          {step === 'info' && (
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('fullName')} <span className="text-rose-400">*</span></Label>
                  <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder={t('fullNamePlaceholder')} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('email')} <span className="text-rose-400">*</span></Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('emailPlaceholder')} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{t('inviteEmailHint')}</p>
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">{t('gender')}</Label>
                <div className="flex gap-2">
                  {([['M', `♂ ${t('genderMale')}`], ['F', `♀ ${t('genderFemale')}`]] as const).map(([g, lbl]) => (
                    <button key={g} type="button"
                      onClick={() => setForm(f => ({ ...f, gender: f.gender === g ? '' : g }))}
                      className="flex-1 py-2 rounded-xl border text-sm font-medium transition-all"
                      style={form.gender === g ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex } : { borderColor: '#e5e7eb', color: '#4b5563' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical data for macros */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{t('macroCalc')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">{t('weight')}</Label>
                    <Input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="80" onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">{t('height')}</Label>
                    <Input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} placeholder="180" onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">{t('dob')}</Label>
                    <Input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>
              </div>

              {/* Macros preview */}
              {computedTDEE && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accentHex}30` }}>
                  <button type="button" onClick={() => setShowMacros(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    style={{ backgroundColor: `${accentHex}08` }}>
                    <div className="flex items-center gap-2">
                      <Zap size={13} style={{ color: accentHex }} />
                      <span className="text-xs font-semibold" style={{ color: accentHex }}>
                        Preporučeni unos: {goalMacros?.kcal} kcal/dan
                      </span>
                    </div>
                    {showMacros ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
                  </button>
                  {showMacros && goalMacros && (
                    <div className="px-3 py-2.5 grid grid-cols-3 gap-2">
                      {[
                        { label: tc('protein'), val: `${goalMacros.protein}g`, color: 'text-blue-600' },
                        { label: tc('carbs'), val: `${goalMacros.carbs}g`, color: 'text-amber-600' },
                        { label: tc('fat'), val: `${goalMacros.fat}g`, color: 'text-rose-500' },
                      ].map(m => (
                        <div key={m.label} className="text-center">
                          <p className={`text-sm font-bold ${m.color}`}>{m.val}</p>
                          <p className="text-[10px] text-gray-400">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: What to copy */}
          {step === 'copy' && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs text-gray-500 mb-1">
                {t('sourceLabel')}: <span className="font-semibold text-gray-700">{sourceClientName}</span>
              </p>
              {loadingSource ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : (
                <>
                  <CopyCheckRow accentHex={accentHex} checked={copyWorkout} onToggle={setCopyWorkout} icon={Dumbbell} label={t('copyWorkout')}
                    sub={sourceData?.workout_plan_name || t('noWorkout')} available={!!sourceData?.workout_plan_name} unavailableHint={t('noWorkout')} />
                  <CopyCheckRow accentHex={accentHex} checked={copyMeal} onToggle={setCopyMeal} icon={UtensilsCrossed} label={t('copyMeal')}
                    sub={sourceData?.meal_plan_name || t('noMeal')} available={!!sourceData?.meal_plan_name} unavailableHint={t('noMeal')} />
                  <CopyCheckRow accentHex={accentHex} checked={copyCheckin} onToggle={setCopyCheckin} icon={ClipboardCheck} label={t('copyCheckin')}
                    sub={t('noCheckin')} available={sourceData?.has_checkin_config ?? false} unavailableHint={t('noCheckin')} />

                  {goalMacros && copyMeal && sourceData?.meal_plan_name && (
                    <div className="rounded-xl px-3 py-2 text-xs text-gray-500 flex items-start gap-2"
                      style={{ backgroundColor: `${accentHex}08`, border: `1px solid ${accentHex}20` }}>
                      <Zap size={12} className="shrink-0 mt-0.5" style={{ color: accentHex }} />
                      <span>Makrosi iz koraka 1 bit će automatski primijenjeni na plan prehrane ({goalMacros.kcal} kcal).</span>
                    </div>
                  )}

                  {/* Payment package selection */}
                  <div className="pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <CreditCard size={11} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700">{t('copyPackage')}</p>
                      {selectedPackage && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: accentHex }}>Odabran</span>}
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                      {trainerPackages.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 text-center">{t('noPackage')}</p>
                      ) : (
                        <>
                          <button type="button" onClick={() => setSelectedPackage('')}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl border text-left text-sm transition-all"
                            style={selectedPackage === '' ? { borderColor: '#d1d5db', backgroundColor: '#f9fafb', color: '#9ca3af' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                            <span className="text-xs italic">{t('notAvailable')}</span>
                          </button>
                          {trainerPackages.map(p => (
                            <button key={p.id} type="button" onClick={() => setSelectedPackage(p.id)}
                              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-left text-sm transition-all"
                              style={selectedPackage === p.id ? { borderColor: accentHex, backgroundColor: `${accentHex}08` } : { borderColor: '#e5e7eb' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="font-medium text-gray-800 truncate">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-400">{p.price} € / {Math.round(p.duration_days / 30)} mj.</span>
                                {selectedPackage === p.id && <Check size={12} style={{ color: accentHex }} />}
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p className="mx-6 text-red-500 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-3 bg-white">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            {tCommon('cancel')}
          </button>
          {step === 'info' ? (
            <button type="button"
              onClick={() => {
                if (!form.full_name || !form.email) { setError(`${t('fullName')}, ${t('email')}`); return }
                setError(''); setStep('copy')
              }}
              className="flex-1 h-9 rounded-lg text-white text-sm font-semibold transition-opacity"
              style={{ backgroundColor: accentHex }}>
              {t('next')}
            </button>
          ) : (
            <button type="button" onClick={handleCreate} disabled={loading}
              className="flex-1 h-9 rounded-lg text-white text-sm font-semibold transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: accentHex }}>
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('submitting')}</> : t('submit')}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

