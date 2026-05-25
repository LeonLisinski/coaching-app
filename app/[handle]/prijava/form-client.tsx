'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { CheckCircle2, AlertCircle } from 'lucide-react'

type Question = {
  id: string
  order_index: number
  type: string
  label: string
  label_en: string | null
  required: boolean
  options: string[] | null
}

type Props = {
  formId: string
  trainerId: string
  title: string
  titleEn: string | null
  description: string | null
  descriptionEn: string | null
  accentColor: string
  photoUrl: string | null
  trainerName: string
  questions: Question[]
}

const UI_STRINGS = {
  hr: {
    submit: 'Pošalji prijavu',
    submitting: 'Slanje…',
    thankYou: 'Hvala na prijavi!',
    thankYouSub: 'Trener će te kontaktirati u najkraćem mogućem roku.',
    requiredError: (label: string) => `Molimo odgovori na obavezno pitanje: "${label}"`,
    networkError: 'Nešto je pošlo po krivu. Pokušaj ponovo.',
    emailPlaceholder: 'tvoj@email.com',
    phonePlaceholder: '+385 99 123 4567',
    yes: 'Da',
    no: 'Ne',
  },
  en: {
    submit: 'Submit',
    submitting: 'Sending…',
    thankYou: 'Thank you!',
    thankYouSub: 'Your trainer will get back to you as soon as possible.',
    requiredError: (label: string) => `Please answer the required question: "${label}"`,
    networkError: 'Something went wrong. Please try again.',
    emailPlaceholder: 'your@email.com',
    phonePlaceholder: '+1 555 123 4567',
    yes: 'Yes',
    no: 'No',
  },
}

export default function LeadFormClient({
  formId, trainerId, title, titleEn, description, descriptionEn, accentColor, photoUrl, trainerName, questions,
}: Props) {
  const [lang, setLang] = useState<'hr' | 'en'>('hr')

  // globals.css sets overflow:hidden on html/body for the PWA dashboard —
  // override it here so this public page can scroll normally
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'auto'
    body.style.overflow = 'auto'
    return () => {
      html.style.overflow = ''
      body.style.overflow = ''
    }
  }, [])
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const t = UI_STRINGS[lang]
  const accent = accentColor || '#7c3aed'
  const accentLight = accent + '18'
  const accentMed   = accent + '33'

  // Fallback both ways: EN picks EN or falls back to HR; HR picks HR or falls back to EN
  const displayTitle = lang === 'en' ? (titleEn || title) : (title || titleEn || '')
  const displayDesc  = lang === 'en' ? (descriptionEn || description) : (description || descriptionEn || null)

  const qLabel = (q: Question) =>
    lang === 'en' ? (q.label_en || q.label) : (q.label || q.label_en || '')

  // Answers are always keyed by the Croatian label for consistent storage
  const setValue = (key: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  const toggleMulti = (key: string, option: string) => {
    const current = (answers[key] as string[]) || []
    setValue(key, current.includes(option) ? current.filter(x => x !== option) : [...current, option])
  }

  const validate = () => {
    for (const q of questions) {
      if (!q.required) continue
      const val = answers[q.label]
      if (!val || (Array.isArray(val) ? val.length === 0 : val.trim() === '')) {
        return t.requiredError(qLabel(q))
      }
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSubmitting(true)
    try {
      // Build answers keyed by question id for storage
      const res = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: formId, trainer_id: trainerId, answers, honeypot }),
      })
      if (!res.ok) throw new Error('Submit failed')
      setSubmitted(true)
    } catch {
      setError(t.networkError)
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestion = (q: Question) => {
    const key = q.label
    const val = answers[key]
    const inputBase = `w-full px-4 py-3 rounded-xl border-2 text-gray-900 text-sm outline-none transition-all bg-white`
    const inputStyle = { borderColor: '#e5e7eb' }
    const focusStyle = { borderColor: accent, boxShadow: `0 0 0 3px ${accentLight}` }

    switch (q.type) {
      case 'short_text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <input
            type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : q.type === 'number' ? 'number' : 'text'}
            value={(val as string) || ''}
            onChange={e => setValue(key, e.target.value)}
            className={inputBase}
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
            placeholder={q.type === 'email' ? t.emailPlaceholder : q.type === 'phone' ? t.phonePlaceholder : ''}
          />
        )

      case 'long_text':
        return (
          <textarea
            value={(val as string) || ''}
            onChange={e => setValue(key, e.target.value)}
            rows={4}
            className={`${inputBase} resize-none`}
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={(val as string) || ''}
            onChange={e => setValue(key, e.target.value)}
            className={inputBase}
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
          />
        )

      case 'yes_no':
        return (
          <div className="flex gap-3">
            {[t.yes, t.no].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setValue(key, opt)}
                className="flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all"
                style={{
                  borderColor: val === opt ? accent : '#e5e7eb',
                  backgroundColor: val === opt ? accentLight : 'white',
                  color: val === opt ? accent : '#6b7280',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )

      case 'single_choice':
        return (
          <div className="space-y-2">
            {(q.options || []).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setValue(key, opt)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-3"
                style={{
                  borderColor: val === opt ? accent : '#e5e7eb',
                  backgroundColor: val === opt ? accentLight : 'white',
                  color: val === opt ? accent : '#374151',
                }}
              >
                <span
                  className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: val === opt ? accent : '#d1d5db' }}
                >
                  {val === opt && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />}
                </span>
                {opt}
              </button>
            ))}
          </div>
        )

      case 'multi_choice':
        return (
          <div className="space-y-2">
            {(q.options || []).map(opt => {
              const selected = ((val as string[]) || []).includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleMulti(key, opt)}
                  className="w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-3"
                  style={{
                    borderColor: selected ? accent : '#e5e7eb',
                    backgroundColor: selected ? accentLight : 'white',
                    color: selected ? accent : '#374151',
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-lg border-2 shrink-0 flex items-center justify-center"
                    style={{ borderColor: selected ? accent : '#d1d5db', backgroundColor: selected ? accent : 'transparent' }}
                  >
                    {selected && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
        )

      default:
        return null
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentLight }}>
            <CheckCircle2 size={32} style={{ color: accent }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.thankYou}</h2>
          <p className="text-gray-500 text-sm">{t.thankYouSub}</p>
          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-center gap-2">
            <span className="text-xs text-gray-400">Powered by</span>
            <span className="text-xs font-black text-gray-600 tracking-tight">UnitLift</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${accent}dd, ${accent}88)` }}>
            {/* UnitLift logo + language toggle */}
            <div className="absolute top-3 right-4 flex items-center gap-2">
              {/* Language toggle */}
              <div className="flex rounded-lg overflow-hidden bg-white/20 border border-white/30">
                {(['hr', 'en'] as const).map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors"
                    style={{
                      backgroundColor: lang === l ? 'rgba(255,255,255,0.9)' : 'transparent',
                      color: lang === l ? accent : 'rgba(255,255,255,0.8)',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center bg-white/20">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
                <span className="text-white/80 text-[11px] font-bold tracking-tight">UnitLift</span>
              </div>
            </div>

            {photoUrl && (
              <div className="absolute -bottom-10 left-6">
                <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-gray-100">
                  <Image src={photoUrl} alt={trainerName} width={80} height={80} className="object-cover w-full h-full" />
                </div>
              </div>
            )}
          </div>

          <div className={`px-6 pb-6 ${photoUrl ? 'pt-12' : 'pt-6'}`}>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{displayTitle || 'Prijavna forma'}</h1>
            {!photoUrl && <p className="text-sm text-gray-500 mt-0.5">{trainerName}</p>}
            {photoUrl && <p className="text-xs text-gray-400 mt-1">{trainerName}</p>}
            {displayDesc && (
              <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{displayDesc}</p>
            )}
          </div>
        </div>

        {/* Questions form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="website_url"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
          />

          {questions.map(q => (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                {qLabel(q)}
                {q.required && <span className="ml-1" style={{ color: accent }}>*</span>}
              </label>
              {renderQuestion(q)}
            </div>
          ))}

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl text-white text-base font-bold transition-all shadow-md disabled:opacity-70"
            style={{ backgroundColor: accent, boxShadow: `0 4px 14px ${accentMed}` }}
          >
            {submitting ? t.submitting : t.submit}
          </button>

          <p className="text-center text-xs text-gray-400 pb-4">
            Powered by <span className="font-black text-gray-500">UnitLift</span>
          </p>
        </form>
      </div>
    </div>
  )
}
