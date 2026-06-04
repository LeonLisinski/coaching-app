'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAppTheme, type AccentColor } from '@/app/contexts/app-theme'
import { Settings, Mail, Globe, Check, Palette, Smartphone, Share, Download, Bell, BellOff, BellRing, TriangleAlert, Trash2, CreditCard, Zap, Crown, Rocket, Sparkles, MessageSquare, ClipboardCheck, Package, ClipboardList } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { usePushNotifications } from '@/app/hooks/use-push-notifications'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LS_ONBOARDING_COMPLETE, LS_TOUR_COMPLETE } from '@/lib/trainer-onboarding-storage'

const ACCENT_COLORS: { key: AccentColor; hex: string }[] = [
  { key: 'violet', hex: '#7c3aed' },
  { key: 'blue',   hex: '#2563eb' },
  { key: 'indigo', hex: '#4f46e5' },
  { key: 'sky',    hex: '#0284c7' },
  { key: 'teal',   hex: '#0d9488' },
  { key: 'green',  hex: '#16a34a' },
  { key: 'yellow', hex: '#ca8a04' },
  { key: 'amber',  hex: '#d97706' },
  { key: 'orange', hex: '#ea580c' },
  { key: 'red',    hex: '#dc2626' },
  { key: 'rose',   hex: '#ec4899' },
  { key: 'slate',  hex: '#475569' },
]

type Tab = 'theme' | 'billing' | 'contact' | 'notifs' | 'danger'


interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsDialog({ open, onClose }: Props) {
  const router = useRouter()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { accent, setAccent } = useAppTheme()

  const colorLabel = (key: string) => t(`colorLabels.${key}` as any)
  const [tab, setTab] = useState<Tab>('theme')
  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications()


  // Plan change / cancel confirm state
  const [confirmAction, setConfirmAction] = useState<null | { type: 'cancel' | 'change'; plan?: string; label?: string; price?: number }>(null)
  const [billingError, setBillingError] = useState('')

  // Notification preferences state
  type NotifPrefs = Record<string, { in_app_enabled: boolean; push_enabled: boolean; email_enabled: boolean }>
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    message: { in_app_enabled: true, push_enabled: true, email_enabled: false },
    checkin: { in_app_enabled: true, push_enabled: true, email_enabled: false },
    package: { in_app_enabled: true, push_enabled: true, email_enabled: true },
    lead:    { in_app_enabled: true, push_enabled: true, email_enabled: false },
  })
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(false)
  const [notifPrefsSaving, setNotifPrefsSaving] = useState(false)

  // Delete account state
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0) // 0=idle, 1=warn1, 2=confirm
  const [deleteWord, setDeleteWord] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null)
  const [clientCount, setClientCount] = useState(0)
  const confirmInputRef = useRef<HTMLInputElement>(null)

  // Subscription state
  const [subData, setSubData] = useState<{
    plan: string; status: string; client_limit: number;
    trial_end: string | null; current_period_end: string | null; cancel_at_period_end: boolean
    promo_ends_at: string | null; promo_lost_at: string | null
  } | null>(null)
  const [subLoading, setSubLoading]       = useState(false)
  const [cancelingPlan, setCancelingPlan] = useState(false)
  const [subClientCount, setSubClientCount] = useState(0)

  const PLANS_SETTINGS = [
    { key: 'starter', label: 'Starter', price: 29, clients: 10, icon: Zap,    color: '#3b82f6' },
    { key: 'pro',     label: 'Pro',     price: 59, clients: 30, icon: Crown,  color: '#7c3aed' },
    { key: 'scale',   label: 'Scale',   price: 99, clients: 75, icon: Rocket, color: '#059669' },
  ]

  const PLAN_META_SETTINGS: Record<string, { label: string; price: string; icon: typeof Zap; color: string }> = {
    starter: { label: 'Starter', price: '€29/mj', icon: Zap,    color: '#3b82f6' },
    pro:     { label: 'Pro',     price: '€59/mj', icon: Crown,  color: '#7c3aed' },
    scale:   { label: 'Scale',   price: '€99/mj', icon: Rocket, color: '#059669' },
  }

  useEffect(() => {
    if (tab === 'danger')  loadDangerData()
    if (tab === 'billing') loadSub()
    if (tab === 'notifs')  loadNotifPrefs()
  }, [tab])

  const loadNotifPrefs = async () => {
    setNotifPrefsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notifications/prefs', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifPrefs(data)
      }
    } finally {
      setNotifPrefsLoading(false)
    }
  }

  const saveNotifPref = async (type: string, key: 'in_app_enabled' | 'push_enabled' | 'email_enabled', value: boolean) => {
    const updated = { ...notifPrefs, [type]: { ...notifPrefs[type], [key]: value } }
    setNotifPrefs(updated)
    setNotifPrefsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/notifications/prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ [type]: updated[type] }),
      })
    } finally {
      setNotifPrefsSaving(false)
    }
  }

  const loadSub = async () => {
    setSubLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubLoading(false); return }
    const [subRes, clientsRes] = await Promise.all([
      supabase.from('subscriptions')
        .select('plan,status,client_limit,trial_end,current_period_end,cancel_at_period_end,promo_ends_at,promo_lost_at')
        .eq('trainer_id', user.id).maybeSingle(),
      supabase.from('clients').select('id', { count: 'exact' }).eq('trainer_id', user.id),
    ])
    setSubData(subRes.data ?? null)
    setSubClientCount(clientsRes.count ?? 0)
    setSubLoading(false)
  }

  const callBillingApi = async (endpoint: string, body?: object) => {
    const { data: { session } } = await supabase.auth.getSession()
    return fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  const handleCancelSubscription = () => {
    setConfirmAction({ type: 'cancel' })
  }

  const executeCancelSubscription = async () => {
    setConfirmAction(null)
    setCancelingPlan(true)
    setBillingError('')
    try {
      const res = await callBillingApi('/api/billing/cancel')
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setBillingError(d.error || t('billingErrorCancel'))
      } else {
        await loadSub()
      }
    } catch {
      setBillingError(t('billingErrorServer'))
    }
    setCancelingPlan(false)
  }

  const handleReactivateSubscription = async () => {
    setCancelingPlan(true)
    await callBillingApi('/api/billing/reactivate')
    await loadSub()
    setCancelingPlan(false)
  }

  const handleChangePlanSettings = (newPlan: string) => {
    if (!subData) return
    const newMeta  = PLANS_SETTINGS.find(p => p.key === newPlan)!
    const currMeta = PLANS_SETTINGS.find(p => p.key === subData.plan)!
    const isUp = newMeta.price > currMeta.price
    if (!isUp && subClientCount > newMeta.clients) {
      alert(t('billingErrorTooManyClients', { plan: newMeta.label, count: subClientCount, limit: newMeta.clients }))
      return
    }
    setConfirmAction({ type: 'change', plan: newPlan, label: newMeta.label, price: newMeta.price })
  }

  const executeChangePlan = async () => {
    if (!confirmAction?.plan) return
    const plan = confirmAction.plan
    setConfirmAction(null)
    setCancelingPlan(true)
    setBillingError('')
    try {
      const res = await callBillingApi('/api/billing/change-plan', { new_plan: plan })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setBillingError(d.error || t('billingErrorChangePlan'))
      } else {
        await loadSub()
      }
    } catch {
      setBillingError(t('billingErrorServer'))
    }
    setCancelingPlan(false)
  }

  const loadDangerData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [profileRes, clientsRes] = await Promise.all([
      supabase.from('profiles').select('deletion_requested_at').eq('id', user.id).single(),
      supabase.from('clients').select('id', { count: 'exact' }).eq('trainer_id', user.id),
    ])
    setDeletionRequestedAt(profileRes.data?.deletion_requested_at ?? null)
    setClientCount(clientsRes.count ?? 0)
  }

  const handleDeleteStep1 = () => {
    setDeleteStep(1)
    setDeleteWord('')
    setDeleteError('')
  }

  const handleDeleteStep2 = () => {
    setDeleteStep(2)
    setTimeout(() => confirmInputRef.current?.focus(), 100)
  }

  const handleDeleteConfirm = async () => {
    if (deleteWord.trim() !== 'DELETE') {
      setDeleteError('Type exactly: DELETE')
      return
    }
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // Soft delete — 30-day grace period before permanent removal
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
        },
      )
      if (!res.ok) throw new Error('Failed')
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch {
      setDeleteError('Error submitting request. Please try again.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCancelDeletion = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ deletion_requested_at: null }).eq('id', user.id)
    setDeletionRequestedAt(null)
  }

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any)?.MSStream
  const isAndroid = /Android/.test(ua)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md w-[calc(100%-2.5rem)] sm:w-auto p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-3rem)] sm:max-h-[90vh] sm:h-[560px] border-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        {/* Header */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, var(--app-accent), var(--app-accent-hover))` }}
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Settings size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">{t('title')}</h2>
            <p className="text-white/60 text-xs">{t('subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 dark:border-white/8 dark:bg-white/3">
          {([
            ['theme',   <Palette size={17} />,       t('tabs.theme')],
            ['billing', <CreditCard size={17} />,    t('tabs.billing')],
            ['notifs',  <Bell size={17} />,           t('tabs.notifs')],
            ['contact', <Mail size={17} />,           t('tabs.contact')],
            ['danger',  <TriangleAlert size={17} />, t('tabs.account')],
          ] as [Tab, React.ReactNode, string][]).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              title={label}
              className={`w-1/5 shrink-0 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors border-b-2 outline-none focus:outline-none ${
                tab === key
                  ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              {icon}
              <span className="text-[9px] font-semibold tracking-wide leading-none">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-white dark:bg-[oklch(0.165_0.025_264)] overflow-y-auto flex-1 min-h-0">

          {tab === 'theme' && (
            <>
              {/* Accent color */}
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('accentColor')}</p>
                <div className="grid grid-cols-6 gap-2">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setAccent(c.key)}
                      title={colorLabel(c.key)}
                      className="group relative w-full aspect-square rounded-xl transition-transform hover:scale-110 focus:outline-none"
                      style={{ backgroundColor: c.hex }}
                    >
                      {accent === c.key && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className="absolute inset-0 rounded-xl transition-opacity"
                        style={{
                          opacity: accent === c.key ? 1 : 0,
                          outline: `2.5px solid ${c.hex}`,
                          outlineOffset: '3px',
                        }}
                      />
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-xs text-gray-400 dark:text-gray-500">
                  {t('activeTheme')} <span className="font-semibold" style={{ color: ACCENT_COLORS.find(c => c.key === accent)?.hex }}>{colorLabel(accent)}</span>
                </p>
              </div>

              {/* Add to Home Screen */}
              <div className="pt-1 border-t border-gray-100 dark:border-white/8">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                  <Smartphone size={14} className="text-gray-500 dark:text-gray-400" />
                  {t('addToHomeScreen')}
                </p>

                {installed ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-100 dark:bg-green-500/10 dark:border-green-500/20">
                    <Check size={14} className="text-green-500 shrink-0" />
                    <p className="text-xs text-green-700 dark:text-green-400">{t('appInstalled')}</p>
                  </div>
                ) : installPrompt ? (
                  <button
                    onClick={handleInstall}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--app-accent-light)] group-hover:bg-[var(--app-accent)] transition-colors shrink-0">
                      <Download size={14} className="text-[var(--app-accent)] group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('installApp')}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{t('addToHomeDesc')}</p>
                    </div>
                  </button>
                ) : isIOS ? (
                  <div className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 space-y-2">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300">{t('iosInstructions')}</p>
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
                      <span className="text-amber-500 text-sm leading-none mt-0.5">⚠</span>
                      <p className="text-xs text-amber-700 dark:text-amber-400">{t('iosSafariWarning')}</p>
                    </div>
                    <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                      <li>{t('iosStep1')}</li>
                      <li><Share size={11} className="inline mb-0.5" /> {t('iosStep2')}</li>
                      <li>{t('iosStep3')}</li>
                    </ol>
                  </div>
                ) : isAndroid ? (
                  <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 dark:bg-white/[0.04] dark:border-white/8 space-y-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('androidInstructions')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">{t('androidDesc')}</p>
                  </div>
                ) : (
                  <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 dark:bg-white/[0.04] dark:border-white/8">
                    <p className="text-xs text-gray-500 dark:text-gray-500">{t('mobileOnly')}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Push Notifications */}
          {tab === 'theme' && (
            <div className="pt-1 border-t border-gray-100 dark:border-white/8">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                <Bell size={14} className="text-gray-500 dark:text-gray-400" />
                {t('pushNotificationsTitle')}
              </p>

              {pushState === 'loading' && (
                <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 dark:bg-white/[0.04] dark:border-white/8">
                  <p className="text-xs text-gray-400 dark:text-gray-500">{t('pushChecking')}</p>
                </div>
              )}

              {pushState === 'unsupported' && (
                <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 dark:bg-white/[0.04] dark:border-white/8">
                  <p className="text-xs text-gray-500">{t('pushUnsupported')}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{t('pushUnsupportedHint')}</p>
                </div>
              )}

              {pushState === 'denied' && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20">
                  <BellOff size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">{t('pushDeniedTitle')}</p>
                    <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">{t('pushDeniedDesc')}</p>
                  </div>
                </div>
              )}

              {pushState === 'prompt' && (
                <button
                  onClick={pushSubscribe}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group text-left"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--app-accent-light)] group-hover:bg-[var(--app-accent)] transition-colors shrink-0">
                    <Bell size={14} className="text-[var(--app-accent)] group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('pushEnable')}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('pushEnableDesc')}</p>
                  </div>
                </button>
              )}

              {pushState === 'subscribed' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-100 dark:bg-green-500/10 dark:border-green-500/20">
                    <BellRing size={14} className="text-green-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">{t('pushEnabled')}</p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">{t('pushEnabledDesc')}</p>
                    </div>
                  </div>
                  <button
                    onClick={pushUnsubscribe}
                    className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors text-center py-1"
                  >
                    {t('pushDisable')}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'billing' && (
            <div className="space-y-4">
              {subLoading ? (
                <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-gray-200 border-t-[var(--app-accent)] rounded-full animate-spin" /></div>
              ) : !subData ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-gray-500">{t('billingNoSubscription')}</p>
                  <a href="https://unitlift.com/#cijene" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ backgroundColor: 'var(--app-accent)' }}>
                    {t('billingChoosePlan')}
                  </a>
                </div>
              ) : (() => {
                const meta = PLAN_META_SETTINGS[subData.plan]
                const Icon = meta?.icon ?? CreditCard
                const isTrialing = subData.status === 'trialing'
                const isActive   = subData.status === 'active'
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 dark:border-white/8 dark:bg-white/[0.04]">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (meta?.color ?? '#6b7280') + '18' }}>
                        <Icon size={16} style={{ color: meta?.color ?? '#6b7280' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Plan {meta?.label}</p>
                        <p className="text-xs text-gray-500">{meta?.price} · {subData.client_limit} klijenata</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isActive || isTrialing
                          ? 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                          : 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                      }`}>
                        {isTrialing ? t('billingStatusTrial') : isActive ? t('billingStatusActive') : subData.status}
                      </span>
                    </div>

                    {/* Founding promo banner */}
                    {subData.promo_ends_at && !subData.promo_lost_at && Date.now() < new Date(subData.promo_ends_at).getTime() && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20">
                        <Sparkles size={13} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">{t('billingPromoTitle')}</p>
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                            {t('billingPromoDesc', { date: new Date(subData.promo_ends_at).toLocaleDateString(locale) })}
                          </p>
                        </div>
                      </div>
                    )}

                    {isTrialing && subData.trial_end && (
                      <p className="text-xs text-gray-500 text-center">{t('billingTrialEnds')} <strong>{new Date(subData.trial_end).toLocaleDateString(locale)}</strong></p>
                    )}
                    {!isTrialing && subData.current_period_end && !subData.cancel_at_period_end && (
                      <p className="text-xs text-gray-500 text-center">{t('billingNextCharge')} <strong>{new Date(subData.current_period_end).toLocaleDateString(locale)}</strong></p>
                    )}
                    {subData.cancel_at_period_end && subData.current_period_end && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20">
                        <TriangleAlert size={12} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">{t('billingCancelingAt')} {new Date(subData.current_period_end).toLocaleDateString(locale)}</p>
                      </div>
                    )}

                    {/* Change plan buttons */}
                    {(isActive || isTrialing) && !subData.cancel_at_period_end && (
                      <div className="space-y-1.5 pt-1 border-t border-gray-50 dark:border-white/8">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('billingChangePlan')}</p>
                        {PLANS_SETTINGS.filter(p => p.key !== subData.plan).map(plan => {
                          const PlanIcon = plan.icon
                          const currPrice = PLANS_SETTINGS.find(p => p.key === subData.plan)?.price ?? 0
                          const isUp = plan.price > currPrice
                          const tooFew = !isUp && subClientCount > plan.clients
                          return (
                            <button key={plan.key} onClick={() => handleChangePlanSettings(plan.key)}
                              disabled={cancelingPlan || tooFew}
                              title={tooFew ? `Imaš ${subClientCount} klijenata, plan dopušta ${plan.clients}` : ''}
                              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl border transition-colors disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5 text-left"
                              style={{ borderColor: tooFew ? '#fca5a5' : '#e5e7eb' }}
                            >
                              <PlanIcon size={12} style={{ color: plan.color }} />
                              <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-300">{plan.label} · €{plan.price}{t('billingMonthSuffix')} · {plan.clients} {t('billingClientsLabel')}</span>
                              <span className={`text-[10px] font-bold ${isUp ? 'text-green-600' : 'text-blue-600'}`}>
                                {isUp ? '↑' : '↓'} {isUp ? t('billingUpgrade') : t('billingDowngrade')}
                              </span>
                            </button>
                          )
                        })}
                        <p className="text-[10px] text-gray-400 text-center">{t('billingProrate')}</p>

                        {/* Inline confirm for plan change */}
                        {confirmAction?.type === 'change' && (
                          <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] p-3 space-y-2.5 mt-1">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t('billingConfirmChangeTo')} {confirmAction.label}</p>
                            <p className="text-xs text-gray-500">{t('billingNewPrice')} <strong>€{confirmAction.price}{t('billingMonthSuffix')}</strong>. {t('billingStripeNote')}</p>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmAction(null)}
                                className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
                                {tCommon('cancel')}
                              </button>
                              <button onClick={executeChangePlan} disabled={cancelingPlan}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                                style={{ backgroundColor: 'var(--app-accent)' }}>
                                {cancelingPlan ? '...' : tCommon('confirm')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {billingError && (
                      <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">{billingError}</p>
                    )}

                    {/* Inline confirm for cancel */}
                    {confirmAction?.type === 'cancel' ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 p-3 space-y-2.5">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400">{t('billingConfirmCancel')}</p>
                        <p className="text-xs text-red-600 dark:text-red-500 leading-relaxed">
                          {subClientCount > 0
                            ? t('billingCancelWarningClients', { count: subClientCount })
                            : t('billingCancelWarningEmpty')}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmAction(null)}
                            className="flex-1 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            {tCommon('back')}
                          </button>
                          <button onClick={executeCancelSubscription} disabled={cancelingPlan}
                            className="flex-1 py-1.5 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                            {cancelingPlan ? t('billingCancelingLoading') : t('billingCancel')}
                          </button>
                        </div>
                      </div>
                    ) : (isActive || isTrialing) && !subData.cancel_at_period_end && (
                      <button onClick={handleCancelSubscription} disabled={cancelingPlan}
                        className="w-full py-2 px-4 rounded-xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
                        {cancelingPlan ? t('billingCancelingLoading') : t('billingCancel')}
                      </button>
                    )}
                    {subData.cancel_at_period_end && (isActive || isTrialing) && (
                      <button onClick={handleReactivateSubscription} disabled={cancelingPlan}
                        className="w-full py-2 px-4 rounded-xl border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors disabled:opacity-50">
                        {cancelingPlan ? '...' : t('billingReactivate')}
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {tab === 'notifs' && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Odaberi na koji način želiš primati svaki tip obavijesti.
              </p>

              {notifPrefsLoading ? (
                <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-gray-200 border-t-[var(--app-accent)] rounded-full animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {([
                    { key: 'message', icon: MessageSquare,  label: 'Poruke',                color: '#0ea5e9' },
                    { key: 'checkin', icon: ClipboardCheck, label: 'Check-in (tjedni)',      color: 'var(--app-accent)' },
                    { key: 'package', icon: Package,        label: 'Istek paketa klijenta', color: '#f59e0b' },
                    { key: 'lead',    icon: ClipboardList,  label: 'Nova prijava',           color: '#a855f7' },
                  ] as const).map(({ key, icon: Icon, label, color }) => {
                    const pref = notifPrefs[key] ?? { in_app_enabled: true, push_enabled: true, email_enabled: false }
                    return (
                      <div key={key} className="rounded-xl border border-gray-100 dark:border-white/8 overflow-hidden">
                        {/* Type header */}
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50/60 dark:bg-white/[0.03]">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                            <Icon size={12} style={{ color }} />
                          </div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                        </div>
                        {/* Toggles */}
                        <div className="divide-y divide-gray-50 dark:divide-white/5">
                          {([
                            { k: 'in_app_enabled' as const, label: 'In-app (zvonce)', desc: 'Prikazuje se unutar aplikacije' },
                            { k: 'push_enabled'   as const, label: 'Push notifikacija', desc: 'Na uređaju (web/PWA)' },
                            { k: 'email_enabled'  as const, label: 'Email', desc: 'Na tvoju email adresu' },
                          ]).map(({ k, label: tLabel, desc }) => (
                            <div key={k} className="flex items-center justify-between px-4 py-2.5">
                              <div>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{tLabel}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500">{desc}</p>
                              </div>
                              <button
                                onClick={() => saveNotifPref(key, k, !pref[k])}
                                disabled={notifPrefsSaving}
                                className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${pref[k] ? 'bg-[var(--app-accent)]' : 'bg-gray-200 dark:bg-white/15'}`}
                                style={{ height: '22px', width: '40px' }}
                              >
                                <span
                                  className="absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
                                  style={{ transform: pref[k] ? 'translateX(18px)' : 'translateX(0)' }}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {notifPrefsSaving && (
                <p className="text-[10px] text-gray-400 text-center">Sprema se...</p>
              )}
            </div>
          )}

          {tab === 'contact' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-gray-100/90 bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:bg-[oklch(0.18_0.02_264)] dark:ring-white/8">
                <div
                  className="absolute inset-x-0 top-0 h-1 opacity-90"
                  style={{
                    background: `linear-gradient(90deg, var(--app-accent), color-mix(in srgb, var(--app-accent) 65%, #a78bfa), var(--app-accent))`,
                  }}
                />
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--app-accent) 14%, transparent)' }}
                  >
                    <Sparkles size={18} className="text-[var(--app-accent)]" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">{t('tutorialTitle')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t('tutorialDesc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem(LS_ONBOARDING_COMPLETE)
                      localStorage.removeItem(LS_TOUR_COMPLETE)
                      window.dispatchEvent(new Event('unitlift-restart-onboarding'))
                    }
                    onClose()
                    router.push('/dashboard')
                  }}
                  className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md transition-[transform,box-shadow] hover:shadow-lg active:scale-[0.99]"
                  style={{
                    background: `linear-gradient(135deg, var(--app-accent), color-mix(in srgb, var(--app-accent) 88%, #1e1b4b))`,
                  }}
                >
                  {t('tutorialButton')}
                </button>
              </div>

              <p className="text-sm text-gray-500">{t('contactDesc')}</p>

              <a
                href="mailto:support@unitlift.com"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 dark:border-white/8 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 group-hover:bg-[var(--app-accent)] transition-colors">
                  <Mail size={16} className="text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Email</p>
                  <p className="text-xs text-gray-500">support@unitlift.com</p>
                </div>
              </a>

              <a
                href="https://unitlift.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 dark:border-white/8 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-50 dark:bg-violet-500/10 group-hover:bg-[var(--app-accent)] transition-colors">
                  <Globe size={16} className="text-violet-600 dark:text-violet-400 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('website')}</p>
                  <p className="text-xs text-gray-500">unitlift.com</p>
                </div>
              </a>

              <div className="pt-3 border-t border-gray-100 dark:border-white/8 text-center space-y-1">
                <p className="text-xs font-semibold text-gray-500">UnitLift · Coaching Platform</p>
                <p className="text-xs text-gray-400 dark:text-gray-600">{t('appVersionLine')}</p>
              </div>
            </div>
          )}

          {tab === 'danger' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20">
                <TriangleAlert size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">
                  {t('dangerWarning')}
                </p>
              </div>

              {deletionRequestedAt ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">⚠️ {t('deletionPendingTitle')}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {t('deletionPendingDesc', { date: new Date(deletionRequestedAt!).toLocaleDateString(locale) })}
                    </p>
                  </div>
                  <button
                    onClick={handleCancelDeletion}
                    className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {t('cancelDeletion')}
                  </button>
                </div>
              ) : deleteStep === 0 ? (
                <button
                  onClick={handleDeleteStep1}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:hover:bg-red-500/15 transition-colors group text-left"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-100 group-hover:bg-red-200 dark:bg-red-500/20 dark:group-hover:bg-red-500/30 transition-colors shrink-0">
                    <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t('deleteAccount')}</p>
                    <p className="text-xs text-red-500 dark:text-red-500">{t('deleteAccountDesc')}</p>
                  </div>
                </button>
              ) : deleteStep === 1 ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 space-y-2">
                    <p className="text-sm font-bold text-red-800 dark:text-red-300">⚠️ {t('deleteStep1Title')}</p>
                    <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                      {t('deleteStep1Body', { count: clientCount })}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {t('deleteStep1Warning')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteStep(0)}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      {tCommon('cancel')}
                    </button>
                    <button
                      onClick={handleDeleteStep2}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                    >
                      {t('deleteContinue')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20">
                    <p className="text-xs text-red-700 dark:text-red-400 font-medium">{t('deleteConfirmHint')}</p>
                  </div>
                  <input
                    ref={confirmInputRef}
                    type="text"
                    value={deleteWord}
                    onChange={e => { setDeleteWord(e.target.value); setDeleteError('') }}
                    placeholder="DELETE"
                    className="w-full px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-mono text-base font-bold tracking-widest focus:outline-none focus:border-red-500 placeholder:text-red-200 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:placeholder:text-red-800"
                    autoComplete="off"
                  />
                  {deleteError && <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteStep(1)}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      disabled={deleteLoading}
                    >
                      {tCommon('back')}
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={deleteLoading || deleteWord.trim() !== 'DELETE'}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteLoading ? t('deleteSending') : t('deleteDeleteBtn')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


