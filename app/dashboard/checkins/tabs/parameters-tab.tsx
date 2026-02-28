'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [form, setForm] = useState({
    name: '',
    type: 'number',
    unit: '',
    options: '',
    required: false,
  })

  useEffect(() => {
    fetchParameters()
  }, [])

  const fetchParameters = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('checkin_parameters')
      .select('*')
      .eq('trainer_id', user.id)
      .order('order_index')
    if (data) setParameters(data)
    setLoading(false)
  }

  const openAdd = () => {
    setEditParam(null)
    setForm({ name: '', type: 'number', unit: '', options: '', required: false })
    setShowForm(true)
  }

  const openEdit = (param: Parameter) => {
    setEditParam(param)
    setForm({
      name: param.name,
      type: param.type,
      unit: param.unit || '',
      options: param.options?.join(', ') || '',
      required: param.required,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      trainer_id: user.id,
      name: form.name,
      type: form.type,
      unit: form.unit || null,
      options: form.type === 'select' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : null,
      required: form.required,
      order_index: editParam ? editParam.order_index : parameters.length,
    }

    if (editParam) {
      await supabase.from('checkin_parameters').update(payload).eq('id', editParam.id)
    } else {
      await supabase.from('checkin_parameters').insert(payload)
    }

    setShowForm(false)
    fetchParameters()
  }

  const deleteParameter = async (id: string) => {
    await supabase.from('checkin_parameters').delete().eq('id', id)
    setParameters(parameters.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const typeLabel = (type: string) => TYPES.find(t => t.value === type)?.label || type

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{parameters.length} parametara</p>
          <p className="text-xs text-gray-400">Ovi parametri su globalni — vrijede za sve klijente</p>
        </div>
        <Button onClick={openAdd} size="sm" className="flex items-center gap-2">
          <Plus size={14} />
          Dodaj parametar
        </Button>
      </div>

      {showForm && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="py-4 space-y-3">
            <p className="font-medium text-sm">{editParam ? 'Uredi parametar' : 'Novi parametar'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Naziv</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Kilaza, Unos vode, Krvni tlak..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tip</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-md px-3 py-1.5 text-sm h-8"
                >
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {form.type === 'number' && (
                <div className="space-y-1">
                  <Label className="text-xs">Jedinica (opcionalno)</Label>
                  <Input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="kg, L, mmHg, koraci..."
                    className="h-8 text-sm"
                  />
                </div>
              )}
              {form.type === 'select' && (
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Opcije (odvojene zarezom)</Label>
                  <Input
                    value={form.options}
                    onChange={(e) => setForm({ ...form, options: e.target.value })}
                    placeholder="Odlično, Dobro, Loše"
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm({ ...form, required: e.target.checked })}
              />
              Obavezno polje
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!form.name}>
                {editParam ? 'Spremi promjene' : 'Dodaj parametar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Odustani
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : parameters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            Još nemaš parametara. Dodaj prvi!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {parameters.map((param) => (
            <Card key={param.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical size={14} className="text-gray-300" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{param.name}</p>
                      {param.required && <Badge variant="outline" className="text-xs py-0">Obavezno</Badge>}
                    </div>
                    <p className="text-xs text-gray-400">
                      {typeLabel(param.type)}
                      {param.unit && ` • ${param.unit}`}
                      {param.options && ` • ${param.options.join(', ')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(param)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(param.id)}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Obriši parametar"
        description="Sigurno želiš obrisati ovaj parametar? Postojeći checkini neće biti pogođeni."
        onConfirm={() => confirmDelete && deleteParameter(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
    </div>
  )
}