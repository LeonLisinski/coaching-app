'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Phone, Globe, Instagram, Camera, Check } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type Profile = {
  id: string; full_name: string; email: string; bio: string | null
  phone: string | null; website: string | null; instagram: string | null; avatar_url: string | null
}
type Package = {
  id: string; name: string; description: string | null
  price: number; duration_days: number; color: string; active: boolean
}

const NUTRITION_FIELD_OPTIONS = [
  { key: 'fiber',         label: 'Vlakna',         unit: 'g' },
  { key: 'sugar',         label: 'Šećeri',         unit: 'g' },
  { key: 'sodium',        label: 'Natrij',         unit: 'mg' },
  { key: 'salt',          label: 'Sol',            unit: 'g' },
  { key: 'potassium',     label: 'Kalij',          unit: 'mg' },
  { key: 'saturated_fat', label: 'Zasićene masti', unit: 'g' },
  { key: 'cholesterol',   label: 'Kolesterol',     unit: 'mg' },
  { key: 'vitamin_c',     label: 'Vitamin C',      unit: 'mg' },
  { key: 'calcium',       label: 'Kalcij',         unit: 'mg' },
  { key: 'iron',          label: 'Željezo',        unit: 'mg' },
]
const EXERCISE_FIELD_OPTIONS = [
  { key: 'rir',      label: 'RIR',      desc: 'Reps In Reserve' },
  { key: 'rpe',      label: 'RPE',      desc: 'Rate of Perceived Exertion' },
  { key: 'tempo',    label: 'Tempo',    desc: 'Brzina izvođenja (npr. 3-1-2)' },
  { key: 'rest',     label: 'Pauza',    desc: 'Odmor između serija (s)' },
  { key: 'duration', label: 'Trajanje', desc: 'Trajanje vježbe (min)' },
  { key: 'distance', label: 'Distanca', desc: 'Prijeđena distanca (km/m)' },
]

export default function ProfilePage() {
  const t       = useTranslations('profile')
  const tPkg    = useTranslations('profile.packages')
  const tCommon = useTranslations('common')

  const [profile, setProfile]             = useState<Profile | null>(null)
  const [packages, setPackages]           = useState<Package[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [form, setForm]                   = useState({ full_name: '', bio: '', phone: '', website: '', instagram: '' })

  const [showPackageForm, setShowPackageForm] = useState(false)
  const [editPackage, setEditPackage]         = useState<Package | null>(null)
  const [packageForm, setPackageForm]         = useState({ name: '', description: '', price: '', duration_days: '30', color: '#3b82f6' })
  const [confirmDelete, setConfirmDelete]     = useState<string | null>(null)

  const [nutritionFields, setNutritionFields]   = useState<string[]>([])
  const [exerciseFields, setExerciseFields]     = useState<string[]>([])
  const [savingSettings, setSavingSettings]     = useState(false)
  const [settingsSaved, setSettingsSaved]       = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: pd }, { data: pkgs }, { data: tp }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('packages').select('*').eq('trainer_id', user.id).order('created_at'),
      supabase.from('trainer_profiles').select('nutrition_fields, exercise_fields').eq('id', user.id).single(),
    ])
    if (pd) { setProfile(pd); setForm({ full_name: pd.full_name || '', bio: pd.bio || '', phone: pd.phone || '', website: pd.website || '', instagram: pd.instagram || '' }) }
    if (pkgs) setPackages(pkgs)
    if (tp) { setNutritionFields(tp.nutrition_fields || []); setExerciseFields(tp.exercise_fields || []) }
    setLoading(false)
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: form.full_name, bio: form.bio || null, phone: form.phone || null, website: form.website || null, instagram: form.instagram || null }).eq('id', profile.id)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
    fetchData()
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    const fileName = `${profile.id}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
    if (error) return
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
    fetchData()
  }

  const openNewPackage = () => { setEditPackage(null); setPackageForm({ name: '', description: '', price: '', duration_days: '30', color: '#3b82f6' }); setShowPackageForm(true) }
  const openEditPackage = (pkg: Package) => { setEditPackage(pkg); setPackageForm({ name: pkg.name, description: pkg.description || '', price: pkg.price.toString(), duration_days: pkg.duration_days.toString(), color: pkg.color }); setShowPackageForm(true) }

  const savePackage = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { trainer_id: user.id, name: packageForm.name, description: packageForm.description || null, price: parseFloat(packageForm.price), duration_days: parseInt(packageForm.duration_days), color: packageForm.color }
    if (editPackage) await supabase.from('packages').update(payload).eq('id', editPackage.id)
    else await supabase.from('packages').insert(payload)
    setShowPackageForm(false); fetchData()
  }

  const deletePackage = async (id: string) => { await supabase.from('packages').delete().eq('id', id); setPackages(packages.filter(p => p.id !== id)); setConfirmDelete(null) }
  const togglePackageActive = async (pkg: Package) => { await supabase.from('packages').update({ active: !pkg.active }).eq('id', pkg.id); setPackages(packages.map(p => p.id === pkg.id ? { ...p, active: !p.active } : p)) }
  const toggleField = (key: string, list: string[], setList: (v: string[]) => void) => { setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]); setSettingsSaved(false) }

  const saveSettings = async () => {
    setSavingSettings(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('trainer_profiles').update({ nutrition_fields: nutritionFields, exercise_fields: exerciseFields }).eq('id', user.id)
    setSavingSettings(false); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000)
  }

  if (loading) return <p className="text-gray-400 text-sm p-4">{tCommon('loading')}</p>

  const initials = form.full_name ? form.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">{t('tabs.profile')}</TabsTrigger>
          <TabsTrigger value="paketi">{t('tabs.packages')}</TabsTrigger>
          <TabsTrigger value="postavke">Postavke</TabsTrigger>
        </TabsList>

        {/* ── PROFIL TAB ── */}
        <TabsContent value="profil" className="mt-6 space-y-5">

          {/* Profile card */}
          <Card>
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-primary">{initials}</span>
                    )}
                  </div>
                  <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                    <Camera size={12} className="text-gray-500" />
                    <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                  </label>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">{form.full_name || '—'}</h2>
                  <p className="text-sm text-gray-400">{profile?.email}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {form.instagram && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Instagram size={11} className="text-pink-400" />@{form.instagram.replace('@', '')}
                      </span>
                    )}
                    {form.phone && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone size={11} className="text-green-500" />{form.phone}
                      </span>
                    )}
                    {form.website && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Globe size={11} className="text-blue-400" />{form.website.replace(/^https?:\/\//, '')}
                      </span>
                    )}
                  </div>
                  {form.bio && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{form.bio}</p>}
                  {profile?.avatar_url && (
                    <button onClick={async () => { await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id); fetchData() }}
                      className="mt-2 text-xs text-red-400 hover:text-red-600 transition-colors">
                      {t('avatar.remove')}
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Uredi podatke</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('form.fullName')}</Label>
                  <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Phone size={11} className="text-gray-400" />{t('form.phone')}</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder={t('form.phonePlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Globe size={11} className="text-gray-400" />{t('form.website')}</Label>
                  <Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder={t('form.websitePlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Instagram size={11} className="text-gray-400" />{t('form.instagram')}</Label>
                  <Input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder={t('form.instagramPlaceholder')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('form.bio')}</Label>
                <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                  placeholder={t('form.bioPlaceholder')}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm min-h-20 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={saveProfile} disabled={saving} size="sm">
                  {saving ? tCommon('saving') : t('saveProfile')}
                </Button>
                {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={13} /> Spremljeno</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PAKETI TAB ── */}
        <TabsContent value="paketi" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{tPkg('count', { count: packages.length })}</p>
            <Button onClick={openNewPackage} size="sm" className="flex items-center gap-1.5">
              <Plus size={13} />{tPkg('addNew').replace('+ ', '')}
            </Button>
          </div>

          {/* Package form */}
          {showPackageForm && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">{editPackage ? tPkg('editTitle') : tPkg('newTitle')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('name')}</Label>
                    <Input value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder={tPkg('namePlaceholder')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('price')} (€)</Label>
                    <Input type="number" value={packageForm.price} onChange={e => setPackageForm({ ...packageForm, price: e.target.value })} placeholder="150" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('duration')} (dana)</Label>
                    <Input type="number" value={packageForm.duration_days} onChange={e => setPackageForm({ ...packageForm, duration_days: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('color')}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={packageForm.color} onChange={e => setPackageForm({ ...packageForm, color: e.target.value })} className="w-8 h-8 rounded-lg border cursor-pointer p-0.5" />
                      <span className="text-xs text-gray-500 font-mono">{packageForm.color}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{tPkg('description')}</Label>
                  <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder={tPkg('descriptionPlaceholder')} className="w-full border border-input rounded-lg px-3 py-2 text-sm min-h-14 resize-none" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={savePackage} disabled={!packageForm.name || !packageForm.price}>{editPackage ? tPkg('save') : tPkg('add')}</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowPackageForm(false)}>{tCommon('cancel')}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Package list */}
          {packages.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2"><Plus size={16} className="text-gray-400" /></div>
              <p className="text-sm">{tPkg('empty')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {packages.map(pkg => (
                <div key={pkg.id} className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border bg-white transition-opacity ${!pkg.active ? 'opacity-50' : ''}`}>
                  {/* Color dot */}
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pkg.color, boxShadow: `0 0 0 2px white, 0 0 0 3px ${pkg.color}40` }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{pkg.name}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pkg.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {pkg.active ? tPkg('active') : tPkg('inactive')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="font-medium text-gray-600">{pkg.price} €</span>
                      {' · '}{pkg.duration_days} {tPkg('days')}
                      {pkg.description && <span className="text-gray-400"> · {pkg.description}</span>}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => togglePackageActive(pkg)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${pkg.active ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                      {pkg.active ? tPkg('deactivate') : tPkg('activate')}
                    </button>
                    <button type="button" onClick={() => openEditPackage(pkg)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(pkg.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── POSTAVKE TAB ── */}
        <TabsContent value="postavke" className="mt-6 space-y-5 max-w-2xl">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Dodatna nutritivna polja</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Odabrana polja bit će dostupna pri unosu namirnica.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {NUTRITION_FIELD_OPTIONS.map(opt => {
                  const active = nutritionFields.includes(opt.key)
                  return (
                    <button key={opt.key} type="button" onClick={() => toggleField(opt.key, nutritionFields, setNutritionFields)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className={`text-xs ${active ? 'text-gray-400' : 'text-gray-400'}`}>{opt.unit}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'bg-white border-white' : 'border-gray-300'}`}>
                        {active && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Metrike za vježbe</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Odabrane metrike bit će dostupne pri kreiranju vježbi.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {EXERCISE_FIELD_OPTIONS.map(opt => {
                  const active = exerciseFields.includes(opt.key)
                  return (
                    <button key={opt.key} type="button" onClick={() => toggleField(opt.key, exerciseFields, setExerciseFields)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className={`text-xs truncate ${active ? 'text-gray-400' : 'text-gray-400'}`}>{opt.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'bg-white border-white' : 'border-gray-300'}`}>
                        {active && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={saveSettings} disabled={savingSettings} size="sm">
              {savingSettings ? 'Sprema...' : 'Spremi postavke'}
            </Button>
            {settingsSaved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={13} /> Spremljeno</span>}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={tPkg('deleteTitle')}
        description={tPkg('deleteConfirm')}
        onConfirm={() => confirmDelete && deletePackage(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tPkg('delete')}
        destructive
      />
    </div>
  )
}
