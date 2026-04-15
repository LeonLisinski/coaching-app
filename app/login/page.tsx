'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, MessageSquare, Shield, Lock, CheckCircle2, TrendingUp, Dumbbell, Loader2 } from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'
import Link from 'next/link'

const FEATURE_ICONS = [Dumbbell, CheckCircle2, MessageSquare, TrendingUp] as const
const FEATURE_KEYS  = ['training', 'checkin', 'chat', 'finance'] as const

export default function LoginPage() {
  const t = useTranslations('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [checking, setChecking] = useState(true)
  const [mode, setMode]         = useState<'login' | 'forgot' | 'forgotSent'>('login')
  const [forgotEmail, setForgotEmail] = useState('')

  // Validate session server-side using getUser() (not getSession which only reads localStorage).
  // If valid, redirect to dashboard. If stale/expired, show login form.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (user && !error) {
        window.location.replace('/dashboard')
      } else {
        // Clear any stale local session to prevent redirect loops
        supabase.auth.signOut({ scope: 'local' }).finally(() => setChecking(false))
      }
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Role check — only trainers can access the web app
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role !== 'trainer') {
      await supabase.auth.signOut()
      setError('Ova platforma je namijenjena isključivo trenerima. Klijenti koriste mobilnu aplikaciju.')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setMode('forgotSent')
  }

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--app-accent)'
    e.currentTarget.style.boxShadow   = '0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent)'
    e.currentTarget.style.backgroundColor = '#fff'
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = ''
    e.currentTarget.style.boxShadow   = ''
    e.currentTarget.style.backgroundColor = ''
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fb]">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: dark branding panel ── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col relative overflow-hidden select-none"
        style={{ background: 'linear-gradient(160deg, #0d0920 0%, #120b28 60%, #0a0614 100%)' }}>

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

        {/* Content */}
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

          {/* Footer */}
          <p className="text-white/25 text-[11px]">© 2026 UnitLift · unitlift.com</p>
        </div>
      </div>

      {/* ── RIGHT: login form ── */}
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

        {/* Centered form */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-12">
          <div className="w-full max-w-[440px] my-auto">

            {/* Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_32px_rgba(0,0,0,0.07)] px-9 py-10 space-y-7">

              {/* Logo + heading */}
              <div className="space-y-5">
                {/* Logo row — desktop only */}
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
                    {mode === 'login' ? t('welcomeTitle')
                      : mode === 'forgot' ? t('forgotTitle')
                      : t('forgotSentTitle')}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1.5">
                    {mode === 'login' ? t('welcomeSubtitle')
                      : mode === 'forgot' ? t('forgotSubtitle')
                      : t('forgotSentDesc')}
                  </p>
                </div>
              </div>

              {/* ── Login form ── */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-5">
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
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="block text-sm font-semibold text-gray-700">{t('password')}</label>
                      <button type="button"
                        onClick={() => { setMode('forgot'); setForgotEmail(email); setError('') }}
                        className="text-xs font-semibold transition-all hover:underline"
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
                        onFocus={inputFocus} onBlur={inputBlur}
                        className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-300 bg-gray-50/80"
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100">
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                      <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                      <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit" disabled={loading}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px color-mix(in srgb, var(--app-accent) 35%, transparent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
                    onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
                  >
                    {loading ? <><Loader2 size={16} className="animate-spin" />{t('loading')}</> : t('submit')}
                  </button>
                </form>
              )}

              {/* ── Forgot password form ── */}
              {mode === 'forgot' && (
                <form onSubmit={handleForgot} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700">{t('email')}</label>
                    <input
                      id="forgot-email" type="email" value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder={t('placeholderEmail')}
                      autoComplete="email"
                      required
                      onFocus={inputFocus} onBlur={inputBlur}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-300 bg-gray-50/80"
                    />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                      <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                      <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit" disabled={loading}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px color-mix(in srgb, var(--app-accent) 35%, transparent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
                    onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
                  >
                    {loading ? <><Loader2 size={16} className="animate-spin" />{t('forgotLoading')}</> : t('forgotSubmit')}
                  </button>
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="w-full text-center text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                    ← {t('backToLogin')}
                  </button>
                </form>
              )}

              {/* ── Forgot sent confirmation ── */}
              {mode === 'forgotSent' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}>
                    <CheckCircle2 size={28} style={{ color: 'var(--app-accent)' }} />
                  </div>
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                    onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.transform = '' }}
                  >
                    ← {t('backToLogin')}
                  </button>
                </div>
              )}

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

            {/* Register link */}
            <p className="text-center text-xs text-gray-400 mt-5">
              Nemaš račun?{' '}
              <Link href="/register" className="font-semibold transition-colors hover:underline" style={{ color: 'var(--app-accent)' }}>
                Kreiraj račun
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
