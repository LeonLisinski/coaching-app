'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useTranslations } from 'next-intl'
import { UserCog, X as XIcon, Dumbbell, UtensilsCrossed, Check, CreditCard, RefreshCw } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX_MAP: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type ActivityLevel = '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
const ACTIVITY_OPTIONS: { value: Exclude<ActivityLevel, ''>; label: string; desc: string }[] = [
  { value: 'sedentary',   label: 'Sjedilački',       desc: 'Malo ili bez vježbanja' },
  { value: 'light',       label: 'Lagano aktivan',   desc: '1–3× tjedno' },
  { value: 'moderate',    label: 'Umjereno aktivan', desc: '3–5× tjedno' },
  { value: 'active',      label: 'Jako aktivan',     desc: '6–7× tjedno' },
  { value: 'very_active', label: 'Izuzetno aktivan', desc: 'Fizički posao + trening' },
]

type Client = {
  id: string; full_name: string; goal: string | null; date_of_birth: string | null
  weight: number | null; height: number | null; start_date: string | null
  active: boolean; gender?: string | null; notes?: string | null
  activity_level?: string | null; step_goal?: number | null
}
type Plan = { id: string; name: string }
type PkgTemplate = { id: string; name: string; price: number; duration_days: number; color: string }
type ActiveCp = { id: string; pkg_name: string; pkg_color: string; end_date: string; price: number }

function addMonths(date: Date, months: number): Date {
  const d = new Date(date); d.setMonth(d.getMonth() + months); return d
}
function durationLabel(days: number): string {
  const m = Math.round(days / 30); return m === 1 ? '1 mj.' : `${m} mj.`
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}. ${m}. ${y}.`
}

type Props = { client: Client; open: boolean; onClose: () => void; onSuccess: () => void }

function dobDisplayToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
function isoToDisplay(iso: string | null): string {
  if (!iso || !iso.match(/^\d{4}-\d{2}-\d{2}$/)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function EditClientDialog({ client, open, onClose, onSuccess }: Props) {
  const t = useTranslations('clients.dialogs.edit')
  const tAdd = useTranslations('clients.dialogs.add')
  const tCommon = useTranslations('common')
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'

  const validActivityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active']
  const [tab, setTab] = useState<'profile' | 'plans'>('profile')

  const [form, setForm] = useState({
    full_name: client.full_name,
    goal: client.goal || '',
    dob_display: isoToDisplay(client.date_of_birth),
    date_of_birth: client.date_of_birth || '',
    weight: client.weight?.toString() || '',
    height: client.height?.toString() || '',
    start_date: client.start_date || '',
    start_date_display: isoToDisplay(client.start_date),
    gender: (client.gender === 'M' || client.gender === 'F') ? client.gender as 'M' | 'F' : '' as '' | 'M' | 'F',
    activity_level: (validActivityLevels.includes(client.activity_level || '') ? client.activity_level : '') as ActivityLevel,
    notes: client.notes || '',
    step_goal: client.step_goal?.toString() || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Plans tab state
  const [workoutPlans, setWorkoutPlans] = useState<Plan[]>([])
  const [mealPlans, setMealPlans] = useState<Plan[]>([])
  const [currentWorkout, setCurrentWorkout] = useState<string | null>(null)
  const [currentMeal, setCurrentMeal] = useState<string | null>(null)
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null)
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null)
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansSaved, setPlansSaved] = useState(false)
  const [savingPlans, setSavingPlans] = useState(false)

  // Package state
  const [pkgTemplates, setPkgTemplates]   = useState<PkgTemplate[]>([])
  const [activeCp, setActiveCp]           = useState<ActiveCp | null>(null)
  const [selectedPkg, setSelectedPkg]     = useState<string | null>(null)
  const [savingPkg, setSavingPkg]         = useState(false)
  const [pkgSaved, setPkgSaved]           = useState(false)

  // Re-fetch fresh client data every time dialog opens (fixes stale step_goal etc.)
  useEffect(() => {
    if (!open) return
    supabase.from('clients')
      .select('goal, weight, height, date_of_birth, start_date, gender, activity_level, notes, step_goal')
      .eq('id', client.id).single()
      .then(({ data }) => {
        if (!data) return
        const vAL = ['sedentary', 'light', 'moderate', 'active', 'very_active']
        setForm(f => ({
          ...f,
          goal:           data.goal || '',
          weight:         data.weight?.toString() || '',
          height:         data.height?.toString() || '',
          dob_display:    isoToDisplay(data.date_of_birth),
          date_of_birth:  data.date_of_birth || '',
          start_date:         data.start_date || '',
          start_date_display: isoToDisplay(data.start_date),
          gender:         (data.gender === 'M' || data.gender === 'F') ? data.gender : '',
          activity_level: (vAL.includes(data.activity_level || '') ? data.activity_level : '') as ActivityLevel,
          notes:          data.notes || '',
          step_goal:      data.step_goal?.toString() || '',
        }))
      })
  }, [open, client.id])

  useEffect(() => {
    if (open && tab === 'plans') fetchPlans()
  }, [open, tab])

  const fetchPlans = async () => {
    setPlansLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: wp }, { data: mp }, { data: cwp }, { data: cmp }, { data: pkgs }, { data: cpData }] = await Promise.all([
      supabase.from('workout_plans').select('id, name').eq('trainer_id', user.id).order('name'),
      supabase.from('meal_plans').select('id, name').eq('trainer_id', user.id).order('name'),
      supabase.from('client_workout_plans').select('workout_plan_id').eq('client_id', client.id).eq('active', true).maybeSingle(),
      supabase.from('client_meal_plans').select('meal_plan_id').eq('client_id', client.id).eq('active', true).maybeSingle(),
      supabase.from('packages').select('id, name, price, duration_days, color').eq('trainer_id', user.id).eq('active', true).order('name'),
      supabase.from('client_packages').select('id, end_date, price, packages(name, color)').eq('client_id', client.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    setWorkoutPlans(wp || [])
    setMealPlans(mp || [])
    const wId = cwp?.workout_plan_id || null
    const mId = cmp?.meal_plan_id || null
    setCurrentWorkout(wId); setCurrentMeal(mId)
    setSelectedWorkout(wId); setSelectedMeal(mId)
    setPkgTemplates(pkgs || [])
    if (cpData) {
      setActiveCp({ id: cpData.id, pkg_name: (cpData.packages as any)?.name || '—', pkg_color: (cpData.packages as any)?.color || '#6366f1', end_date: cpData.end_date, price: cpData.price })
    } else { setActiveCp(null) }
    setSelectedPkg(null)
    setPlansLoading(false)
  }

  const assignOrReplacePkg = async () => {
    if (!selectedPkg) return
    setSavingPkg(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingPkg(false); return }
    const pkg = pkgTemplates.find(p => p.id === selectedPkg)
    if (!pkg) { setSavingPkg(false); return }

    // Expire active package if exists
    if (activeCp) {
      await supabase.from('client_packages').update({ status: 'expired' }).eq('id', activeCp.id)
    }
    const start = new Date()
    const end   = addMonths(start, Math.round(pkg.duration_days / 30))
    const { data: cpData } = await supabase.from('client_packages').insert({
      trainer_id: user.id, client_id: client.id, package_id: pkg.id,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      price: pkg.price, status: 'active',
    }).select().single()
    if (cpData) {
      await supabase.from('payments').insert({ trainer_id: user.id, client_id: client.id, client_package_id: cpData.id, amount: pkg.price, status: 'pending' })
    }
    setSavingPkg(false); setPkgSaved(true); setTimeout(() => setPkgSaved(false), 2500)
    setSelectedPkg(null)
    fetchPlans()
    onSuccess()
  }

  const handleDobInput = (raw: string) => {
    const formatted = formatDobInput(raw)
    const iso = dobDisplayToIso(formatted)
    setForm(f => ({ ...f, dob_display: formatted, date_of_birth: iso }))
  }

  const handleSubmitProfile = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const { data: clientData } = await supabase.from('clients').select('user_id').eq('id', client.id).single()
    if (clientData) {
      await supabase.from('profiles').update({ full_name: form.full_name }).eq('id', clientData.user_id)
    }

    const { error } = await supabase.from('clients').update({
      full_name: form.full_name,
      goal: form.goal || null,
      date_of_birth: form.date_of_birth || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      start_date: form.start_date || null,
      gender: form.gender === '' ? null : form.gender,
      activity_level: form.activity_level || null,
      notes: form.notes || null,
      step_goal: form.step_goal ? parseInt(form.step_goal) : null,
    }).eq('id', client.id)

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    onSuccess(); onClose()
  }

  const savePlans = async () => {
    setSavingPlans(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingPlans(false); return }

    // Handle workout plan change
    if (selectedWorkout !== currentWorkout) {
      if (currentWorkout) {
        await supabase.from('client_workout_plans').update({ active: false })
          .eq('client_id', client.id).eq('workout_plan_id', currentWorkout)
      }
      if (selectedWorkout) {
        // Check if assignment already exists (inactive)
        const { data: existing } = await supabase.from('client_workout_plans')
          .select('id').eq('client_id', client.id).eq('workout_plan_id', selectedWorkout).maybeSingle()
        if (existing) {
          await supabase.from('client_workout_plans').update({ active: true }).eq('id', existing.id)
        } else {
          await supabase.from('client_workout_plans').insert({
            client_id: client.id, workout_plan_id: selectedWorkout, trainer_id: user.id, active: true,
          })
        }
      }
    }

    // Handle meal plan change
    if (selectedMeal !== currentMeal) {
      if (currentMeal) {
        await supabase.from('client_meal_plans').update({ active: false })
          .eq('client_id', client.id).eq('meal_plan_id', currentMeal)
      }
      if (selectedMeal) {
        const { data: existing } = await supabase.from('client_meal_plans')
          .select('id').eq('client_id', client.id).eq('meal_plan_id', selectedMeal).maybeSingle()
        if (existing) {
          await supabase.from('client_meal_plans').update({ active: true }).eq('id', existing.id)
        } else {
          await supabase.from('client_meal_plans').insert({
            client_id: client.id, meal_plan_id: selectedMeal, trainer_id: user.id, active: true,
          })
        }
      }
    }

    setSavingPlans(false); setPlansSaved(true)
    setTimeout(() => setPlansSaved(false), 2500)
    setCurrentWorkout(selectedWorkout); setCurrentMeal(selectedMeal)
    onSuccess()
  }

  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = accentHex
    e.currentTarget.style.boxShadow = `0 0 0 3px ${accentHex}20`
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = ''
    e.currentTarget.style.boxShadow = ''
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh]" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        {/* Header with gradient */}
        <div className="px-6 py-4 shrink-0 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accentHex} 80%, #0f0a1e), color-mix(in srgb, ${accentHex} 55%, #0f0a1e))` }}>
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <UserCog size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base">{t('title')}</h2>
            <p className="text-white/60 text-xs truncate">{client.full_name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <XIcon size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-gray-100 bg-white">
          {[
            { key: 'profile', label: 'Profil', icon: UserCog },
            { key: 'plans',   label: 'Planovi', icon: Dumbbell },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} type="button"
              onClick={() => setTab(key as typeof tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${tab === key ? 'border-b-2 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              style={tab === key ? { borderBottomColor: accentHex, color: accentHex } : {}}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === 'profile' && (
          <form onSubmit={handleSubmitProfile} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              <div className="space-y-2">
                <Label>{tAdd('fullName')}</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  required onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label>Spol</Label>
                <div className="flex gap-2">
                  {([['M', '♂ Muško', 'from-sky-400 to-blue-500'], ['F', '♀ Žensko', 'from-rose-400 to-pink-500']] as const).map(([g, lbl, grad]) => (
                    <button key={g} type="button"
                      onClick={() => setForm({ ...form, gender: form.gender === g ? '' : g })}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${form.gender === g ? `bg-gradient-to-r ${grad} text-white border-transparent shadow-sm` : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{tAdd('goal')}</Label>
                <Input value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })}
                  placeholder={tAdd('goalPlaceholder')} onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              {/* Activity level */}
              <div className="space-y-2">
                <Label>Razina aktivnosti</Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {ACTIVITY_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm({ ...form, activity_level: form.activity_level === opt.value ? '' : opt.value })}
                      className={`flex items-center justify-between px-3 py-2 rounded-md border text-left text-sm transition-colors ${form.activity_level === opt.value ? 'text-white border-transparent' : 'border-input bg-background hover:bg-accent'}`}
                      style={form.activity_level === opt.value ? { backgroundColor: accentHex } : {}}>
                      <span className="font-medium">{opt.label}</span>
                      <span className={`text-xs ${form.activity_level === opt.value ? 'opacity-75' : 'text-gray-400'}`}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{tAdd('weight')}</Label>
                  <Input type="text" inputMode="decimal" value={form.weight}
                    onChange={e => setForm({ ...form, weight: e.target.value.replace(',', '.') })}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-2">
                  <Label>{tAdd('height')}</Label>
                  <Input type="text" inputMode="decimal" value={form.height}
                    onChange={e => setForm({ ...form, height: e.target.value.replace(',', '.') })}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{tAdd('dateOfBirth')}</Label>
                  <Input type="text" inputMode="numeric" placeholder="dd/mm/yyyy"
                    value={form.dob_display} onChange={e => handleDobInput(e.target.value)} maxLength={10}
                    onFocus={inputFocus} onBlur={inputBlur} />
                </div>
                <div className="space-y-2">
                  <Label>{tAdd('startDate')}</Label>
                  <Input type="text" inputMode="numeric" placeholder="dd/mm/yyyy"
                    value={form.start_date_display}
                    onChange={e => {
                      const formatted = formatDobInput(e.target.value)
                      const iso = dobDisplayToIso(formatted)
                      setForm(f => ({ ...f, start_date_display: formatted, start_date: iso || '' }))
                    }}
                    maxLength={10} onFocus={inputFocus} onBlur={inputBlur} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dnevni cilj koraka</Label>
                <Input type="number" min="0" max="50000" step="500" value={form.step_goal}
                  onChange={e => setForm({ ...form, step_goal: e.target.value })}
                  placeholder="npr. 8000" onFocus={inputFocus} onBlur={inputBlur} />
              </div>

              <div className="space-y-2">
                <Label>Bilješke</Label>
                <Textarea value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Veganska prehrana, ozljede, alergije..." rows={3}
                  className="resize-none" onFocus={inputFocus as any} onBlur={inputBlur as any} />
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-3 bg-white">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
              <Button type="submit" disabled={loading} className="flex-1 text-white"
                style={{ backgroundColor: accentHex }}>
                {loading ? tCommon('saving') : t('submit')}
              </Button>
            </div>
          </form>
        )}

        {/* Plans tab */}
        {tab === 'plans' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {plansLoading ? (
                <p className="text-sm text-gray-400 text-center py-8">{tCommon('loading')}</p>
              ) : (
                <>
                  {/* Training plan */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <Dumbbell size={13} />
                      </div>
                      <Label className="text-sm font-semibold text-gray-800">Plan treninga</Label>
                    </div>
                    <div className="space-y-1.5">
                      <button type="button"
                        onClick={() => setSelectedWorkout(null)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${selectedWorkout === null ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        style={selectedWorkout === null ? { backgroundColor: accentHex } : {}}>
                        <span className="font-medium">Bez plana</span>
                        {selectedWorkout === null && <Check size={14} />}
                      </button>
                      {workoutPlans.map(wp => (
                        <button key={wp.id} type="button"
                          onClick={() => setSelectedWorkout(wp.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${selectedWorkout === wp.id ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                          style={selectedWorkout === wp.id ? { backgroundColor: accentHex } : {}}>
                          <span className="font-medium">{wp.name}</span>
                          {selectedWorkout === wp.id && <Check size={14} />}
                        </button>
                      ))}
                      {workoutPlans.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">Nema kreiranih planova treninga.</p>
                      )}
                    </div>
                  </div>

                  {/* Meal plan */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <UtensilsCrossed size={13} />
                      </div>
                      <Label className="text-sm font-semibold text-gray-800">Plan prehrane</Label>
                    </div>
                    <div className="space-y-1.5">
                      <button type="button"
                        onClick={() => setSelectedMeal(null)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${selectedMeal === null ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        style={selectedMeal === null ? { backgroundColor: accentHex } : {}}>
                        <span className="font-medium">Bez plana</span>
                        {selectedMeal === null && <Check size={14} />}
                      </button>
                      {mealPlans.map(mp => (
                        <button key={mp.id} type="button"
                          onClick={() => setSelectedMeal(mp.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${selectedMeal === mp.id ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                          style={selectedMeal === mp.id ? { backgroundColor: accentHex } : {}}>
                          <span className="font-medium">{mp.name}</span>
                          {selectedMeal === mp.id && <Check size={14} />}
                        </button>
                      ))}
                      {mealPlans.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">Nema kreiranih planova prehrane.</p>
                      )}
                    </div>
                  </div>

                  {/* Package section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15`, color: accentHex }}>
                        <CreditCard size={13} />
                      </div>
                      <Label className="text-sm font-semibold text-gray-800">Paket plaćanja</Label>
                    </div>

                    {/* Current active package */}
                    {activeCp && (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-gray-50">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeCp.pkg_color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{activeCp.pkg_name}</p>
                          <p className="text-xs text-gray-400">Aktivan · do {fmtDate(activeCp.end_date)} · {activeCp.price} €</p>
                        </div>
                      </div>
                    )}
                    {!activeCp && (
                      <p className="text-xs text-gray-400 px-1">Klijent nema aktivnog paketa.</p>
                    )}

                    {/* Select new package */}
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500">{activeCp ? 'Zamijeni s novim paketom:' : 'Dodjeli paket:'}</p>
                      <div className="space-y-1.5">
                        {pkgTemplates.map(pkg => (
                          <button key={pkg.id} type="button"
                            onClick={() => setSelectedPkg(selectedPkg === pkg.id ? null : pkg.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${selectedPkg === pkg.id ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                            style={selectedPkg === pkg.id ? { backgroundColor: accentHex } : {}}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedPkg === pkg.id ? 'white' : pkg.color }} />
                              <span className="font-medium">{pkg.name}</span>
                              <span className={`text-xs ${selectedPkg === pkg.id ? 'opacity-75' : 'text-gray-400'}`}>{pkg.price} € · {durationLabel(pkg.duration_days)}</span>
                            </div>
                            {selectedPkg === pkg.id && <Check size={14} />}
                          </button>
                        ))}
                        {pkgTemplates.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">Nema kreiranih paketa.</p>
                        )}
                      </div>
                    </div>

                    {selectedPkg && (
                      <Button type="button" onClick={assignOrReplacePkg} disabled={savingPkg}
                        className="h-8 text-xs gap-1.5 text-white" style={{ backgroundColor: accentHex }}>
                        <RefreshCw size={12} />
                        {savingPkg ? 'Sprema...' : activeCp ? 'Zamijeni paket' : 'Dodjeli paket'}
                        {pkgSaved && <Check size={12} />}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-3 bg-white">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">{tCommon('cancel')}</Button>
              <Button type="button" disabled={savingPlans} onClick={savePlans} className="flex-1 text-white flex items-center gap-2"
                style={{ backgroundColor: accentHex }}>
                {savingPlans ? tCommon('saving') : t('savePlans')}
                {plansSaved && <Check size={13} />}
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}

