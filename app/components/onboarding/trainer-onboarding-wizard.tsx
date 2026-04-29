'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { edgeFunctionUrl } from '@/lib/supabase-edge'
import { writeOnboardingComplete } from '@/lib/trainer-onboarding-storage'

type Step = 1 | 2 | 3

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinished: () => void
}

export default function TrainerOnboardingWizard({ open, onOpenChange, onFinished }: Props) {
  const t = useTranslations('onboarding.wizard')
  const dismissOnce = useRef(false)
  const [step, setStep] = useState<Step>(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const resetAndClose = () => {
    setStep(1)
    setFullName('')
    setEmail('')
    setError('')
    setSubmitting(false)
    onOpenChange(false)
  }

  const handleCloseX = () => {
    if (dismissOnce.current) return
    dismissOnce.current = true
    writeOnboardingComplete()
    resetAndClose()
    onFinished()
    queueMicrotask(() => { dismissOnce.current = false })
  }

  const goStep3 = () => {
    setStep(3)
    setError('')
  }

  const handleSkipStep2 = () => {
    goStep3()
  }

  const handleNextStep2 = async () => {
    setError('')
    if (!fullName.trim() || !email.trim()) {
      setError(t('errRequired'))
      return
    }
    setSubmitting(true)
    try {
      const { data: { user: trainer } } = await supabase.auth.getUser()
      if (!trainer) {
        setError(t('errNotLoggedIn'))
        setSubmitting(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError(t('errSession'))
        setSubmitting(false)
        return
      }
      const response = await fetch(
        edgeFunctionUrl('create-client'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            trainer_id: trainer.id,
            email: email.trim(),
            full_name: fullName.trim(),
            goal: null,
            date_of_birth: null,
            weight: null,
            height: null,
            gender: null,
            activity_level: null,
            notes: null,
          }),
        },
      )
      const result = await response.json() as {
        error?: string
        message?: string
      }
      if (result.error) {
        const friendly: Record<string, string> = {
          ALREADY_CLIENT: 'Ova osoba je već tvoj aktivni klijent.',
          HAS_ACTIVE_TRAINER: 'Ova osoba trenutno aktivno trenira s drugim trenerom.',
          SELF_AS_CLIENT: 'Ne možeš dodati sam sebe kao klijenta.',
          CLIENT_LIMIT_REACHED: 'Dosegnut je limit klijenata na tvom planu.',
        }
        setError(friendly[result.error] ?? result.message ?? result.error)
        setSubmitting(false)
        return
      }
      goStep3()
    } catch {
      setError(t('errConnection'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenDashboard = () => {
    if (dismissOnce.current) return
    dismissOnce.current = true
    writeOnboardingComplete()
    resetAndClose()
    onFinished()
    queueMicrotask(() => { dismissOnce.current = false })
  }

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900'
    + ' placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/30 focus:border-[var(--app-accent)]'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleCloseX() }}>
      <DialogContent
        className="sm:max-w-md w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
        showCloseButton={false}
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{t('step1Title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('step1Body')}</DialogDescription>

        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, var(--app-accent), var(--app-accent-hover))` }}
        >
          <p className="text-white font-bold text-sm tracking-tight">UnitLift</p>
          <button
            type="button"
            onClick={handleCloseX}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t('closeAria')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 bg-white dark:bg-[oklch(0.165_0.025_264)]">
          {step === 1 && (
            <>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('step1Title')}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{t('step1Body')}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm shadow-md transition-transform active:scale-[0.98]"
                style={{ backgroundColor: 'var(--app-accent)' }}
              >
                {t('ctaStart')}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('step2Title')}</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('step2Hint')}</p>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('step2Name')}</span>
                  <input
                    className={`mt-1 ${inputCls}`}
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('step2Email')}</span>
                  <input
                    className={`mt-1 ${inputCls}`}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleNextStep2}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-semibold text-white text-sm shadow-md transition-transform active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundColor: 'var(--app-accent)' }}
                >
                  {submitting ? t('creating') : t('next')}
                </button>
                <button
                  type="button"
                  onClick={handleSkipStep2}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl font-medium text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  {t('skipForNow')}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('step3Title')}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{t('step3Body')}</p>
              </div>
              <button
                type="button"
                onClick={handleOpenDashboard}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm shadow-md transition-transform active:scale-[0.98]"
                style={{ backgroundColor: 'var(--app-accent)' }}
              >
                {t('openDashboard')}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
