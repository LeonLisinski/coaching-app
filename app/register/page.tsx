'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Eye, EyeOff, MessageSquare, Shield, Lock, CheckCircle2,
  TrendingUp, Dumbbell, Loader2, CircleCheck,
} from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'

const FEATURE_ICONS = [Dumbbell, CheckCircle2, MessageSquare, TrendingUp] as const
const FEATURE_KEYS  = ['training', 'checkin', 'chat', 'finance'] as const

type Step = 'form' | 'loading' | 'success'

export default function RegisterPage() {
  const t = useTranslations('register')

  const [fullName, setFullName]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirm]   = useState('')
  const [showPwd, setShowPwd]           = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [error, setError]               = useState('')
  const [step, setStep]                 = useState<Step>('form')

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

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t('errFields')); return
    }
    if (password.length < 8) {
      setError(t('errPasswordShort')); return
    }
    if (password !== confirmPassword) {
      setError(t('errPasswordMatch')); return
    }

    setStep('loading')

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Greška pri registraciji.')
        setStep('form')
      } else {
        setStep('success')
      }
    } catch {
      setError('Greška pri spajanju na server.')
      setStep('form')
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: dark branding panel ── */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col relative overflow-hidden select-none"
        style={{ background: 'linear-gradient(160deg, #0d0920 0%, #120b28 60%, #0a0614 100%)' }}
      >
        {/* Glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-25 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
          <div className="absolute bottom-0 -left-24 w-[360px] h-[360px] rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="lg" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lg)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full px-12 py-12">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--app-accent)' }}>
              <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-black text-sm tracking-tight leading-none">UnitLift</p>
              <p className="text-white/30 text-[9px] tracking-[0.2em] uppercase mt-0.5">Coaching Platform</p>
            </div>
          </div>

          {/* Headline + features */}
          <div className="space-y-10">
            <div>
              <h1 className="text-[2.6rem] font-black text-white leading-[1.1] tracking-tight">
                {t('headlineMain')}<br />
                {t('headlinePre')}{' '}
                <span style={{ color: 'var(--app-accent)' }}>{t('headlineAccent')}</span>
              </h1>
              <p className="text-white/40 text-sm mt-4 leading-relaxed max-w-[290px]">
                {t('tagline')}
              </p>
            </div>
            <div className="border-t border-white/[0.07]" />
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

      {/* ── RIGHT: form panel ── */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#f7f8fb' }}>

        {/* Mobile header */}
        <header
          className="lg:hidden flex items-center px-6 bg-white border-b border-gray-100"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))', paddingBottom: '1rem' }}
        >
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
              /* ── Success state ── */
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.07)] px-9 py-12 text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}>
                    <CircleCheck size={32} style={{ color: 'var(--app-accent)' }} />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{t('successTitle')}</h2>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">{t('successMsg')}</p>
                </div>
                <Link
                  href="/login"
                  className="block w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center transition-all"
                  style={{ backgroundColor: 'var(--app-accent)' }}
                >
                  {t('goToLogin')}
                </Link>
              </div>
            ) : (
              /* ── Form ── */
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.07)] px-9 py-10 space-y-7">

                {/* Logo + heading */}
                <div className="space-y-5">
                  <div className="hidden lg:flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: 'var(--app-accent)' }}>
                      <UnitLiftLogo fill="white" tight={false} className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-[1.15rem] text-gray-900 tracking-tight leading-none">UnitLift</p>
                      <p className="text-gray-400 text-[10px] tracking-widest uppercase mt-0.5">Coaching Platform</p>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight leading-tight">
                      {t('welcomeTitle')}
                    </h2>
                    <p className="text-gray-400 text-sm mt-1.5">{t('welcomeSubtitle')}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Full name */}
                  <div className="space-y-1.5">
                    <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700">{t('fullName')}</label>
                    <input
                      id="fullName" type="text" value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder={t('placeholderName')}
                      autoComplete="name"
                      required
                      onFocus={inputFocus} onBlur={inputBlur}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-300 bg-gray-50/80"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700">{t('email')}</label>
                    <input
                      id="email" type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={t('placeholderEmail')}
                      autoComplete="email"
                      required
                      onFocus={inputFocus} onBlur={inputBlur}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-300 bg-gray-50/80"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700">{t('password')}</label>
                    <div className="relative">
                      <input
                        id="password" type={showPwd ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('placeholderPassword')}
                        autoComplete="new-password"
                        required
                        onFocus={inputFocus} onBlur={inputBlur}
                        className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-300 bg-gray-50/80"
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100">
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* Password strength hint */}
                    {password.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{
                              backgroundColor: password.length >= i * 2 + 4
                                ? i <= 1 ? '#ef4444' : i <= 2 ? '#f59e0b' : i <= 3 ? '#3b82f6' : 'var(--app-accent)'
                                : '#e5e7eb',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <label htmlFor="confirm" className="block text-sm font-semibold text-gray-700">{t('confirmPassword')}</label>
                    <div className="relative">
                      <input
                        id="confirm" type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder={t('placeholderConfirm')}
                        autoComplete="new-password"
                        required
                        onFocus={inputFocus} onBlur={inputBlur}
                        className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-300 bg-gray-50/80"
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100">
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* Match indicator */}
                    {confirmPassword.length > 0 && (
                      <p className={`text-xs mt-1 ${password === confirmPassword ? 'text-green-500' : 'text-red-400'}`}>
                        {password === confirmPassword ? '✓ Lozinke se podudaraju' : '✗ Lozinke se ne podudaraju'}
                      </p>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                      <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                      <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={step === 'loading'}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                    onMouseEnter={e => {
                      if (step !== 'loading') {
                        e.currentTarget.style.filter = 'brightness(1.08)'
                        e.currentTarget.style.boxShadow = '0 6px 20px color-mix(in srgb, var(--app-accent) 35%, transparent)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.filter = ''
                      e.currentTarget.style.boxShadow = ''
                      e.currentTarget.style.transform = ''
                    }}
                  >
                    {step === 'loading'
                      ? <><Loader2 size={16} className="animate-spin" />{t('loading')}</>
                      : t('submit')
                    }
                  </button>
                </form>

                {/* Trust row */}
                <div className="flex items-center justify-center gap-6 pt-1 border-t border-gray-50">
                  {([{ icon: Lock, key: 'secureLogin' }, { icon: Shield, key: 'gdpr' }] as const).map(({ icon: Icon, key }) => (
                    <div key={key} className="flex items-center gap-1.5 text-gray-400">
                      <Icon size={12} />
                      <span className="text-xs font-medium">{t(key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Already have account */}
            {step !== 'success' && (
              <p className="text-center text-xs text-gray-400 mt-5">
                {t('alreadyHaveAccount')}{' '}
                <Link href="/login" className="font-semibold transition-colors hover:underline" style={{ color: 'var(--app-accent)' }}>
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
