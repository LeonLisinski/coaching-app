'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertTriangle, Clock, CreditCard, XCircle, Sparkles, X, Building2, User } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { isFoundingPromoActive, foundingPromoEndDate } from '@/lib/founding'

function GradientLogo({ height = 32 }: { height?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 82.020836 51.064583"
      style={{ height, width: 'auto', display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id="cpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7eb8ff" />
          <stop offset="50%" stopColor="#0066ff" />
          <stop offset="100%" stopColor="#0044cc" />
        </linearGradient>
      </defs>
      <g transform="translate(-9.5249995,-47.095833)">
        <path fill="url(#cpGrad)" d="M 40.348957,94.687852 32.940624,91.257608 32.477603,90.71095 32.014583,90.164292 V 69.067944 47.971597 l 0.483856,-0.437882 0.483854,-0.437882 h 2.770521 2.770518 l 0.3175,0.3175 0.3175,0.3175 V 66.9604 86.189967 l 0.788999,0.326813 0.788998,0.326814 0.401627,-0.154118 0.401626,-0.154119 v -4.068339 -4.068337 l 0.483857,-0.437883 0.483854,-0.437882 h 0.30638 0.306382 l 3.010646,1.420082 3.010646,1.420082 0.121568,7.202061 0.121568,7.202062 -0.116382,1.4034 -0.116379,1.4034 -0.64352,0.293206 -0.643517,0.293206 -0.0537,-0.02117 -0.0537,-0.02117 z m 12.061346,3.009542 -0.564986,-0.46302 0.07265,-8.45302 0.07265,-8.453019 3.167914,-1.41827 3.167915,-1.41827 0.602398,0.274471 0.602398,0.274471 v 4.233965 4.233966 l 0.595312,0.148114 0.595313,0.148114 3.262823,-1.46599 3.26282,-1.465991 h 0.586867 0.586865 l 0.3175,0.3175 0.3175,0.3175 v 2.948784 2.948787 l -0.463021,0.408305 -0.463021,0.408302 -7.461737,3.469161 -7.461739,3.469161 H 53.09101 52.975289 Z M 23.02806,84.419476 22.754166,83.907703 V 69.11465 54.321597 l 0.483857,-0.437882 0.483854,-0.437882 h 2.658747 2.658751 l 0.337849,0.407086 0.337852,0.407085 -0.03927,14.975855 -0.03927,14.975853 -0.298583,0.359767 -0.298579,0.35977 H 26.170661 23.30195 Z m 48.726939,0.194273 -0.3175,-0.3175 V 69.144932 53.993618 l 0.511773,-0.273893 0.511773,-0.273892 h 2.512036 2.512039 l 0.415774,0.415774 0.415771,0.415774 v 15.009434 15.009434 l -0.3175,0.3175 -0.3175,0.3175 H 74.877082 72.072499 Z M 62.337256,82.936957 61.912499,82.5122 V 65.241899 47.971597 l 0.483857,-0.437882 0.483854,-0.437882 h 2.791039 2.791042 l 0.299011,0.360288 0.299011,0.360287 -0.06818,16.374609 -0.06818,16.374607 -2.513542,1.226457 -2.513541,1.226455 -0.567431,0.171588 -0.567433,0.171587 z M 14.221354,78.824639 13.758333,78.554955 V 75.393102 72.231249 H 12.079549 10.400765 L 9.9628823,71.747395 9.5249995,71.263541 v -2.109063 -2.109062 l 0.3175,-0.3175 0.3174995,-0.3175 h 1.799167 1.799167 v -2.989791 -2.989792 l 0.3175,-0.3175 0.3175,-0.3175 h 2.478021 2.478019 l 0.511773,0.273892 0.51177,0.273893 v 9.109506 9.109506 l -0.51177,0.273894 -0.511773,0.273891 -2.332498,-0.008 -2.332501,-0.008 z m 67.069175,-0.0071 -0.592614,-0.219221 V 69.47096 60.343618 l 0.511773,-0.273893 0.511773,-0.273892 h 2.478019 2.478019 l 0.3175,0.3175 0.3175,0.3175 v 2.989792 2.989791 h 1.799166 1.799167 l 0.3175,0.3175 0.3175,0.3175 v 2.155034 2.155036 l -0.483854,0.43788 -0.483854,0.437883 h -1.632813 -1.632812 v 3.183305 3.183303 l -0.33073,0.103761 -0.330729,0.103762 -2.383949,0.115684 -2.383948,0.115681 z m -39.433447,-6.903773 -0.3175,-0.3175 v -2.838601 -2.838601 l 0.415775,-0.415774 0.415774,-0.415774 h 8.262559 8.262559 l 0.3175,0.3175 0.3175,0.3175 v 2.936875 2.936875 l -0.3175,0.3175 -0.3175,0.3175 h -8.360833 -8.360834 z" />
      </g>
    </svg>
  )
}

const BLUE  = '#0066FF'
const NAVY  = '#0A1024'
const GREEN = '#44cc88'

const Chk = () => (
  <span style={{
    width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 2,
    background: 'rgba(68,204,136,.13)', border: '1px solid rgba(68,204,136,.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '.58rem', color: GREEN,
  }}>✓</span>
)

type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'locked' | null

type BuyerType = 'private' | 'business'

interface BuyerInfo {
  type: BuyerType
  name: string
  email: string
  country: string
  address: string
  company: string
  oib: string
  invoiceEmail: string
}

function BuyerModal({
  plan,
  prefillName,
  prefillEmail,
  onClose,
  onSubmit,
  submitting,
}: {
  plan: string
  prefillName: string
  prefillEmail: string
  onClose: () => void
  onSubmit: (buyer: BuyerInfo) => void
  submitting: boolean
}) {
  const t = useTranslations('buyerModal')
  const [type, setType] = useState<BuyerType>('private')
  const [name, setName]           = useState(prefillName)
  const [email, setEmail]         = useState(prefillEmail)
  const [country, setCountry]     = useState('')
  const [address, setAddress]     = useState('')
  const [company, setCompany]     = useState('')
  const [oib, setOib]             = useState('')
  const [invoiceEmail, setInvoiceEmail] = useState(prefillEmail)
  const [errors, setErrors]       = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (type === 'private') {
      if (!name.trim()) e.name = t('required')
    } else {
      if (!company.trim()) e.company = t('required')
      if (!oib.trim()) e.oib = t('required')
      else if (!/^\d{11}$/.test(oib.trim())) e.oib = t('oibError')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ type, name, email, country, address, company, oib, invoiceEmail })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #d1d5db', borderRadius: 10,
    padding: '10px 12px', fontSize: '.875rem',
    outline: 'none', background: '#fff',
    color: NAVY,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '.8rem', fontWeight: 600,
    color: '#374151', marginBottom: 4,
  }

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <span style={{ fontSize: '.75rem', color: '#dc2626' }}>{error}</span>}
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10,16,36,.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480,
        boxShadow: '0 24px 80px rgba(0,0,0,.18)',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: NAVY }}>{t('title')}</h2>
            <p style={{ margin: '3px 0 0', fontSize: '.82rem', color: '#6b7a99' }}>{t('subtitle')}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Type toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['private', 'business'] as BuyerType[]).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { setType(opt); setErrors({}) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  border: type === opt ? `2px solid ${BLUE}` : '2px solid #e2e8f0',
                  background: type === opt ? `rgba(0,102,255,.06)` : '#f9fafb',
                  transition: 'all .15s',
                  textAlign: 'left',
                }}
              >
                {opt === 'private'
                  ? <User size={16} color={type === opt ? BLUE : '#9ca3af'} />
                  : <Building2 size={16} color={type === opt ? BLUE : '#9ca3af'} />}
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: type === opt ? BLUE : '#374151', lineHeight: 1.3 }}>
                  {t(opt === 'private' ? 'typePrivate' : 'typeBusiness')}
                </span>
              </button>
            ))}
          </div>

          {type === 'private' ? (
            <>
              <Field label={t('nameLabel')} error={errors.name}>
                <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, borderColor: errors.name ? '#dc2626' : '#d1d5db' }} />
              </Field>
              <Field label={t('emailLabel')}>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} />
              </Field>
              <Field label={t('countryLabel')}>
                <input value={country} onChange={e => setCountry(e.target.value)} style={inputStyle} />
              </Field>
              <Field label={t('addressLabel')}>
                <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
              </Field>
            </>
          ) : (
            <>
              <Field label={t('companyLabel')} error={errors.company}>
                <input value={company} onChange={e => setCompany(e.target.value)} style={{ ...inputStyle, borderColor: errors.company ? '#dc2626' : '#d1d5db' }} />
              </Field>
              <Field label={t('oibLabel')} error={errors.oib}>
                <input
                  value={oib}
                  onChange={e => setOib(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder={t('oibPlaceholder')}
                  style={{ ...inputStyle, borderColor: errors.oib ? '#dc2626' : '#d1d5db' }}
                  inputMode="numeric"
                />
              </Field>
              <Field label={t('addressLabel')}>
                <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
              </Field>
              <Field label={t('invoiceEmailLabel')}>
                <input value={invoiceEmail} onChange={e => setInvoiceEmail(e.target.value)} type="email" style={inputStyle} />
              </Field>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, height: 46, borderRadius: 12, border: '1.5px solid #d1d5db',
                background: '#fff', color: '#374151', fontWeight: 600, fontSize: '.9rem',
                cursor: 'pointer',
              }}
            >
              {t('cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 2, height: 46, borderRadius: 12, border: 'none',
                background: `linear-gradient(90deg, ${BLUE}, #0055ee)`,
                color: '#fff', fontWeight: 700, fontSize: '.9rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
              {t('continueBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ChoosePlanPage() {
  const router = useRouter()
  const t = useTranslations('choosePlan')
  const locale = useLocale()
  const [loading, setLoading]   = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [subStatus, setSubStatus] = useState<SubStatus>(null)
  const [subLoading, setSubLoading] = useState(true)

  // Buyer modal state
  const [pendingPlan, setPendingPlan]   = useState<string | null>(null)
  const [prefillName, setPrefillName]   = useState('')
  const [prefillEmail, setPrefillEmail] = useState('')

  const promoActive = isFoundingPromoActive()
  const promoEndDate = foundingPromoEndDate(locale)

  const FEATURES_COMMON = [
    t('featureTrainingMeal'),
    t('featureTracking'),
    t('featureChat'),
    t('featureMobileApp'),
    t('featureFinance'),
  ]

  const PLANS = [
    { key: 'starter', label: 'STARTER', price: 29, clients: t('clientLimitStarter'), popular: false },
    { key: 'pro',     label: 'PRO',     price: 59, clients: t('clientLimitPro'),     popular: true  },
    { key: 'scale',   label: 'SCALE',   price: 99, clients: t('clientLimitScale'),   popular: false },
  ]

  const STATUS_BANNER: Record<NonNullable<SubStatus>, { icon: React.ReactNode; bg: string; border: string; text: string; label: string; sub: string }> = {
    trialing: {
      icon: <Clock size={16} color="#d97706" />,
      bg: '#fffbeb', border: '#fde68a', text: '#92400e',
      label: t('statusTrialingTitle'),
      sub:   t('statusTrialingDesc'),
    },
    past_due: {
      icon: <CreditCard size={16} color="#dc2626" />,
      bg: '#fef2f2', border: '#fecaca', text: '#991b1b',
      label: t('statusPastDueTitle'),
      sub:   t('statusPastDueDesc'),
    },
    canceled: {
      icon: <XCircle size={16} color="#6b7280" />,
      bg: '#f9fafb', border: '#e5e7eb', text: '#374151',
      label: t('statusCanceledTitle'),
      sub:   t('statusCanceledDesc'),
    },
    locked: {
      icon: <AlertTriangle size={16} color="#dc2626" />,
      bg: '#fef2f2', border: '#fecaca', text: '#991b1b',
      label: t('statusLockedTitle'),
      sub:   t('statusLockedDesc'),
    },
    active: {
      icon: null, bg: '', border: '', text: '',
      label: '', sub: '',
    },
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, trial_end, locked_at')
        .eq('trainer_id', user.id)
        .maybeSingle()
      if (sub) {
        const now = new Date()
        if (sub.status === 'trialing' && sub.trial_end && new Date(sub.trial_end) <= now) {
          setSubStatus('trialing')
        } else if (sub.status === 'past_due') {
          setSubStatus(sub.locked_at && new Date(sub.locked_at) <= now ? 'locked' : 'past_due')
        } else if (sub.status === 'canceled') {
          setSubStatus('canceled')
        }
      }

      // Pre-fill from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle()
      setPrefillName(profile?.full_name ?? '')
      setPrefillEmail(profile?.email ?? user.email ?? '')

      setSubLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectPlan = (planKey: string) => {
    setError('')
    setPendingPlan(planKey)
  }

  const handleBuyerSubmit = async (buyer: BuyerInfo) => {
    if (!pendingPlan) return
    setLoading(pendingPlan)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: pendingPlan, buyer }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t('errorCreate'))
        setLoading(null)
        setPendingPlan(null)
        return
      }
      window.location.href = data.checkout_url
    } catch {
      setError(t('errorServer'))
      setLoading(null)
      setPendingPlan(null)
    }
  }

  return (
    <>
      {/* Buyer info modal */}
      {pendingPlan && (
        <BuyerModal
          plan={pendingPlan}
          prefillName={prefillName}
          prefillEmail={prefillEmail}
          onClose={() => { setPendingPlan(null); setLoading(null) }}
          onSubmit={handleBuyerSubmit}
          submitting={!!loading}
        />
      )}

      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#fff 0%,#f5f9ff 100%)' }}>

        {/* Header */}
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, paddingTop: 'max(14px, env(safe-area-inset-top, 14px))', paddingBottom: '14px', paddingLeft: 28, paddingRight: 28, background: '#fff', borderBottom: '1px solid #e8edf5' }}>
          <GradientLogo height={34} />
          <span style={{ fontWeight: 700, fontSize: 20, color: NAVY }}>UnitLift</span>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px 0' }}>
          <div style={{ width: '100%', maxWidth: 980, display: 'flex', flexDirection: 'column', flex: 1 }}>

            {/* Status banner */}
            {!subLoading && subStatus && subStatus !== 'active' && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: STATUS_BANNER[subStatus].bg,
                border: `1px solid ${STATUS_BANNER[subStatus].border}`,
                borderRadius: 14, padding: '12px 16px',
                maxWidth: 520, margin: '0 auto 20px', width: '100%',
              }}>
                <span style={{ marginTop: 1, flexShrink: 0 }}>{STATUS_BANNER[subStatus].icon}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '.875rem', color: STATUS_BANNER[subStatus].text }}>
                    {STATUS_BANNER[subStatus].label}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '.8rem', color: STATUS_BANNER[subStatus].text, opacity: .8, lineHeight: 1.4 }}>
                    {STATUS_BANNER[subStatus].sub}
                  </p>
                </div>
              </div>
            )}

            {/* Founding promo banner */}
            {promoActive && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'linear-gradient(135deg,rgba(0,102,255,.07),rgba(0,85,238,.04))',
                border: '1px solid rgba(0,102,255,.25)',
                borderRadius: 14, padding: '14px 18px',
                maxWidth: 560, margin: '0 auto 20px', width: '100%',
              }}>
                <Sparkles size={16} color={BLUE} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '.875rem', color: NAVY }}>
                    {t('foundingBannerTitle')}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '.8rem', color: '#4b5a7a', lineHeight: 1.5 }}>
                    {t('foundingBannerDesc')}
                    {promoEndDate && <> {t('foundingBannerEnds', { date: promoEndDate })}</>}
                  </p>
                </div>
              </div>
            )}

            {/* Headline */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, color: NAVY, lineHeight: 1.1, margin: '0 0 10px' }}>
                {subLoading ? ' ' : subStatus ? t('titleExisting') : t('titleNew')}
              </h1>
              <p style={{ fontSize: '.9rem', color: '#6b7a99', margin: 0 }}>
                {t('subtitle')}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', maxWidth: 400, margin: '0 auto 24px', fontSize: '.8rem', color: '#dc2626' }}>
                ⚠ {error}
              </div>
            )}

            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 22 }}>
              {PLANS.map(plan => {
                const isLoading = loading === plan.key
                return (
                  <div key={plan.key} style={{
                    borderRadius: 20,
                    padding: '36px 30px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    background: plan.popular
                      ? 'linear-gradient(180deg,rgba(0,102,255,.08),#fff 26%)'
                      : '#fff',
                    border: plan.popular
                      ? '2px solid rgba(0,102,255,.38)'
                      : '1px solid #e2e8f0',
                    boxShadow: plan.popular
                      ? '0 0 0 1px rgba(0,102,255,.08), 0 18px 48px rgba(0,102,255,.14)'
                      : '0 12px 36px rgba(0,102,255,.08)',
                    paddingTop: plan.popular ? 50 : 36,
                  }}>

                    {plan.popular && (
                      <div style={{
                        position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                        background: `linear-gradient(90deg, ${BLUE}, #0055ee)`,
                        color: '#fff', fontSize: '.7rem', fontWeight: 700,
                        padding: '5px 17px', borderRadius: 20, whiteSpace: 'nowrap',
                        letterSpacing: '.05em', textTransform: 'uppercase',
                      }}>
                        {t('mostPopular')}
                      </div>
                    )}

                    <div style={{ fontSize: '.75rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: BLUE, marginBottom: 10 }}>
                      {plan.label}
                    </div>

                    {promoActive ? (
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: NAVY }}>
                            €{(plan.price / 2).toFixed(2).replace('.00', '')}
                          </span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: .55 }}>{t('monthSuffix')}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: '.8rem', color: '#9ca3af', textDecoration: 'line-through' }}>€{plan.price}</span>
                          <span style={{ fontSize: '.72rem', fontWeight: 700, color: BLUE, background: 'rgba(0,102,255,.09)', borderRadius: 6, padding: '2px 7px' }}>
                            {t('foundingLabel')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: NAVY, marginBottom: 4 }}>
                        €{plan.price}<span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: .55, letterSpacing: 0 }}>{t('monthSuffix')}</span>
                      </div>
                    )}

                    <div style={{ fontSize: '.8rem', color: '#6b7a99', marginBottom: 22 }}>{plan.clients}</div>

                    <div style={{ height: 1, background: '#e2e8f0', marginBottom: 20 }} />

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                      {FEATURES_COMMON.map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: '.86rem', color: NAVY, lineHeight: 1.4 }}>
                          <Chk />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button onClick={() => handleSelectPlan(plan.key)} disabled={!!loading}
                      style={{
                        width: '100%', height: 48, borderRadius: 12, border: 'none',
                        background: `linear-gradient(90deg, ${BLUE}, #0055ee)`,
                        color: '#fff', fontWeight: 700, fontSize: '.95rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading && !isLoading ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'opacity .15s',
                      }}>
                      {isLoading
                        ? <><Loader2 size={15} className="animate-spin" /> {t('activateBtn')}</>
                        : t('activateBtn')
                      }
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Footer note */}
            <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: 16, paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ color: '#6b7a99', fontSize: '0.85rem', margin: 0 }}>
                {locale === 'en'
                  ? '14 days free. Billing starts after the trial. Cancel anytime.'
                  : '14 dana besplatno. Naplata počinje tek nakon probnog razdoblja. Otkazivanje u svako doba.'}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#9ca3af', margin: 0 }}>
                {t('wrongAccount')}{' '}
                <button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })}
                  style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', padding: 0 }}>
                  {t('switchAccount')}
                </button>
                {' · '}
                <a href="https://unitlift.com" style={{ color: BLUE, textDecoration: 'underline' }}>
                  unitlift.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

