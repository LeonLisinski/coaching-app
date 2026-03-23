'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Lock, Shield, CheckCircle2, Loader2 } from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'

function ResetPasswordForm() {
  const t = useTranslations('login')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [showCfm, setShowCfm]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type')

    if (!token_hash || type !== 'recovery') {
      setError(t('resetErrorInvalid'))
      setVerifying(false)
      return
    }

    supabase.auth
      .verifyOtp({ token_hash, type: 'recovery' })
      .then(({ error }) => {
        if (error) setError(t('resetErrorInvalid'))
        setVerifying(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor      = 'var(--app-accent)'
    e.currentTarget.style.boxShadow        = '0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent)'
    e.currentTarget.style.backgroundColor  = '#fff'
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor      = ''
    e.currentTarget.style.boxShadow        = ''
    e.currentTarget.style.backgroundColor  = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8)      { setError(t('resetErrorWeak'));     return }
    if (password !== confirm)      { setError(t('resetErrorMismatch')); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
    setTimeout(() => router.replace('/dashboard'), 2500)
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fb]">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: branding panel ── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col relative overflow-hidden select-none"
        style={{ background: 'linear-gradient(160deg, #0d0920 0%, #120b28 60%, #0a0614 100%)' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-25 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
          <div className="absolute bottom-0 -left-24 w-[360px] h-[360px] rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: 'var(--app-accent)' }} />
        </div>
        <div className="relative z-10 flex flex-col justify-between h-full px-12 py-12">
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
          <div>
            <h1 className="text-[2.6rem] font-black text-white leading-[1.1] tracking-tight">
              Novi početak,<br />
              nova <span style={{ color: 'var(--app-accent)' }}>lozinka.</span>
            </h1>
            <p className="text-white/40 text-sm mt-4 leading-relaxed max-w-[290px]">
              Postavi novu lozinku i nastavi tamo gdje si stao.
            </p>
          </div>
          <p className="text-white/25 text-[11px]">© 2026 UnitLift · unitlift.com</p>
        </div>
      </div>

      {/* ── RIGHT: form ── */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#f7f8fb' }}>
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
                    {success ? t('forgotSentTitle') : t('resetTitle')}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1.5">
                    {success ? t('resetSuccess') : t('resetSubtitle')}
                  </p>
                </div>
              </div>

              {/* Success state */}
              {success && (
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--app-accent) 12%, transparent)' }}>
                  <CheckCircle2 size={28} style={{ color: 'var(--app-accent)' }} />
                </div>
              )}

              {/* Error (invalid link) — no form */}
              {!success && error && !password && !confirm && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                    <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                    <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                  </div>
                  <button
                    onClick={() => router.replace('/login')}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                  >
                    ← {t('backToLogin')}
                  </button>
                </div>
              )}

              {/* Password form */}
              {!success && !(error && !password && !confirm) && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700">
                      {t('resetNewPassword')}
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
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
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700">
                      {t('resetConfirmPassword')}
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showCfm ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        onFocus={inputFocus} onBlur={inputBlur}
                        className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none transition-all duration-150 placeholder:text-gray-300 bg-gray-50/80"
                      />
                      <button type="button" onClick={() => setShowCfm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100">
                        {showCfm ? <EyeOff size={15} /> : <Eye size={15} />}
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
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" />{t('resetLoading')}</>
                      : t('resetSubmit')
                    }
                  </button>
                </form>
              )}

              {/* Trust row */}
              {!success && (
                <div className="flex items-center justify-center gap-6 pt-1 border-t border-gray-50">
                  {([{ icon: Lock, key: 'secureLogin' }, { icon: Shield, key: 'gdpr' }] as const).map(({ icon: Icon, key }) => (
                    <div key={key} className="flex items-center gap-1.5 text-gray-400">
                      <Icon size={12} />
                      <span className="text-xs font-medium">{t(key)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fb]">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
