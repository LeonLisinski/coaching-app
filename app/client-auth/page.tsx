'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Loader2, Lock, Smartphone, ShieldCheck } from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'
import LocaleSwitcher from '@/components/locale-switcher'

type Phase = 'loading' | 'invalid' | 'form' | 'success'

function ClientAuthForm() {
  const t = useTranslations('clientAuth')
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showCfm, setShowCfm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const establishSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setPhase('form')
      return true
    }

    if (typeof window === 'undefined') return false

    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code)
      if (!exErr) {
        window.history.replaceState(null, '', `${url.pathname}${url.hash}`)
        const { data: { session: s2 } } = await supabase.auth.getSession()
        if (s2) {
          setPhase('form')
          return true
        }
      }
    }

    const hash = window.location.hash?.replace(/^#/, '')
    if (hash) {
      const p = new URLSearchParams(hash)
      const access_token = p.get('access_token')
      const refresh_token = p.get('refresh_token')
      if (access_token && refresh_token) {
        const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token })
        if (!sErr) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
          setPhase('form')
          return true
        }
      }
    }

    const token_hash = searchParams.get('token_hash') ?? url.searchParams.get('token_hash')
    const rawType = searchParams.get('type') ?? url.searchParams.get('type')
    if (token_hash && rawType) {
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash,
        type: rawType as 'recovery' | 'invite' | 'signup' | 'email',
      })
      if (!vErr) {
        window.history.replaceState(null, '', url.pathname)
        setPhase('form')
        return true
      }
    }

    const { data: { session: s3 } } = await supabase.auth.getSession()
    if (s3) {
      setPhase('form')
      return true
    }

    return false
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await establishSession()
      if (cancelled) return
      if (!ok) setPhase('invalid')
    })()
    return () => { cancelled = true }
  }, [establishSession])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(t('errWeak'))
      return
    }
    if (password !== confirm) {
      setError(t('errMismatch'))
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) {
      setError(t('errGeneric'))
      return
    }
    await supabase.auth.signOut()
    setPhase('success')
  }

  const inputCls =
    'w-full h-12 px-4 pr-11 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/25'

  if (phase === 'loading') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-[#06040f]">
        <Loader2 className="w-9 h-9 animate-spin text-white/30" aria-hidden />
        <p className="mt-4 text-sm text-white/45">{t('verifying')}</p>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-[#06040f]">
        <div className="absolute top-4 right-4">
          <LocaleSwitcher />
        </div>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm">
          <p className="text-white/90 text-sm leading-relaxed">{t('invalidLink')}</p>
        </div>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-[#06040f]">
        <div className="absolute top-4 right-4">
          <LocaleSwitcher />
        </div>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-32 w-[420px] h-[420px] rounded-full opacity-25 blur-3xl bg-[var(--app-accent)]" />
          <div className="absolute bottom-0 -left-24 w-[320px] h-[320px] rounded-full opacity-10 blur-3xl bg-violet-500" />
        </div>
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur-md text-center">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--app-accent) 22%, transparent)' }}
          >
            <Smartphone className="w-8 h-8 text-[var(--app-accent)]" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t('successTitle')}</h1>
          <p className="mt-3 text-sm text-white/65 leading-relaxed">{t('successBody')}</p>
          <p className="mt-5 text-xs text-white/45 leading-relaxed border-t border-white/10 pt-5">{t('successHint')}</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-medium text-white/35 uppercase tracking-wider">
            <ShieldCheck size={14} className="text-emerald-400/80" />
            {t('secureNote')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10 bg-[#06040f]">
      <div className="absolute top-4 right-4 z-10">
        <LocaleSwitcher />
      </div>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full opacity-30 blur-3xl bg-[var(--app-accent)]" />
        <div className="absolute bottom-0 -left-24 w-[360px] h-[360px] rounded-full opacity-12 blur-3xl bg-indigo-500" />
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
            style={{ backgroundColor: 'var(--app-accent)', boxShadow: '0 8px 32px color-mix(in srgb, var(--app-accent) 35%, transparent)' }}
          >
            <UnitLiftLogo fill="white" tight={false} className="w-8 h-8" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{t('cardBadge')}</span>
          <h1 className="mt-2 text-2xl font-semibold text-white tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-sm text-white/55 leading-relaxed max-w-sm">{t('subtitle')}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="ca-pw" className="block text-xs font-semibold uppercase tracking-wide text-white/45 mb-2">
                {t('passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="ca-pw"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 p-1.5 rounded-lg"
                  aria-label={showPwd ? 'Hide' : 'Show'}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="ca-cf" className="block text-xs font-semibold uppercase tracking-wide text-white/45 mb-2">
                {t('confirmLabel')}
              </label>
              <div className="relative">
                <input
                  id="ca-cf"
                  type={showCfm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCfm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 p-1.5 rounded-lg"
                  aria-label={showCfm ? 'Hide' : 'Show'}
                >
                  {showCfm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-200/90">
                <span className="text-red-400 text-xs mt-0.5">⚠</span>
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--app-accent)',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--app-accent) 35%, transparent)',
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock size={16} />}
              {loading ? t('saving') : t('submit')}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-6 text-[11px] text-white/40">
            <Lock size={12} />
            <span>{t('secureNote')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClientAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-[#06040f]">
          <Loader2 className="w-9 h-9 animate-spin text-white/30" />
        </div>
      }
    >
      <ClientAuthForm />
    </Suspense>
  )
}
