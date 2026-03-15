'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, Pencil, Trash2, Phone, Globe, Instagram, Camera, Check,
  X, Mail, FileText, AtSign, Package, Facebook, Eye, EyeOff,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useAppTheme } from '@/app/contexts/app-theme'

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function durationLabel(days: number): string {
  const m = Math.round(days / 30)
  return m === 1 ? '1 mjesec' : `${m} mj.`
}

const ACCENT_HEX_MAP: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type Profile = {
  id: string; full_name: string; email: string; bio: string | null
  phone: string | null; website: string | null; instagram: string | null
  tiktok: string | null; facebook: string | null; avatar_url: string | null
}

// Social link definitions
const SOCIAL_LINKS = [
  { key: 'email',     label: 'Email',     Icon: Mail,       prefix: '' },
  { key: 'phone',     label: 'Telefon',   Icon: Phone,      prefix: '' },
  { key: 'website',   label: 'Web',       Icon: Globe,      prefix: '' },
  { key: 'instagram', label: 'Instagram', Icon: Instagram,  prefix: '@' },
  { key: 'facebook',  label: 'Facebook',  Icon: Facebook,   prefix: '' },
  { key: 'tiktok',    label: 'TikTok',    Icon: AtSign,     prefix: '@' },
] as const
type Pkg = {
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

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-gray-700 tracking-tight">{title}</h2>
      {action}
    </div>
  )
}

export default function ProfilePage() {
  const t       = useTranslations('profile')
  const tPkg    = useTranslations('profile.packages')
  const tCommon = useTranslations('common')
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX_MAP[accent] || '#7c3aed'

  const [profile, setProfile]   = useState<Profile | null>(null)
  const [packages, setPackages] = useState<Pkg[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm]         = useState({ full_name: '', bio: '', phone: '', website: '', instagram: '', tiktok: '', facebook: '' })
  const [socialVisibility, setSocialVisibility] = useState<string[]>(['phone', 'email', 'instagram', 'website'])

  const [showPkgForm, setShowPkgForm]     = useState(false)
  const [editPkg, setEditPkg]             = useState<Pkg | null>(null)
  const [pkgForm, setPkgForm]             = useState({ name: '', description: '', price: '', duration_months: '1', color: '#3b82f6' })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [nutritionFields, setNutritionFields] = useState<string[]>([])
  const [exerciseFields, setExerciseFields]   = useState<string[]>([])
  const [savingSettings, setSavingSettings]   = useState(false)
  const [settingsSaved, setSettingsSaved]     = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: pd }, { data: pkgs }, { data: tp }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('packages').select('*').eq('trainer_id', user.id).order('created_at'),
      supabase.from('trainer_profiles').select('*').eq('id', user.id).maybeSingle(),
    ])
    if (pd) {
      setProfile(pd)
      setForm({
        full_name: pd.full_name || '', bio: pd.bio || '',
        phone: pd.phone || '', website: pd.website || '',
        instagram: pd.instagram || '', tiktok: pd.tiktok || '', facebook: pd.facebook || '',
      })
    }
    if (pkgs) setPackages(pkgs)
    if (tp) {
      setNutritionFields(tp.nutrition_fields || [])
      setExerciseFields(tp.exercise_fields || [])
      setSocialVisibility(tp.social_visibility || ['phone', 'email', 'instagram', 'website'])
    }
    setLoading(false)
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      full_name: form.full_name, bio: form.bio || null,
      phone: form.phone || null, website: form.website || null,
      instagram: form.instagram || null, tiktok: form.tiktok || null, facebook: form.facebook || null,
    }).eq('id', profile.id)
    if (user) {
      await supabase.from('trainer_profiles').update({ social_visibility: socialVisibility }).eq('id', user.id)
    }
    setSaving(false); setSaved(true); setEditMode(false)
    setTimeout(() => setSaved(false), 2500)
    fetchData()
  }

  const toggleVisibility = (key: string) => {
    setSocialVisibility(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    const fileName = `${profile.id}.${file.name.split('.').pop()}`
    await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
    fetchData()
  }

  const openNewPkg  = () => { setEditPkg(null); setPkgForm({ name: '', description: '', price: '', duration_months: '1', color: '#3b82f6' }); setShowPkgForm(true) }
  const openEditPkg = (pkg: Pkg) => { setEditPkg(pkg); setPkgForm({ name: pkg.name, description: pkg.description || '', price: pkg.price.toString(), duration_months: String(Math.round(pkg.duration_days / 30)), color: pkg.color }); setShowPkgForm(true) }

  const savePkg = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const months = parseInt(pkgForm.duration_months) || 1
    const payload = { trainer_id: user.id, name: pkgForm.name, description: pkgForm.description || null, price: parseFloat(pkgForm.price), duration_days: months * 30, color: pkgForm.color }
    if (editPkg) await supabase.from('packages').update(payload).eq('id', editPkg.id)
    else await supabase.from('packages').insert(payload)
    setShowPkgForm(false); fetchData()
  }

  const deletePkg       = async (id: string) => { await supabase.from('packages').delete().eq('id', id); setPackages(p => p.filter(x => x.id !== id)); setConfirmDelete(null) }
  const togglePkgActive = async (pkg: Pkg)    => { await supabase.from('packages').update({ active: !pkg.active }).eq('id', pkg.id); setPackages(p => p.map(x => x.id === pkg.id ? { ...x, active: !x.active } : x)) }
  const toggleField     = (key: string, list: string[], setList: (v: string[]) => void) => { setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]); setSettingsSaved(false) }

  const saveSettings = async () => {
    setSavingSettings(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('trainer_profiles').update({ nutrition_fields: nutritionFields, exercise_fields: exerciseFields, social_visibility: socialVisibility }).eq('id', user.id)
    setSavingSettings(false); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2500)
  }

  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = accentHex
    e.currentTarget.style.boxShadow = `0 0 0 3px ${accentHex}20`
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = ''
    e.currentTarget.style.boxShadow = ''
  }

  if (loading) return <p className="text-gray-400 text-sm p-4">{tCommon('loading')}</p>

  const initials = form.full_name ? form.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

  return (
    <div className="space-y-5">

      {/* ── Hero header ── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-white/20">
        <div className="px-4 sm:px-6 py-5 flex items-start gap-4"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accentHex} 70%, #0f0a1e), color-mix(in srgb, ${accentHex} 50%, #0f0a1e))` }}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 border border-white/30 overflow-hidden flex items-center justify-center shadow-sm">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-xl sm:text-2xl font-bold text-white">{initials}</span>
              }
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors border border-gray-200">
              <Camera size={11} className="text-gray-500" />
              <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
            </label>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{form.full_name || '—'}</h1>
                <p className="text-white/60 text-xs sm:text-sm mt-0.5 truncate">{profile?.email}</p>
              </div>
              {/* Edit button — icon only on mobile, text on sm+ */}
              <div className="flex items-center gap-1.5 shrink-0">
                {profile?.avatar_url && (
                  <button onClick={async () => { await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile!.id); fetchData() }}
                    className="hidden sm:block text-xs text-white/50 hover:text-white/80 transition-colors">
                    {t('avatar.remove')}
                  </button>
                )}
                <button onClick={() => setEditMode(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl font-semibold transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
                  {editMode
                    ? <><X size={11} /> <span className="hidden sm:inline">{tCommon('cancel')}</span></>
                    : <><Pencil size={11} /> <span className="hidden sm:inline">{t('editProfile')}</span></>
                  }
                </button>
              </div>
            </div>

            {/* Social links — compact on mobile, never break mid-item */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {form.instagram && <span className="whitespace-nowrap flex items-center gap-1 text-[11px] text-white/70"><Instagram size={9} />@{form.instagram.replace('@', '')}</span>}
              {form.facebook  && <span className="whitespace-nowrap flex items-center gap-1 text-[11px] text-white/70"><Facebook size={9} />{form.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, '')}</span>}
              {form.tiktok    && <span className="whitespace-nowrap flex items-center gap-1 text-[11px] text-white/70"><AtSign size={9} />@{form.tiktok.replace('@', '')}</span>}
              {form.phone     && <span className="whitespace-nowrap flex items-center gap-1 text-[11px] text-white/70"><Phone size={9} />{form.phone}</span>}
              {form.website   && <span className="whitespace-nowrap flex items-center gap-1 text-[11px] text-white/70"><Globe size={9} />{form.website.replace(/^https?:\/\//, '')}</span>}
            </div>
            {form.bio && <p className="text-[11px] text-white/55 mt-1.5 leading-relaxed line-clamp-2 sm:line-clamp-none">{form.bio}</p>}
          </div>
        </div>
      </div>

      {/* ── Two-column grid: Info left, Paketi right ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

      {/* ── SECTION: Profile info ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <SectionHeader title="Informacije o profilu" />

        {editMode ? (
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('form.fullName')}</Label>
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            {/* Contact links */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kontakt i mreže</p>
              <div className="space-y-2">
                {[
                  { key: 'phone',     Icon: Phone,     label: 'Telefon',   placeholder: '+385 99 123 4567' },
                  { key: 'website',   Icon: Globe,     label: 'Web',       placeholder: 'https://...' },
                  { key: 'instagram', Icon: Instagram, label: 'Instagram', placeholder: '@korisničkoime' },
                  { key: 'facebook',  Icon: Facebook,  label: 'Facebook',  placeholder: 'https://facebook.com/...' },
                  { key: 'tiktok',    Icon: AtSign,    label: 'TikTok',    placeholder: '@korisničkoime' },
                ].map(({ key, Icon, label, placeholder }) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-gray-200">
                      <Icon size={12} className="text-gray-400" />
                    </div>
                    <Input
                      value={(form as any)[key]}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="flex-1 h-8 text-sm"
                      onFocus={inputFocus} onBlur={inputBlur}
                    />
                    {/* Visibility toggle */}
                    <button
                      type="button"
                      title={socialVisibility.includes(key) ? 'Vidljivo na mobilnoj app' : 'Skriveno na mobilnoj app'}
                      onClick={() => toggleVisibility(key)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${socialVisibility.includes(key) ? 'border-transparent text-white' : 'border-gray-200 text-gray-300 hover:text-gray-500'}`}
                      style={socialVisibility.includes(key) ? { backgroundColor: accentHex } : {}}>
                      {socialVisibility.includes(key) ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                <Eye size={10} /> Ikona oka označava što se prikazuje klijentima na mobilnoj aplikaciji.
              </p>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('form.bio')}</Label>
              <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder={t('form.bioPlaceholder')}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm min-h-20 resize-none focus:outline-none transition-colors"
                onFocus={inputFocus as any} onBlur={inputBlur as any} />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button onClick={saveProfile} disabled={saving}
                className="h-9 px-5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: accentHex }}>
                {saving ? tCommon('saving') : t('saveProfile')}
              </button>
              <button onClick={() => setEditMode(false)} className="h-9 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                {tCommon('cancel')}
              </button>
              {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={13} /> Spremljeno</span>}
            </div>
          </div>
        ) : (
          /* View mode */
          <div className="space-y-2">
            {/* Email always shown */}
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentHex}12`, color: accentHex }}>
                <Mail size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Email</p>
                <p className="text-sm text-gray-800 font-medium break-all">{profile?.email}</p>
              </div>
            </div>

            {SOCIAL_LINKS.filter(s => s.key !== 'email').map(({ key, label, Icon, prefix }) => {
              const raw = (form as any)[key]
              if (!raw) return null
              const visible = socialVisibility.includes(key)
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentHex}12`, color: accentHex }}>
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm text-gray-800 font-medium break-all">{prefix}{raw.replace('@', '')}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${visible ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {visible ? <Eye size={9} /> : <EyeOff size={9} />}
                    {visible ? 'Vidljivo' : 'Skriveno'}
                  </span>
                </div>
              )
            })}

            {form.bio && (
              <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${accentHex}12`, color: accentHex }}>
                  <FileText size={13} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Biografija</p>
                  <p className="text-sm text-gray-700 leading-relaxed mt-0.5">{form.bio}</p>
                </div>
              </div>
            )}

            {!form.phone && !form.website && !form.instagram && !form.facebook && !form.tiktok && !form.bio && (
              <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
                <p className="text-sm text-gray-400">{t('noContactData')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION: Paketi (right column) ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <SectionHeader
          title={`Paketi (${packages.length})`}
          action={
            <button onClick={openNewPkg}
              className="h-8 px-3 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5"
              style={{ backgroundColor: accentHex }}>
              <Plus size={12} />{tPkg('addNew').replace('+ ', '')}
            </button>
          }
        />

        {/* Package form */}
        {showPkgForm && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3" style={{ borderColor: `${accentHex}25` }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">{editPkg ? tPkg('editTitle') : tPkg('newTitle')}</p>
              <button onClick={() => setShowPkgForm(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">{tPkg('name')}</Label>
                <Input value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} placeholder={tPkg('namePlaceholder')} className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">{tPkg('price')} (€)</Label>
                <Input type="number" value={pkgForm.price} onChange={e => setPkgForm({ ...pkgForm, price: e.target.value })} placeholder="150" className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Trajanje (mjeseci)</Label>
                <Input type="number" min="1" max="24" value={pkgForm.duration_months} onChange={e => setPkgForm({ ...pkgForm, duration_months: e.target.value })} className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">{tPkg('color')}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={pkgForm.color} onChange={e => setPkgForm({ ...pkgForm, color: e.target.value })} className="w-8 h-8 rounded-lg border cursor-pointer p-0.5" />
                  <span className="text-xs text-gray-500 font-mono">{pkgForm.color}</span>
                </div></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">{tPkg('description')}</Label>
              <textarea value={pkgForm.description} onChange={e => setPkgForm({ ...pkgForm, description: e.target.value })} placeholder={tPkg('descriptionPlaceholder')} className="w-full border border-input rounded-lg px-3 py-2 text-sm min-h-14 resize-none" /></div>
            <div className="flex gap-2">
              <button onClick={savePkg} disabled={!pkgForm.name || !pkgForm.price}
                className="h-8 px-4 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
                style={{ backgroundColor: accentHex }}>
                {editPkg ? tPkg('save') : tPkg('add')}
              </button>
              <button onClick={() => setShowPkgForm(false)} className="h-8 px-4 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">{tCommon('cancel')}</button>
            </div>
          </div>
        )}

        {packages.length === 0 && !showPkgForm ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2"><Package size={16} className="text-gray-400" /></div>
            <p className="text-sm text-gray-400">{tPkg('empty')}</p>
            <button onClick={openNewPkg} className="mt-2 text-xs font-medium" style={{ color: accentHex }}>{t('addFirstPackage')}</button>
          </div>
        ) : (
          <div className="space-y-2">
            {packages.map(pkg => (
              <div key={pkg.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-white transition-opacity ${!pkg.active ? 'opacity-50' : ''}`}
                style={{ borderLeft: `3px solid ${pkg.color}` }}>
                {/* Color + name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{pkg.name}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pkg.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pkg.active ? tPkg('active') : tPkg('inactive')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-semibold text-gray-700">{pkg.price} €</span>
                    {' · '}{durationLabel(pkg.duration_days)}
                    {pkg.description && <span className="text-gray-400"> · {pkg.description}</span>}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => togglePkgActive(pkg)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${pkg.active ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                    {pkg.active ? tPkg('deactivate') : tPkg('activate')}
                  </button>
                  <button onClick={() => openEditPkg(pkg)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => setConfirmDelete(pkg.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>{/* end grid */}

      {/* ── SECTION: Postavke ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
        <SectionHeader title="Postavke prikaza" />

        {/* Nutrition fields */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-0.5">Dodatna nutritivna polja</p>
          <p className="text-xs text-gray-400 mb-3">Odabrana polja bit će dostupna pri unosu namirnica.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {NUTRITION_FIELD_OPTIONS.map(opt => {
              const active = nutritionFields.includes(opt.key)
              return (
                <button key={opt.key} type="button" onClick={() => toggleField(opt.key, nutritionFields, setNutritionFields)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all"
                  style={active ? { backgroundColor: accentHex, borderColor: accentHex, color: 'white' } : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs opacity-60">{opt.unit}</p>
                  </div>
                  <div className="w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                    style={active ? { backgroundColor: 'white', borderColor: 'white' } : { borderColor: '#d1d5db' }}>
                    {active && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke={accentHex} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Exercise fields */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-0.5">Metrike za vježbe</p>
          <p className="text-xs text-gray-400 mb-3">Odabrane metrike bit će dostupne pri kreiranju vježbi.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {EXERCISE_FIELD_OPTIONS.map(opt => {
              const active = exerciseFields.includes(opt.key)
              return (
                <button key={opt.key} type="button" onClick={() => toggleField(opt.key, exerciseFields, setExerciseFields)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all"
                  style={active ? { backgroundColor: accentHex, borderColor: accentHex, color: 'white' } : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs truncate opacity-60">{opt.desc}</p>
                  </div>
                  <div className="w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                    style={active ? { backgroundColor: 'white', borderColor: 'white' } : { borderColor: '#d1d5db' }}>
                    {active && <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5"><path d="M2 6l3 3 5-5" stroke={accentHex} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveSettings} disabled={savingSettings}
            className="h-9 px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: accentHex }}>
            {savingSettings ? t('savingSettings') : t('saveSettings')}
          </button>
          {settingsSaved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={13} /> {t('settingsSaved')}</span>}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={tPkg('deleteTitle')}
        description={tPkg('deleteConfirm')}
        onConfirm={() => confirmDelete && deletePkg(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tPkg('delete')}
        destructive
      />
    </div>
  )
}
