'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'

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

const TYPES = [
  { value: 'number', label: 'Broj' },
  { value: 'text', label: 'Tekst' },
  { value: 'boolean', label: 'Da/Ne' },
  { value: 'select', label: 'Odabir' },
]

export default function ParametersTab() {
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editParam, setEditParam] = useState<Parameter | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'number', unit: '', options: '', required: false, frequency: 'daily' as 'daily' | 'weekly' })

  useEffect(() => { fetchParameters() }, [])

  const fetchParameters = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('frequency').order('order_index')
    if (data) setParameters(data)
    setLoading(false)
  }

  const openAdd = () => {
    setEditParam(null)
    setForm({ name: '', type: 'number', unit: '', options: '', required: false, frequency: 'daily' })
    setShowForm(true)
  }

  const openEdit = (param: Parameter) => {
    setEditParam(param)
    setForm({ name: param.name, type: param.type, unit: param.unit || '', options: param.options?.join(', ') || '', required: param.required, frequency: param.frequency || 'daily' })
    setShowForm(true)
  }

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      trainer_id: user.id, name: form.name, type: form.type,
      unit: form.unit || null,
      options: form.type === 'select' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : null,
      required: form.required, frequency: form.frequency,
      order_index: editParam ? editParam.order_index : parameters.length,
    }
    if (editParam) await supabase.from('checkin_parameters').update(payload).eq('id', editParam.id)
    else await supabase.from('checkin_parameters').insert(payload)
    setShowForm(false)
    fetchParameters()
  }

  const deleteParameter = async (id: string) => {
    await supabase.from('checkin_parameters').delete().eq('id', id)
    setParameters(parameters.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const typeLabel = (type: string) => TYPES.find(t => t.value === type)?.label || type
  const daily = parameters.filter(p => p.frequency === 'daily')
  const weekly = parameters.filter(p => p.frequency === 'weekly')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{parameters.length} parametara</p>
        <Button onClick={openAdd} size="sm" className="flex items-center gap-2">
          <Plus size={14} /> Dodaj parametar
        </Button>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
          <p className="font-medium text-sm">{editParam ? 'Uredi parametar' : 'Novi parametar'}</p>

          {/* Frequency — pill toggle matching filter style */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Učestalost</p>
            <div className="flex gap-2">
              {[{ value: 'daily', label: 'Dnevno' }, { value: 'weekly', label: 'Tjedno' }].map(f => (
                <button key={f.value} onClick={() => setForm({ ...form, frequency: f.value as any })} style={{
                  padding: '4px 14px', borderRadius: 99, fontSize: 13,
                  fontWeight: form.frequency === f.value ? 600 : 400,
                  backgroundColor: form.frequency === f.value ? '#111827' : 'white',
                  color: form.frequency === f.value ? 'white' : '#374151',
                  border: `1px solid ${form.frequency === f.value ? '#111827' : '#e5e7eb'}`, cursor: 'pointer',
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Naziv</p>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="npr. Težina, Koraci..." className="h-9" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tip</p>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full border border-input rounded-md px-3 py-2 text-sm h-9 bg-white">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {form.type === 'number' && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Jedinica</p>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="kg, L, koraka..." className="h-9" />
              </div>
            )}
            {form.type === 'select' && (
              <div className="space-y-1.5 col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opcije (odvojene zarezom)</p>
                <Input value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} placeholder="Odlično, Dobro, Loše" className="h-9" />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.required} onChange={e => setForm({ ...form, required: e.target.checked })} />
            Obavezno polje
          </label>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={!form.name}>{editParam ? 'Spremi' : 'Dodaj'}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Odustani</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Učitava...</p>
      ) : parameters.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-500 text-sm">Nema parametara</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {daily.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dnevni ({daily.length})</p>
              <div className="grid grid-cols-1 gap-2">
                {daily.map(param => (
                  <Card key={param.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical size={14} className="text-gray-300" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{param.name}</p>
                            {param.required && <Badge variant="outline" className="text-xs">Obavezno</Badge>}
                          </div>
                          <p className="text-xs text-gray-500">{typeLabel(param.type)}{param.unit && ` · ${param.unit}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(param)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(param.id)}><Trash2 size={14} className="text-red-400" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {weekly.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tjedni ({weekly.length})</p>
              <div className="grid grid-cols-1 gap-2">
                {weekly.map(param => (
                  <Card key={param.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical size={14} className="text-gray-300" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{param.name}</p>
                            {param.required && <Badge variant="outline" className="text-xs">Obavezno</Badge>}
                          </div>
                          <p className="text-xs text-gray-500">{typeLabel(param.type)}{param.unit && ` · ${param.unit}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(param)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(param.id)}><Trash2 size={14} className="text-red-400" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={confirmDelete !== null} title="Obriši parametar" description="Jesi li siguran?"
        onConfirm={() => confirmDelete && deleteParameter(confirmDelete)}
        onCancel={() => setConfirmDelete(null)} confirmLabel="Obriši" destructive />
    </div>
  )
}
