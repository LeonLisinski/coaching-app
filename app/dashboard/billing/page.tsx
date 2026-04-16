'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTranslations, useLocale } from 'next-intl'
import {
  AlertTriangle, CreditCard, CheckCircle2, Loader2,
  Zap, Crown, Rocket, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'locked'

type Subscription = {
  plan: string
  status: SubStatus
  client_limit: number
  trial_end: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  locked_at: string | null
}

const PLANS = [
  { key: 'starter', label: 'Starter', price: 29, clients: 15, icon: Zap,    color: '#3b82f6' },
  { key: 'pro',     label: 'Pro',     price: 59, clients: 50, icon: Crown,  color: '#7c3aed' },
  { key: 'scale',   label: 'Scale',   price: 99, clients: 150, icon: Rocket, color: '#059669' },
]

export default function BillingPage() {
  const t      = useTranslations('billingPage')
  const locale = useLocale()
  const [sub, setSub]               = useState<Subscription | null>(null)
  const [clientCount, setClientCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [actionLoading, setAction]  = useState('')
  const [successMsg, setSuccess]    = useState('')
  const [errorMsg, setError]        = useState('')
  const [showChangePlan, setShowChangePlan] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const [subRes, clientsRes] = await Promise.all([
      supabase.from('subscriptions')
        .select('plan,status,client_limit,trial_end,current_period_end,cancel_at_period_end,locked_at')
        .eq('trainer_id', user.id).maybeSingle(),
      supabase.from('clients').select('id', { count: 'exact' }).eq('trainer_id', user.id),
    ])
    setSub(subRes.data ?? null)
    setClientCount(clientsRes.count ?? 0)
    setLoading(false)
  }

  const callApi = async (endpoint: string, body?: object) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res
  }

  const handleCancel = async () => {
    const msg = clientCount > 0
      ? t('cancelConfirmClients', { count: clientCount })
      : t('cancelConfirmEmpty')
    if (!confirm(msg)) return

    setAction('cancel')
    const res = await callApi('/api/billing/cancel')
    if (res.ok) { setSuccess(t('cancelSuccess')); fetchAll() }
    else setError(t('cancelError'))
    setAction('')
  }

  const handleReactivate = async () => {
    setAction('reactivate')
    const res = await callApi('/api/billing/reactivate')
    if (res.ok) { setSuccess(t('reactivateSuccess')); fetchAll() }
    else setError(t('reactivateError'))
    setAction('')
  }

  const handleChangePlan = async (newPlan: string) => {
    if (!sub) return
    const newMeta  = PLANS.find(p => p.key === newPlan)!
    const currMeta = PLANS.find(p => p.key === sub.plan)!
    const isUpgrade = newMeta.price > currMeta.price

    if (!isUpgrade && clientCount > newMeta.clients) {
      setError(t('changePlanDowngradeError', { plan: newMeta.label, count: clientCount, limit: newMeta.clients }))
      setShowChangePlan(false)
      return
    }

    const confirmMsg = isUpgrade
      ? t('upgradeConfirm', { plan: newMeta.label, price: newMeta.price })
      : t('downgradeConfirm', { plan: newMeta.label, price: newMeta.price })

    if (!confirm(confirmMsg)) return

    setAction('change')
    const res  = await callApi('/api/billing/change-plan', { new_plan: newPlan })
    const data = await res.json()
    if (res.ok) {
      setSuccess(t('changePlanSuccess', { plan: newMeta.label, limit: newMeta.clients }))
      setShowChangePlan(false)
      fetchAll()
    } else {
      setError(data.error || t('changePlanError'))
    }
    setAction('')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
  }

  const meta        = sub ? PLANS.find(p => p.key === sub.plan) : null
  const Icon        = meta?.icon ?? CreditCard
  const isLocked    = sub?.status === 'locked'
  const isCanceled  = sub?.status === 'canceled'
  const isPastDue   = sub?.status === 'past_due'
  const isTrialing  = sub?.status === 'trialing'
  const isActive    = sub?.status === 'active'
  const canManage   = isActive || isTrialing

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-4">

        {/* Status banner */}
        {(isLocked || isCanceled || isPastDue) && (
          <div className={`rounded-2xl p-5 flex items-start gap-4 ${isLocked || isCanceled ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle size={20} className={isLocked || isCanceled ? 'text-red-500 shrink-0 mt-0.5' : 'text-amber-500 shrink-0 mt-0.5'} />
            <div>
              <p className={`font-bold text-sm ${isLocked || isCanceled ? 'text-red-800' : 'text-amber-800'}`}>
                {isLocked ? t('bannerLockedTitle') : isCanceled ? t('bannerCanceledTitle') : t('bannerPastDueTitle')}
              </p>
              <p className={`text-xs mt-1 leading-relaxed ${isLocked || isCanceled ? 'text-red-600' : 'text-amber-700'}`}>
                {isLocked   ? t('bannerLockedDesc') : ''}
                {isCanceled ? t('bannerCanceledDesc') : ''}
                {isPastDue  ? t('bannerPastDueDesc', { days: sub?.locked_at ? Math.max(0, Math.ceil((new Date(sub.locked_at).getTime() - Date.now()) / 86400000)) : 3 }) : ''}
              </p>
            </div>
          </div>
        )}

        {/* Success / error messages */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
            <p className="text-sm text-green-700">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Current plan card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (meta?.color ?? '#6b7280') + '15' }}>
                <Icon size={18} style={{ color: meta?.color ?? '#6b7280' }} />
              </div>
              <div>
                <p className="font-bold text-gray-900">{sub ? `${t('planLabel')} ${meta?.label}` : t('noSubscription')}</p>
                <p className="text-xs text-gray-500">€{meta?.price}/{t('perMonth')} · {sub?.client_limit ?? 0} {t('clients')}</p>
              </div>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              isActive || isTrialing ? 'bg-green-50 text-green-700' :
              isPastDue ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
            }`}>
              {isTrialing ? t('statusTrialing') : isActive ? t('statusActive') : isPastDue ? t('statusPastDue') : isLocked ? t('statusLocked') : t('statusCanceled')}
            </div>
          </div>

          {sub && (
            <div className="space-y-2 pt-1 border-t border-gray-50">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('activeClients')}</span>
                <span className={`font-medium ${clientCount >= (sub.client_limit ?? 0) ? 'text-red-600' : 'text-gray-800'}`}>
                  {clientCount} / {sub.client_limit}
                </span>
              </div>
              {isTrialing && sub.trial_end && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('trialEnds')}</span>
                  <span className="font-medium text-gray-800">{new Date(sub.trial_end).toLocaleDateString(locale)}</span>
                </div>
              )}
              {sub.current_period_end && !sub.cancel_at_period_end && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('nextBilling')}</span>
                  <span className="font-medium text-gray-800">{new Date(sub.current_period_end).toLocaleDateString(locale)}</span>
                </div>
              )}
              {sub.cancel_at_period_end && sub.current_period_end && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    {t('cancelAtPeriodEnd', { date: new Date(sub.current_period_end).toLocaleDateString(locale) })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {(isLocked || isPastDue) && (
              <a href="https://billing.stripe.com" target="_blank" rel="noopener noreferrer"
                className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--app-accent)' }}>
                <CreditCard size={15} /> {t('updatePayment')}
              </a>
            )}
            {isCanceled && (
              <a href="https://unitlift.com/#cijene"
                className="w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center"
                style={{ backgroundColor: 'var(--app-accent)' }}>
                {t('resubscribe')}
              </a>
            )}
            {canManage && !sub?.cancel_at_period_end && (
              <button onClick={() => { setShowChangePlan(v => !v); setError(''); setSuccess('') }}
                className="w-full h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
                {t('changePlan')}
              </button>
            )}
            {canManage && !sub?.cancel_at_period_end && (
              <button onClick={handleCancel} disabled={actionLoading === 'cancel'}
                className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                {actionLoading === 'cancel' ? <Loader2 size={14} className="animate-spin mx-auto" /> : t('cancelSubscription')}
              </button>
            )}
            {sub?.cancel_at_period_end && canManage && (
              <button onClick={handleReactivate} disabled={actionLoading === 'reactivate'}
                className="w-full h-11 rounded-xl border border-green-200 text-green-700 text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50">
                {actionLoading === 'reactivate' ? <Loader2 size={14} className="animate-spin mx-auto" /> : t('undoCancel')}
              </button>
            )}
            {!isLocked && !isCanceled && (
              <a href="/dashboard" className="w-full h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium flex items-center justify-center hover:bg-gray-50 transition-colors">
                {t('backToDashboard')}
              </a>
            )}
          </div>
        </div>

        {/* Change plan section */}
        {showChangePlan && sub && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <p className="font-bold text-gray-900 text-sm">{t('changePlanTitle')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('changePlanSubtitle')}</p>
            </div>
            <div className="space-y-2">
              {PLANS.filter(p => p.key !== sub.plan).map(plan => {
                const PlanIcon   = plan.icon
                const currPrice  = PLANS.find(p => p.key === sub.plan)?.price ?? 0
                const isUp       = plan.price > currPrice
                const tooFew     = !isUp && clientCount > plan.clients
                return (
                  <button
                    key={plan.key}
                    onClick={() => handleChangePlan(plan.key)}
                    disabled={actionLoading === 'change' || tooFew}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-300 hover:bg-gray-50"
                    style={{ borderColor: tooFew ? '#fca5a5' : '#e5e7eb' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: plan.color + '15' }}>
                      <PlanIcon size={16} style={{ color: plan.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900">{plan.label}</p>
                      <p className="text-xs text-gray-500">{plan.clients} {t('clients')} · €{plan.price}/{t('perMonth')}</p>
                      {tooFew && <p className="text-xs text-red-500 mt-0.5">{t('tooManyClients', { count: clientCount })}</p>}
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isUp ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      {isUp ? t('upgrade') : t('downgrade')}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 text-center">
              {t('changeInstant')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
