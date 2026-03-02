'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type Profile = {
  id: string
  full_name: string
  email: string
  bio: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  avatar_url: string | null
}

type Package = {
  id: string
  name: string
  description: string | null
  price: number
  duration_days: number
  color: string
  active: boolean
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const tPkg = useTranslations('profile.packages')
  const tCommon = useTranslations('common')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    bio: '',
    phone: '',
    website: '',
    instagram: '',
  })

  // Package form
  const [showPackageForm, setShowPackageForm] = useState(false)
  const [editPackage, setEditPackage] = useState<Package | null>(null)
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_days: '30',
    color: '#3b82f6',
  })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: profileData }, { data: packagesData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('packages').select('*').eq('trainer_id', user.id).order('created_at')
    ])

    if (profileData) {
      setProfile(profileData)
      setForm({
        full_name: profileData.full_name || '',
        bio: profileData.bio || '',
        phone: profileData.phone || '',
        website: profileData.website || '',
        instagram: profileData.instagram || '',
      })
    }
    if (packagesData) setPackages(packagesData)
    setLoading(false)
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({
      full_name: form.full_name,
      bio: form.bio || null,
      phone: form.phone || null,
      website: form.website || null,
      instagram: form.instagram || null,
    }).eq('id', profile.id)
    setSaving(false)
    fetchData()
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    const fileExt = file.name.split('.').pop()
    const fileName = `${profile.id}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    await supabase.from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    fetchData()
  }

  const openNewPackage = () => {
    setEditPackage(null)
    setPackageForm({ name: '', description: '', price: '', duration_days: '30', color: '#3b82f6' })
    setShowPackageForm(true)
  }

  const openEditPackage = (pkg: Package) => {
    setEditPackage(pkg)
    setPackageForm({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price.toString(),
      duration_days: pkg.duration_days.toString(),
      color: pkg.color,
    })
    setShowPackageForm(true)
  }

  const savePackage = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      trainer_id: user.id,
      name: packageForm.name,
      description: packageForm.description || null,
      price: parseFloat(packageForm.price),
      duration_days: parseInt(packageForm.duration_days),
      color: packageForm.color,
    }

    if (editPackage) {
      await supabase.from('packages').update(payload).eq('id', editPackage.id)
    } else {
      await supabase.from('packages').insert(payload)
    }

    setShowPackageForm(false)
    fetchData()
  }

  const deletePackage = async (id: string) => {
    await supabase.from('packages').delete().eq('id', id)
    setPackages(packages.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const togglePackageActive = async (pkg: Package) => {
    await supabase.from('packages').update({ active: !pkg.active }).eq('id', pkg.id)
    setPackages(packages.map(p => p.id === pkg.id ? { ...p, active: !p.active } : p))
  }

  if (loading) return <p className="text-gray-500 text-sm">{tCommon('loading')}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500 text-sm">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">{t('tabs.profile')}</TabsTrigger>
          <TabsTrigger value="paketi">{t('tabs.packages')}</TabsTrigger>
        </TabsList>

        {/* PROFIL TAB */}
        <TabsContent value="profil" className="mt-6 space-y-6">
          {/* Profil header - izvan boxa */}
          <div className="flex flex-col items-center gap-3">
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                border: '3px solid #e5e7eb',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  style={{ width: 120, height: 120, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span style={{ fontSize: 40, fontWeight: 700, color: '#9ca3af' }}>
                  {form.full_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <span className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                  {t('avatar.change')}
                </span>
                <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
              </label>
              {profile?.avatar_url && (
                <button
                  onClick={async () => {
                    await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
                    fetchData()
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  {t('avatar.remove')}
                </button>
              )}
            </div>

            <div className="text-center">
              <p className="font-semibold text-xl">{form.full_name}</p>
              <p className="text-sm text-gray-400">{profile?.email}</p>
              {form.instagram && (
                <p className="text-sm text-blue-500 mt-0.5">@{form.instagram.replace('@', '')}</p>
              )}
              {form.bio && <p className="text-sm text-gray-500 mt-1 max-w-md">{form.bio}</p>}
            </div>
          </div>

          {/* Forma u boxu */}
          <Card>
            <CardContent className="py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('form.fullName')}</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('form.phone')}</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t('form.phonePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('form.website')}</Label>
                  <Input
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder={t('form.websitePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('form.instagram')}</Label>
                  <Input
                    value={form.instagram}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                    placeholder={t('form.instagramPlaceholder')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('form.bio')}</Label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder={t('form.bioPlaceholder')}
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-24 resize-none"
                />
              </div>

              <Button onClick={saveProfile} disabled={saving}>
                {saving ? tCommon('saving') : t('saveProfile')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAKETI TAB */}
        <TabsContent value="paketi" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm">{tPkg('count', { count: packages.length })}</p>
            <Button onClick={openNewPackage} size="sm" className="flex items-center gap-2">
              <Plus size={14} />
              {tPkg('addNew').replace('+ ', '')}
            </Button>
          </div>

          {showPackageForm && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="py-4 space-y-3">
                <p className="font-medium text-sm">{editPackage ? tPkg('editTitle') : tPkg('newTitle')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('name')}</Label>
                    <Input
                      value={packageForm.name}
                      onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                      placeholder={tPkg('namePlaceholder')}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('price')}</Label>
                    <Input
                      type="number"
                      value={packageForm.price}
                      onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                      placeholder="150"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('duration')}</Label>
                    <Input
                      type="number"
                      value={packageForm.duration_days}
                      onChange={(e) => setPackageForm({ ...packageForm, duration_days: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tPkg('color')}</Label>
                    <input
                      type="color"
                      value={packageForm.color}
                      onChange={(e) => setPackageForm({ ...packageForm, color: e.target.value })}
                      className="w-full h-8 rounded border cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{tPkg('description')}</Label>
                  <textarea
                    value={packageForm.description}
                    onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                    placeholder={tPkg('descriptionPlaceholder')}
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-16 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={savePackage} disabled={!packageForm.name || !packageForm.price}>
                    {editPackage ? tPkg('save') : tPkg('add')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowPackageForm(false)}>
                    {tCommon('cancel')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {packages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500 text-sm">
                {tPkg('empty')}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {packages.map(pkg => (
                <Card key={pkg.id} className={`transition-shadow ${!pkg.active ? 'opacity-60' : ''}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: pkg.color }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{pkg.name}</p>
                          <Badge variant={pkg.active ? 'default' : 'secondary'} className="text-xs">
                            {pkg.active ? tPkg('active') : tPkg('inactive')}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400">
                          {pkg.price}€ • {pkg.duration_days} {tPkg('days')}
                          {pkg.description && ` • ${pkg.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => togglePackageActive(pkg)}>
                        {pkg.active ? tPkg('deactivate') : tPkg('activate')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditPackage(pkg)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(pkg.id)}>
                        <Trash2 size={14} className="text-red-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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