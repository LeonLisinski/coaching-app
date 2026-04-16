'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAppTheme, type AccentColor } from '@/app/contexts/app-theme'
import { Settings, Mail, Globe, Check, Palette, Smartphone, Share, Download, Bell, BellOff, BellRing, TriangleAlert, Trash2, CreditCard, Zap, Crown, Rocket } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { usePushNotifications } from '@/app/hooks/use-push-notifications'
import { supabase } from '@/lib/supabase'

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

type Tab = 'theme' | 'billing' | 'contact' | 'danger'


interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsDialog({ open, onClose }: Props) {
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
  } | null>(null)
  const [subLoading, setSubLoading]       = useState(false)
  const [cancelingPlan, setCancelingPlan] = useState(false)
  const [subClientCount, setSubClientCount] = useState(0)

  const PLANS_SETTINGS = [
    { key: 'starter', label: 'Starter', price: 29, clients: 15, icon: Zap,    color: '#3b82f6' },
    { key: 'pro',     label: 'Pro',     price: 59, clients: 50, icon: Crown,  color: '#7c3aed' },
    { key: 'scale',   label: 'Scale',   price: 99, clients: 150, icon: Rocket, color: '#059669' },
  ]

  const PLAN_META_SETTINGS: Record<string, { label: string; price: string; icon: typeof Zap; color: string }> = {
    starter: { label: 'Starter', price: '€29/mj', icon: Zap,    color: '#3b82f6' },
    pro:     { label: 'Pro',     price: '€59/mj', icon: Crown,  color: '#7c3aed' },
    scale:   { label: 'Scale',   price: '€99/mj', icon: Rocket, color: '#059669' },
  }

  useEffect(() => {
    if (tab === 'danger')  loadDangerData()
    if (tab === 'billing') loadSub()
  }, [tab])

  const loadSub = async () => {
    setSubLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubLoading(false); return }
    const [subRes, clientsRes] = await Promise.all([
      supabase.from('subscriptions')
        .select('plan,status,client_limit,trial_end,current_period_end,cancel_at_period_end')
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
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      })
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
      <DialogContent className="sm:max-w-md w-[calc(100%-2.5rem)] sm:w-auto p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-3rem)] sm:max-h-[90vh]" showCloseButton={false}>
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
            ['theme',   <Palette size={14} />,       t('tabs.theme'),    t('tabs.theme')],
            ['billing', <CreditCard size={14} />,    t('tabs.billing'),  t('mobileTabPlan')],
            ['contact', <Mail size={14} />,           t('tabs.contact'),  t('tabs.contact')],
            ['danger',  <TriangleAlert size={14} />, t('tabs.account'),  t('tabs.account')],
          ] as [Tab, React.ReactNode, string, string][]).map(([key, icon, label, mobileLabel]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-4 py-2.5 sm:py-3 font-medium transition-colors border-b-2 ${
                tab === key
                  ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {icon}
              <span className="text-[9px] leading-tight sm:hidden">{mobileLabel}</span>
              <span className="hidden sm:inline text-sm">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-white dark:bg-[oklch(0.165_0.025_264)] overflow-y-auto flex-1 min-h-0">

          {tab === 'theme' && (
            <>
              {/* Accent color */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">{t('accentColor')}</p>
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
                <p className="mt-2.5 text-xs text-gray-400">
                  {t('activeTheme')} <span className="font-semibold" style={{ color: ACCENT_COLORS.find(c => c.key === accent)?.hex }}>{colorLabel(accent)}</span>
                </p>
              </div>

              {/* Add to Home Screen */}
              <div className="pt-1 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                  <Smartphone size={14} className="text-gray-500" />
                  {t('addToHomeScreen')}
                </p>

                {installed ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-100">
                    <Check size={14} className="text-green-500 shrink-0" />
                    <p className="text-xs text-green-700">{t('appInstalled')}</p>
                  </div>
                ) : installPrompt ? (
                  <button
                    onClick={handleInstall}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group text-left"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--app-accent-light)] group-hover:bg-[var(--app-accent)] transition-colors shrink-0">
                      <Download size={14} className="text-[var(--app-accent)] group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t('installApp')}</p>
                      <p className="text-xs text-gray-400">{t('addToHomeDesc')}</p>
                    </div>
                  </button>
                ) : isIOS ? (
                  <div className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
                    <p className="text-xs font-medium text-blue-800">{t('iosInstructions')}</p>
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <span className="text-amber-500 text-sm leading-none mt-0.5">⚠</span>
                      <p className="text-xs text-amber-700">{t('iosSafariWarning')}</p>
                    </div>
                    <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                      <li>{t('iosStep1')}</li>
                      <li><Share size={11} className="inline mb-0.5" /> {t('iosStep2')}</li>
                      <li>{t('iosStep3')}</li>
                    </ol>
                  </div>
                ) : isAndroid ? (
                  <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                    <p className="text-xs font-medium text-gray-700">{t('androidInstructions')}</p>
                    <p className="text-xs text-gray-500">{t('androidDesc')}</p>
                  </div>
                ) : (
                  <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500">{t('mobileOnly')}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Push Notifications */}
          {tab === 'theme' && (
            <div className="pt-1 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Bell size={14} className="text-gray-500" />
                {t('pushNotificationsTitle')}
              </p>

              {pushState === 'loading' && (
                <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-400">{t('pushChecking')}</p>
                </div>
              )}

              {pushState === 'unsupported' && (
                <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500">{t('pushUnsupported')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('pushUnsupportedHint')}</p>
                </div>
              )}

              {pushState === 'denied' && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
                  <BellOff size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-700">{t('pushDeniedTitle')}</p>
                    <p className="text-xs text-red-500 mt-0.5">{t('pushDeniedDesc')}</p>
                  </div>
                </div>
              )}

              {pushState === 'prompt' && (
                <button
                  onClick={pushSubscribe}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group text-left"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--app-accent-light)] group-hover:bg-[var(--app-accent)] transition-colors shrink-0">
                    <Bell size={14} className="text-[var(--app-accent)] group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t('pushEnable')}</p>
                    <p className="text-xs text-gray-400">{t('pushEnableDesc')}</p>
                  </div>
                </button>
              )}

              {pushState === 'subscribed' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-100">
                    <BellRing size={14} className="text-green-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-green-700">{t('pushEnabled')}</p>
                      <p className="text-xs text-green-600 mt-0.5">{t('pushEnabledDesc')}</p>
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
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (meta?.color ?? '#6b7280') + '18' }}>
                        <Icon size={16} style={{ color: meta?.color ?? '#6b7280' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">Plan {meta?.label}</p>
                        <p className="text-xs text-gray-500">{meta?.price} · {subData.client_limit} klijenata</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isActive || isTrialing ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {isTrialing ? t('billingStatusTrial') : isActive ? t('billingStatusActive') : subData.status}
                      </span>
                    </div>

                    {isTrialing && subData.trial_end && (
                      <p className="text-xs text-gray-500 text-center">{t('billingTrialEnds')} <strong>{new Date(subData.trial_end).toLocaleDateString(locale)}</strong></p>
                    )}
                    {!isTrialing && subData.current_period_end && !subData.cancel_at_period_end && (
                      <p className="text-xs text-gray-500 text-center">{t('billingNextCharge')} <strong>{new Date(subData.current_period_end).toLocaleDateString(locale)}</strong></p>
                    )}
                    {subData.cancel_at_period_end && subData.current_period_end && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                        <TriangleAlert size={12} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">{t('billingCancelingAt')} {new Date(subData.current_period_end).toLocaleDateString(locale)}</p>
                      </div>
                    )}

                    {/* Change plan buttons */}
                    {(isActive || isTrialing) && !subData.cancel_at_period_end && (
                      <div className="space-y-1.5 pt-1 border-t border-gray-50">
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
                              className="w-full flex items-center gap-2 py-2 px-3 rounded-xl border transition-colors disabled:opacity-40 hover:bg-gray-50 text-left"
                              style={{ borderColor: tooFew ? '#fca5a5' : '#e5e7eb' }}>
                              <PlanIcon size={12} style={{ color: plan.color }} />
                              <span className="flex-1 text-xs font-medium text-gray-700">{plan.label} · €{plan.price}{t('billingMonthSuffix')} · {plan.clients} {t('billingClientsLabel')}</span>
                              <span className={`text-[10px] font-bold ${isUp ? 'text-green-600' : 'text-blue-600'}`}>
                                {isUp ? '↑' : '↓'} {isUp ? t('billingUpgrade') : t('billingDowngrade')}
                              </span>
                            </button>
                          )
                        })}
                        <p className="text-[10px] text-gray-400 text-center">{t('billingProrate')}</p>

                        {/* Inline confirm for plan change */}
                        {confirmAction?.type === 'change' && (
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2.5 mt-1">
                            <p className="text-xs font-semibold text-gray-800">{t('billingConfirmChangeTo')} {confirmAction.label}</p>
                            <p className="text-xs text-gray-500">{t('billingNewPrice')} <strong>€{confirmAction.price}{t('billingMonthSuffix')}</strong>. {t('billingStripeNote')}</p>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmAction(null)}
                                className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-100 transition-colors">
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
                      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{billingError}</p>
                    )}

                    {/* Inline confirm for cancel */}
                    {confirmAction?.type === 'cancel' ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2.5">
                        <p className="text-xs font-semibold text-red-700">{t('billingConfirmCancel')}</p>
                        <p className="text-xs text-red-600 leading-relaxed">
                          {subClientCount > 0
                            ? t('billingCancelWarningClients', { count: subClientCount })
                            : t('billingCancelWarningEmpty')}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmAction(null)}
                            className="flex-1 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 bg-white hover:bg-red-50 transition-colors">
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
                        className="w-full py-2 px-4 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                        {cancelingPlan ? t('billingCancelingLoading') : t('billingCancel')}
                      </button>
                    )}
                    {subData.cancel_at_period_end && (isActive || isTrialing) && (
                      <button onClick={handleReactivateSubscription} disabled={cancelingPlan}
                        className="w-full py-2 px-4 rounded-xl border border-green-200 text-green-700 text-xs font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
                        {cancelingPlan ? '...' : t('billingReactivate')}
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {tab === 'contact' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{t('contactDesc')}</p>

              <a
                href="mailto:support@unitlift.com"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 group-hover:bg-[var(--app-accent)] transition-colors">
                  <Mail size={16} className="text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Email</p>
                  <p className="text-xs text-gray-500">support@unitlift.com</p>
                </div>
              </a>

              <a
                href="https://unitlift.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-50 group-hover:bg-[var(--app-accent)] transition-colors">
                  <Globe size={16} className="text-violet-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t('website')}</p>
                  <p className="text-xs text-gray-500">unitlift.com</p>
                </div>
              </a>

              <div className="pt-3 border-t border-gray-100 text-center space-y-1">
                <p className="text-xs font-semibold text-gray-500">UnitLift · Coaching Platform</p>
                <p className="text-xs text-gray-400">{t('appVersionLine')}</p>
              </div>
            </div>
          )}

          {tab === 'danger' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <TriangleAlert size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  {t('dangerWarning')}
                </p>
              </div>

              {deletionRequestedAt ? (
                /* Pending deletion state */
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ {t('deletionPendingTitle')}</p>
                    <p className="text-xs text-amber-700">
                      {t('deletionPendingDesc', { date: new Date(deletionRequestedAt!).toLocaleDateString(locale) })}
                    </p>
                  </div>
                  <button
                    onClick={handleCancelDeletion}
                    className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t('cancelDeletion')}
                  </button>
                </div>
              ) : deleteStep === 0 ? (
                /* Step 0 — show button */
                <button
                  onClick={handleDeleteStep1}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors group text-left"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-100 group-hover:bg-red-200 transition-colors shrink-0">
                    <Trash2 size={16} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-700">{t('deleteAccount')}</p>
                    <p className="text-xs text-red-500">{t('deleteAccountDesc')}</p>
                  </div>
                </button>
              ) : deleteStep === 1 ? (
                /* Step 1 — Warning 1 */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2">
                    <p className="text-sm font-bold text-red-800">⚠️ {t('deleteStep1Title')}</p>
                    <p className="text-xs text-red-700 leading-relaxed">
                      {t('deleteStep1Body', { count: clientCount })}
                    </p>
                    <p className="text-xs text-red-600 font-medium">
                      {t('deleteStep1Warning')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteStep(0)}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
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
                /* Step 2 — Warning 2: type DELETE */
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                    <p className="text-xs text-red-700 font-medium">{t('deleteConfirmHint')}</p>
                  </div>
                  <input
                    ref={confirmInputRef}
                    type="text"
                    value={deleteWord}
                    onChange={e => { setDeleteWord(e.target.value); setDeleteError('') }}
                    placeholder="DELETE"
                    className="w-full px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-mono text-base font-bold tracking-widest focus:outline-none focus:border-red-500 placeholder:text-red-200"
                    autoComplete="off"
                  />
                  {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteStep(1)}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
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


