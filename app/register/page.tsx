'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Eye, EyeOff, MessageSquare, Shield, Lock, CheckCircle2,
  TrendingUp, Dumbbell, Loader2, CircleCheck, Crown, Zap, Rocket,
} from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'

const FEATURE_ICONS = [Dumbbell, CheckCircle2, MessageSquare, TrendingUp] as const
const FEATURE_KEYS  = ['training', 'checkin', 'chat', 'finance'] as const

const PLAN_META: Record<string, { label: string; price: string; clients: string; icon: typeof Crown; color: string }> = {
  starter: { label: 'Starter', price: '€29/mj', clients: '15 klijenata', icon: Zap,    color: '#3b82f6' },
  pro:     { label: 'Pro',     price: '€59/mj', clients: '50 klijenata', icon: Crown,  color: '#7c3aed' },
  scale:   { label: 'Scale',   price: '€99/mj', clients: '150 klijenata', icon: Rocket, color: '#059669' },
}

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || 'https://unitlift.com'

type Step = 'validating' | 'form' | 'loading' | 'success' | 'invalid'

// Whether to use the new pre-checkout flow vs. legacy post-checkout flow
type Mode = 'new' | 'legacy'

function RegisterInner() {
  const t = useTranslations('register')
  const searchParams = useSearchParams()
  const router = useRouter()

  const sessionId = searchParams.get('session_id')
  const plan      = searchParams.get('plan') ?? ''

  const mode: Mode = sessionId ? 'legacy' : 'new'

  const [step, setStep]               = useState<Step>('validating')
  const [fullName, setFullName]       = useState('')
  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [showCnf, setShowCnf]         = useState(false)
  const [error, setError]             = useState('')
  const [stripeEmail, setStripeEmail] = useState('')

  // Determine mode and validate on mount
  useEffect(() => {
    if (mode === 'new') {
      // New flow: plan in URL → show form immediately
      if (plan && ['starter', 'pro', 'scale'].includes(plan)) {
        setStep('form')
      } else {
        router.replace(`${LANDING_URL}/cijene`)
      }
      return
    }
    // Legacy flow: validate Stripe session
    fetch(`/api/register/validate-session?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setStripeEmail(data.customer_email || '')
          setEmail(data.customer_email || '')
          setStep('form')
        } else {
          setStep('invalid')
        }
      })
      .catch(() => setStep('invalid'))
  }, [sessionId, plan, mode])

  const planMeta = PLAN_META[plan]

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor     = 'var(--app-accent)'
    e.currentTarget.style.boxShadow       = '0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent)'
    e.currentTarget.style.backgroundColor = '#fff'
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor     = ''
    e.currentTarget.style.boxShadow       = ''
    e.currentTarget.style.backgroundColor = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !email.trim() || !password) {
      setError(t('errFields')); return
    }
    if (password.length < 8) {
      setError(t('errPasswordShort')); return
    }
    if (password !== confirmPwd) {
      setError(t('errPasswordMatch')); return
    }

    setStep('loading')
    try {
      if (mode === 'new') {
        // New flow: create account first, then redirect to Stripe
        const res = await fetch('/api/register/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email:     email.trim(),
            phone:     phone.trim() || null,
            password,
            plan,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Greška pri registraciji.')
          setStep('form')
        } else if (data.checkout_url) {
          window.location.href = data.checkout_url
        }
      } else {
        // Legacy flow: account created after Stripe checkout
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email:     email.trim(),
            phone:     phone.trim() || null,
            password,
            session_id: sessionId,
            plan,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Greška pri registraciji.')
          setStep('form')
        } else {
          setStep('success')
        }
      }
    } catch {
      setError('Greška pri spajanju na server.')
      setStep('form')
    }
  }

  // ── Validating ─────────────────────────────────────────────────────────────
  if (step === 'validating') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f8fb' }}>
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    )
  }

  // ── Invalid session ────────────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT: branding ── */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col relative overflow-hidden select-none"
        style={{ background: 'linear-gradient(160deg, #0d0920 0%, #120b28 60%, #0a0614 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-25 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
          <div className="absolute bottom-0 -left-24 w-[360px] h-[360px] rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
        </div>
        <div className="relative z-10 flex flex-col justify-between h-full px-12 py-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--app-accent)' }}>
              <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-black text-sm tracking-tight leading-none">UnitLift</p>
              <p className="text-white/30 text-[9px] tracking-[0.2em] uppercase mt-0.5">Coaching Platform</p>
            </div>
          </div>

          <div className="space-y-10">
            <div>
              <h1 className="text-[2.6rem] font-black text-white leading-[1.1] tracking-tight">
                {t('headlineMain')}<br />
                {t('headlinePre')}{' '}
                <span style={{ color: 'var(--app-accent)' }}>{t('headlineAccent')}</span>
              </h1>
              <p className="text-white/40 text-sm mt-4 leading-relaxed max-w-[290px]">{t('tagline')}</p>
            </div>
            <div className="border-t border-white/[0.07]" />

            {/* Plan summary box */}
            {planMeta && (
              <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: planMeta.color + '33' }}>
                    <planMeta.icon size={16} style={{ color: planMeta.color }} />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Plan: {planMeta.label}</p>
                    <p className="text-white/50 text-xs">{planMeta.clients} · {planMeta.price}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                  <p className="text-white/70 text-xs">14 dana besplatnog probnog perioda</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <Shield size={13} className="text-blue-400 shrink-0" />
                  <p className="text-white/70 text-xs">Kartica verificirana, naplata tek nakon triala</p>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {FEATURE_KEYS.map((key, i) => {
                const Icon = FEATURE_ICONS[i]
                return (
                  <div key={key} className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Icon size={16} style={{ color: 'var(--app-accent)' }} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold leading-tight">{t(`features.${key}.label`)}</p>
                      <p className="text-white/38 text-xs mt-0.5">{t(`features.${key}.desc`)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-white/25 text-[11px]">© 2026 UnitLift · unitlift.com</p>
        </div>
      </div>

      {/* ── RIGHT: form ── */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#f7f8fb' }}>
        <header className="lg:hidden flex items-center px-6 bg-white border-b border-gray-100"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))', paddingBottom: '1rem' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--app-accent)' }}>
              <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
            </div>
            <span className="font-black text-sm text-gray-900">UnitLift</span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[440px]">

            {step === 'success' ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.07)] px-9 py-12 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}>
                    <CircleCheck size={32} style={{ color: 'var(--app-accent)' }} />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900">{t('successTitle')}</h2>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">{t('successMsg')}</p>
                </div>
                <Link href="/login"
                  className="block w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center"
                  style={{ backgroundColor: 'var(--app-accent)' }}>
                  {t('goToLogin')}
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.07)] px-9 py-10 space-y-6">

                {/* Header */}
                <div className="space-y-4">
                  <div className="hidden lg:flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--app-accent)' }}>
                      <UnitLiftLogo fill="white" tight={false} className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-[1.15rem] text-gray-900 tracking-tight leading-none">UnitLift</p>
                      <p className="text-gray-400 text-[10px] tracking-widest uppercase mt-0.5">Coaching Platform</p>
                    </div>
                  </div>

                  {/* Plan badge */}
                  {planMeta && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                      style={{ backgroundColor: planMeta.color + '0f', borderColor: planMeta.color + '33' }}>
                      <planMeta.icon size={13} style={{ color: planMeta.color }} />
                      <span className="text-xs font-semibold" style={{ color: planMeta.color }}>
                        Plan {planMeta.label} · {planMeta.price} · 14 dana trial
                      </span>
                    </div>
                  )}

                  <div>
                    <h2 className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight leading-tight">{t('welcomeTitle')}</h2>
                    <p className="text-gray-400 text-sm mt-1">{t('welcomeSubtitle')}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Full name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">{t('fullName')}</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder={t('placeholderName')} autoComplete="name" required
                      onFocus={inputFocus} onBlur={inputBlur}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 bg-gray-50/80" />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">{t('email')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder={t('placeholderEmail')} autoComplete="email" required
                      onFocus={inputFocus} onBlur={inputBlur}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 bg-gray-50/80" />
                    {mode === 'legacy' && stripeEmail && email !== stripeEmail && (
                      <p className="text-xs text-amber-500">💡 Stripe email: {stripeEmail}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">
                      {t('phone') || 'Telefon'} <span className="text-gray-400 font-normal">(opcija)</span>
                    </label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+385 91 234 5678"
                      onFocus={inputFocus} onBlur={inputBlur}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 bg-gray-50/80" />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">{t('password')}</label>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder={t('placeholderPassword')} autoComplete="new-password" required
                        onFocus={inputFocus} onBlur={inputBlur}
                        className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 bg-gray-50/80" />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-all"
                            style={{ backgroundColor: password.length >= i*2+4
                              ? i<=1?'#ef4444':i<=2?'#f59e0b':i<=3?'#3b82f6':'var(--app-accent)'
                              : '#e5e7eb' }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">{t('confirmPassword')}</label>
                    <div className="relative">
                      <input type={showCnf ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                        placeholder={t('placeholderConfirm')} autoComplete="new-password" required
                        onFocus={inputFocus} onBlur={inputBlur}
                        className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 bg-gray-50/80" />
                      <button type="button" onClick={() => setShowCnf(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                        {showCnf ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPwd.length > 0 && (
                      <p className={`text-xs mt-1 ${password === confirmPwd ? 'text-green-500' : 'text-red-400'}`}>
                        {password === confirmPwd ? '✓ Lozinke se podudaraju' : '✗ Lozinke se ne podudaraju'}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                      <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                      <p className="text-red-600 text-xs">{error}</p>
                    </div>
                  )}

                  <button type="submit" disabled={step === 'loading'}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                    onMouseEnter={e => { if (step!=='loading') { e.currentTarget.style.filter='brightness(1.08)'; e.currentTarget.style.transform='translateY(-1px)' }}}
                    onMouseLeave={e => { e.currentTarget.style.filter=''; e.currentTarget.style.transform='' }}
                  >
                    {step === 'loading'
                      ? <><Loader2 size={16} className="animate-spin" />{mode === 'new' ? 'Kreiranje računa...' : t('loading')}</>
                      : mode === 'new' ? 'Nastavi na plaćanje →' : t('submit')
                    }
                  </button>
                </form>

                {mode === 'new' && (
                  <p className="text-center text-xs text-gray-400 -mt-2">
                    Kartica je potrebna za aktivaciju · Bez naplate 14 dana · Otkaži kad hoćeš
                  </p>
                )}
                <div className="flex items-center justify-center gap-6 pt-1 border-t border-gray-50">
                  {([{ icon: Lock, key: 'secureLogin' }, { icon: Shield, key: 'gdpr' }] as const).map(({ icon: Icon, key }) => (
                    <div key={key} className="flex items-center gap-1.5 text-gray-400">
                      <Icon size={12} /><span className="text-xs font-medium">{t(key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step !== 'success' && (
              <p className="text-center text-xs text-gray-400 mt-5">
                {t('alreadyHaveAccount')}{' '}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--app-accent)' }}>
                  {t('loginLink')}
                </Link>
              </p>
            )}
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
