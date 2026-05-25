'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAppTheme } from '@/app/contexts/app-theme'
import {
  ClipboardList, Settings2, PhoneCall, UserPlus, Trash2, ChevronDown,
  ChevronUp, Copy, Check, ExternalLink, Plus, Calendar, GripVertical,
  X, ArrowLeft, Save, Loader2, AlertCircle, CheckCircle2,
  Mail, Phone, User, Eye, EyeOff,
} from 'lucide-react'
import nextDynamic from 'next/dynamic'

const AddClientDialog = nextDynamic(() => import('@/app/dashboard/clients/add-client-dialog'), { ssr: false })

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

const QUESTION_TYPES = [
  { value: 'short_text',    label: 'Kratki tekst' },
  { value: 'long_text',     label: 'Dugi tekst' },
  { value: 'number',        label: 'Broj' },
  { value: 'email',         label: 'Email' },
  { value: 'phone',         label: 'Telefon' },
  { value: 'single_choice', label: 'Jedan izbor' },
  { value: 'multi_choice',  label: 'Više izbora' },
  { value: 'date',          label: 'Datum' },
  { value: 'yes_no',        label: 'Da / Ne' },
]

const FORM_COLORS = [
  '#7c3aed', '#6d28d9', '#2563eb', '#4f46e5', '#0284c7',
  '#0d9488', '#16a34a', '#d97706', '#ea580c', '#dc2626',
  '#ec4899', '#475569',
]

const STATUS_LABELS: Record<string, string> = {
  new: 'Nova',
  contacted: 'Kontaktirana',
  converted: 'Pretvorena u klijenta',
  rejected: 'Odbijena',
}
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
  required: boolean
  options: string[] | null
}

type FormConfig = {
  id: string
  title: string
  description: string | null
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
  required: boolean
  options: string
}

function makeKey() { return Math.random().toString(36).slice(2) }

// ─── Lead row ───────────────────────────────────────────────────────────────
function LeadRow({
  sub, accentHex, isDark, onStatusChange, onDelete, onConvert, onClick, isOpen,
}: {
  sub: Submission
  accentHex: string
  isDark: boolean
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onConvert: (sub: Submission) => void
  onClick: () => void
  isOpen: boolean
}) {
  const [notes, setNotes] = useState(sub.trainer_notes || '')
  const [callDate, setCallDate] = useState(sub.scheduled_call_at ? sub.scheduled_call_at.slice(0, 16) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const cardBg = isDark ? 'oklch(0.195 0.018 264)' : 'white'
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'
  const textMuted = isDark ? '#9ca3af' : '#6b7280'

  // Extract readable info from answers
  const answerEntries = Object.entries(sub.answers || {})
  const emailEntry = answerEntries.find(([k]) => /email/i.test(k))
  const phoneEntry = answerEntries.find(([k]) => /tel|mob|phone/i.test(k))
  const nameEntry  = answerEntries.find(([k]) => /ime|name/i.test(k))
  const previewName = nameEntry ? String(nameEntry[1]) : emailEntry ? String(emailEntry[1]) : 'Anonimno'

  const saveDetails = async () => {
    setSaving(true)
    await supabase.from('lead_submissions').update({
      trainer_notes: notes || null,
      scheduled_call_at: callDate ? new Date(callDate).toISOString() : null,
    }).eq('id', sub.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const formattedDate = new Date(sub.created_at).toLocaleDateString('hr-HR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ borderColor: isOpen ? accentHex + '55' : border, background: cardBg }}
    >
      {/* Header row */}
      <button
        type="button"
        className="w-full px-5 py-4 flex items-center gap-3 text-left"
        onClick={onClick}
      >
        {/* Status dot */}
        <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[sub.status]}`}>
          {STATUS_LABELS[sub.status] || sub.status}
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
        </div>

        <span className="text-xs shrink-0" style={{ color: textMuted }}>{formattedDate}</span>
        {isOpen ? <ChevronUp size={15} style={{ color: textMuted }} className="shrink-0" /> : <ChevronDown size={15} style={{ color: textMuted }} className="shrink-0" />}
      </button>

      {/* Expanded */}
      {isOpen && (
        <div className="border-t px-5 pb-5 space-y-5" style={{ borderColor: border }}>
          {/* Answers */}
          <div className="pt-4 space-y-3">
            {answerEntries.map(([label, value]) => (
              <div key={label} className="flex gap-3 text-sm">
                <span className="font-medium shrink-0 w-36 truncate" style={{ color: textMuted }}>{label}</span>
                <span style={{ color: isDark ? '#e5e7eb' : '#1f2937' }}>
                  {Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                </span>
              </div>
            ))}
          </div>

          {/* Status change */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textMuted }}>Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
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

          {/* Scheduled call */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textMuted }}>Zakazani razgovor</p>
            <input
              type="datetime-local"
              value={callDate}
              onChange={e => setCallDate(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm outline-none"
              style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb', color: isDark ? '#e5e7eb' : '#111827' }}
            />
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textMuted }}>Bilješke</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Dodaj bilješku o ovom leadu..."
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
              style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb', color: isDark ? '#e5e7eb' : '#111827' }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={saveDetails}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-70"
              style={{ backgroundColor: accentHex }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
              {saved ? 'Spremljeno' : 'Spremi'}
            </button>
            <button
              type="button"
              onClick={() => onConvert(sub)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6', color: isDark ? '#e5e7eb' : '#374151' }}
            >
              <UserPlus size={13} />
              Pretvori u klijenta
            </button>
            <button
              type="button"
              onClick={() => onDelete(sub.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all ml-auto"
            >
              <Trash2 size={13} />
              Obriši
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

  const [userId, setUserId]               = useState<string | null>(null)
  const [handle, setHandle]               = useState<string | null | undefined>(undefined)
  const [tab, setTab]                     = useState<'submissions' | 'form'>('submissions')
  const [submissions, setSubmissions]     = useState<Submission[]>([])
  const [openId, setOpenId]               = useState<string | null>(null)
  const [statusFilter, setStatusFilter]   = useState<string>('all')
  const [loading, setLoading]             = useState(true)

  // Form builder state
  const [formConfig, setFormConfig]       = useState<FormConfig | null>(null)
  const [draftTitle, setDraftTitle]       = useState('')
  const [draftDesc, setDraftDesc]         = useState('')
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

  // ── Auth + data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uid = session.user.id
      setUserId(uid)

      // Get handle
      const { data: profile } = await supabase.from('profiles').select('handle').eq('id', uid).single()
      setHandle(profile?.handle ?? null)

      if (profile?.handle) {
        await loadAll(uid)
      }
      setLoading(false)
    }
    init()
  }, [])

  const loadAll = useCallback(async (uid: string) => {
    const [subsRes, formRes] = await Promise.all([
      supabase.from('lead_submissions').select('*').eq('trainer_id', uid).order('created_at', { ascending: false }),
      supabase.from('lead_forms').select('*').eq('trainer_id', uid).single(),
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
      setDraftDesc(f.description || '')
      setDraftColor(f.accent_color)
      setDraftActive(f.is_active)
      setDraftPhoto(f.photo_url)

      const { data: qs } = await supabase
        .from('lead_form_questions')
        .select('*')
        .eq('form_id', f.id)
        .order('order_index')
      setQuestions(
        (qs || []).map((q: Question) => ({
          _key: makeKey(),
          id: q.id,
          type: q.type,
          label: q.label,
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
        title: draftTitle, description: draftDesc || null,
        accent_color: draftColor, is_active: draftActive, photo_url: draftPhoto,
        updated_at: new Date().toISOString(),
      }).eq('id', formId)
    } else {
      const { data: newForm } = await supabase.from('lead_forms').insert({
        trainer_id: userId, title: draftTitle, description: draftDesc || null,
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
          required: q.required,
          options: q.type === 'single_choice' || q.type === 'multi_choice'
            ? q.options.split('\n').map(s => s.trim()).filter(Boolean)
            : null,
        })),
      )
    }

    setFormConfig(prev => prev ? { ...prev, title: draftTitle, description: draftDesc || null, accent_color: draftColor, is_active: draftActive, photo_url: draftPhoto } : null)
    setFormSaving(false)
    setFormSaved(true)
    setTimeout(() => setFormSaved(false), 2500)
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null)
  const questionsEndRef = useRef<HTMLDivElement>(null)

  const addQuestion = () => {
    setQuestions(prev => [...prev, { _key: makeKey(), type: 'short_text', label: '', required: false, options: '' }])
    // Scroll to new question after render
    requestAnimationFrame(() => {
      setTimeout(() => questionsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    })
  }

  const uploadPhoto = async (file: File) => {
    if (!userId) return
    setPhotoUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    // Use the public `avatars` bucket so the URL is publicly accessible
    const path = `lead-forms/${userId}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
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

  // ── Render: handle setup ──────────────────────────────────────────────────
  if (handle === null) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <div className="rounded-3xl p-8 border space-y-5" style={{ background: cardBg, borderColor: border }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: accentHex + '20' }}>
            <ClipboardList size={22} style={{ color: accentHex }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: textMain }}>Postavi javni link</h2>
            <p className="text-sm mt-1" style={{ color: textMuted }}>Odaberi jedinstveni handle koji će biti dio javnog URL-a tvoje prijavne forme.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: textMuted }}>Handle</label>
            <div className="flex items-center gap-0 rounded-xl border-2 overflow-hidden" style={{ borderColor: handleSetupErr ? '#ef4444' : border }}>
              <span className="px-3 py-3 text-sm" style={{ color: textMuted, background: isDark ? '#1a1a2e' : '#f9fafb' }}>app.unitlift.com/</span>
              <input
                type="text"
                value={handleSetup}
                onChange={e => { setHandleSetup(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setHandleSetupErr('') }}
                placeholder="petar-petrovic"
                className="flex-1 px-3 py-3 text-sm outline-none"
                style={{ background: isDark ? '#0f0f1a' : 'white', color: textMain }}
              />
            </div>
            {handleSetupErr && <p className="text-xs text-red-500 mt-1">{handleSetupErr}</p>}
            <p className="text-xs mt-1.5" style={{ color: textMuted }}>/prijava</p>
          </div>
          <button
            type="button"
            onClick={saveHandle}
            disabled={!handleSetup || handleSetupSaving}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor: accentHex }}
          >
            {handleSetupSaving ? 'Spremanje…' : 'Postavi handle i nastavi'}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: main ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentHex + '20' }}>
            <ClipboardList size={20} style={{ color: accentHex }} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: textMain }}>Prijave</h1>
            <p className="text-xs" style={{ color: textMuted }}>{handle}/prijava</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: border, color: textMain, background: cardBg }}
          >
            {linkCopied ? <Check size={13} style={{ color: accentHex }} /> : <Copy size={13} />}
            {linkCopied ? 'Kopirano!' : 'Kopiraj link'}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: border, color: textMain, background: cardBg }}
          >
            <ExternalLink size={13} />
            Pregledaj
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
            {t === 'submissions' ? `Prijave${submissions.length ? ` (${submissions.length})` : ''}` : 'Uredi formu'}
          </button>
        ))}
      </div>

      {/* ── Submissions tab ── */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'new', 'contacted', 'converted', 'rejected'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all border"
                style={{
                  borderColor: statusFilter === s ? accentHex : border,
                  background: statusFilter === s ? accentHex + '18' : 'transparent',
                  color: statusFilter === s ? accentHex : textMuted,
                }}
              >
                {s === 'all' ? `Sve (${submissions.length})` : `${STATUS_LABELS[s]} (${submissions.filter(x => x.status === s).length})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ClipboardList size={36} className="mx-auto" style={{ color: accentHex + '60' }} />
              <p className="font-semibold" style={{ color: textMain }}>Nema prijava.</p>
              <p className="text-sm" style={{ color: textMuted }}>
                {statusFilter !== 'all' ? 'Nema prijava s ovim statusom.' : 'Kad netko popuni tvoju formu, prikazat će se ovdje.'}
              </p>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: accentHex }}
              >
                <Copy size={14} />
                Kopiraj link forme
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
        <div className="space-y-5">
          {/* Handle */}
          <div className="rounded-2xl p-5 border space-y-3" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold" style={{ color: textMain }}>Javni link</h3>
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
            <p className="text-xs" style={{ color: textMuted }}>Samo mala slova, brojevi i crtice.</p>
          </div>

          {/* Basic info */}
          <div className="rounded-2xl p-5 border space-y-4" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold" style={{ color: textMain }}>Osnovno</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>Naslov forme</label>
              <input
                type="text"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
                placeholder="npr. Prijava za trening s Petrom"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb', color: textMain }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>Uvodni tekst</label>
              <textarea
                value={draftDesc}
                onChange={e => setDraftDesc(e.target.value)}
                rows={3}
                placeholder="Pozdrav! Molim te da popuniš ovu formu kako bih saznao više o tebi..."
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
                style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb', color: textMain }}
              />
            </div>

            {/* Photo */}
            <div className="space-y-2">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>Tvoja fotografija na formi</label>
              <div className="flex items-center gap-3">
                {draftPhoto && (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border" style={{ borderColor: border }}>
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
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="px-3 py-2 rounded-xl border text-xs font-semibold transition-all"
                  style={{ borderColor: border, color: textMain }}
                >
                  {photoUploading ? 'Učitavanje…' : draftPhoto ? 'Promijeni sliku' : 'Odaberi sliku'}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }}
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-xs font-semibold" style={{ color: textMuted }}>Boja forme</label>
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
              <span className="text-sm font-medium" style={{ color: textMain }}>Forma je aktivna</span>
            </label>
          </div>

          {/* Questions */}
          <div className="rounded-2xl p-5 border space-y-4" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: textMain }}>Pitanja ({questions.length})</h3>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                style={{ backgroundColor: accentHex }}
              >
                <Plus size={12} />
                Dodaj pitanje
              </button>
            </div>

            {questions.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: textMuted }}>Nema pitanja. Dodaj prvo pitanje gore.</p>
            )}

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q._key} className="rounded-xl border p-4 space-y-3" style={{ borderColor: border, background: isDark ? '#1a1a2e' : '#f9fafb' }}>
                  <div className="flex items-center gap-2">
                    <GripVertical size={15} style={{ color: textMuted }} className="cursor-grab shrink-0" />
                    <span className="text-xs font-bold" style={{ color: accentHex }}>#{idx + 1}</span>
                    <div className="flex-1" />
                    {/* Move up/down */}
                    <button type="button" disabled={idx === 0} onClick={() => setQuestions(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })}
                      className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30" style={{ color: textMuted }}>
                      <ChevronUp size={13} />
                    </button>
                    <button type="button" disabled={idx === questions.length - 1} onClick={() => setQuestions(prev => { const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a })}
                      className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30" style={{ color: textMuted }}>
                      <ChevronDown size={13} />
                    </button>
                    <button type="button" onClick={() => setQuestions(prev => prev.filter((_, i) => i !== idx))}
                      className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-600">
                      <X size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold" style={{ color: textMuted }}>Tekst pitanja</label>
                      <input
                        type="text"
                        value={q.label}
                        onChange={e => setQuestions(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuestion() } }}
                        placeholder="npr. Koje su tvoje godine?"
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{ borderColor: border, background: isDark ? '#0f0f1a' : 'white', color: textMain }}
                        autoFocus={idx === questions.length - 1 && q.label === ''}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold" style={{ color: textMuted }}>Vrsta pitanja</label>
                      <select
                        value={q.type}
                        onChange={e => setQuestions(prev => prev.map((x, i) => i === idx ? { ...x, type: e.target.value } : x))}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{ borderColor: border, background: isDark ? '#0f0f1a' : 'white', color: textMain }}
                      >
                        {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold" style={{ color: textMuted }}>Obavezno</label>
                      <label className="flex items-center gap-2 cursor-pointer h-9">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={e => setQuestions(prev => prev.map((x, i) => i === idx ? { ...x, required: e.target.checked } : x))}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: accentHex }}
                        />
                        <span className="text-sm" style={{ color: textMain }}>Da</span>
                      </label>
                    </div>
                  </div>

                  {(q.type === 'single_choice' || q.type === 'multi_choice') && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold" style={{ color: textMuted }}>Opcije (jedna po retku)</label>
                      <textarea
                        value={q.options}
                        onChange={e => setQuestions(prev => prev.map((x, i) => i === idx ? { ...x, options: e.target.value } : x))}
                        rows={3}
                        placeholder={'Opcija 1\nOpcija 2\nOpcija 3'}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                        style={{ borderColor: border, background: isDark ? '#0f0f1a' : 'white', color: textMain }}
                      />
                    </div>
                  )}
                </div>
              ))}
              {/* Scroll anchor + bottom "Add question" button */}
              <div ref={questionsEndRef} />
            </div>

            {/* Bottom add button — always visible without scrolling to top */}
            <button
              type="button"
              onClick={addQuestion}
              className="w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold transition-all flex items-center justify-center gap-2"
              style={{ borderColor: accentHex + '55', color: accentHex }}
            >
              <Plus size={14} />
              Dodaj pitanje
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
            {formSaving ? <><Loader2 size={15} className="animate-spin" />Spremanje...</>
              : formSaved ? <><CheckCircle2 size={15} />Forma je spremljena!</>
              : <><Save size={15} />Spremi formu</>}
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
