'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Check, Hash, List, Plus, Trash2, ToggleLeft, Type, X } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'

type Props = { clientId: string }

type GlobalParam = {
  id: string
  name: string
  type: string
  unit: string | null
  frequency: 'daily' | 'weekly'
  archived?: boolean
}

type ClientParam = {
  id: string
  name: string
  type: string
  unit: string | null
  frequency: 'daily' | 'weekly'
  required: boolean
  options: string[] | null
}

const PHOTO_POSITIONS = ['front', 'side', 'back'] as const
const BLANK_PARAM: { name: string; type: string; unit: string; options: string; frequency: 'daily' | 'weekly'; required: boolean } = { name: '', type: 'number', unit: '', options: '', frequency: 'daily', required: false }

export default function CheckinConfig({ clientId }: Props) {
  const t = useTranslations('checkins')
  const t2 = useTranslations('checkins2')
  const tDaysShort = useTranslations('daysShort')
  const tCommon = useTranslations('common')
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const inactivePill = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.06)', color: '#9ca3af', borderColor: 'rgba(255,255,255,0.12)' }
    : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }

  const tConfig = (key: string) => t(`detail.config.${key}` as any)
  const tForm = (key: string) => t(`detail.form.${key}` as any)

  const TYPES = [
    { value: 'number',  label: t('parametersTab.typeNumber'),  icon: <Hash size={11} /> },
    { value: 'text',    label: t('parametersTab.typeText'),     icon: <Type size={11} /> },
    { value: 'boolean', label: t('parametersTab.typeBoolean'),  icon: <ToggleLeft size={11} /> },
    { value: 'select',  label: t('parametersTab.typeSelect'),   icon: <List size={11} /> },
  ]

  const typeColors = isDark
    ? { number: 'bg-sky-500/15 text-sky-400 border-sky-500/25', text: 'bg-amber-500/15 text-amber-400 border-amber-500/25', boolean: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', select: 'bg-violet-500/15 text-violet-400 border-violet-500/25' }
    : { number: 'bg-sky-50 text-sky-700 border-sky-200', text: 'bg-amber-50 text-amber-700 border-amber-200', boolean: 'bg-emerald-50 text-emerald-700 border-emerald-200', select: 'bg-violet-50 text-violet-700 border-violet-200' }

  const PHOTO_FREQUENCIES = [
    { value: 'none', label: tConfig('frequencies.none') },
    { value: 'every', label: tConfig('frequencies.every') },
  ]

  // ── Schedule / photo / notes config ──────────────────────────────────────
  const [config, setConfig] = useState({
    checkin_day: 1,
    photo_frequency: 'every',
    photo_positions: ['front', 'side', 'back'],
    notes: '',
    excluded_parameter_ids: [] as string[],
  })
  const [configId, setConfigId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Global trainer parameters ─────────────────────────────────────────────
  const [globalParams, setGlobalParams] = useState<GlobalParam[]>([])

  // ── Client-specific extra parameters ─────────────────────────────────────
  const [clientParams, setClientParams] = useState<ClientParam[]>([])
  const [showAddParam, setShowAddParam] = useState(false)
  const [newParam, setNewParam] = useState(BLANK_PARAM)
  const [addingParam, setAddingParam] = useState(false)
  const [deletingParamId, setDeletingParamId] = useState<string | null>(null)
  const [trainerId, setTrainerId] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [clientId])

  const fetchAll = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (user) setTrainerId(user.id)

    const [configRes, globalRes, clientRes] = await Promise.all([
      supabase.from('checkin_config')
        .select('id, checkin_day, photo_frequency, photo_positions, notes, excluded_parameter_ids')
        .eq('client_id', clientId).maybeSingle(),
      user
        ? supabase.from('checkin_parameters')
            .select('id, name, type, unit, frequency, archived')
            .eq('trainer_id', user.id)
            .is('client_id', null)
            .eq('archived', false)
            .order('order_index')
        : Promise.resolve({ data: [] }),
      supabase.from('checkin_parameters')
        .select('id, name, type, unit, frequency, required, options')
        .eq('client_id', clientId)
        .order('order_index'),
    ])

    if (configRes.data) {
      setConfigId(configRes.data.id)
      setConfig({
        checkin_day: configRes.data.checkin_day ?? 1,
        photo_frequency: configRes.data.photo_frequency || 'every',
        photo_positions: configRes.data.photo_positions || ['front', 'side', 'back'],
        notes: configRes.data.notes || '',
        excluded_parameter_ids: configRes.data.excluded_parameter_ids || [],
      })
    }

    if (globalRes.data) setGlobalParams(globalRes.data as GlobalParam[])
    if (clientRes.data) setClientParams(clientRes.data as ClientParam[])
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

  const toggleExcluded = (paramId: string) => {
    setConfig(prev => ({
      ...prev,
      excluded_parameter_ids: prev.excluded_parameter_ids.includes(paramId)
        ? prev.excluded_parameter_ids.filter(id => id !== paramId)
        : [...prev.excluded_parameter_ids, paramId],
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
        excluded_parameter_ids: config.excluded_parameter_ids,
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

  const handleAddClientParam = async () => {
    if (!newParam.name.trim() || !trainerId) return
    setAddingParam(true)
    try {
      const { data, error } = await supabase.from('checkin_parameters').insert({
        trainer_id: trainerId,
        client_id: clientId,
        name: newParam.name.trim(),
        type: newParam.type,
        unit: newParam.unit.trim() || null,
        frequency: newParam.frequency,
        required: newParam.required,
        options: newParam.type === 'select'
          ? newParam.options.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        order_index: 999,
      }).select('id, name, type, unit, frequency, required, options').single()

      if (!error && data) {
        setClientParams(prev => [...prev, data as ClientParam])
        setNewParam(BLANK_PARAM)
        setShowAddParam(false)
      }
    } finally {
      setAddingParam(false)
    }
  }

  const handleDeleteClientParam = async (paramId: string) => {
    setDeletingParamId(paramId)
    await supabase.from('checkin_parameters').delete().eq('id', paramId)
    setClientParams(prev => prev.filter(p => p.id !== paramId))
    setDeletingParamId(null)
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
  const inputCls = `border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.05] border-white/12 text-gray-100 placeholder:text-gray-500 focus:border-white/25'
      : 'border-gray-200 focus:border-gray-300'
  }`

  const activeParams = globalParams.filter(p => !config.excluded_parameter_ids.includes(p.id))
  const allExcluded = globalParams.length > 0 && activeParams.length === 0

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

      {/* Parameter overrides */}
      <div className={`${cardCls} !space-y-0`}>
        <div className="pb-3">
          <p className={sectionLabelCls}>{tConfig('paramOverrides')}</p>
          <p className="text-[11px] text-gray-400">{tConfig('paramOverridesHint')}</p>
        </div>

        {/* Global params with toggle */}
        {globalParams.length === 0 ? (
          <p className={`text-xs py-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{tConfig('paramNoParams')}</p>
        ) : (
          <div className="space-y-1.5 pb-3">
            {globalParams.map(p => {
              const excluded = config.excluded_parameter_ids.includes(p.id)
              return (
                <div key={p.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 border transition-colors ${
                  excluded
                    ? isDark ? 'border-white/8 bg-white/[0.02] opacity-50' : 'border-gray-100 bg-gray-50 opacity-60'
                    : isDark ? 'border-white/12 bg-white/[0.04]' : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{p.name}</span>
                    {p.unit && <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{p.unit}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      p.frequency === 'daily'
                        ? isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                        : isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {p.frequency === 'daily' ? t2('groupDaily') : t2('groupWeekly')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExcluded(p.id)}
                    className={`shrink-0 w-10 h-6 rounded-full border-2 transition-all relative ${
                      !excluded
                        ? 'border-transparent'
                        : isDark ? 'border-white/20 bg-white/8' : 'border-gray-200 bg-gray-100'
                    }`}
                    style={!excluded ? { backgroundColor: 'var(--app-accent)' } : {}}
                    aria-label={excluded ? 'Enable' : 'Disable'}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      !excluded ? 'left-[calc(100%-18px)]' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              )
            })}
            {allExcluded && (
              <p className={`text-[11px] pt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                ⚠ Svi globalni parametri su isključeni za ovog klijenta.
              </p>
            )}
          </div>
        )}

        {/* Client-specific extra params */}
        {clientParams.length > 0 && (
          <div className={`pt-3 border-t space-y-1.5 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {tConfig('paramClientBadge')}
            </p>
            {clientParams.map(p => (
              <div key={p.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 border ${
                isDark ? 'border-white/10 bg-white/[0.03]' : 'border-teal-100 bg-teal-50/30'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{p.name}</span>
                  {p.unit && <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{p.unit}</span>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    p.frequency === 'daily'
                      ? isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                      : isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {p.frequency === 'daily' ? t2('groupDaily') : t2('groupWeekly')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={deletingParamId === p.id}
                  onClick={() => handleDeleteClientParam(p.id)}
                  className={`shrink-0 p-1 rounded transition-colors ${
                    isDark ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10' : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  {deletingParamId === p.id ? '...' : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add client-specific param */}
        <div className={`pt-3 border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          {!showAddParam ? (
            <button
              type="button"
              onClick={() => setShowAddParam(true)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
              }`}
            >
              <Plus size={13} />
              {tConfig('paramAddClientParam')}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newParam.name}
                  onChange={e => setNewParam(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Naziv parametra"
                  className={`flex-1 ${inputCls}`}
                  onKeyDown={e => e.key === 'Enter' && handleAddClientParam()}
                />
                <button
                  type="button"
                  onClick={() => { setShowAddParam(false); setNewParam(BLANK_PARAM) }}
                  className={`p-2 rounded-lg border transition-colors ${
                    isDark ? 'border-white/12 hover:bg-white/8 text-gray-400' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                  }`}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {TYPES.map(tp => {
                  const active = newParam.type === tp.value
                  return (
                    <button key={tp.value} type="button"
                      onClick={() => setNewParam(prev => ({ ...prev, type: tp.value }))}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${
                        active
                          ? typeColors[tp.value as keyof typeof typeColors] + ' ring-2 ring-offset-1 ring-current/30'
                          : typeColors[tp.value as keyof typeof typeColors] + ' opacity-40 hover:opacity-70'
                      }`}>
                      {tp.icon}{tp.label}
                    </button>
                  )
                })}
                {(['daily','weekly'] as const).map(fr => (
                  <button key={fr} type="button"
                    onClick={() => setNewParam(prev => ({ ...prev, frequency: fr }))}
                    className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
                    style={newParam.frequency === fr
                      ? { backgroundColor: 'var(--app-accent)', color: 'white', borderColor: 'var(--app-accent)' }
                      : inactivePill}>
                    {fr === 'daily' ? t2('groupDaily') : t2('groupWeekly')}
                  </button>
                ))}
              </div>
              {newParam.type === 'number' && (
                <input
                  value={newParam.unit}
                  onChange={e => setNewParam(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="Jedinica (npr. kg, %)"
                  className={`w-full ${inputCls}`}
                />
              )}
              {newParam.type === 'select' && (
                <input
                  value={newParam.options}
                  onChange={e => setNewParam(prev => ({ ...prev, options: e.target.value }))}
                  placeholder="Opcije odvojene zarezom (npr. Loše, Dobro, Odlično)"
                  className={`w-full ${inputCls}`}
                />
              )}
              <button
                type="button"
                onClick={handleAddClientParam}
                disabled={!newParam.name.trim() || addingParam || (newParam.type === 'select' && !newParam.options.trim())}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--app-accent)' }}
              >
                {addingParam ? tCommon('saving') : 'Dodaj'}
              </button>
            </div>
          )}
        </div>
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
