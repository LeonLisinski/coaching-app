'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, GripVertical, Pencil, Settings2, X, Check, Hash, Type, ToggleLeft, List } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX_MAP: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type Parameter = {
  id: string
  name: string
  type: string
  unit: string | null
  options: string[] | null
  required: boolean
  order_index: number
  frequency: 'daily' | 'weekly'
  show_in_overview?: boolean | null
  archived?: boolean
}

type FormState = {
  name: string
  type: string
  unit: string
  options: string
  required: boolean
  frequency: 'daily' | 'weekly'
  show_in_overview: boolean
}

const BLANK_FORM: FormState = {
  name: '', type: 'number', unit: '', options: '', required: false, frequency: 'daily', show_in_overview: false,
}

function paramToForm(p: Parameter): FormState {
  return {
    name: p.name, type: p.type, unit: p.unit || '',
    options: p.options?.join(', ') || '',
    required: p.required, frequency: p.frequency,
    show_in_overview: p.show_in_overview === true,
  }
}

// ─── Inline edit/add form ─────────────────────────────────────────────────────
function InlineForm({
  form, onChange, onSave, onCancel, types, t, isNew,
  overviewShow, overviewChecked, overviewCheckDisabled, onOverviewChange,
}: {
  form: FormState
  onChange: (f: FormState) => void
  onSave: () => void
  onCancel: () => void
  types: { value: string; label: string; icon: React.ReactNode }[]
  t: (k: string) => string
  isNew: boolean
  overviewShow?: boolean
  overviewChecked?: boolean
  overviewCheckDisabled?: boolean
  onOverviewChange?: (next: boolean) => void
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50) }, [])
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'
  const isDark = mode === 'dark'

  const inactivePill = isDark
    ? 'bg-white/8 text-gray-300 border-white/15 hover:border-white/30'
    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'

  return (
    <div className={`mt-2 pt-3 space-y-3 border-t ${isDark ? 'border-white/10' : 'border-gray-100'}`}>

      {/* Row 1: Name */}
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('name')}</p>
        <Input ref={nameRef} value={form.name} onChange={e => onChange({ ...form, name: e.target.value })}
          placeholder={t('namePlaceholder')} className="h-8 text-sm"
          onKeyDown={e => { if (e.key === 'Enter' && form.name) onSave(); if (e.key === 'Escape') onCancel() }}
        />
      </div>

      {/* Row 2: Type chips */}
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('typeLabel')}</p>
        <div className="flex gap-1.5 flex-wrap">
          {types.map(ty => (
            <button key={ty.value} type="button" onClick={() => onChange({ ...form, type: ty.value })}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium ${
                form.type === ty.value ? '' : inactivePill
              }`}
              style={form.type === ty.value
                ? { backgroundColor: `${accentHex}18`, color: accentHex, borderColor: `${accentHex}40` }
                : undefined}>
              {ty.icon}
              {ty.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Unit (if number) or Options (if select) */}
      {form.type === 'number' && (
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('unit')}</p>
          <Input value={form.unit} onChange={e => onChange({ ...form, unit: e.target.value })}
            placeholder={t('unitPlaceholder')} className="h-8 text-sm max-w-[180px]" />
        </div>
      )}
      {form.type === 'select' && (
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('optionsLabel')}</p>
          <Input value={form.options} onChange={e => onChange({ ...form, options: e.target.value })}
            placeholder={t('optionsPlaceholder')} className="h-8 text-sm" />
        </div>
      )}

      {/* Row 4: Checkboxes */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input type="checkbox" className="accent-indigo-600 w-3.5 h-3.5"
            checked={form.required} onChange={e => onChange({ ...form, required: e.target.checked })} />
          <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{t('requiredLabel')}</span>
        </label>
        {overviewShow && onOverviewChange && (
          <label className={`flex items-center gap-2 text-xs select-none ${overviewCheckDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="checkbox" className="accent-violet-600 w-3.5 h-3.5 shrink-0"
              checked={overviewChecked === true} disabled={overviewCheckDisabled}
              onChange={e => !overviewCheckDisabled && onOverviewChange(e.target.checked)} />
            <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{t('overviewPicker')}</span>
          </label>
        )}
      </div>

      {/* Row 5: Frequency */}
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('frequencyLabel')}</p>
        <div className="flex gap-1">
          {[{ value: 'daily', label: t('daily') }, { value: 'weekly', label: t('weekly') }].map(f => (
            <button key={f.value} type="button" onClick={() => onChange({ ...form, frequency: f.value as any })}
              className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                form.frequency === f.value ? '' : inactivePill
              }`}
              style={form.frequency === f.value
                ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex }
                : undefined}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 6: Actions */}
      <div className="flex gap-1.5 pt-0.5">
        <button type="button" onClick={onSave} disabled={!form.name}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-opacity"
          style={{ backgroundColor: accentHex }}>
          <Check size={12} /> {isNew ? t('addButton') : t('save')}
        </button>
        <button type="button" onClick={onCancel}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            isDark ? 'border-white/15 text-gray-300 hover:bg-white/8' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

// ─── Single parameter card ────────────────────────────────────────────────────
function ParamCard({
  param, isEditing, onDoubleClick, onEdit, onDelete, onSave, onCancel, editForm, onFormChange, types, t,
  onToggleOverview, overviewDisableCheck, inlineOverviewCheckDisabled,
}: {
  param: Parameter
  isEditing: boolean
  onDoubleClick: () => void
  onEdit: () => void
  onDelete: () => void
  onSave: () => void
  onCancel: () => void
  editForm: FormState
  onFormChange: (f: FormState) => void
  types: { value: string; label: string; icon: React.ReactNode }[]
  t: (k: string) => string
  onToggleOverview?: (param: Parameter, next: boolean) => void
  overviewDisableCheck?: boolean
  inlineOverviewCheckDisabled?: boolean
}) {
  const typeLabel = types.find(x => x.value === param.type)?.label || param.type
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'
  const isDark = mode === 'dark'

  const typeBadge = isDark
    ? { number: 'bg-sky-500/15 text-sky-400 border-sky-500/25', text: 'bg-amber-500/15 text-amber-400 border-amber-500/25', boolean: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', select: 'bg-violet-500/15 text-violet-400 border-violet-500/25' }
    : { number: 'bg-sky-50 text-sky-700 border-sky-200', text: 'bg-amber-50 text-amber-700 border-amber-200', boolean: 'bg-emerald-50 text-emerald-700 border-emerald-200', select: 'bg-violet-50 text-violet-700 border-violet-200' }

  return (
    <div
      className={`border rounded-xl px-3 py-2.5 transition-all ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-100'}`}
      style={isEditing ? { borderColor: `${accentHex}60`, boxShadow: `0 0 0 1px ${accentHex}30` } : undefined}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-2">
        <GripVertical size={13} className={`shrink-0 cursor-grab ${isDark ? 'text-white/20' : 'text-gray-300'}`} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className={`font-medium text-sm truncate ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{param.name}</p>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${(typeBadge as any)[param.type] || (isDark ? 'bg-white/8 text-gray-400 border-white/15' : 'bg-gray-50 text-gray-500 border-gray-200')}`}>
            {typeLabel}{param.unit && ` · ${param.unit}`}
          </span>
          {param.required && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${isDark ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
              {t('required')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" title={t('editTooltip')} onClick={onEdit}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-white/30 hover:text-white/70 hover:bg-white/8' : 'text-gray-400 hover:bg-gray-50'}`}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = accentHex }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '' }}>
            <Pencil size={12} />
          </button>
          <button type="button" onClick={onDelete}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-white/30 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {(() => {
        const effType  = isEditing ? editForm.type      : param.type
        const effFreq  = isEditing ? editForm.frequency : param.frequency
        const showOverviewRow = effType === 'number' && (effFreq === 'daily' || effFreq === 'weekly')
        return (
          <>
            {!isEditing && showOverviewRow && onToggleOverview && (
              <label className={`flex items-center gap-2 mt-2 pl-7 select-none text-[11px] ${overviewDisableCheck ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="checkbox" className="accent-violet-600 w-3.5 h-3.5 shrink-0"
                  checked={param.show_in_overview === true} disabled={overviewDisableCheck}
                  onChange={e => !overviewDisableCheck && onToggleOverview(param, e.target.checked)} />
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t('overviewPicker')}</span>
              </label>
            )}
            {isEditing && (
              <InlineForm
                form={editForm} onChange={onFormChange} onSave={onSave} onCancel={onCancel}
                types={types} t={t} isNew={false}
                overviewShow={showOverviewRow}
                overviewChecked={editForm.show_in_overview === true}
                overviewCheckDisabled={inlineOverviewCheckDisabled}
                onOverviewChange={next => onToggleOverview?.(param, next)}
              />
            )}
          </>
        )
      })()}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ParametersTab() {
  const t = useTranslations('checkins.parametersTab')
  const tCommon = useTranslations('common')
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'
  const isDark = mode === 'dark'

  const TYPES = [
    { value: 'number',  label: t('typeNumber'),  icon: <Hash size={11} /> },
    { value: 'text',    label: t('typeText'),     icon: <Type size={11} /> },
    { value: 'boolean', label: t('typeBoolean'),  icon: <ToggleLeft size={11} /> },
    { value: 'select',  label: t('typeSelect'),   icon: <List size={11} /> },
  ]

  const [parameters, setParameters] = useState<Parameter[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(BLANK_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForms, setEditForms] = useState<Record<string, FormState>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchParameters() }, [])

  const fetchParameters = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { data } = await supabase.from('checkin_parameters').select('id, name, type, unit, options, required, frequency, order_index, show_in_overview, archived, trainer_id').eq('trainer_id', user.id).eq('archived', false).order('frequency').order('order_index')
    if (data) setParameters(data)
    setLoading(false)
  }

  const startEdit = (param: Parameter) => {
    setEditForms(prev => ({ ...prev, [param.id]: paramToForm(param) }))
    setEditingId(param.id)
    setShowAddForm(false)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (param: Parameter) => {
    const form = editForms[param.id]
    if (!form?.name) return
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const isNumericOverview = form.type === 'number' && (form.frequency === 'daily' || form.frequency === 'weekly')
    let showInOverview = false
    if (isNumericOverview) {
      const wants = form.show_in_overview === true
      const othersTrue = parameters.filter(p => p.id !== param.id && p.show_in_overview === true).length
      if (wants && othersTrue >= 3) return
      showInOverview = wants
    }
    await supabase.from('checkin_parameters').update({
      name: form.name, type: form.type, unit: form.unit || null,
      options: form.type === 'select' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : null,
      required: form.required, frequency: form.frequency,
      trainer_id: user.id, show_in_overview: showInOverview,
    }).eq('id', param.id)
    setEditingId(null)
    fetchParameters()
  }

  const saveAdd = async () => {
    if (!addForm.name) return
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const isNumericOverview = addForm.type === 'number' && (addForm.frequency === 'daily' || addForm.frequency === 'weekly')
    let showInOverview = false
    if (isNumericOverview) {
      const wants = addForm.show_in_overview === true
      const currentTrue = parameters.filter(p => p.show_in_overview === true).length
      if (wants && currentTrue >= 3) return
      showInOverview = wants
    }
    await supabase.from('checkin_parameters').insert({
      trainer_id: user.id, name: addForm.name, type: addForm.type,
      unit: addForm.unit || null,
      options: addForm.type === 'select' ? addForm.options.split(',').map(o => o.trim()).filter(Boolean) : null,
      required: addForm.required, frequency: addForm.frequency,
      order_index: parameters.length, show_in_overview: showInOverview,
    })
    setShowAddForm(false)
    setAddForm(BLANK_FORM)
    fetchParameters()
  }

  const deleteParameter = async (id: string) => {
    // Always soft-delete (archive) so historical check-in values retain their labels.
    // The parameter disappears from the active list immediately.
    await supabase.from('checkin_parameters').update({ archived: true }).eq('id', id)
    setParameters(parameters.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const toggleOverviewPicker = async (param: Parameter, next: boolean) => {
    if (next) {
      const othersTrue = parameters.filter(p => p.id !== param.id && p.show_in_overview === true).length
      if (othersTrue >= 3) return
    }
    const { error } = await supabase.from('checkin_parameters').update({ show_in_overview: next }).eq('id', param.id)
    if (!error) {
      setParameters(prev => prev.map(p => (p.id === param.id ? { ...p, show_in_overview: next } : p)))
      setEditForms(prev => {
        const cur = prev[param.id]
        if (!cur) return prev
        return { ...prev, [param.id]: { ...cur, show_in_overview: next } }
      })
    }
  }

  const daily  = parameters.filter(p => p.frequency === 'daily')
  const weekly = parameters.filter(p => p.frequency === 'weekly')
  const overviewOnCount = parameters.filter(p => p.show_in_overview === true).length
  const tStr = (k: string) => t(k as any)

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {t('paramCount', { count: parameters.length })} · {t('dblClickHint')}
        </p>
        <Button onClick={() => { setShowAddForm(v => !v); setEditingId(null) }} size="sm"
          className="h-7 text-xs flex items-center gap-1 px-2.5"
          style={showAddForm ? {} : { backgroundColor: accentHex, border: 'none' }}>
          {showAddForm ? <><X size={12} /> {t('close')}</> : <><Plus size={12} /> {t('add')}</>}
        </Button>
      </div>

      {/* Add new */}
      {showAddForm && (
        <div className={`rounded-xl border px-4 pt-3 pb-4`}
          style={{ borderColor: `${accentHex}40`, backgroundColor: isDark ? `${accentHex}10` : `${accentHex}06` }}>
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: accentHex }}>
            <Settings2 size={12} /> {t('newParam')}
          </p>
          <InlineForm
            form={addForm} onChange={setAddForm} onSave={saveAdd}
            onCancel={() => { setShowAddForm(false); setAddForm(BLANK_FORM) }}
            types={TYPES} t={tStr} isNew
            overviewShow={addForm.type === 'number' && (addForm.frequency === 'daily' || addForm.frequency === 'weekly')}
            overviewChecked={addForm.show_in_overview === true}
            overviewCheckDisabled={
              addForm.type === 'number' && (addForm.frequency === 'daily' || addForm.frequency === 'weekly') &&
              !addForm.show_in_overview && overviewOnCount >= 3
            }
            onOverviewChange={next => setAddForm(f => ({ ...f, show_in_overview: next }))}
          />
        </div>
      )}

      {/* Parameter list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className={`h-11 rounded-xl animate-pulse ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />)}
        </div>
      ) : parameters.length === 0 ? (
        <div className={`py-10 text-center border-2 border-dashed rounded-xl ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${accentHex}12` }}>
            <Settings2 size={20} style={{ color: accentHex }} />
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>{t('noParameters')}</p>
          <button onClick={() => setShowAddForm(true)} className="mt-2 text-xs font-medium flex items-center gap-1 mx-auto" style={{ color: accentHex }}>
            <Plus size={11} /> {t('addFirstParam')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {daily.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentHex }} />
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dailyCount', { count: daily.length })}</p>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {daily.map(param => {
                  const editF = editForms[param.id] || paramToForm(param)
                  const inlineOverviewCheckDisabled = !editF.show_in_overview && parameters.filter(p => p.id !== param.id && p.show_in_overview === true).length >= 3
                  return (
                    <ParamCard key={param.id} param={param} isEditing={editingId === param.id}
                      onDoubleClick={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                      onEdit={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                      onDelete={() => setConfirmDelete(param.id)}
                      onSave={() => saveEdit(param)} onCancel={cancelEdit}
                      editForm={editF} onFormChange={f => setEditForms(prev => ({ ...prev, [param.id]: f }))}
                      types={TYPES} t={tStr}
                      onToggleOverview={toggleOverviewPicker}
                      overviewDisableCheck={!param.show_in_overview && overviewOnCount >= 3}
                      inlineOverviewCheckDisabled={inlineOverviewCheckDisabled}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {weekly.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full opacity-60" style={{ backgroundColor: accentHex }} />
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('weeklyCount', { count: weekly.length })}</p>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {weekly.map(param => {
                  const editF = editForms[param.id] || paramToForm(param)
                  const inlineOverviewCheckDisabled = !editF.show_in_overview && parameters.filter(p => p.id !== param.id && p.show_in_overview === true).length >= 3
                  return (
                    <ParamCard key={param.id} param={param} isEditing={editingId === param.id}
                      onDoubleClick={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                      onEdit={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                      onDelete={() => setConfirmDelete(param.id)}
                      onSave={() => saveEdit(param)} onCancel={cancelEdit}
                      editForm={editF} onFormChange={f => setEditForms(prev => ({ ...prev, [param.id]: f }))}
                      types={TYPES} t={tStr}
                      onToggleOverview={toggleOverviewPicker}
                      overviewDisableCheck={!param.show_in_overview && overviewOnCount >= 3}
                      inlineOverviewCheckDisabled={inlineOverviewCheckDisabled}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('deleteTitle')}
        description={t('deleteConfirm')}
        onConfirm={() => confirmDelete && deleteParameter(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('delete')}
        destructive
      />
    </div>
  )
}
