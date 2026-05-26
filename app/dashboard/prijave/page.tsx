'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'
import {
  ClipboardList, Settings2, PhoneCall, UserPlus, Trash2, ChevronDown,
  ChevronUp, Copy, Check, ExternalLink, Plus, GripVertical,
  X, ArrowLeft, Save, Loader2, AlertCircle, CheckCircle2,
  Mail, Phone, User, Eye, EyeOff,
} from 'lucide-react'
import nextDynamic from 'next/dynamic'

const AddClientDialog = nextDynamic(() => import('@/app/dashboard/clients/add-client-dialog'), { ssr: false })
const DateTimePicker  = nextDynamic(() => import('@/app/components/date-time-picker'), { ssr: false })

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}


const FORM_COLORS = [
  '#7c3aed', '#6d28d9', '#2563eb', '#4f46e5', '#0284c7',
  '#0d9488', '#16a34a', '#d97706', '#ea580c', '#dc2626',
  '#ec4899', '#475569',
]

const STATUS_COLORS: Record<string, string> = {
  new:       'bg-violet-100 text-violet-700',
  contacted: 'bg-sky-100 text-sky-700',
  converted: 'bg-emerald-100 text-emerald-700',
  rejected:  'bg-gray-100 text-gray-500',
}

type Question = {
  id: string
  order_index: number
  type: string
  label: string
  label_en: string | null
  required: boolean
  options: string[] | null
}

type FormConfig = {
  id: string
  title: string
  title_en: string | null
  description: string | null
  description_en: string | null
  accent_color: string
  photo_url: string | null
  is_active: boolean
}

type Submission = {
  id: string
  answers: Record<string, unknown>
  status: string
  scheduled_call_at: string | null
  trainer_notes: string | null
  seen: boolean
  created_at: string
}

// ─── Draft question type ────────────────────────────────────────────────────
type DraftQuestion = {
  _key: string
  id?: string
  type: string
  label: string
  label_en: string
  required: boolean
  options: string
}

function makeKey() { return Math.random().toString(36).slice(2) }

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics: š→s, č→c, ž→z, đ→d…
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

// ─── Custom question-type selector ──────────────────────────────────────────
function TypeSelect({
  value, options, isDark, border, textMain, accentHex, onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  isDark: boolean
  border: string
  textMain: string
  accentHex: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
        style={{
          borderColor: open ? accentHex : border,
          background: isDark ? '#0f0f1a' : 'white',
          color: textMain,
          boxShadow: open ? `0 0 0 2px ${accentHex}22` : 'none',
        }}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform"
          style={{ color: accentHex, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 left-0 right-0 rounded-xl border overflow-hidden shadow-lg"
          style={{ background: isDark ? '#1a1a2e' : 'white', borderColor: border }}
        >
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onMouseDown={e => { e.preventDefault(); onChange(opt.value); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                style={{
                  background: isSelected ? accentHex + '18' : 'transparent',
                  color: isSelected ? accentHex : textMain,
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {isSelected && <Check size={11} style={{ color: accentHex }} className="shrink-0" />}
                {!isSelected && <span className="w-[11px] shrink-0" />}
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type LeadRowLabels = {
  statusLabels: Record<string, string>
  scheduledCall: string
  notes: string
  notesPlaceholder: string
  save: string
  saved: string
  convertToClient: string
  deleteSubmission: string
  anonymous: string
  locale: string
  pickDatePlaceholder: string
}

// ─── Lead row ───────────────────────────────────────────────────────────────
function LeadRow({
  sub, accentHex, isDark, labels, onStatusChange, onDelete, onConvert, onClick, isOpen,
}: {
  sub: Submission
  accentHex: string
  isDark: boolean
  labels: LeadRowLabels
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onConvert: (sub: Submission) => void
  onClick: () => void
  isOpen: boolean
}) {
  const [notes, setNotes] = useState(sub.trainer_notes || '')
  const [callDate, setCallDate] = useState(sub.scheduled_call_at ? sub.scheduled_call_at.slice(0, 16) : '')
  const [saving, setSaving] = useState(false)
  const [savedState, setSavedState] = useState(false)

  const cardBg = isDark ? 'oklch(0.195 0.018 264)' : 'white'
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'
  const textMuted = isDark ? '#9ca3af' : '#6b7280'

  const answerEntries = Object.entries(sub.answers || {})
  const emailEntry = answerEntries.find(([k]) => /email/i.test(k))
  const phoneEntry = answerEntries.find(([k]) => /tel|mob|phone/i.test(k))
  const nameEntry  = answerEntries.find(([k]) => /ime|name/i.test(k))
  const previewName = nameEntry ? String(nameEntry[1]) : emailEntry ? String(emailEntry[1]) : labels.anonymous

  const saveDetails = async () => {
    setSaving(true)
    const isoCall = callDate ? new Date(callDate).toISOString() : null
    await supabase.from('lead_submissions').update({
      trainer_notes: notes || null,
      scheduled_call_at: isoCall,
    }).eq('id', sub.id)

    // Sync to trainer_events so the call appears on the calendar
    const { data: { session } } = await supabase.auth.getSession()
    if (session && isoCall) {
      // Upsert: one event per lead_submission_id (match by lead_submission_id)
      const { data: existing } = await supabase
        .from('trainer_events')
        .select('id')
        .eq('lead_submission_id', sub.id)
        .maybeSingle()
      const payload = {
        trainer_id: session.user.id,
        title: `${previewName} – ${labels.scheduledCall}`,
        type: 'call' as const,
        starts_at: isoCall,
        lead_submission_id: sub.id,
      }
      if (existing?.id) {
        await supabase.from('trainer_events').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('trainer_events').insert(payload)
      }
    } else if (session && !isoCall) {
      // Call was cleared → remove the linked event from calendar
      await supabase.from('trainer_events').delete().eq('lead_submission_id', sub.id)
    }

    setSaving(false)
    setSavedState(true)
    setTimeout(() => setSavedState(false), 2000)
  }

  const dateLocale = labels.locale === 'en' ? 'en-GB' : 'hr-HR'

  const formattedDate = new Date(sub.created_at).toLocaleString(dateLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ borderColor: isOpen ? accentHex + '55' : border, background: cardBg }}
    >
      <button
        type="button"
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
        onClick={onClick}
      >
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status]}`}>
          {labels.statusLabels[sub.status] || sub.status}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: isDark ? '#f9fafb' : '#111827' }}>
            {previewName}
          </p>
          {(emailEntry || phoneEntry) && (
            <p className="text-xs truncate" style={{ color: textMuted }}>
              {emailEntry ? String(emailEntry[1]) : ''}{emailEntry && phoneEntry ? ' · ' : ''}{phoneEntry ? String(phoneEntry[1]) : ''}
            </p>
          )}
          <p className="text-[11px] mt-0.5 sm:hidden" style={{ color: textMuted }}>{formattedDate}</p>
        </div>

        <span className="text-xs shrink-0 hidden sm:block" style={{ color: textMuted }}>{formattedDate}</span>
        {isOpen ? <ChevronUp size={15} style={{ color: textMuted }} className="shrink-0" /> : <ChevronDown size={15} style={{ color: textMuted }} className="shrink-0" />}
      </button>

      {isOpen && (
        <div className="border-t px-4 sm:px-5 pb-5 space-y-4 sm:space-y-5" style={{ borderColor: border }}>
          <div className="pt-4 space-y-2.5">
            {answerEntries.map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row sm:gap-3 text-sm">
                <span className="font-medium text-xs sm:text-sm sm:shrink-0 sm:w-36 sm:truncate" style={{ color: textMuted }}>{label}</span>
                <span className="text-sm mt-0.5 sm:mt-0" style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
                  {Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                </span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textMuted }}>Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(labels.statusLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onStatusChange(sub.id, key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${STATUS_COLORS[key]}`}
                  style={sub.status === key ? { outline: `2px solid ${accentHex}`, outlineOffset: '2px' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textMuted }}>{labels.scheduledCall}</p>
            <DateTimePicker
              value={callDate}
              onChange={setCallDate}
              locale={labels.locale}
              isDark={isDark}
              accentHex={accentHex}
              textMain={isDark ? '#e5e7eb' : '#111827'}
              textMuted={textMuted}
              border={border}
              placeholder={labels.pickDatePlaceholder}
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textMuted }}>{labels.notes}</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder={labels.notesPlaceholder}
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
              style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb', color: isDark ? '#e5e7eb' : '#111827' }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={saveDetails}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-70"
              style={{ backgroundColor: accentHex }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : savedState ? <CheckCircle2 size={13} /> : <Save size={13} />}
              {savedState ? labels.saved : labels.save}
            </button>
            <button
              type="button"
              onClick={() => onConvert(sub)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: isDark ? '#e5e7eb' : '#374151' }}
            >
              <UserPlus size={13} />
              {labels.convertToClient}
            </button>
            <button
              type="button"
              onClick={() => onDelete(sub.id)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold text-red-500 transition-all sm:ml-auto"
              style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2' }}
            >
              <Trash2 size={13} />
              {labels.deleteSubmission}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { accent, mode } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const isDark = mode === 'dark'
  const router = useRouter()
  const locale = useLocale()

  const [userId, setUserId]               = useState<string | null>(null)
  const [handle, setHandle]               = useState<string | null | undefined>(undefined)
  const [tab, setTab]                     = useState<'submissions' | 'form'>('submissions')
  const [submissions, setSubmissions]     = useState<Submission[]>([])
  const [openId, setOpenId]               = useState<string | null>(null)
  const [statusFilter, setStatusFilter]   = useState<string>('all')
  const [loading, setLoading]             = useState(true)
  const [pageError, setPageError]         = useState<string | null>(null)

  // Form builder state
  const [formConfig, setFormConfig]       = useState<FormConfig | null>(null)
  const [contentLang, setContentLang]     = useState<'hr' | 'en'>('hr')
  const [draftTitle, setDraftTitle]       = useState('')
  const [draftTitleEn, setDraftTitleEn]   = useState('')
  const [draftDesc, setDraftDesc]         = useState('')
  const [draftDescEn, setDraftDescEn]     = useState('')
  const [draftColor, setDraftColor]       = useState('#7c3aed')
  const [draftActive, setDraftActive]     = useState(true)
  const [draftHandle, setDraftHandle]     = useState('')
  const [draftPhoto, setDraftPhoto]       = useState<string | null>(null)
  const [handleError, setHandleError]     = useState('')
  const [questions, setQuestions]         = useState<DraftQuestion[]>([])
  const [formSaving, setFormSaving]       = useState(false)
  const [formSaved, setFormSaved]         = useState(false)
  const [linkCopied, setLinkCopied]       = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [dragIdx, setDragIdx]             = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx]     = useState<number | null>(null)

  // Handle setup state
  const [handleSetup, setHandleSetup]     = useState('')
  const [handleSetupErr, setHandleSetupErr] = useState('')
  const [handleSetupSaving, setHandleSetupSaving] = useState(false)

  // Convert to client dialog
  const [convertSub, setConvertSub]       = useState<Submission | null>(null)
  const [showAddClient, setShowAddClient] = useState(false)
  const [addClientInit, setAddClientInit] = useState<{ full_name?: string; email?: string; phone?: string }>({})

  const cardBg  = isDark ? 'oklch(0.195 0.018 264)' : 'white'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'
  const textMain = isDark ? '#f9fafb' : '#111827'
  const textMuted = isDark ? '#9ca3af' : '#6b7280'
  const tL = useTranslations('leads')

  const statusLabels: Record<string, string> = {
    new:       tL('statusNew'),
    contacted: tL('statusContacted'),
    converted: tL('statusConverted'),
    rejected:  tL('statusRejected'),
  }

  const rowLabels: LeadRowLabels = {
    statusLabels,
    scheduledCall:   tL('scheduledCall'),
    notes:           tL('notes'),
    notesPlaceholder:tL('notesPlaceholder'),
    save:            tL('save'),
    saved:           tL('saved'),
    locale,
    pickDatePlaceholder: tL('pickDatePlaceholder'),
    convertToClient: tL('convertToClient'),
    deleteSubmission:tL('deleteSubmission'),
    anonymous:       tL('anonymous'),
  }
  const qTypes = [
    { value: 'short_text',    label: tL('typeShortText') },
    { value: 'long_text',     label: tL('typeLongText') },
    { value: 'number',        label: tL('typeNumber') },
    { value: 'email',         label: tL('typeEmail') },
    { value: 'phone',         label: tL('typePhone') },
    { value: 'single_choice', label: tL('typeSingleChoice') },
    { value: 'multi_choice',  label: tL('typeMultiChoice') },
    { value: 'date',          label: tL('typeDate') },
    { value: 'yes_no',        label: tL('typeYesNo') },
  ]

  // ── Auth + data load + real-time ─────────────────────────────────────────
  useEffect(() => {
    // Use a ref so cleanup can always access the channel even if init() is still async
    const channelRef: { current: ReturnType<typeof supabase.channel> | null } = { current: null }
    let cancelled = false

    const init = async () => {
      try {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) { router.push('/login'); return }
      const uid = session.user.id
      setUserId(uid)

      // Get handle + profile avatar + full_name for slug suggestion
      const { data: profile } = await supabase.from('profiles').select('handle, avatar_url, full_name').eq('id', uid).single()
      if (cancelled) return
      setHandle(profile?.handle ?? null)
      if (profile?.avatar_url) setProfileAvatarUrl(profile.avatar_url)

      // Pre-fill handle setup with slugified name if no handle yet
      if (!profile?.handle && profile?.full_name) {
        setHandleSetup(slugify(profile.full_name))
      }

      if (profile?.handle) {
        await loadAll(uid, profile?.avatar_url ?? null)
      }
      if (cancelled) return

      // Real-time: unique channel per trainer to avoid cross-session conflicts
      channelRef.current = supabase
        .channel(`lead-submissions-rt-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'lead_submissions', filter: `trainer_id=eq.${uid}` },
          (payload) => {
            if (cancelled) return
            const newSub = payload.new as Submission
            setSubmissions(prev => prev.length >= 200 ? prev : [newSub, ...prev])
            supabase.from('lead_submissions').update({ seen: true }).eq('id', newSub.id)
          },
        )
        .subscribe()

      setLoading(false)
      } catch (err) {
        console.error('Prijave init error:', err)
        if (!cancelled) {
          setPageError('Greška pri učitavanju prijava. Pokušajte osvježiti stranicu.')
          setLoading(false)
        }
      }
    }
    init()

    return () => {
      cancelled = true
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const loadAll = useCallback(async (uid: string, avatarUrl?: string | null) => {
    const [subsRes, formRes] = await Promise.all([
      supabase.from('lead_submissions')
        .select('id, trainer_id, answers, status, seen, scheduled_call_at, trainer_notes, created_at')
        .eq('trainer_id', uid)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('lead_forms')
        .select('id, trainer_id, title, title_en, description, description_en, accent_color, is_active, photo_url')
        .eq('trainer_id', uid)
        .single(),
    ])
    setSubmissions((subsRes.data || []) as Submission[])

    // Mark all as seen
    const unseenIds = (subsRes.data || []).filter((s: Submission) => !s.seen).map((s: Submission) => s.id)
    if (unseenIds.length) {
      await supabase.from('lead_submissions').update({ seen: true }).in('id', unseenIds)
    }

    if (formRes.data) {
      const f = formRes.data as FormConfig
      setFormConfig(f)
      setDraftTitle(f.title)
      setDraftTitleEn(f.title_en || '')
      setDraftDesc(f.description || '')
      setDraftDescEn(f.description_en || '')
      setDraftColor(f.accent_color)
      setDraftActive(f.is_active)
      // If no custom form photo is set, default to the trainer's profile avatar
      setDraftPhoto(f.photo_url ?? avatarUrl ?? null)

      const { data: qs } = await supabase
        .from('lead_form_questions')
        .select('id, form_id, type, label, label_en, required, options, order_index')
        .eq('form_id', f.id)
        .order('order_index')
      setQuestions(
        (qs || []).map((q: Question) => ({
          _key: makeKey(),
          id: q.id,
          type: q.type,
          label: q.label,
          label_en: q.label_en || '',
          required: q.required,
          options: (q.options || []).join('\n'),
        })),
      )
    }
  }, [])

  // ── Handle setup ──────────────────────────────────────────────────────────
  const saveHandle = async () => {
    const h = handleSetup.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(h)) {
      setHandleSetupErr('Handle smije sadržavati samo mala slova, brojevi i crtice.')
      return
    }
    setHandleSetupSaving(true)
    const { error } = await supabase.from('profiles').update({ handle: h }).eq('id', userId!)
    if (error) {
      setHandleSetupErr(error.message.includes('unique') ? 'Ovaj handle je već zauzet.' : error.message)
      setHandleSetupSaving(false)
      return
    }
    setHandle(h)
    setDraftHandle(h)
    setHandleSetupSaving(false)
    await loadAll(userId!)
    setLoading(false)
  }

  // ── Status change ─────────────────────────────────────────────────────────
  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from('lead_submissions').update({ status }).eq('id', id)
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from('lead_submissions').delete().eq('id', id)
    setSubmissions(prev => prev.filter(s => s.id !== id))
    if (openId === id) setOpenId(null)
  }

  // ── Convert to client ─────────────────────────────────────────────────────
  const handleConvert = (sub: Submission) => {
    const entries = Object.entries(sub.answers || {})
    const emailVal = entries.find(([k]) => /email/i.test(k))?.[1]
    const phoneVal = entries.find(([k]) => /tel|mob|phone/i.test(k))?.[1]
    const nameVal  = entries.find(([k]) => /ime|name|prezime/i.test(k))?.[1]
    setAddClientInit({
      full_name: nameVal ? String(nameVal) : '',
      email:     emailVal ? String(emailVal) : '',
      phone:     phoneVal ? String(phoneVal) : '',
    })
    setConvertSub(sub)
    setShowAddClient(true)
  }

  // ── Form save ─────────────────────────────────────────────────────────────
  const saveForm = async () => {
    if (!userId) return
    const h = draftHandle.trim().toLowerCase()
    if (h && !/^[a-z0-9][a-z0-9-]{0,47}$/.test(h)) {
      setHandleError('Handle smije sadržavati samo mala slova, brojevi i crtice.')
      return
    }
    setHandleError('')
    setFormSaving(true)

    // Upsert handle on profile
    if (h && h !== handle) {
      const { error: hErr } = await supabase.from('profiles').update({ handle: h }).eq('id', userId)
      if (hErr) {
        setHandleError(hErr.message.includes('unique') ? 'Ovaj handle je već zauzet.' : hErr.message)
        setFormSaving(false)
        return
      }
      setHandle(h)
    }

    // Upsert form
    let formId = formConfig?.id
    if (formId) {
      await supabase.from('lead_forms').update({
        title: draftTitle, title_en: draftTitleEn || null,
        description: draftDesc || null, description_en: draftDescEn || null,
        accent_color: draftColor, is_active: draftActive, photo_url: draftPhoto,
        updated_at: new Date().toISOString(),
      }).eq('id', formId)
    } else {
      const { data: newForm } = await supabase.from('lead_forms').insert({
        trainer_id: userId,
        title: draftTitle, title_en: draftTitleEn || null,
        description: draftDesc || null, description_en: draftDescEn || null,
        accent_color: draftColor, is_active: draftActive, photo_url: draftPhoto,
      }).select('id').single()
      formId = newForm?.id
    }

    if (!formId) { setFormSaving(false); return }

    // Strip empty questions before saving
    const validQuestions = questions.filter(q => q.label.trim() !== '')
    setQuestions(validQuestions)

    // Sync questions: delete all + re-insert in order
    await supabase.from('lead_form_questions').delete().eq('form_id', formId)
    if (validQuestions.length) {
      await supabase.from('lead_form_questions').insert(
        validQuestions.map((q, i) => ({
          form_id: formId,
          order_index: i,
          type: q.type,
          label: q.label.trim(),
          label_en: q.label_en.trim() || null,
          required: q.required,
          options: q.type === 'single_choice' || q.type === 'multi_choice'
            ? q.options.split('\n').map(s => s.trim()).filter(Boolean)
            : null,
        })),
      )
    }

    setFormConfig(prev => prev ? {
      ...prev,
      title: draftTitle, title_en: draftTitleEn || null,
      description: draftDesc || null, description_en: draftDescEn || null,
      accent_color: draftColor, is_active: draftActive, photo_url: draftPhoto,
    } : null)
    setFormSaving(false)
    setFormSaved(true)
    setTimeout(() => setFormSaved(false), 2500)
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null)
  const questionsEndRef = useRef<HTMLDivElement>(null)

  const addQuestion = () => {
    setQuestions(prev => [...prev, { _key: makeKey(), type: 'short_text', label: '', label_en: '', required: false, options: '' }])
    // Scroll to new question after render
    requestAnimationFrame(() => {
      setTimeout(() => questionsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    })
  }

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= questions.length) return
    setQuestions(prev => {
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const uploadPhoto = async (file: File) => {
    if (!userId) return
    setPhotoUploading(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    // Unique timestamp path → always a clean INSERT, never hits upsert/conflict RLS
    const path = `${userId}-lead-form-photo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
    if (!error) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      setDraftPhoto(urlData.publicUrl)
    } else {
      console.error('[uploadPhoto]', error.message)
    }
    setPhotoUploading(false)
  }

  const publicUrl = handle
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://app.unitlift.com'}/${handle}/prijava`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const filtered = statusFilter === 'all' ? submissions : submissions.filter(s => s.status === statusFilter)

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: accentHex }} />
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
        <p className="text-red-500 text-sm font-medium">{pageError}</p>
        <button
          onClick={() => { setPageError(null); setLoading(true); window.location.reload() }}
          className="text-sm px-4 py-2 rounded-lg font-semibold text-white"
          style={{ backgroundColor: accentHex }}
        >
          Pokušaj ponovo
        </button>
      </div>
    )
  }

  // ── Render: handle setup ──────────────────────────────────────────────────
  if (handle === null) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <div className="rounded-3xl p-8 border space-y-5" style={{ background: cardBg, borderColor: border }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: accentHex + '20' }}>
            <ClipboardList size={22} style={{ color: accentHex }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: textMain }}>{tL('setupHandleTitle')}</h2>
            <p className="text-sm mt-1" style={{ color: textMuted }}>{tL('setupHandleDesc')}</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>
              {tL('publicLink')}
            </label>
            <div className="flex items-center rounded-xl border-2 overflow-hidden" style={{ borderColor: handleSetupErr ? '#ef4444' : border }}>
              <span className="px-3 py-3 text-xs shrink-0" style={{ color: textMuted, background: isDark ? '#1a1a2e' : '#f9fafb' }}>app.unitlift.com/</span>
              <input
                type="text"
                value={handleSetup}
                onChange={e => { setHandleSetup(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setHandleSetupErr('') }}
                className="flex-1 px-3 py-3 text-sm outline-none font-medium"
                style={{ background: isDark ? '#0f0f1a' : 'white', color: textMain }}
              />
              <span className="px-3 py-3 text-xs shrink-0" style={{ color: textMuted, background: isDark ? '#1a1a2e' : '#f9fafb' }}>/prijava</span>
            </div>
            {handleSetupErr
              ? <p className="text-xs text-red-500 mt-1.5">{handleSetupErr}</p>
              : <p className="text-xs mt-1.5" style={{ color: textMuted }}>
                  {tL('handleHintShort')}
                  {handleSetup && <span className="ml-1" style={{ color: accentHex }}>→ app.unitlift.com/{handleSetup}/prijava</span>}
                </p>
            }
          </div>
          <button
            type="button"
            onClick={saveHandle}
            disabled={!handleSetup || handleSetupSaving}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: accentHex }}
          >
            {handleSetupSaving ? tL('setupHandleSaving') : tL('setupHandleContinue')}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: main ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-6 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accentHex + '20' }}>
            <ClipboardList size={18} style={{ color: accentHex }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold leading-tight truncate" style={{ color: textMain }}>{tL('pageTitle')}</h1>
            <p className="text-xs truncate" style={{ color: textMuted }}>{handle}/prijava</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: border, color: textMain, background: cardBg }}
          >
            {linkCopied ? <Check size={13} style={{ color: accentHex }} /> : <Copy size={13} />}
            <span className="hidden sm:inline">{linkCopied ? tL('linkCopied') : tL('copyLink')}</span>
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: border, color: textMain, background: cardBg }}
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">{tL('preview')}</span>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }}>
        {(['submissions', 'form'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t ? (isDark ? '#1e1e2e' : 'white') : 'transparent',
              color: tab === t ? textMain : textMuted,
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t === 'submissions'
              ? `${tL('tabSubmissions')}${submissions.length ? ` (${submissions.length})` : ''}`
              : tL('tabForm')}
          </button>
        ))}
      </div>

      {/* ── Submissions tab ── */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          {/* Status filter — scrollable on mobile */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-wrap">
            {['all', 'new', 'contacted', 'converted', 'rejected'].map(s => {
              const count = s === 'all' ? submissions.length : submissions.filter(x => x.status === s).length
              const shortLabels: Record<string, string> = {
                all: tL('filterAll'), new: statusLabels.new,
                contacted: statusLabels.contacted,
                converted: locale === 'en' ? 'Converted' : 'Pretvoreni',
                rejected:  statusLabels.rejected,
              }
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all border whitespace-nowrap shrink-0"
                  style={{
                    borderColor: statusFilter === s ? accentHex : border,
                    background: statusFilter === s ? accentHex + '18' : 'transparent',
                    color: statusFilter === s ? accentHex : textMuted,
                  }}
                >
                  {shortLabels[s]} ({count})
                </button>
              )
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ClipboardList size={36} className="mx-auto" style={{ color: accentHex + '60' }} />
              <p className="font-semibold" style={{ color: textMain }}>{tL('noSubmissions')}</p>
              <p className="text-sm" style={{ color: textMuted }}>
                {statusFilter !== 'all' ? tL('noSubmissionsFilter') : tL('noSubmissionsHint')}
              </p>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ backgroundColor: linkCopied ? '#16a34a' : accentHex }}
              >
                {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                {linkCopied ? tL('linkCopied') : tL('copyFormLink')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(sub => (
                <LeadRow
                  key={sub.id}
                  sub={sub}
                  accentHex={accentHex}
                  isDark={isDark}
                  labels={rowLabels}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onConvert={handleConvert}
                  onClick={() => setOpenId(openId === sub.id ? null : sub.id)}
                  isOpen={openId === sub.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Form builder tab ── */}
      {tab === 'form' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Mobile hint */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border sm:hidden"
            style={{ borderColor: accentHex + '40', background: accentHex + '0d' }}>
            <AlertCircle size={15} style={{ color: accentHex }} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed" style={{ color: accentHex }}>
              {locale === 'en'
                ? 'The form builder is easier to use on a desktop. You can still edit here.'
                : 'Graditelj forme je pregledaniji na računalu. Možeš uređivati i ovdje.'}
            </p>
          </div>
          {/* Handle */}
          <div className="rounded-2xl p-5 border space-y-3" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold" style={{ color: textMain }}>{tL('publicLink')}</h3>
            <div className="flex items-center gap-0 rounded-xl border-2 overflow-hidden" style={{ borderColor: handleError ? '#ef4444' : border }}>
              <span className="px-3 py-2.5 text-xs shrink-0" style={{ color: textMuted, background: isDark ? '#1a1a2e' : '#f9fafb' }}>
                {typeof window !== 'undefined' ? window.location.origin : 'https://app.unitlift.com'}/
              </span>
              <input
                type="text"
                value={draftHandle || handle || ''}
                onChange={e => { setDraftHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setHandleError('') }}
                className="flex-1 px-3 py-2.5 text-sm outline-none"
                style={{ background: isDark ? '#0f0f1a' : 'white', color: textMain }}
              />
              <span className="px-3 py-2.5 text-xs shrink-0" style={{ color: textMuted, background: isDark ? '#1a1a2e' : '#f9fafb' }}>/prijava</span>
            </div>
            {handleError && <p className="text-xs text-red-500">{handleError}</p>}
            <p className="text-xs" style={{ color: textMuted }}>{tL('handleHintShort')}</p>
          </div>

          {/* Basic info */}
          <div className="rounded-2xl p-5 border space-y-4" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: textMain }}>{tL('basicInfo')}</h3>
              {/* Content language toggle — controls which language version of the form content you're editing */}
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: textMuted }}>{tL('contentLanguage')}:</span>
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: border }}>
                  {(['hr', 'en'] as const).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setContentLang(l)}
                      className="px-3 py-1 text-xs font-bold uppercase transition-colors"
                      style={{
                        background: contentLang === l ? accentHex : (isDark ? '#1a1a2e' : '#f9fafb'),
                        color: contentLang === l ? 'white' : textMuted,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>
                {tL('formTitle')} ({contentLang.toUpperCase()})
              </label>
              <input
                type="text"
                value={contentLang === 'hr' ? draftTitle : draftTitleEn}
                onChange={e => contentLang === 'hr' ? setDraftTitle(e.target.value) : setDraftTitleEn(e.target.value)}
                placeholder={tL('formTitlePlaceholder')}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb', color: textMain }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>
                {tL('formDescription')} ({contentLang.toUpperCase()})
              </label>
              <textarea
                value={contentLang === 'hr' ? draftDesc : draftDescEn}
                onChange={e => contentLang === 'hr' ? setDraftDesc(e.target.value) : setDraftDescEn(e.target.value)}
                rows={3}
                placeholder={tL('formDescriptionPlaceholder')}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
                style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb', color: textMain }}
              />
            </div>

            {/* Photo */}
            <div className="space-y-2">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>{tL('formPhoto')}</label>
              <div className="flex items-center gap-3 flex-wrap">
                {draftPhoto && (
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border shrink-0" style={{ borderColor: border }}>
                    <img src={draftPhoto} alt="Photo" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setDraftPhoto(null)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      <X size={9} />
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  {/* Use profile photo shortcut */}
                  {profileAvatarUrl && draftPhoto !== profileAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setDraftPhoto(profileAvatarUrl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                      style={{ borderColor: accentHex + '55', color: accentHex, background: accentHex + '0d' }}
                    >
                      <User size={11} />
                      {contentLang === 'en' ? 'Use profile photo' : 'Koristi sliku s profila'}
                    </button>
                  )}
                  {/* Custom upload */}
                  <label
                    htmlFor="lead-form-photo-input"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${photoUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{ borderColor: border, color: textMain }}
                  >
                    {photoUploading
                      ? <><Loader2 size={11} className="animate-spin" />{tL('formPhotoUploading')}</>
                      : tL('formPhotoSelect')}
                  </label>
                </div>
                <input
                  id="lead-form-photo-input"
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  disabled={photoUploading}
                  className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }}
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>{tL('formAccentColor')}</label>
              <div className="flex gap-2 flex-wrap">
                {FORM_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftColor(c)}
                    className="w-7 h-7 rounded-lg transition-all"
                    style={{
                      backgroundColor: c,
                      outline: draftColor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className="relative w-10 h-5 rounded-full transition-all"
                style={{ backgroundColor: draftActive ? accentHex : (isDark ? '#374151' : '#d1d5db') }}
                onClick={() => setDraftActive(v => !v)}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${draftActive ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className="text-sm font-medium" style={{ color: textMain }}>{tL('formActive')}</span>
            </label>
          </div>

          {/* Questions */}
          <div className="rounded-2xl p-5 border space-y-4" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: textMain }}>{tL('questionsCount', { count: questions.length })}</h3>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                style={{ backgroundColor: accentHex }}
              >
                <Plus size={12} />
                {tL('addQuestion')}
              </button>
            </div>

            {questions.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: textMuted }}>{tL('noQuestions')}</p>
            )}

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={q._key}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragIdx === null || dragIdx === idx) return
                    setQuestions(prev => {
                      const next = [...prev]
                      const [moved] = next.splice(dragIdx, 1)
                      next.splice(idx, 0, moved)
                      return next
                    })
                    setDragIdx(null)
                    setDragOverIdx(null)
                  }}
                  className="rounded-xl border p-4 space-y-3 transition-all"
                  style={{
                    borderColor: dragOverIdx === idx && dragIdx !== idx ? accentHex : border,
                    background: isDark ? '#1a1a2e' : '#f9fafb',
                    opacity: dragIdx === idx ? 0.4 : 1,
                    boxShadow: dragOverIdx === idx && dragIdx !== idx ? `0 0 0 2px ${accentHex}44` : 'none',
                    cursor: dragIdx !== null ? 'grabbing' : 'default',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical size={15} style={{ color: textMuted }} className="cursor-grab shrink-0 hidden sm:block" />
                    <span className="text-xs font-bold" style={{ color: accentHex }}>#{idx + 1}</span>
                    {/* Up / down — primary on mobile, also handy on desktop */}
                    <div className="flex items-center gap-0.5 ml-0.5">
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, -1)}
                        disabled={idx === 0}
                        className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-25"
                        style={{ color: textMuted }}
                        title="Pomakni gore"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, 1)}
                        disabled={idx === questions.length - 1}
                        className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-25"
                        style={{ color: textMuted }}
                        title="Pomakni dolje"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <div className="flex-1" />
                    <button type="button" onClick={() => setQuestions(prev => prev.filter((_, i) => i !== idx))}
                      className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-600">
                      <X size={13} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {/* Label input - full width */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold" style={{ color: textMuted }}>
                        {tL('questionLabel')} ({contentLang.toUpperCase()})
                      </label>
                      <input
                        type="text"
                        value={contentLang === 'hr' ? q.label : q.label_en}
                        onChange={e => setQuestions(prev => prev.map((x, i) => i === idx
                          ? { ...x, [contentLang === 'hr' ? 'label' : 'label_en']: e.target.value }
                          : x))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuestion() } }}
                        placeholder={contentLang === 'hr' ? 'npr. Ime i prezime' : 'e.g. Full name'}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{ borderColor: border, background: isDark ? '#0f0f1a' : 'white', color: textMain }}
                        autoFocus={contentLang === 'hr' && idx === questions.length - 1 && q.label === ''}
                      />
                    </div>

                    {/* Type + Required — side by side on all screens */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-semibold" style={{ color: textMuted }}>{tL('questionType')}</label>
                        <TypeSelect
                          value={q.type}
                          options={qTypes}
                          isDark={isDark}
                          border={border}
                          textMain={textMain}
                          accentHex={accentHex}
                          onChange={val => setQuestions(prev => prev.map((x, i) => i === idx ? { ...x, type: val } : x))}
                        />
                      </div>
                      <div className="space-y-1 shrink-0">
                        <label className="text-[11px] font-semibold block" style={{ color: textMuted }}>{tL('questionRequired')}</label>
                        <label className="flex items-center gap-2 cursor-pointer h-9 px-3 rounded-lg border"
                          style={{ borderColor: border, background: isDark ? '#0f0f1a' : 'white' }}>
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={e => setQuestions(prev => prev.map((x, i) => i === idx ? { ...x, required: e.target.checked } : x))}
                            className="w-4 h-4 rounded"
                            style={{ accentColor: accentHex }}
                          />
                          <span className="text-sm" style={{ color: textMain }}>{tL('yes')}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {(q.type === 'single_choice' || q.type === 'multi_choice') && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold" style={{ color: textMuted }}>{tL('questionOptions')}</label>
                      <textarea
                        value={q.options}
                        onChange={e => setQuestions(prev => prev.map((x, i) => i === idx ? { ...x, options: e.target.value } : x))}
                        rows={3}
                        placeholder={contentLang === 'hr' ? 'Opcija 1\nOpcija 2\nOpcija 3' : 'Option 1\nOption 2\nOption 3'}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                        style={{ borderColor: border, background: isDark ? '#0f0f1a' : 'white', color: textMain }}
                      />
                    </div>
                  )}
                </div>
              ))}
              <div ref={questionsEndRef} />
            </div>

            {/* Bottom add button */}
            <button
              type="button"
              onClick={addQuestion}
              className="w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold transition-all flex items-center justify-center gap-2"
              style={{ borderColor: accentHex + '55', color: accentHex }}
            >
              <Plus size={14} />
              {tL('addQuestion')}
            </button>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={saveForm}
            disabled={formSaving}
            className="w-full py-3.5 rounded-2xl text-white text-sm font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ backgroundColor: accentHex }}
          >
            {formSaving ? <><Loader2 size={15} className="animate-spin" />{tL('formSaving')}</>
              : formSaved ? <><CheckCircle2 size={15} />{tL('formSaved')}</>
              : <><Save size={15} />{tL('formSave')}</>}
          </button>
        </div>
      )}

      {/* Add client dialog */}
      <AddClientDialog
        open={showAddClient}
        onClose={() => { setShowAddClient(false); setConvertSub(null) }}
        onSuccess={() => {
          setShowAddClient(false)
          if (convertSub) {
            handleStatusChange(convertSub.id, 'converted')
            setConvertSub(null)
          }
        }}
        initialValues={addClientInit}
      />
    </div>
  )
}
