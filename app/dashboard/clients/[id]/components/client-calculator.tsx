'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Calculator, Check } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
type Gender = 'M' | 'F'
type Goal = 'loss' | 'maintain' | 'gain'
type MacroMode = 'percent' | 'grams'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
}


const DEFAULT_MACRO_SPLITS: Record<Goal, { p: number; c: number; f: number }> = {
  loss:     { p: 35, c: 40, f: 25 },
  maintain: { p: 30, c: 45, f: 25 },
  gain:     { p: 30, c: 50, f: 20 },
}

function calcBMR(weight: number, height: number, age: number, gender: Gender): number {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'M' ? base + 5 : base - 161
}

function round(n: number, dec = 0) {
  return Math.round(n * 10 ** dec) / 10 ** dec
}

function MacroBar({ p, c, f }: { p: number; c: number; f: number }) {
  const tCalc = useTranslations('clientCalculator')
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
      <div className="bg-red-400 transition-all" style={{ width: `${p}%` }} title={tCalc('proteinPct', { pct: p })} />
      <div className="bg-amber-400 transition-all" style={{ width: `${c}%` }} title={tCalc('carbsPct', { pct: c })} />
      <div className="bg-blue-400 transition-all" style={{ width: `${f}%` }} title={tCalc('fatPct', { pct: f })} />
    </div>
  )
}

type Props = {
  clientId: string
  client: {
    weight: number | null
    height: number | null
    date_of_birth: string | null
    gender: string | null
    activity_level: string | null
    step_goal: number | null
  }
  onSaved?: () => void
}

type Tab = 'tdee' | 'macros' | 'steps'

export default function ClientCalculator({ clientId, client, onSaved }: Props) {
  const t = useTranslations('clients.calculator')
  const tCommon = useTranslations('common')
  const tCalc = useTranslations('clientCalculator')
  const locale = useLocale()
  const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
    sedentary:   t('activity.sedentary'),
    light:       t('activity.light'),
    moderate:    t('activity.moderate'),
    active:      t('activity.active'),
    very_active: t('activity.very_active'),
  }
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('tdee')
  const [saved, setSaved] = useState<Tab | null>(null)

  // Derive age from date_of_birth
  const age = client.date_of_birth
    ? (() => {
        const today = new Date()
        const birth = new Date(client.date_of_birth!)
        let a = today.getFullYear() - birth.getFullYear()
        if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) a--
        return a
      })()
    : null

  // TDEE state
  const [tdeeForm, setTdeeForm] = useState({
    weight: client.weight?.toString() || '',
    height: client.height?.toString() || '',
    age: age?.toString() || '',
    gender: (client.gender === 'M' || client.gender === 'F' ? client.gender : 'M') as Gender,
    activity: (client.activity_level || 'moderate') as ActivityLevel,
  })

  // Macro state
  const [macroGoal, setMacroGoal] = useState<Goal>('maintain')
  const [macroMode, setMacroMode] = useState<MacroMode>('percent')
  const [customKcal, setCustomKcal] = useState('')
  // Selected TDEE scenario (carries over to Macros tab)
  type Scenario = { label: string; kcal: number; goal: Goal }
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [macroSplit, setMacroSplit] = useState(DEFAULT_MACRO_SPLITS.maintain)

  // Steps state
  const [stepGoal, setStepGoal] = useState(client.step_goal?.toString() || '8000')

  // Active meal plan state (fetched when dialog opens)
  type ActivePlan = { id: string; name: string; meal_plan_id: string }
  type AvailablePlan = { id: string; name: string }
  const [activePlan, setActivePlan] = useState<ActivePlan | null | undefined>(undefined)
  const [availablePlans, setAvailablePlans] = useState<AvailablePlan[]>([])
  const [planAction, setPlanAction] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [planActionError, setPlanActionError] = useState('')
  // Plan create mode: null = show buttons, 'choosing' = show new/existing choice, 'existing' = show plan picker
  const [planCreateMode, setPlanCreateMode] = useState<null | 'choosing' | 'existing'>(null)
  const [selectedExistingPlanId, setSelectedExistingPlanId] = useState('')

  // --- TDEE calc ---
  const w = parseFloat(tdeeForm.weight)
  const h = parseFloat(tdeeForm.height)
  const a = parseFloat(tdeeForm.age)
  const canCalc = !isNaN(w) && !isNaN(h) && !isNaN(a) && w > 0 && h > 0 && a > 0
  const bmr = canCalc ? round(calcBMR(w, h, a, tdeeForm.gender)) : null
  const tdee = bmr ? round(bmr * ACTIVITY_MULTIPLIERS[tdeeForm.activity]) : null

  // --- Macro calc ---
  const splitTotal = macroSplit.p + macroSplit.c + macroSplit.f
  const splitOk    = splitTotal === 100
  const targetKcal = customKcal ? parseFloat(customKcal) : tdee
  const proteinG   = targetKcal && splitOk ? round(targetKcal * macroSplit.p / 100 / 4) : null
  const carbG      = targetKcal && splitOk ? round(targetKcal * macroSplit.c / 100 / 4) : null
  const fatG       = targetKcal && splitOk ? round(targetKcal * macroSplit.f / 100 / 9) : null

  const handleGoalChange = (g: Goal) => {
    setMacroGoal(g)
    setMacroSplit(DEFAULT_MACRO_SPLITS[g])
  }

  const pickScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario)
    setCustomKcal(round(scenario.kcal).toString())
    handleGoalChange(scenario.goal)
  }

  const saveTdee = async () => {
    if (!tdee || !tdeeForm.activity) return
    await supabase.from('clients').update({
      activity_level: tdeeForm.activity,
      weight: w || null,
      height: h || null,
    }).eq('id', clientId)
    setSaved('tdee')
    setTimeout(() => setSaved(null), 2000)
    onSaved?.()
  }

  const saveSteps = async () => {
    const steps = parseInt(stepGoal)
    if (isNaN(steps)) return
    await supabase.from('clients').update({ step_goal: steps }).eq('id', clientId)
    setSaved('steps')
    setTimeout(() => setSaved(null), 2000)
    onSaved?.()
  }

  const fetchActivePlan = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    const [{ data: active }, { data: plans }] = await Promise.all([
      supabase
        .from('client_meal_plans')
        .select('id, meal_plan_id, meal_plan:meal_plans(name)')
        .eq('client_id', clientId)
        .eq('active', true)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      user
        ? supabase.from('meal_plans').select('id, name').eq('trainer_id', user.id).eq('is_template', true).order('name')
        : Promise.resolve({ data: [] }),
    ])
    setActivePlan(active ? { id: active.id, meal_plan_id: active.meal_plan_id, name: (active.meal_plan as any)?.name || tCalc('activePlanFallback') } : null)
    if (plans) setAvailablePlans(plans)
  }

  const handlePlanAction = async (mode: 'update' | 'create_new' | 'assign_existing') => {
    if (!targetKcal || proteinG === null || carbG === null || fatG === null) return
    if (mode === 'assign_existing' && !selectedExistingPlanId) return
    setPlanAction('loading')
    setPlanActionError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
      if (!user) throw new Error(tCalc('errNotAuth'))

      const targets = {
        calories_target: round(targetKcal),
        protein_target: proteinG,
        carbs_target: carbG,
        fat_target: fatG,
      }

      if (mode === 'update' && activePlan) {
        const { error } = await supabase
          .from('client_meal_plans')
          .update(targets)
          .eq('id', activePlan.id)
        if (error) throw error
      } else if (mode === 'assign_existing') {
        const existingPlan = availablePlans.find(p => p.id === selectedExistingPlanId)
        const { error } = await supabase.from('client_meal_plans').insert({
          trainer_id: user.id,
          client_id: clientId,
          meal_plan_id: selectedExistingPlanId,
          meals: [],
          active: true,
          plan_type: 'default',
          ...targets,
        })
        if (error) throw error
        setSelectedExistingPlanId('')
        setPlanCreateMode(null)
      } else {
        // Create brand new plan + assign
        const GOAL_NAMES: Record<Goal, string> = { loss: tCalc('goalLoss'), maintain: tCalc('goalMaintain'), gain: tCalc('goalGain') }
        const planName = `${GOAL_NAMES[macroGoal]} — ${new Date().toLocaleDateString(locale)}`

        const { data: plan, error: insertError } = await supabase
          .from('meal_plans')
          .insert({ trainer_id: user.id, name: planName, ...targets, meals: [], is_template: false })
          .select('id')
          .single()
        if (insertError || !plan) throw insertError ?? new Error(tCalc('errNoInsertId'))

        const { error: assignError } = await supabase.from('client_meal_plans').insert({
          trainer_id: user.id,
          client_id: clientId,
          meal_plan_id: plan.id,
          meals: [],
          active: true,
          plan_type: 'default',
        })
        if (assignError) throw assignError
        setPlanCreateMode(null)
      }

      setPlanAction('done')
      setTimeout(() => setPlanAction('idle'), 3000)
      await fetchActivePlan()
      onSaved?.()
    } catch (err: any) {
      setPlanAction('error')
      setPlanActionError(err?.message || tCalc('errUnknown'))
      setTimeout(() => { setPlanAction('idle'); setPlanActionError('') }, 4000)
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'tdee',  label: t('tabs.bmr') },
    { key: 'macros', label: t('tabs.macros') },
    { key: 'steps', label: t('tabs.steps') },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); fetchActivePlan() }}
        className="p-1 text-gray-400 hover:text-gray-600"
        title={t('title')}
      >
        <Calculator size={14} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator size={16} /> {t('title')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('title')}</DialogDescription>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TDEE TAB ── */}
          {tab === 'tdee' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('weightLabel')}</Label>
                  <Input type="text" inputMode="decimal" value={tdeeForm.weight}
                    onChange={e => setTdeeForm(f => ({ ...f, weight: e.target.value.replace(',', '.') }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('heightLabel')}</Label>
                  <Input type="text" inputMode="decimal" value={tdeeForm.height}
                    onChange={e => setTdeeForm(f => ({ ...f, height: e.target.value.replace(',', '.') }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('ageLabel')}</Label>
                  <Input type="number" min="10" max="100" value={tdeeForm.age}
                    onChange={e => setTdeeForm(f => ({ ...f, age: e.target.value }))} className="h-8" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('genderLabel')}</Label>
                <div className="flex gap-2">
                  {(['M', 'F'] as Gender[]).map(g => (
                    <button key={g} type="button"
                      onClick={() => setTdeeForm(f => ({ ...f, gender: g }))}
                      className={`flex-1 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                        tdeeForm.gender === g ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-accent'
                      }`}>
                      {g === 'M' ? t('genderMale') : t('genderFemale')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('activityLabel')}</Label>
                <div className="space-y-1">
                  {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([val, lbl]) => (
                    <button key={val} type="button"
                      onClick={() => setTdeeForm(f => ({ ...f, activity: val }))}
                      className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                        tdeeForm.activity === val ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-accent'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              {canCalc && bmr && tdee ? (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{t('bmrResult')}</span>
                    <span className="font-bold text-lg">{bmr} kcal</span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="space-y-1.5">
                    {([
                      { labelKey: 'scenarios.maintain', kcal: tdee,       goal: 'maintain' as Goal, cls: 'text-emerald-600', activeCls: 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200' },
                      { labelKey: 'scenarios.loss',     kcal: tdee - 500, goal: 'loss'     as Goal, cls: 'text-blue-600',   activeCls: 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' },
                      { labelKey: 'scenarios.gain',     kcal: tdee + 300, goal: 'gain'     as Goal, cls: 'text-orange-600', activeCls: 'bg-orange-50 border-orange-300 ring-1 ring-orange-200' },
                    ]).map(row => {
                      const rowLabel = t(row.labelKey as any)
                      const isSelected = selectedScenario?.goal === row.goal
                      return (
                        <button
                          key={row.labelKey}
                          type="button"
                          onClick={() => pickScenario({ label: rowLabel, kcal: row.kcal, goal: row.goal })}
                          className={`w-full flex justify-between items-center px-3 py-2 rounded-lg border transition-all ${
                            isSelected ? row.activeCls : 'border-transparent hover:bg-white hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{rowLabel}</span>
                            {isSelected && <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">{t('scenarioSelected')}</span>}
                          </div>
                          <span className={`font-semibold ${row.cls}`}>{round(row.kcal)} kcal</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 text-center pt-1">{t('scenarioHint')}</p>
                  <div className="h-px bg-gray-200" />
                  <p className="text-xs text-gray-400 text-center">{t('tdeeFormula')}</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-400">
                  {t('fillData')}
                </div>
              )}

              <Button size="sm" className="w-full" onClick={saveTdee} disabled={!canCalc}>
                {saved === 'tdee' ? <><Check size={14} className="mr-1" /> {t('savedLabel')}</> : t('saveActivity')}
              </Button>
            </div>
          )}

          {/* ── MACROS TAB ── */}
          {tab === 'macros' && (
            <div className="space-y-4">
              {/* Kcal source — shows selected scenario or manual input */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t('caloricGoal')}</Label>
                {selectedScenario ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">{selectedScenario.label}</p>
                      <p className="font-bold text-base text-gray-900">{round(selectedScenario.kcal)} kcal</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button type="button" className="text-[11px] text-primary underline"
                        onClick={() => { setSelectedScenario(null); setCustomKcal('') }}>
                        {tCalc('changePlanBtn')}
                      </button>
                      <button type="button" className="text-[11px] text-gray-400 underline"
                        onClick={() => setTab('tdee')}>
                        {tCalc('backToBmr')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      placeholder={tdee ? tCalc('tdeeLabel', { tdee }) : tCalc('enterManually')}
                      value={customKcal}
                      onChange={e => setCustomKcal(e.target.value)}
                      className="h-8"
                    />
                    {tdee && (
                      <button type="button" className="text-xs text-primary underline shrink-0 whitespace-nowrap"
                        onClick={() => setCustomKcal(tdee.toString())}>
                        {tCalc('useTdee')}
                      </button>
                    )}
                    {!tdee && (
                      <button type="button" className="text-xs text-gray-400 underline shrink-0 whitespace-nowrap"
                        onClick={() => setTab('tdee')}>
                        {tCalc('calcBtn')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Goal */}
              <div className="space-y-1">
                <Label className="text-xs">{tCalc('goalLabel')}</Label>
                <div className="flex gap-2">
                  {([
                    { value: 'loss',     label: tCalc('goalLoss') },
                    { value: 'maintain', label: tCalc('goalMaintain') },
                    { value: 'gain',     label: tCalc('goalGain') },
                  ] as { value: Goal; label: string }[]).map(g => (
                    <button key={g.value} type="button"
                      onClick={() => handleGoalChange(g.value)}
                      className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        macroGoal === g.value ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-accent'
                      }`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{tCalc('macroSplit')}</Label>
                  {/* Quick presets */}
                  <div className="flex gap-1">
                    {(tCalc.raw('splitPresets') as string[]).map((label, i) => {
                      const [p, c, f] = label.split('/').map(Number)
                      const preset = { label, p, c, f }
                      return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setMacroSplit({ p: preset.p, c: preset.c, f: preset.f })}
                        className="px-2 py-0.5 rounded border text-xs text-gray-500 border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {preset.label}
                      </button>
                      )
                    })}
                  </div>
                </div>

                <MacroBar p={macroSplit.p} c={macroSplit.c} f={macroSplit.f} />

                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'p' as const, label: tCalc('proteinLabel'), color: 'text-red-500', border: 'focus:border-red-400' },
                    { key: 'c' as const, label: tCalc('carbsLabel'), color: 'text-amber-500', border: 'focus:border-amber-400' },
                    { key: 'f' as const, label: tCalc('fatLabel'), color: 'text-blue-500', border: 'focus:border-blue-400' },
                  ]).map(m => (
                    <div key={m.key} className="space-y-1">
                      <p className={`text-xs font-medium ${m.color}`}>{m.label}</p>
                      <div className="relative">
                        <Input
                          type="number"
                          value={macroSplit[m.key] === 0 ? '' : macroSplit[m.key]}
                          onChange={e => {
                            const raw = e.target.value
                            if (raw === '') { setMacroSplit(s => ({ ...s, [m.key]: 0 })); return }
                            const v = parseInt(raw)
                            if (!isNaN(v)) setMacroSplit(s => ({ ...s, [m.key]: Math.min(98, v) }))
                          }}
                          onBlur={() => setMacroSplit(s => ({ ...s, [m.key]: Math.max(1, Math.min(98, s[m.key] || 1)) }))}
                          className={`h-9 text-center pr-6 text-sm font-semibold ${m.border}`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total indicator */}
                {(() => {
                  const total = macroSplit.p + macroSplit.c + macroSplit.f
                  const ok = total === 100
                  return (
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      <span className="font-medium">{tCalc('totalLabel')}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{total}%</span>
                        {!ok && (
                          <button
                            type="button"
                            className="text-xs underline opacity-80"
                            onClick={() => {
                              const diff = 100 - total
                              setMacroSplit(s => ({ ...s, c: Math.max(1, s.c + diff) }))
                            }}
                          >
                            {tCalc('fixTo100')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Results */}
              {targetKcal && proteinG !== null ? (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-400 text-center mb-3">{tCalc('dailyMacros', { kcal: round(targetKcal) })}</p>
                    {[
                      { label: tCalc('proteinLabel'), g: proteinG, kcal: round(proteinG * 4), color: 'bg-red-100 text-red-700' },
                      { label: tCalc('carbsLabel'),   g: carbG!,   kcal: round(carbG! * 4),   color: 'bg-amber-100 text-amber-700' },
                      { label: tCalc('fatLabel'),     g: fatG!,    kcal: round(fatG! * 9),    color: 'bg-blue-100 text-blue-700' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.color}`}>{row.label}</span>
                        <div className="text-right">
                          <span className="font-bold text-sm">{row.g}g</span>
                          <span className="text-xs text-gray-400 ml-1">({row.kcal} kcal)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Smart plan action */}
                  {activePlan === undefined ? (
                    <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                  ) : (
                    <div className="space-y-2">
                      {/* Active plan info */}
                      {activePlan && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <span className="text-xs text-blue-700 flex-1 min-w-0">
                            {tCalc('currentPlan')} <span className="font-semibold">{activePlan.name}</span>
                          </span>
                          <Button size="sm" variant="outline" className="text-xs shrink-0 h-7"
                            onClick={() => handlePlanAction('update')}
                            disabled={planAction === 'loading'}>
                            {planAction === 'done' ? <><Check size={11} className="mr-1" />{tCalc('updated')}</> : tCalc('updateGoals')}
                          </Button>
                        </div>
                      )}

                      {/* Choose mode */}
                      {planCreateMode === null && (
                        <Button size="sm" variant={activePlan ? 'outline' : 'default'} className="w-full"
                          onClick={() => setPlanCreateMode('choosing')}
                          disabled={planAction === 'loading' || planAction === 'done'}>
                          {planAction === 'done'
                            ? <><Check size={14} className="mr-1.5" />{tCalc('assignedPlan')}</>
                            : activePlan ? tCalc('assignAnother') : tCalc('assignMealPlan')}
                        </Button>
                      )}

                      {/* Step 1: new or existing? */}
                      {planCreateMode === 'choosing' && (
                        <div className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
                          <p className="text-xs font-medium text-gray-600 text-center">{tCalc('whichPlan')}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button"
                              onClick={() => handlePlanAction('create_new')}
                              disabled={planAction === 'loading'}
                              className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-white transition-colors text-center">
                              <span className="text-lg">+</span>
                              <span className="text-xs font-medium text-gray-700">{tCalc('newEmptyPlan')}</span>
                              <span className="text-[10px] text-gray-400">{tCalc('createWithGoals')}</span>
                            </button>
                            <button type="button"
                              onClick={() => setPlanCreateMode('existing')}
                              className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-white transition-colors text-center">
                              <span className="text-lg">📋</span>
                              <span className="text-xs font-medium text-gray-700">{tCalc('existingPlan')}</span>
                              <span className="text-[10px] text-gray-400">{tCalc('fromLibrary')}</span>
                            </button>
                          </div>
                          <button type="button" onClick={() => setPlanCreateMode(null)}
                            className="w-full text-xs text-gray-400 hover:text-gray-600 pt-1">
                            {tCommon('cancel')}
                          </button>
                        </div>
                      )}

                      {/* Step 2: pick existing plan */}
                      {planCreateMode === 'existing' && (
                        <div className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
                          <p className="text-xs font-medium text-gray-600">{tCalc('selectPlan')}</p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {availablePlans.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">{tCalc('noPlans')}</p>
                            ) : availablePlans.map(p => (
                              <button key={p.id} type="button"
                                onClick={() => setSelectedExistingPlanId(p.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                                  selectedExistingPlanId === p.id
                                    ? 'border-primary bg-primary/5 font-medium'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}>
                                {p.name}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => setPlanCreateMode('choosing')}
                              className="flex-1 text-xs text-gray-400 hover:text-gray-600">
                              {tCalc('backBtn')}
                            </button>
                            <Button size="sm" className="flex-1 text-xs"
                              onClick={() => handlePlanAction('assign_existing')}
                              disabled={!selectedExistingPlanId || planAction === 'loading'}>
                              {planAction === 'loading' ? tCalc('assigning') : tCalc('assignBtn')}
                            </Button>
                          </div>
                        </div>
                      )}

                      {planAction === 'error' && (
                        <p className="text-xs text-red-500 text-center">{planActionError}</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-400">
                  {tCalc('enterKcalHint')}
                </div>
              )}
            </div>
          )}

          {/* ── STEPS TAB ── */}
          {tab === 'steps' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{t('stepsDesc')}</p>
              <div className="space-y-1">
                <Label>{t('stepsLabel')}</Label>
                <Input
                  type="number" min="0" max="50000" step="500"
                  value={stepGoal}
                  onChange={e => setStepGoal(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[5000, 8000, 10000, 12000].map(n => (
                  <button key={n} type="button"
                    onClick={() => setStepGoal(n.toString())}
                    className={`py-2 rounded-md border text-xs font-medium transition-colors ${
                      stepGoal === n.toString() ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-accent'
                    }`}>
                    {n.toLocaleString('hr-HR')}
                  </button>
                ))}
              </div>
              {stepGoal && (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-gray-900">{parseInt(stepGoal).toLocaleString('hr-HR')}</p>
                  <p className="text-sm text-gray-400 mt-1">{t('stepsPerDay')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">≈ {round(parseInt(stepGoal) * 0.0007, 1)} km</p>
                </div>
              )}
              <Button size="sm" className="w-full" onClick={saveSteps} disabled={!stepGoal}>
                {saved === 'steps' ? <><Check size={14} className="mr-1" /> {t('savedLabel')}</> : t('saveSteps')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
