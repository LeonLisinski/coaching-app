'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Pencil, Check, X, CreditCard, Settings, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'

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

function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function Stat({ label, value, sub, valueClass }: {
  label: string; value: string; sub?: string; valueClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium leading-tight ${valueClass || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
import CheckinOverview from '@/app/dashboard/checkins/[id]/components/checkin-overview'
import CheckinHistory from '@/app/dashboard/checkins/[id]/components/checkin-history'
import CheckinGraphs from '@/app/dashboard/checkins/[id]/components/checkin-graphs'
import CheckinConfig from '@/app/dashboard/checkins/[id]/components/checkin-config'
import ClientWorkoutPlans from '@/app/dashboard/clients/[id]/components/client-workout-plans'
import ClientMealPlans from '@/app/dashboard/clients/[id]/components/client-meal-plans'
import ClientPackages from '@/app/dashboard/clients/[id]/components/client-packages'
import ClientHistory from '@/app/dashboard/clients/[id]/components/client-history'
import ClientCalculator from '@/app/dashboard/clients/[id]/components/client-calculator'
import { useTranslations } from 'next-intl'

type ActivityLevel = '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary:   'Sjedilački',
  light:       'Lagano aktivan',
  moderate:    'Umjereno aktivan',
  active:      'Jako aktivan',
  very_active: 'Izuzetno aktivan',
}

const ACTIVITY_OPTIONS: { value: Exclude<ActivityLevel, ''>; label: string; desc: string }[] = [
  { value: 'sedentary',   label: 'Sjedilački',       desc: 'Malo ili bez vježbanja' },
  { value: 'light',       label: 'Lagano aktivan',   desc: '1–3× tjedno' },
  { value: 'moderate',    label: 'Umjereno aktivan', desc: '3–5× tjedno' },
  { value: 'active',      label: 'Jako aktivan',     desc: '6–7× tjedno' },
  { value: 'very_active', label: 'Izuzetno aktivan', desc: 'Fizički posao + trening' },
]

type Client = {
  id: string
  full_name: string
  email: string
  goal: string | null
  weight: number | null
  height: number | null
  date_of_birth: string | null
  start_date: string | null
  active: boolean
  gender: string | null
  notes: string | null
  activity_level: string | null
  step_goal: number | null
}

type ActivePackage = {
  id: string
  name: string
  color: string
  end_date: string
  status: string
}

type EditForm = {
  full_name: string
  goal: string
  weight: string
  height: string
  dob_display: string
  date_of_birth: string
  start_date: string
  start_display: string
  gender: '' | 'M' | 'F'
  activity_level: ActivityLevel
  step_goal: string
  notes: string
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('hr-HR')
}

export default function ClientDetailPage() {
  const t = useTranslations('clients.detail')
  const tCommon = useTranslations('common')

  const { id } = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    full_name: '', goal: '', weight: '', height: '',
    dob_display: '', date_of_birth: '',
    start_date: '', start_display: '', gender: '',
    activity_level: '', step_goal: '', notes: '',
  })
  const [activePackage, setActivePackage] = useState<ActivePackage | null>(null)
  const [showCheckinConfig, setShowCheckinConfig] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const noName = t('noName')

  useEffect(() => { fetchClient() }, [id])

  const fetchClient = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`id, goal, weight, height, date_of_birth, start_date, active, gender, notes, activity_level, step_goal,
        profiles!clients_user_id_fkey (full_name, email)`)
      .eq('id', id).single()

    if (data) {
      const c: Client = {
        id: data.id,
        full_name: (data.profiles as any)?.full_name || noName,
        email: (data.profiles as any)?.email || '',
        goal: data.goal, weight: data.weight, height: data.height,
        date_of_birth: data.date_of_birth, start_date: data.start_date, active: data.active,
        gender: data.gender, notes: data.notes,
        activity_level: data.activity_level, step_goal: data.step_goal,
      }
      setClient(c)
    }

    // Fetch active package
    const { data: pkgData } = await supabase
      .from('client_packages')
      .select('id, start_date, end_date, status, packages(name, color)')
      .eq('client_id', id)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .single()

    if (pkgData) {
      setActivePackage({
        id: pkgData.id,
        name: (pkgData.packages as any)?.name || 'Paket',
        color: (pkgData.packages as any)?.color || '#6366f1',
        end_date: pkgData.end_date,
        status: pkgData.status,
      })
    }

    setLoading(false)
  }

  const validActivityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active']
  const startEdit = () => {
    if (!client) return
    setEditForm({
      full_name: client.full_name,
      goal: client.goal || '',
      weight: client.weight?.toString() || '',
      height: client.height?.toString() || '',
      dob_display: isoToDisplay(client.date_of_birth),
      date_of_birth: client.date_of_birth || '',
      start_date: client.start_date || '',
      start_display: isoToDisplay(client.start_date),
      gender: (client.gender === 'M' || client.gender === 'F') ? client.gender : '',
      activity_level: (validActivityLevels.includes(client.activity_level || '') ? client.activity_level : '') as ActivityLevel,
      step_goal: client.step_goal?.toString() || '',
      notes: client.notes || '',
    })
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    if (!client) return
    setSaving(true)

    const { data: clientData } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', client.id)
      .single()

    if (clientData && editForm.full_name) {
      await supabase
        .from('profiles')
        .update({ full_name: editForm.full_name })
        .eq('id', clientData.user_id)
    }

    await supabase
      .from('clients')
      .update({
        goal: editForm.goal || null,
        date_of_birth: editForm.date_of_birth || null,
        weight: editForm.weight ? parseFloat(editForm.weight) : null,
        height: editForm.height ? parseFloat(editForm.height) : null,
        start_date: editForm.start_date || null,
        gender: editForm.gender || null,
        activity_level: editForm.activity_level || null,
        step_goal: editForm.step_goal ? parseInt(editForm.step_goal) : null,
        notes: editForm.notes || null,
      })
      .eq('id', client.id)

    setSaving(false)
    setEditing(false)
    await fetchClient()
  }

  const deleteClient = async () => {
    if (!client) return
    await supabase.from('checkins').delete().eq('client_id', client.id)
    await supabase.from('payments').delete().eq('client_id', client.id)
    await supabase.from('client_packages').delete().eq('client_id', client.id)
    await supabase.from('client_meal_plans').delete().eq('client_id', client.id)
    await supabase.from('client_workout_plans').delete().eq('client_id', client.id)
    await supabase.from('checkin_config').delete().eq('client_id', client.id)
    await supabase.from('messages').delete().eq('receiver_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)
    router.push('/dashboard/clients')
  }

  if (loading) return <p className="text-gray-500 text-sm p-8">{tCommon('loading')}</p>
  if (!client) return <p className="text-gray-500 text-sm p-8">Klijent nije pronađen</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{client.full_name}</h1>
            {client.gender && (
              <span className="text-lg">{client.gender === 'M' ? '♂' : '♀'}</span>
            )}
            {!client.active && <Badge variant="secondary">Neaktivan</Badge>}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-gray-500 text-sm">{client.email}</p>
            {activePackage && (
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: activePackage.color + '22', color: activePackage.color }}
              >
                <CreditCard size={11} />
                {activePackage.name}
                {activePackage.end_date && (
                  <span className="opacity-70">· do {formatDate(activePackage.end_date)}</span>
                )}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          title="Obriši klijenta"
          className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Ime i prezime</Label>
                  <Input
                    value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Cilj</Label>
                  <Input
                    value={editForm.goal}
                    onChange={e => setEditForm(f => ({ ...f, goal: e.target.value }))}
                    placeholder="Mršavljenje, mišićna masa..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Težina (kg)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={editForm.weight}
                    onChange={e => setEditForm(f => ({ ...f, weight: e.target.value.replace(',', '.') }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Visina (cm)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={editForm.height}
                    onChange={e => setEditForm(f => ({ ...f, height: e.target.value.replace(',', '.') }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Datum rođenja</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/yyyy"
                    value={editForm.dob_display}
                    maxLength={10}
                    onChange={e => {
                      const formatted = formatDobInput(e.target.value)
                      const iso = dobDisplayToIso(formatted)
                      setEditForm(f => ({ ...f, dob_display: formatted, date_of_birth: iso }))
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Datum početka</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/yyyy"
                    value={editForm.start_display}
                    maxLength={10}
                    onChange={e => {
                      const formatted = formatDobInput(e.target.value)
                      const iso = dobDisplayToIso(formatted)
                      setEditForm(f => ({ ...f, start_display: formatted, start_date: iso || formatted }))
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Spol</Label>
                <div className="flex gap-2">
                  {(['M', 'F'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, gender: f.gender === g ? '' : g }))}
                      className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                        editForm.gender === g
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {g === 'M' ? '♂ Muško' : '♀ Žensko'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Razina aktivnosti</Label>
                <div className="grid grid-cols-1 gap-1">
                  {ACTIVITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, activity_level: f.activity_level === opt.value ? '' : opt.value }))}
                      className={`flex items-center justify-between px-3 py-2 rounded-md border text-left text-sm transition-colors ${
                        editForm.activity_level === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input bg-background hover:bg-accent'
                      }`}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className={`text-xs ${editForm.activity_level === opt.value ? 'opacity-80' : 'text-gray-400'}`}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Dnevni cilj koraka</Label>
                <Input
                  type="number"
                  min="0"
                  max="50000"
                  step="500"
                  placeholder="npr. 8000"
                  value={editForm.step_goal}
                  onChange={e => setEditForm(f => ({ ...f, step_goal: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Bilješke</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Veganska prehrana, ozljede, alergije..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                  <X size={14} className="mr-1" /> Odustani
                </Button>
                <Button type="button" size="sm" onClick={saveEdit} disabled={saving}>
                  <Check size={14} className="mr-1" /> {saving ? 'Sprema...' : 'Spremi'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute top-0 right-0 flex items-center gap-0.5">
                <ClientCalculator
                  clientId={client.id}
                  client={client}
                  onSaved={fetchClient}
                />
                <button
                  type="button"
                  onClick={startEdit}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Uredi podatke"
                >
                  <Pencil size={14} />
                </button>
              </div>

              {/* Main stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-4 pr-8">
                {client.goal && (
                  <Stat label={t('stats.goal')} value={client.goal} />
                )}
                {client.gender && (
                  <Stat label="Spol" value={client.gender === 'M' ? 'Muško' : 'Žensko'} />
                )}
                <Stat
                  label={t('stats.status')}
                  value={client.active ? tCommon('active') : tCommon('inactive')}
                  valueClass={client.active ? 'text-emerald-600' : 'text-red-500'}
                />
                {(client.weight || client.height) && (
                  <>
                    {client.weight && <Stat label={t('stats.weight')} value={`${client.weight} kg`} />}
                    {client.height && <Stat label={t('stats.height')} value={`${client.height} cm`} />}
                  </>
                )}
                {client.date_of_birth && (
                  <Stat
                    label={t('stats.dateOfBirth')}
                    value={formatDate(client.date_of_birth)!}
                    sub={`${calcAge(client.date_of_birth)} god.`}
                  />
                )}
                {client.start_date && (
                  <Stat label={t('stats.startDate')} value={formatDate(client.start_date)!} />
                )}
                {client.activity_level && (
                  <Stat label="Razina aktivnosti" value={ACTIVITY_LABELS[client.activity_level] || client.activity_level} />
                )}
                {client.step_goal && (
                  <Stat label="Dnevni cilj koraka" value={`${client.step_goal.toLocaleString('hr-HR')} koraka`} />
                )}
              </div>

              {/* Notes */}
              {client.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Bilješke</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Tabs defaultValue="pracenje" className="flex-1">
          <div className="flex items-center gap-2">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="pracenje">{t('tabs.pracenje')}</TabsTrigger>
              <TabsTrigger value="checkin">{t('tabs.weeklyCheckin')}</TabsTrigger>
              <TabsTrigger value="slike">{t('tabs.slike')}</TabsTrigger>
              <TabsTrigger value="graphs">{t('tabs.graphs')}</TabsTrigger>
              <TabsTrigger value="treninzi">{t('tabs.training')}</TabsTrigger>
              <TabsTrigger value="prehrana">{t('tabs.nutrition')}</TabsTrigger>
              <TabsTrigger value="paketi">{t('tabs.packages')}</TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCheckinConfig(true)}
              title={t('tabs.checkinSettings')}
              className="text-gray-400 hover:text-gray-700 shrink-0"
            >
              <Settings size={16} />
            </Button>
          </div>

          <TabsContent value="pracenje" className="mt-6">
            <ClientHistory clientId={id as string} />
          </TabsContent>
          <TabsContent value="checkin" className="mt-6">
            <CheckinOverview clientId={id as string} />
          </TabsContent>
          <TabsContent value="slike" className="mt-6">
            <CheckinHistory clientId={id as string} />
          </TabsContent>
          <TabsContent value="graphs" className="mt-6">
            <CheckinGraphs clientId={id as string} />
          </TabsContent>
          <TabsContent value="treninzi" className="mt-6">
            <ClientWorkoutPlans clientId={id as string} />
          </TabsContent>
          <TabsContent value="prehrana" className="mt-6">
            <ClientMealPlans clientId={id as string} />
          </TabsContent>
          <TabsContent value="paketi" className="mt-6">
            <ClientPackages clientId={id as string} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Check-in settings dialog */}
      <Dialog open={showCheckinConfig} onOpenChange={setShowCheckinConfig}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('tabs.checkinSettings')}</DialogTitle>
          </DialogHeader>
          <CheckinConfig clientId={id as string} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Brisanje klijenta: ${client.full_name}`}
        description={
          <div className="space-y-3">
            <p>Brisanjem ovog klijenta trajno će se ukloniti <span className="font-semibold text-gray-800">svi podaci vezani za njega</span>:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
              <li>Svi check-inovi i fotografije napretka</li>
              <li>Planovi prehrane i treninga</li>
              <li>Paketi i evidencija plaćanja</li>
              <li>Sve poruke u chatu</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2">
              <span className="text-amber-500 text-base leading-none mt-0.5">💡</span>
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Preporuka:</span> Umjesto brisanja, razmotrite{' '}
                <button
                  type="button"
                  className="underline font-semibold hover:text-amber-900"
                  onClick={async () => {
                    setConfirmDelete(false)
                    await supabase.from('clients').update({ active: false }).eq('id', client.id)
                    fetchClient()
                  }}
                >
                  deaktivaciju klijenta
                </button>
                . Na taj način zadržavate sve podatke i povijest, ali klijent više nije aktivan.
              </p>
            </div>
            <p className="font-bold text-red-600">Ova radnja je nepovratna i ne može se poništiti.</p>
            <p className="text-gray-700">Želite li nastaviti s brisanjem klijenta?</p>
          </div>
        }
        onConfirm={deleteClient}
        onCancel={() => setConfirmDelete(false)}
        confirmLabel="Da, obriši"
        cancelLabel="Ne, odustani"
        destructive
      />
    </div>
  )
}
