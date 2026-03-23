'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertTriangle, Clock, CreditCard, XCircle } from 'lucide-react'

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

const FEATURES_COMMON = [
  'Planovi treninga i prehrane',
  'Prati što ti je važno — koraci, san, težina, raspoloženje',
  'Chat s klijentima',
  'Mobilna app za klijente (besplatna)',
  'Vidi odmah tko je platio i koliko si zaradio',
]

const PLANS = [
  {
    key:     'starter',
    label:   'STARTER',
    price:   29,
    clients: 'Do 15 klijenata',
    popular: false,
    feats:   ['Do 15 aktivnih klijenata'],
    note:    null,
  },
  {
    key:     'pro',
    label:   'PRO',
    price:   59,
    clients: 'Do 50 klijenata',
    popular: true,
    feats:   ['Do 50 aktivnih klijenata', 'Vlastiti logo i boje u klijentskoj app'],
    note:    null,
  },
  {
    key:     'scale',
    label:   'SCALE',
    price:   99,
    clients: 'Do 150 klijenata',
    popular: false,
    feats:   ['Do 150 aktivnih klijenata', 'Vlastiti logo i boje u klijentskoj app'],
    note:    'Više od 150 klijenata? +€10/mj za svakih dodatnih 25.',
  },
]

const Chk = () => (
  <span style={{
    width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 2,
    background: 'rgba(68,204,136,.13)', border: '1px solid rgba(68,204,136,.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '.58rem', color: GREEN,
  }}>✓</span>
)

type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'locked' | null

const STATUS_BANNER: Record<NonNullable<SubStatus>, { icon: React.ReactNode; bg: string; border: string; text: string; label: string; sub: string }> = {
  trialing: {
    icon: <Clock size={16} color="#d97706" />,
    bg: '#fffbeb', border: '#fde68a', text: '#92400e',
    label: 'Probni period je završio',
    sub: 'Odaberi plan da nastaviš koristiti UnitLift bez prekida.',
  },
  past_due: {
    icon: <CreditCard size={16} color="#dc2626" />,
    bg: '#fef2f2', border: '#fecaca', text: '#991b1b',
    label: 'Neuspjela naplata',
    sub: 'Nismo uspjeli naplatiti pretplatu. Odaberi plan i ažuriraj platnu karticu da nastaviš.',
  },
  canceled: {
    icon: <XCircle size={16} color="#6b7280" />,
    bg: '#f9fafb', border: '#e5e7eb', text: '#374151',
    label: 'Pretplata je otkazana',
    sub: 'Tvoja pretplata je istekla. Aktiviraj novi plan da nastaviš s radom.',
  },
  locked: {
    icon: <AlertTriangle size={16} color="#dc2626" />,
    bg: '#fef2f2', border: '#fecaca', text: '#991b1b',
    label: 'Račun je privremeno zaključan',
    sub: 'Pretplata nije plaćena. Aktiviraj plan za povratak pristupa.',
  },
  active: {
    icon: null, bg: '', border: '', text: '',
    label: '', sub: '',
  },
}

export default function ChoosePlanPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [subStatus, setSubStatus] = useState<SubStatus>(null)
  const [subLoading, setSubLoading] = useState(true)

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
      setSubLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectPlan = async (planKey: string) => {
    setLoading(planKey)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Greška pri kreiranju pretplate.'); setLoading(null); return }
      window.location.href = data.checkout_url
    } catch {
      setError('Greška pri spajanju na server.')
      setLoading(null)
    }
  }

  return (
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

          {/* Headline */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, color: NAVY, lineHeight: 1.1, margin: '0 0 10px' }}>
              {subLoading ? ' ' : subStatus ? 'Odaberi plan za nastavak' : 'Odaberi plan za početak'}
            </h1>
            <p style={{ fontSize: '.9rem', color: '#6b7a99', margin: 0 }}>
              Aktiviraj pretplatu i nastavi s radom. Otkaži kad hoćeš — bez skrivenih troškova.
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
                      Najpopularniji
                    </div>
                  )}

                  {/* Plan name */}
                  <div style={{ fontSize: '.75rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: BLUE, marginBottom: 10 }}>
                    {plan.label}
                  </div>

                  {/* Price */}
                  <div style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: NAVY, marginBottom: 4 }}>
                    €{plan.price}<span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: .55, letterSpacing: 0 }}>/mj</span>
                  </div>

                  {/* Clients */}
                  <div style={{ fontSize: '.8rem', color: '#6b7a99', marginBottom: 22 }}>{plan.clients}</div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#e2e8f0', marginBottom: 20 }} />

                  {/* Features */}
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                    {[...plan.feats, ...FEATURES_COMMON].map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: '.86rem', color: NAVY, lineHeight: 1.4 }}>
                        <Chk />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {plan.note && (
                    <p style={{ fontSize: '.75rem', color: '#6b7a99', textAlign: 'center', lineHeight: 1.5, marginBottom: 12 }}>
                      {plan.note}
                    </p>
                  )}

                  {/* CTA */}
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
                      ? <><Loader2 size={15} className="animate-spin" /> Učitavanje...</>
                      : 'Aktiviraj plan →'
                    }
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer note */}
          <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: 16, paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ color: '#6b7a99', fontSize: '0.9rem', margin: 0 }}>
              Naplata počinje odmah · Otkaži kad hoćeš · Bez skrivenih troškova
            </p>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af', margin: 0 }}>
              Pogrešan račun?{' '}
              <button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })}
                style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', padding: 0 }}>
                Prijavi se drugim računom
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
  )
}
