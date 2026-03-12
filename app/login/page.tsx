'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Users, Dumbbell, UtensilsCrossed, BarChart2, Shield, Lock } from 'lucide-react'
import UnitLiftLogo from '@/app/components/unitlift-logo'

const FEATURES = [
  { icon: Users,           text: 'Upravljanje klijentima i napretkom' },
  { icon: Dumbbell,        text: 'Trening planovi s drag & drop editorom' },
  { icon: UtensilsCrossed, text: 'Prehrana, makrosi i recepti' },
  { icon: BarChart2,       text: 'Financije, paketi i izvještaji' },
]

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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left panel: always dark, accent color as glow ── */}
      <div
        className="hidden lg:flex lg:w-[38%] flex-col justify-between px-10 py-10 relative overflow-hidden"
        style={{ backgroundColor: '#0d0818' }}
      >
        {/* Accent glow blobs — purely decorative, always readable text */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ backgroundColor: 'var(--app-accent)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 -translate-x-1/3 translate-y-1/3 rounded-full opacity-15 blur-2xl pointer-events-none"
          style={{ backgroundColor: 'var(--app-accent)' }} />
        <div className="absolute top-1/2 right-0 w-40 h-40 opacity-10 blur-xl pointer-events-none"
          style={{ backgroundColor: 'var(--app-accent)' }} />

        {/* Top: compact brand mark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center select-none border"
            style={{ backgroundColor: 'var(--app-accent)', borderColor: 'var(--app-accent-hover)' }}>
            <span className="text-white font-black text-sm leading-none" style={{ letterSpacing: '-0.05em' }}>UL</span>
          </div>
          <div>
            <p className="text-white font-black text-sm leading-none tracking-tight">UnitLift</p>
            <p className="text-white/40 text-[10px] mt-0.5 tracking-wide uppercase font-medium">Coaching Platform</p>
          </div>
        </div>

        {/* Middle: large wordmark + hero text */}
        <div className="relative z-10 space-y-7">
          {/* Full wordmark shown large — this is where it looks great */}
          <UnitLiftLogo fill="white" className="w-44 opacity-90" tight={true} />

          <div>
            <h1 className="text-2xl font-bold text-white leading-snug">
              Upravljanje klijentima,<br />
              planovima i napretkom<br />
              na jednom mjestu.
            </h1>
            <p className="text-white/50 text-sm mt-3 leading-relaxed">
              Jednostavan pristup UnitLift platformi za osobne trenere.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="space-y-2.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--app-accent) 30%, transparent)' }}>
                  <Icon size={10} className="text-white/80" />
                </div>
                <p className="text-white/65 text-xs leading-tight">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/20 text-[11px]">© 2026 UnitLift · unitlift.com</p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col bg-gray-50">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center select-none"
              style={{ backgroundColor: 'var(--app-accent)' }}>
              <span className="text-white font-black text-sm leading-none" style={{ letterSpacing: '-0.05em' }}>UL</span>
            </div>
            <span className="font-black text-sm tracking-tight text-gray-900">UnitLift</span>
          </div>
        </header>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[460px]">

            {/* Desktop heading */}
            <div className="hidden lg:block mb-8">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center select-none shadow-md"
                  style={{ backgroundColor: 'var(--app-accent)' }}>
                  <span className="text-white font-black text-base leading-none" style={{ letterSpacing: '-0.05em' }}>UL</span>
                </div>
                <span className="font-black text-sm tracking-tight text-gray-400 uppercase">UnitLift</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Dobrodošli natrag</h2>
              <p className="text-gray-500 text-sm mt-1.5">Prijavite se za pristup UnitLift platformi.</p>
            </div>

            {/* Mobile heading */}
            <div className="lg:hidden text-center mb-8">
              <h2 className="text-xl font-bold text-gray-900">Dobrodošli natrag</h2>
              <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
            </div>

            {/* Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <form onSubmit={handleLogin} className="space-y-5">

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700">{t('email')}</label>
                  <input
                    id="email" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('placeholderEmail')}
                    required
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 bg-white"
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--app-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--app-accent-muted)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700">{t('password')}</label>
                    <button type="button" className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--app-accent)' }}>
                      Zaboravljena lozinka?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password" type={showPwd ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t('placeholderPassword')}
                      required
                      className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-300 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 bg-white"
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--app-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--app-accent-muted)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                    <span className="text-red-500 text-xs mt-0.5 shrink-0">⚠</span>
                    <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit" disabled={loading}
                  className="w-full h-11 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                  style={{ backgroundColor: 'var(--app-accent)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--app-accent-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--app-accent)')}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('loading')}
                    </>
                  ) : (
                    'Prijava'
                  )}
                </button>
              </form>

              {/* Trust badges */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center gap-6 justify-center">
                  {[
                    { icon: Lock,   label: 'Sigurna prijava' },
                    { icon: Shield, label: 'GDPR usklađeno' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-gray-400">
                      <Icon size={12} />
                      <span className="text-xs">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-gray-400 mt-5">
              Nemaš pristup? Kontaktiraj administratora.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
