'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Eye, EyeOff, MessageSquare, Shield, Lock, CheckCircle2, Users,
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

  const BLUE = '#0066FF'
  const NAVY = '#0A1024'

  const inputClass = "w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 bg-white focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10"

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f3f4f8' }}>

      {/* ── LEFT: branding panel ── */}
      <div
        className="hidden lg:flex lg:w-[42%] xl:w-[46%] flex-col relative overflow-hidden select-none"
        style={{ background: `linear-gradient(155deg, ${NAVY} 0%, #0d1a3a 55%, ${NAVY} 100%)` }}
      >
        {/* Glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-[480px] h-[480px] rounded-full opacity-20 blur-[100px]"
            style={{ backgroundColor: BLUE }} />
          <div className="absolute bottom-[-80px] right-[-60px] w-[320px] h-[320px] rounded-full opacity-10 blur-[80px]"
            style={{ backgroundColor: BLUE }} />
        </div>

        {/* Grid lines overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative z-10 flex flex-col h-full px-10 xl:px-14 py-10">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: BLUE }}>
              <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-black text-sm tracking-tight leading-none">UnitLift</p>
              <p className="text-white/30 text-[9px] tracking-[0.2em] uppercase mt-0.5">Coaching Platform</p>
            </div>
          </div>

          {/* Headline + plan card */}
          <div className="flex-1 flex flex-col justify-start space-y-6 pt-6 pb-8">
            <div>
              <h1 className="text-[2.4rem] xl:text-[2.8rem] font-black text-white leading-[1.08] tracking-tight">
                {t('headlineMain')}<br />
                {t('headlinePre')}{' '}
                <span style={{ color: BLUE }}>{t('headlineAccent')}</span>
              </h1>
              <p className="text-white/45 text-sm mt-4 leading-relaxed max-w-[300px]">{t('tagline')}</p>
            </div>

            {/* Plan summary card */}
            {planMeta && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                {/* Card header */}
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: BLUE + '25', border: `1px solid ${BLUE}40` }}>
                      <planMeta.icon size={17} style={{ color: BLUE }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm leading-none">Plan {planMeta.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white font-black text-2xl leading-none">{planMeta.price}</p>
                      <p className="text-white/35 text-[10px] mt-1">po mjesecu</p>
                    </div>
                  </div>
                  {/* Client limit badge */}
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: BLUE + '20', border: `1px solid ${BLUE}40`, color: '#7ab8ff' }}>
                    <Users size={11} />
                    {planMeta.clients}
                  </div>
                </div>
                {/* Guarantees + features */}
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

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

                {/* Feature list inside card */}
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
      <div className="flex-1 flex flex-col bg-white">

        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-5 border-b border-gray-100"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))', paddingBottom: '1rem', backgroundColor: NAVY }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: BLUE }}>
            <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
          </div>
          <span className="font-black text-sm text-white">UnitLift</span>
          {planMeta && (
            <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: BLUE + '30', border: `1px solid ${BLUE}50` }}>
              {planMeta.label} · {planMeta.price}
            </span>
          )}
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:py-12"
          style={{ backgroundColor: '#f8f9fc' }}>
          <div className="w-full max-w-[420px]">

            {step === 'success' ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-12 text-center space-y-5">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0066ff15' }}>
                    <CircleCheck size={32} style={{ color: BLUE }} />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900">{t('successTitle')}</h2>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">{t('successMsg')}</p>
                </div>
                <Link href="/login"
                  className="block w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center"
                  style={{ backgroundColor: BLUE }}>
                  {t('goToLogin')}
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-7 py-8 space-y-5">

                {/* Form header */}
                <div>
                  {/* Mobile plan badge */}
                  {planMeta && (
                    <div className="lg:hidden flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                      style={{ backgroundColor: BLUE + '0d', border: `1px solid ${BLUE}25` }}>
                      <planMeta.icon size={13} style={{ color: BLUE }} />
                      <span className="text-xs font-semibold" style={{ color: BLUE }}>
                        Plan {planMeta.label} · {planMeta.price} · 14 dana besplatno
                      </span>
                    </div>
                  )}
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Kreiraj račun</h2>
                  <p className="text-gray-400 text-sm mt-1">Registracija za UnitLift platformu.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3.5">

                  {/* Full name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('fullName')}</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Marko Markić" autoComplete="name" required
                      className={inputClass} />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('email')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="trener@email.com" autoComplete="email" required
                      className={inputClass} />
                    {mode === 'legacy' && stripeEmail && email !== stripeEmail && (
                      <p className="text-xs text-amber-500">💡 Stripe email: {stripeEmail}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Telefon <span className="text-gray-400 normal-case font-normal">(opcija)</span>
                    </label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+385 91 234 5678"
                      className={inputClass} />
                  </div>

                  {/* Password row */}
                  <div className="flex flex-col gap-3.5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('password')}</label>
                      <div className="relative">
                        <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="Min. 8 znakova" autoComplete="new-password" required
                          className={inputClass + ' pr-10'} />
                        <button type="button" onClick={() => setShowPwd(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('confirmPassword')}</label>
                      <div className="relative">
                        <input type={showCnf ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                          placeholder="Ponovi lozinku" autoComplete="new-password" required
                          className={`${inputClass} pr-10 ${confirmPwd.length > 0 ? password === confirmPwd ? 'border-green-300 focus:border-green-400 focus:ring-green-100' : 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`} />
                        <button type="button" onClick={() => setShowCnf(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showCnf ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password strength bar */}
                  {password.length > 0 && (
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all"
                          style={{ backgroundColor: password.length >= i*2+4
                            ? i<=1?'#ef4444':i<=2?'#f59e0b':i<=3?'#3b82f6':BLUE
                            : '#e5e7eb' }} />
                      ))}
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
                      ? <><Loader2 size={15} className="animate-spin" />{mode === 'new' ? 'Kreiranje računa...' : t('loading')}</>
                      : mode === 'new' ? 'Kreni besplatno →' : t('submit')
                    }
                  </button>
                </form>

                {mode === 'new' && (
                  <p className="text-center text-[11px] text-gray-400 leading-relaxed">
                    Kartica potrebna za aktivaciju · Bez naplate 14 dana · Otkaži besplatno kad hoćeš
                  </p>
                )}

                {/* Trust badges */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100">
                  {[
                    { icon: Shield,       label: '14 dana besplatno' },
                    { icon: CircleCheck,  label: 'Pravo na povrat' },
                    { icon: Lock,         label: 'Besplatno otkazivanje' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-gray-50 border border-gray-100">
                      <Icon size={13} style={{ color: BLUE }} />
                      <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step !== 'success' && (
              <p className="text-center text-xs text-gray-400 mt-4">
                {t('alreadyHaveAccount')}{' '}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: BLUE }}>
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
