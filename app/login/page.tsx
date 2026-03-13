'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, MessageSquare, Shield, Lock, CheckCircle2, TrendingUp, Dumbbell } from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'

const FEATURE_ICONS = [Dumbbell, CheckCircle2, MessageSquare, TrendingUp] as const
const FEATURE_KEYS = ['training', 'checkin', 'chat', 'finance'] as const

export default function LoginPage() {
  const t = useTranslations('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else window.location.href = '/dashboard'
  }

  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--app-accent)'
    e.currentTarget.style.boxShadow   = '0 0 0 3px var(--app-accent-muted)'
  }
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = ''
    e.currentTarget.style.boxShadow   = ''
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: dark branding panel ── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col relative overflow-hidden select-none"
        style={{ background: 'linear-gradient(160deg, #0d0920 0%, #120b28 60%, #0a0614 100%)' }}>

        {/* Glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
          <div className="absolute bottom-0 -left-24 w-[350px] h-[350px] rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="lg" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lg)" />
          </svg>
        </div>

        {/* Content — vertically centered */}
        <div className="relative z-10 flex flex-col justify-between h-full px-12 py-12">

          {/* Top: brand */}
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

          {/* Center: headline + features */}
          <div className="space-y-10">
            <div>
              <h1 className="text-[2.6rem] font-black text-white leading-[1.1] tracking-tight">
                {t('headlineMain')}<br />
                {t('headlinePre')}{' '}
                <span className="relative">
                  <span style={{ color: 'var(--app-accent)' }}>{t('headlineAccent')}</span>
                </span>
              </h1>
              <p className="text-white/40 text-sm mt-5 leading-relaxed max-w-[300px]">
                {t('tagline')}
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-white/[0.07]" />

            {/* Features */}
            <div className="space-y-5">
              {FEATURE_KEYS.map((key, i) => {
                const Icon = FEATURE_ICONS[i]
                return (
                  <div key={key} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Icon size={16} style={{ color: 'var(--app-accent)' }} />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-white text-sm font-semibold leading-tight">{t(`features.${key}.label`)}</p>
                      <p className="text-white/40 text-xs mt-1 leading-relaxed">{t(`features.${key}.desc`)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom: footer */}
          <p className="text-white/15 text-[11px]">© 2026 UnitLift · unitlift.com</p>
        </div>
      </div>

      {/* ── RIGHT: login form ── */}
      <div className="flex-1 flex flex-col bg-white">

        {/* Mobile header */}
        <header className="lg:hidden flex items-center px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--app-accent)' }}>
              <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
            </div>
            <span className="font-black text-sm text-gray-900">UnitLift</span>
          </div>
        </header>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-16">
          <div className="w-full max-w-[400px] space-y-8">

            {/* Heading */}
            <div>
              {/* Logo — desktop only */}
              <div className="hidden lg:flex items-center gap-2.5 mb-8">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--app-accent)' }}>
                  <UnitLiftLogo fill="white" tight={false} className="w-5 h-5" />
                </div>
                <span className="font-black text-sm text-gray-800 tracking-tight">UnitLift</span>
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{t('welcomeTitle')}</h2>
              <p className="text-gray-400 text-sm mt-2">{t('welcomeSubtitle')}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">{t('email')}</label>
                <input
                  id="email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('placeholderEmail')}
                  autoComplete="email"
                  required
                  onFocus={focusInput} onBlur={blurInput}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 bg-gray-50/60 focus:bg-white"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700">{t('password')}</label>
                  <button type="button" className="text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--app-accent)' }}>
                    {t('forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password" type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    onFocus={focusInput} onBlur={blurInput}
                    className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-300 bg-gray-50/60 focus:bg-white"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
                type="submit" disabled={loading}
                className="w-full h-11 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--app-accent)' }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.filter = '')}
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('loading')}</>
                ) : t('submit')}
              </button>
            </form>

            {/* Trust */}
            <div className="flex items-center gap-6 justify-center pt-2">
              {([{ icon: Lock, key: 'secureLogin' }, { icon: Shield, key: 'gdpr' }] as const).map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-center gap-1.5 text-gray-300">
                  <Icon size={11} />
                  <span className="text-xs">{t(key)}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-300">
              {t('noAccess')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
