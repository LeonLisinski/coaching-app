'use client'
import { Suspense, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare, Shield, Lock, CheckCircle2, Users,
  TrendingUp, Dumbbell, Loader2, CircleCheck, Crown, Zap, Rocket,
  User, Building2,
} from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'

const FEATURE_ICONS = [Dumbbell, CheckCircle2, MessageSquare, TrendingUp] as const
const FEATURE_KEYS  = ['training', 'checkin', 'chat', 'finance'] as const

const PLAN_META: Record<string, { label: string; price: string; basePrice: number; clients: string; icon: typeof Crown; color: string }> = {
  starter: { label: 'Starter', price: '€29/mj', basePrice: 29, clients: '10 klijenata', icon: Zap,    color: '#3b82f6' },
  pro:     { label: 'Pro',     price: '€59/mj', basePrice: 59, clients: '30 klijenata', icon: Crown,  color: '#7c3aed' },
  scale:   { label: 'Scale',   price: '€99/mj', basePrice: 99, clients: '75 klijenata', icon: Rocket, color: '#059669' },
}

function isFoundingPromoActive(): boolean {
  const end = process.env.NEXT_PUBLIC_FOUNDING_PROMO_END
  if (!end) return false
  return Date.now() < new Date(end).getTime()
}

function foundingPromoEndDate(): string | null {
  const end = process.env.NEXT_PUBLIC_FOUNDING_PROMO_END
  if (!end) return null
  try {
    return new Date(end).toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return end }
}

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || 'https://unitlift.com'

type Step    = 'validating' | 'form' | 'loading' | 'invalid'
type BuyerType = 'private' | 'business'

function RegisterInner() {
  const t = useTranslations('register')
  const searchParams = useSearchParams()
  const router = useRouter()

  const plan = searchParams.get('plan') ?? ''

  const promoActive  = isFoundingPromoActive()
  const planMeta     = PLAN_META[plan]
  const promoPrice   = planMeta ? (planMeta.basePrice / 2).toFixed(2).replace('.00', '') : null

  const [step, setStep]           = useState<Step>('validating')
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [buyerType, setBuyerType] = useState<BuyerType>('private')
  const [company, setCompany]     = useState('')
  const [oib, setOib]             = useState('')
  const [address, setAddress]     = useState('')
  const [error, setError]         = useState('')

  useEffect(() => {
    if (plan && ['starter', 'pro', 'scale'].includes(plan)) {
      setStep('form')
    } else {
      router.replace(`${LANDING_URL}/cijene`)
    }
  }, [plan, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !email.trim()) {
      setError(t('errFields')); return
    }
    if (buyerType === 'business') {
      if (!company.trim()) { setError(t('errFields')); return }
      if (!/^\d{11}$/.test(oib.trim())) { setError(t('errOib')); return }
    }

    setStep('loading')
    try {
      const res = await fetch('/api/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:   buyerType === 'private' ? fullName.trim() : company.trim(),
          display_name: fullName.trim(),
          email:       email.trim(),
          plan,
          buyer_type:  buyerType,
          buyer_name:  buyerType === 'private' ? fullName.trim() : company.trim(),
          oib:         buyerType === 'business' ? oib.trim() : '',
          address:     address.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Greška pri registraciji.')
        setStep('form')
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch {
      setError('Greška pri spajanju na server.')
      setStep('form')
    }
  }

  if (step === 'validating') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f8fb' }}>
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#f7f8fb' }}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.07)] px-9 py-12 text-center space-y-4 max-w-md w-full">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-extrabold text-gray-900">Nevažeća sesija</h2>
          <p className="text-sm text-gray-500">Ovaj link je istekao ili nije ispravan. Odaberi plan na stranici.</p>
          <a
            href={`${LANDING_URL}/#cijene`}
            className="block w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center"
            style={{ backgroundColor: 'var(--app-accent)' }}
          >
            Pogledaj planove
          </a>
        </div>
      </div>
    )
  }

  const BLUE = '#0066FF'
  const NAVY = '#0A1024'

  const inputClass = "w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 bg-white focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10"

  return (
    <div className="h-[100dvh] flex overflow-hidden" style={{ backgroundColor: '#f3f4f8' }}>

      {/* ── LEFT: branding panel ── */}
      <div
        className="hidden lg:flex lg:w-[42%] xl:w-[46%] flex-col relative overflow-y-auto select-none"
        style={{ background: `linear-gradient(155deg, ${NAVY} 0%, #0d1a3a 55%, ${NAVY} 100%)` }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-[480px] h-[480px] rounded-full opacity-20 blur-[100px]"
            style={{ backgroundColor: BLUE }} />
          <div className="absolute bottom-[-80px] right-[-60px] w-[320px] h-[320px] rounded-full opacity-10 blur-[80px]"
            style={{ backgroundColor: BLUE }} />
        </div>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative z-10 flex flex-col h-full px-10 xl:px-14 py-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: BLUE }}>
              <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-black text-sm tracking-tight leading-none">UnitLift</p>
              <p className="text-white/30 text-[9px] tracking-[0.2em] uppercase mt-0.5">Coaching Platform</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-start space-y-8 pt-6 pb-8">
            <div>
              <h1 className="text-[1.9rem] font-black text-white leading-tight tracking-tight">
                {t('headlineMain')}<br />
                {t('headlinePre')}{' '}
                <span style={{ color: BLUE }}>{t('headlineAccent')}</span>
              </h1>
              <p className="text-white/40 text-xs mt-2 leading-relaxed max-w-[280px]">{t('tagline')}</p>
            </div>

            {planMeta && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: BLUE + '25', border: `1px solid ${BLUE}40` }}>
                      <planMeta.icon size={17} style={{ color: BLUE }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm leading-none">Plan {planMeta.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {promoActive && promoPrice ? (
                        <>
                          <p className="text-white font-black text-2xl leading-none">€{promoPrice}<span className="text-sm font-normal text-white/50">/mj</span></p>
                          <p className="text-white/40 text-[10px] line-through mt-0.5">{planMeta.price}</p>
                          <span className="inline-block text-[9px] font-bold text-blue-300 bg-blue-500/20 rounded px-1.5 py-0.5 mt-0.5">{t('foundingLabel')}</span>
                        </>
                      ) : (
                        <>
                          <p className="text-white font-black text-2xl leading-none">{planMeta.price}</p>
                          <p className="text-white/35 text-[10px] mt-1">po mjesecu</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: BLUE + '20', border: `1px solid ${BLUE}40`, color: '#7ab8ff' }}>
                    <Users size={11} />
                    {planMeta.clients}
                  </div>
                </div>
                <div className="px-5 py-3.5 space-y-2.5">
                  {[
                    { color: '#22c55e', icon: CheckCircle2, text: '14 dana besplatnog probnog perioda' },
                    { color: '#a855f7', icon: CircleCheck,  text: '30 dana pravo na povrat novca' },
                    { color: '#f59e0b', icon: Lock,         text: 'Besplatno otkazivanje u bilo kom trenutku' },
                  ].map(({ color, icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color + '22' }}>
                        <Icon size={10} style={{ color }} />
                      </div>
                      <p className="text-white/65 text-xs">{text}</p>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
                <div className="px-5 py-4 space-y-3">
                  {FEATURE_KEYS.map((key, i) => {
                    const Icon = FEATURE_ICONS[i]
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'rgba(0,102,255,0.12)', border: '1px solid rgba(0,102,255,0.18)' }}>
                          <Icon size={13} style={{ color: BLUE }} />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold leading-tight">{t(`features.${key}.label`)}</p>
                          <p className="text-white/35 text-[10px] mt-0.5">{t(`features.${key}.desc`)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <p className="text-white/20 text-[11px]">© 2026 UnitLift · unitlift.com</p>
        </div>
      </div>

      {/* ── RIGHT: form panel ── */}
      <div className="flex-1 flex flex-col bg-white min-h-0 min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-5"
          style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top, 0.875rem))', paddingBottom: '0.875rem', backgroundColor: NAVY, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: BLUE }}>
            <UnitLiftLogo fill="white" tight={false} className="w-4 h-4" />
          </div>
          <span className="font-black text-sm text-white">UnitLift</span>
          <span className="text-white/30 text-xs ml-0.5">· Coaching Platform</span>
        </header>

        <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 py-6 lg:py-12"
          style={{ backgroundColor: '#f8f9fc' }}>
          <div className="w-full max-w-[420px] my-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-6 lg:px-7 lg:py-8 space-y-5">

              {/* Mobile plan card */}
              {planMeta && (
                <div className="lg:hidden rounded-xl overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0d1a3a 100%)`, border: `1px solid ${BLUE}30` }}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: BLUE + '25', border: `1px solid ${BLUE}40` }}>
                      <planMeta.icon size={15} style={{ color: BLUE }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold">Plan {planMeta.label}</p>
                      <p className="text-white/40 text-[10px]">{planMeta.clients} · 14 dana besplatno</p>
                    </div>
                    {promoActive && promoPrice ? (
                      <div className="text-right shrink-0">
                        <p className="text-white font-black text-xl leading-none">€{promoPrice}<span className="text-xs font-normal text-white/50">/mj</span></p>
                        <p className="text-white/40 text-[9px] line-through">{planMeta.price}</p>
                      </div>
                    ) : (
                      <p className="text-white font-black text-xl shrink-0">{planMeta.price}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xl lg:text-2xl font-extrabold text-gray-900 tracking-tight">{t('welcomeTitle')}</h2>
                <p className="text-gray-400 text-sm mt-1">{t('welcomeSubtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Buyer type toggle */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('buyerTypeTitle')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['private', 'business'] as BuyerType[]).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => { setBuyerType(opt); setError('') }}
                        className="flex items-center gap-2 p-3 rounded-xl text-left transition-all"
                        style={{
                          border: buyerType === opt ? `2px solid ${BLUE}` : '2px solid #e5e7eb',
                          background: buyerType === opt ? `${BLUE}08` : '#f9fafb',
                        }}
                      >
                        {opt === 'private'
                          ? <User size={15} style={{ color: buyerType === opt ? BLUE : '#9ca3af', flexShrink: 0 }} />
                          : <Building2 size={15} style={{ color: buyerType === opt ? BLUE : '#9ca3af', flexShrink: 0 }} />}
                        <span className="text-xs font-semibold leading-tight"
                          style={{ color: buyerType === opt ? BLUE : '#374151' }}>
                          {t(opt === 'private' ? 'buyerTypePrivate' : 'buyerTypeBusiness')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name / Company */}
                {buyerType === 'business' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('companyLabel')}</label>
                    <input
                      type="text" value={company} onChange={e => setCompany(e.target.value)}
                      placeholder="Fitness d.o.o." required
                      className={inputClass}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('fullName')}</label>
                  <input
                    type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Marko Markić" autoComplete="name" required
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('email')}</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="trener@email.com" autoComplete="email" required
                    className={inputClass}
                  />
                </div>

                {/* OIB — only for business */}
                {buyerType === 'business' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {t('oibLabel')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text" inputMode="numeric"
                      value={oib}
                      onChange={e => setOib(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder={t('oibPlaceholder')}
                      className={inputClass}
                      style={{ borderColor: oib.length > 0 && oib.length !== 11 ? '#f87171' : '' }}
                    />
                    {oib.length > 0 && oib.length !== 11 && (
                      <p className="text-red-500 text-[11px]">{t('oibError')}</p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                    <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                    <p className="text-red-600 text-xs">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={step === 'loading'}
                  className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{ backgroundColor: BLUE, boxShadow: `0 4px 16px ${BLUE}30` }}
                >
                  {step === 'loading'
                    ? <><Loader2 size={15} className="animate-spin" />{t('loading')}</>
                    : t('submit')
                  }
                </button>
              </form>

              {/* Trust row */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 border-t border-gray-100">
                {[
                  { icon: Shield,      label: '14 dana besplatno' },
                  { icon: CircleCheck, label: 'Pravo na povrat' },
                  { icon: Lock,        label: 'Otkaži besplatno' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon size={12} style={{ color: BLUE }} />
                    <span className="text-[11px] text-gray-500 font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              {t('alreadyHaveAccount')}{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: BLUE }}>
                {t('loginLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f8fb' }}>
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    }>
      <RegisterInner />
    </Suspense>
  )
}
