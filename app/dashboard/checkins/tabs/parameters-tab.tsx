'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, GripVertical, Pencil, Settings2, X, Check } from 'lucide-react'
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
}

type FormState = { name: string; type: string; unit: string; options: string; required: boolean; frequency: 'daily' | 'weekly' }

const TYPE_COLORS: Record<string, string> = {
  number:  'bg-sky-50 text-sky-700 border-sky-200',
  text:    'bg-amber-50 text-amber-700 border-amber-200',
  boolean: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  select:  'bg-violet-50 text-violet-700 border-violet-200',
}

const BLANK_FORM: FormState = { name: '', type: 'number', unit: '', options: '', required: false, frequency: 'daily' }

function paramToForm(p: Parameter): FormState {
  return { name: p.name, type: p.type, unit: p.unit || '', options: p.options?.join(', ') || '', required: p.required, frequency: p.frequency }
}

// ─── Inline edit form rendered inside the card ───────────────────────────────
function InlineForm({
  form, onChange, onSave, onCancel, types, t, isNew,
}: {
  form: FormState
  onChange: (f: FormState) => void
  onSave: () => void
  onCancel: () => void
  types: { value: string; label: string }[]
  t: (k: string) => string
  isNew: boolean
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50) }, [])

  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'

  return (
    <div className="mt-2 pt-3 border-t border-gray-100 space-y-3">
      {/* Frequency */}
      <div className="flex gap-1.5">
        {[{ value: 'daily', label: t('daily') }, { value: 'weekly', label: t('weekly') }].map(f => (
          <button key={f.value} type="button" onClick={() => onChange({ ...form, frequency: f.value as any })}
            className="text-xs px-3 py-1 rounded-full border transition-colors font-medium"
            style={form.frequency === f.value
              ? { backgroundColor: accentHex, color: 'white', borderColor: accentHex }
              : { backgroundColor: 'white', color: '#4b5563', borderColor: '#e5e7eb' }
            }>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t('name')}</Label>
          <Input ref={nameRef} value={form.name} onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder={t('namePlaceholder')} className="h-8 text-sm focus:border-indigo-300"
            onKeyDown={e => { if (e.key === 'Enter' && form.name) onSave(); if (e.key === 'Escape') onCancel() }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t('typeLabel')}</Label>
          <select value={form.type} onChange={e => onChange({ ...form, type: e.target.value })}
            className="w-full border border-input rounded-md px-2.5 py-1.5 text-sm h-8 bg-white focus:border-indigo-300 focus:outline-none">
            {types.map(ty => <option key={ty.value} value={ty.value}>{ty.label}</option>)}
          </select>
        </div>
        {form.type === 'number' && (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">{t('unit')}</Label>
            <Input value={form.unit} onChange={e => onChange({ ...form, unit: e.target.value })}
              placeholder={t('unitPlaceholder')} className="h-8 text-sm focus:border-indigo-300" />
          </div>
        )}
        {form.type === 'select' && (
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-gray-500">{t('optionsLabel')}</Label>
            <Input value={form.options} onChange={e => onChange({ ...form, options: e.target.value })}
              placeholder={t('optionsPlaceholder')} className="h-8 text-sm focus:border-indigo-300" />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
        <input type="checkbox" className="accent-indigo-600 w-3.5 h-3.5" checked={form.required} onChange={e => onChange({ ...form, required: e.target.checked })} />
        <span className="text-gray-600">{t('requiredLabel')}</span>
      </label>

      <div className="flex gap-1.5">
        <button type="button" onClick={onSave} disabled={!form.name}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          style={{ backgroundColor: accentHex }}>
          <Check size={12} /> {isNew ? t('addButton') : t('save')}
        </button>
        <button type="button" onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

// ─── Single parameter card with optional inline edit ─────────────────────────
function ParamCard({
  param, isEditing, onDoubleClick, onEdit, onDelete, onSave, onCancel, editForm, onFormChange, types, t,
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
  types: { value: string; label: string }[]
  t: (k: string) => string
}) {
  const typeLabel = types.find(x => x.value === param.type)?.label || param.type
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'

  return (
    <div
      className="border rounded-xl px-3 py-2.5 bg-white transition-all"
      style={isEditing ? { borderColor: `${accentHex}60`, boxShadow: `0 0 0 1px ${accentHex}30` } : undefined}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-2">
        <GripVertical size={13} className="text-gray-300 shrink-0 cursor-grab" />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="font-medium text-sm text-gray-800 truncate">{param.name}</p>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${TYPE_COLORS[param.type] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            {typeLabel}{param.unit && ` · ${param.unit}`}
          </span>
          {param.required && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-rose-50 text-rose-600 border-rose-200 shrink-0">
              {t('required')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" title={t('editTooltip')} onClick={onEdit}
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-50 transition-colors"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = accentHex }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '' }}>
            <Pencil size={12} />
          </button>
          <button type="button" onClick={onDelete}
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {isEditing && (
        <InlineForm
          form={editForm}
          onChange={onFormChange}
          onSave={onSave}
          onCancel={onCancel}
          types={types}
          t={t}
          isNew={false}
        />
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ParametersTab() {
  const t = useTranslations('checkins.parametersTab')
  const tCommon = useTranslations('common')
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'
  const TYPES = [
    { value: 'number',  label: t('typeNumber') },
    { value: 'text',    label: t('typeText') },
    { value: 'boolean', label: t('typeBoolean') },
    { value: 'select',  label: t('typeSelect') },
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
    const { data } = await supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('frequency').order('order_index')
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
    await supabase.from('checkin_parameters').update({
      name: form.name, type: form.type,
      unit: form.unit || null,
      options: form.type === 'select' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : null,
      required: form.required, frequency: form.frequency,
      trainer_id: user.id,
    }).eq('id', param.id)
    setEditingId(null)
    fetchParameters()
  }

  const saveAdd = async () => {
    if (!addForm.name) return
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    await supabase.from('checkin_parameters').insert({
      trainer_id: user.id, name: addForm.name, type: addForm.type,
      unit: addForm.unit || null,
      options: addForm.type === 'select' ? addForm.options.split(',').map(o => o.trim()).filter(Boolean) : null,
      required: addForm.required, frequency: addForm.frequency,
      order_index: parameters.length,
    })
    setShowAddForm(false)
    setAddForm(BLANK_FORM)
    fetchParameters()
  }

  const deleteParameter = async (id: string) => {
    await supabase.from('checkin_parameters').delete().eq('id', id)
    setParameters(parameters.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const daily  = parameters.filter(p => p.frequency === 'daily')
  const weekly = parameters.filter(p => p.frequency === 'weekly')

  const tStr = (k: string) => t(k as any)

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-xs">{t('paramCount', { count: parameters.length })} · {t('dblClickHint')}</p>
        <Button onClick={() => { setShowAddForm(v => !v); setEditingId(null) }} size="sm"
          className="h-7 text-xs flex items-center gap-1 px-2.5"
          style={showAddForm ? {} : { backgroundColor: accentHex, border: 'none' }}>
          {showAddForm ? <><X size={12} /> {t('close')}</> : <><Plus size={12} /> {t('add')}</>}
        </Button>
      </div>

      {/* Add new — inline below header */}
      {showAddForm && (
        <div className="rounded-xl border px-4 pt-3 pb-4 space-y-0" style={{ borderColor: `${accentHex}40`, backgroundColor: `${accentHex}06` }}>
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: accentHex }}>
            <Settings2 size={12} /> {t('newParam')}
          </p>
          <InlineForm
            form={addForm}
            onChange={setAddForm}
            onSave={saveAdd}
            onCancel={() => { setShowAddForm(false); setAddForm(BLANK_FORM) }}
            types={TYPES}
            t={tStr}
            isNew
          />
        </div>
      )}

      {/* Parameter list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-11 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : parameters.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-xl">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${accentHex}12` }}>
            <Settings2 size={20} style={{ color: accentHex }} />
          </div>
          <p className="text-gray-400 text-sm">{t('noParameters')}</p>
          <button onClick={() => setShowAddForm(true)} className="mt-2 text-xs font-medium flex items-center gap-1 mx-auto" style={{ color: accentHex }}>
            <Plus size={11} /> Dodaj prvi parametar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {daily.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentHex }} />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('dailyCount', { count: daily.length })}</p>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {daily.map(param => (
                  <ParamCard
                    key={param.id}
                    param={param}
                    isEditing={editingId === param.id}
                    onDoubleClick={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                    onEdit={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                    onDelete={() => setConfirmDelete(param.id)}
                    onSave={() => saveEdit(param)}
                    onCancel={cancelEdit}
                    editForm={editForms[param.id] || paramToForm(param)}
                    onFormChange={f => setEditForms(prev => ({ ...prev, [param.id]: f }))}
                    types={TYPES}
                    t={tStr}
                  />
                ))}
              </div>
            </div>
          )}

          {weekly.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full opacity-60" style={{ backgroundColor: accentHex }} />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('weeklyCount', { count: weekly.length })}</p>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {weekly.map(param => (
                  <ParamCard
                    key={param.id}
                    param={param}
                    isEditing={editingId === param.id}
                    onDoubleClick={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                    onEdit={() => editingId === param.id ? cancelEdit() : startEdit(param)}
                    onDelete={() => setConfirmDelete(param.id)}
                    onSave={() => saveEdit(param)}
                    onCancel={cancelEdit}
                    editForm={editForms[param.id] || paramToForm(param)}
                    onFormChange={f => setEditForms(prev => ({ ...prev, [param.id]: f }))}
                    types={TYPES}
                    t={tStr}
                  />
                ))}
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

