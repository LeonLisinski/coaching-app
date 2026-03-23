'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { UserPlus, X, Dumbbell, UtensilsCrossed, CalendarDays, Check, ChevronRight, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

const GOAL_CHIPS = ['Mršavljenje', 'Mišićna masa', 'Kondicija', 'Snaga', 'Fleksibilnost', 'Opće zdravlje']

type ActivityLevel = '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

const ACTIVITY_OPTIONS: { value: Exclude<ActivityLevel, ''>; label: string; desc: string }[] = [
  { value: 'sedentary',   label: 'Sjedilački',       desc: 'Malo ili bez vježbanja' },
  { value: 'light',       label: 'Lagano aktivan',   desc: '1–3× tjedno' },
  { value: 'moderate',    label: 'Umjereno aktivan', desc: '3–5× tjedno' },
  { value: 'active',      label: 'Jako aktivan',     desc: '6–7× tjedno' },
  { value: 'very_active', label: 'Izuzetno aktivan', desc: 'Fizički posao + trening' },
]

const DAY_NAMES = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']

type Props = { open: boolean; onClose: () => void; onSuccess: () => void }

type Step = 'account' | 'profile' | 'plans'

function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
function dobToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

export default function AddClientDialog({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('clients.dialogs.add')
  const tCommon = useTranslations('common')
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'

  const [step, setStep]       = useState<Step>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [limitInfo, setLimitInfo] = useState<{ current: number; limit: number; plan: string } | null>(null)
  const [limitChecking, setLimitChecking] = useState(false)

  // Step 1
  const [full_name, setFullName]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [gender, setGender]             = useState<'' | 'M' | 'F'>('')
  // Step 2
  const [goal, setGoal]                 = useState('')
  const [dob_display, setDobDisplay]    = useState('')
  const [date_of_birth, setDob]         = useState('')
  const [start_date_display, setStartDateDisplay] = useState('')
  const [start_date, setStartDate]      = useState('')
  const [weight, setWeight]             = useState('')
  const [height, setHeight]             = useState('')
  const [activity_level, setActivity]   = useState<ActivityLevel>('')
  const [notes, setNotes]               = useState('')
  // Step 3
  const [workoutPlans, setWorkoutPlans]   = useState<{ id: string; name: string }[]>([])
  const [mealPlans, setMealPlans]         = useState<{ id: string; name: string }[]>([])
  const [trainerPackages, setTrainerPkgs] = useState<{ id: string; name: string; price: number; duration_days: number; color: string }[]>([])
  const [selectedWorkout, setSelectedWorkout] = useState('')
  const [selectedMeal, setSelectedMeal]       = useState('')
  const [selectedPackage, setSelectedPackage] = useState('')
  const [checkinDay, setCheckinDay]     = useState<number | null>(null)
  const [plansLoading, setPlansLoading] = useState(false)

  const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', scale: 'Scale' }

  // Reset on open + check limit
  useEffect(() => {
    if (open) {
      setStep('account'); setError(''); setLimitInfo(null)
      setFullName(''); setEmail(''); setPassword(''); setGender('')
      setGoal(''); setDobDisplay(''); setDob(''); setStartDateDisplay(''); setStartDate(''); setWeight(''); setHeight(''); setActivity(''); setNotes('')
      setSelectedWorkout(''); setSelectedMeal(''); setSelectedPackage(''); setCheckinDay(null)
      checkLimit()
    }
  }, [open])

  const checkLimit = async () => {
    setLimitChecking(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLimitChecking(false); return }
    const [{ data: sub }, { count }] = await Promise.all([
      supabase.from('subscriptions').select('plan, client_limit').eq('trainer_id', user.id).single(),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('trainer_id', user.id),
    ])
    if (sub && count !== null && count >= sub.client_limit) {
      setLimitInfo({ current: count, limit: sub.client_limit, plan: sub.plan })
    }
    setLimitChecking(false)
  }

  // Load plans when reaching step 3
  useEffect(() => {
    if (step === 'plans' && workoutPlans.length === 0 && mealPlans.length === 0) {
      fetchPlans()
    }
  }, [step])

  const fetchPlans = async () => {
    setPlansLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: wp }, { data: mp }, { data: pkgs }] = await Promise.all([
      supabase.from('workout_plans').select('id, name').eq('trainer_id', user.id).order('name'),
      supabase.from('meal_plans').select('id, name').eq('trainer_id', user.id).order('name'),
      supabase.from('packages').select('id, name, price, duration_days, color').eq('trainer_id', user.id).eq('active', true).order('name'),
    ])
    setWorkoutPlans(wp || [])
    setMealPlans(mp || [])
    setTrainerPkgs(pkgs || [])
    setPlansLoading(false)
  }

  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = accentHex
    e.currentTarget.style.boxShadow = `0 0 0 3px ${accentHex}20`
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = ''
    e.currentTarget.style.boxShadow = ''
  }

  const goNext = () => {
    setError('')
    if (step === 'account') {
      if (!full_name || !email || !password) { setError('Ime, email i lozinka su obavezni.'); return }
      setStep('profile')
    } else if (step === 'profile') {
      setStep('plans')
    }
  }

  const handleSubmit = async () => {
    setLoading(true); setError('')

    const { data: { user: trainer } } = await supabase.auth.getUser()
    if (!trainer) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const response = await fetch(
      'https://nvlrlubvxelrwdzggmno.supabase.co/functions/v1/create-client',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          trainer_id: trainer.id,
          email, password, full_name,
          goal: goal || null,
          date_of_birth: date_of_birth || null,
          weight: weight ? parseFloat(weight) : null,
          height: height ? parseFloat(height) : null,
          gender: gender || null,
          activity_level: activity_level || null,
          notes: notes || null,
        }),
      }
    )
    const result = await response.json()
    if (result.error) { setError(result.error); setLoading(false); return }

    const newClientId = result.client_id
    if (newClientId) {
      // Set start_date if provided
      if (start_date) {
        await supabase.from('clients').update({ start_date }).eq('id', newClientId)
      }
      // Assign training plan
      if (selectedWorkout) {
        await supabase.from('client_workout_plans').insert({
          client_id: newClientId, workout_plan_id: selectedWorkout, trainer_id: trainer.id, active: true,
        })
      }
      // Assign meal plan
      if (selectedMeal) {
        await supabase.from('client_meal_plans').insert({
          client_id: newClientId, meal_plan_id: selectedMeal, trainer_id: trainer.id, active: true,
        })
      }
      // Set up check-in
      if (checkinDay !== null) {
        await supabase.from('checkin_config').insert({
          client_id: newClientId,
          trainer_id: trainer.id,
          checkin_day: checkinDay,
          photo_frequency: 'every',
          photo_positions: ['front', 'side', 'back'],
        })
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
    }

    setLoading(false)
    onClose()
    // Small delay so Supabase has time to commit before parent re-fetches
    setTimeout(onSuccess, 250)
  }

  const STEPS: { key: Step; label: string }[] = [
    { key: 'account', label: 'Račun' },
    { key: 'profile', label: 'Profil' },
    { key: 'plans',   label: 'Planovi' },
  ]

  const PlanPicker = ({ items, selected, onSelect, emptyText }: {
    items: { id: string; name: string }[]; selected: string; onSelect: (id: string) => void; emptyText: string
  }) => (
    <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">{emptyText}</p>
      ) : (
        <>
          <button type="button"
            onClick={() => onSelect('')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-all"
            style={selected === '' ? { borderColor: '#d1d5db', backgroundColor: '#f9fafb', color: '#9ca3af' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
            <span className="text-xs italic">Bez plana</span>
          </button>
          {items.map(p => (
            <button key={p.id} type="button"
              onClick={() => onSelect(p.id)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-all"
              style={selected === p.id
                ? { borderColor: accentHex, backgroundColor: `${accentHex}08`, color: '#111827' }
                : { borderColor: '#e5e7eb', color: '#374151' }}>
              <span className="font-medium truncate">{p.name}</span>
              {selected === p.id && <Check size={13} style={{ color: accentHex, flexShrink: 0 }} />}
            </button>
          ))}
        </>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-[calc(100%-2.5rem)] sm:w-auto flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        {/* Header */}
        <div className="px-6 py-4 shrink-0 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accentHex} 75%, #0f0a1e), color-mix(in srgb, ${accentHex} 55%, #0f0a1e))` }}>
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <UserPlus size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">{t('title')}</h2>
            <p className="text-white/55 text-xs">{t('subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Step indicator — hidden when limit reached */}
        <div className={`flex shrink-0 border-b border-gray-100 ${limitInfo || limitChecking ? 'hidden' : ''}`}>
          {STEPS.map((s, i) => {
            const isActive  = step === s.key
            const isDone    = STEPS.findIndex(x => x.key === step) > i
            return (
              <button key={s.key} type="button"
                onClick={() => isDone && setStep(s.key)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${isActive ? '' : 'border-transparent'} ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
                style={isActive ? { borderBottomColor: accentHex, color: accentHex } : { color: isDone ? '#6b7280' : '#d1d5db' }}>
                <span className="flex items-center justify-center gap-1.5">
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${isActive ? 'text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                    style={isActive ? { backgroundColor: accentHex } : {}}>
                    {isDone ? '✓' : i + 1}
                  </span>
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col">

          {/* ── Limit checking spinner ── */}
          {limitChecking && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
              <span className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Provjera plana...</p>
            </div>
          )}

          {/* ── Limit reached screen ── */}
          {!limitChecking && limitInfo && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={26} className="text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-gray-900 text-base">Dostignut limit klijenata</h3>
                <p className="text-gray-500 text-sm">
                  Na vašem <span className="font-semibold">{PLAN_LABELS[limitInfo.plan] ?? limitInfo.plan}</span> planu možete imati
                  maksimalno <span className="font-semibold">{limitInfo.limit} klijenata</span>.
                </p>
              </div>
              <div className="flex items-baseline gap-1.5 px-5 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-3xl font-extrabold" style={{ color: accentHex }}>{limitInfo.current}</span>
                <span className="text-gray-400 text-sm">/ {limitInfo.limit} klijenata</span>
              </div>
              <p className="text-gray-400 text-xs max-w-[260px]">
                Nadogradite plan kako biste mogli dodavati više klijenata ili deaktivirajte postojeće klijente.
              </p>
              <a
                href="/dashboard/billing"
                className="w-full h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                style={{ backgroundColor: accentHex }}
              >
                <TrendingUp size={15} /> Nadogradi plan
              </a>
            </div>
          )}

          {/* ── Steps (hidden when limit reached or checking) ── */}
          {!limitChecking && !limitInfo && (
          <>

          {/* ── Step 1: Account ── */}
          {step === 'account' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('fullName')} <span className="text-rose-400">*</span></Label>
                  <Input value={full_name} onChange={e => setFullName(e.target.value)} placeholder={t('fullNamePlaceholder')} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('email')} <span className="text-rose-400">*</span></Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} onFocus={inputFocus} onBlur={inputBlur} autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('password')} <span className="text-rose-400">*</span></Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')} onFocus={inputFocus} onBlur={inputBlur} autoComplete="new-password" />
                </div>
              </div>

              {/* Spol */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Spol</Label>
                <div className="flex gap-2">
                  {([['M', '♂ Muško'], ['F', '♀ Žensko']] as const).map(([g, lbl]) => (
                    <button key={g} type="button"
                      onClick={() => setGender(gender === g ? '' : g)}
                      className="flex-1 py-2 rounded-xl border text-sm font-medium transition-all"
                      style={gender === g ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex } : { borderColor: '#e5e7eb', color: '#4b5563' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Profile ── */}
          {step === 'profile' && (
            <div className="space-y-4">
              {/* Goal chips */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">{t('goal')}</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {GOAL_CHIPS.map(chip => (
                    <button key={chip} type="button"
                      onClick={() => setGoal(goal === chip ? '' : chip)}
                      className="text-xs px-2.5 py-1 rounded-full border transition-all font-medium"
                      style={goal === chip ? { backgroundColor: `${accentHex}15`, borderColor: accentHex, color: accentHex } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                      {chip}
                    </button>
                  ))}
                </div>
                <Input value={goal} onChange={e => setGoal(e.target.value)} placeholder="Ili upiši vlastiti cilj..." onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              {/* Tjelesne mjere */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('weight')}</Label>
                  <Input type="text" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value.replace(',', '.'))} placeholder="80" onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('height')}</Label>
                  <Input type="text" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value.replace(',', '.'))} placeholder="180" onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('dateOfBirth')}</Label>
                  <Input type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10}
                    value={dob_display}
                    onChange={e => { const f = formatDobInput(e.target.value); setDobDisplay(f); setDob(dobToIso(f)) }}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
              </div>

              {/* Datum početka suradnje */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">{t('startDate')}</Label>
                  <Input type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10}
                    value={start_date_display}
                    onChange={e => { const f = formatDobInput(e.target.value); setStartDateDisplay(f); setStartDate(dobToIso(f)) }}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
              </div>

              {/* Activity level */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Razina aktivnosti</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ACTIVITY_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setActivity(activity_level === opt.value ? '' : opt.value)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all"
                      style={activity_level === opt.value ? { backgroundColor: `${accentHex}12`, borderColor: accentHex, color: accentHex } : { borderColor: '#e5e7eb', color: '#374151' }}>
                      <div>
                        <p className="text-xs font-medium leading-none">{opt.label}</p>
                        <p className="text-[10px] mt-0.5 opacity-60">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bilješke */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Bilješke</Label>
                <Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  placeholder="Ozljede, alergije, posebni zahtjevi..." rows={2} className="resize-none text-sm" />
              </div>
            </div>
          )}

          {/* ── Step 3: Plans & Check-in ── */}
          {step === 'plans' && (
            <div className="space-y-5">
              {plansLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : (
                <>
                  {/* Training plan */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <Dumbbell size={12} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700">Plan treninga</p>
                      {selectedWorkout && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: accentHex }}>Odabran</span>}
                    </div>
                    <PlanPicker
                      items={workoutPlans}
                      selected={selectedWorkout}
                      onSelect={setSelectedWorkout}
                      emptyText="Nema kreiranih planova treninga"
                    />
                  </div>

                  {/* Meal plan */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <UtensilsCrossed size={12} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700">Plan prehrane</p>
                      {selectedMeal && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: accentHex }}>Odabran</span>}
                    </div>
                    <PlanPicker
                      items={mealPlans}
                      selected={selectedMeal}
                      onSelect={setSelectedMeal}
                      emptyText="Nema kreiranih planova prehrane"
                    />
                  </div>

                  {/* Payment package */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <CreditCard size={12} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700">Paket plaćanja</p>
                      {selectedPackage && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: accentHex }}>Odabran</span>}
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                      {trainerPackages.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 text-center">Nema kreiranih paketa</p>
                      ) : (
                        <>
                          <button type="button" onClick={() => setSelectedPackage('')}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-all"
                            style={selectedPackage === '' ? { borderColor: '#d1d5db', backgroundColor: '#f9fafb', color: '#9ca3af' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                            <span className="text-xs italic">Bez paketa</span>
                          </button>
                          {trainerPackages.map(p => (
                            <button key={p.id} type="button" onClick={() => setSelectedPackage(p.id)}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-all"
                              style={selectedPackage === p.id ? { borderColor: accentHex, backgroundColor: `${accentHex}08` } : { borderColor: '#e5e7eb' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="font-medium text-gray-800 truncate">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-400">{p.price} € / {Math.round(p.duration_days / 30)} mj.</span>
                                {selectedPackage === p.id && <Check size={13} style={{ color: accentHex }} />}
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Check-in day */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <CalendarDays size={12} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700">Dan check-ina</p>
                      {checkinDay !== null && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: accentHex }}>{DAY_NAMES[checkinDay]}</span>}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {DAY_NAMES.map((d, i) => (
                        <button key={i} type="button"
                          onClick={() => setCheckinDay(checkinDay === i ? null : i)}
                          className="py-2 rounded-xl border text-xs font-semibold transition-all"
                          style={checkinDay === i ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                    {checkinDay !== null && (
                      <p className="text-xs text-gray-400 mt-1">Foto postavke i parametri mogu se konfigurirati na profilu klijenta.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
          {limitInfo || limitChecking ? (
            <button type="button" onClick={onClose}
              className="w-full h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {tCommon('cancel')}
            </button>
          ) : (
            <>
              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{error}</p>}
              <div className="flex gap-3">
                {step !== 'account' ? (
                  <button type="button" onClick={() => setStep(step === 'plans' ? 'profile' : 'account')}
                    className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    ← Natrag
                  </button>
                ) : (
                  <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    {tCommon('cancel')}
                  </button>
                )}
                {step !== 'plans' ? (
                  <button type="button" onClick={goNext}
                    className="flex-1 h-9 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: accentHex }}>
                    Dalje <ChevronRight size={14} />
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={loading}
                    className="flex-1 h-9 rounded-lg text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ backgroundColor: accentHex }}>
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Kreiranje...</>
                      : t('submit')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

