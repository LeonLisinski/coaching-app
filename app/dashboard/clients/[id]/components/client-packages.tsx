'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, CreditCard, ChevronDown, ChevronUp, Check, Clock, AlertTriangle, RefreshCw, Trash2, Calendar, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useTranslations } from 'next-intl'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type Package = { id: string; name: string; price: number; duration_days: number; color: string }
type Payment = { id: string; amount: number; paid_at: string | null; status: string; notes: string | null }
type ClientPackage = {
  id: string; package_id: string; start_date: string; end_date: string
  price: number; status: string; notes: string | null
  packages: Package; payments: Payment[]
}
type Props = { clientId: string }

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}. ${m}. ${y}.`
}
function daysLeft(endDate: string): number {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
}
function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}
function durationLabel(days: number): string {
  const m = Math.round(days / 30)
  return m === 1 ? '1 mj.' : `${m} mj.`
}
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// dd/mm/yyyy ↔ yyyy-mm-dd helpers
function isoToDisp(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function dispToIso(disp: string): string {
  const m = disp.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function fmtDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
function todayDisp() { return isoToDisp(today()) }

function PaymentStatusBadge({ status, daysLeftVal }: { status: 'paid' | 'upcoming' | 'pending' | 'late'; daysLeftVal?: number }) {
  const t = useTranslations('clients.packages')
  const cfg = {
    paid:     { icon: <Check size={11} />,          label: t('statusPaid'),              cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    upcoming: { icon: <Clock size={11} />,           label: t('statusUpcoming', { days: daysLeftVal ?? 0 }), cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending:  { icon: <Clock size={11} />,           label: t('statusPending'),           cls: 'bg-gray-50 text-gray-600 border-gray-200' },
    late:     { icon: <AlertTriangle size={11} />,   label: t('statusLate'),              cls: 'bg-red-50 text-red-700 border-red-200' },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

export default function ClientPackages({ clientId }: Props) {
  const t = useTranslations('clients.packages')
  const tCommon = useTranslations('common')

  const [clientPackages, setClientPackages]     = useState<ClientPackage[]>([])
  const [availablePackages, setAvailablePackages] = useState<Package[]>([])
  const [loading, setLoading]                   = useState(true)
  const [expandedIds, setExpandedIds]           = useState<Set<string>>(new Set())
  const [trainerId, setTrainerId]               = useState<string | null>(null)
  const [collabStart, setCollabStart]           = useState<string | null>(null)
  const [editingCollabStart, setEditingCollabStart] = useState(false)
  const [collabStartDraft, setCollabStartDraft] = useState('')

  // Assign dialog (only when no active package)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignForm, setAssignForm]             = useState({ package_id: '', start_date: today(), start_disp: todayDisp(), notes: '' })

  // Replace dialog (when active package exists)
  const [showReplaceDialog, setShowReplaceDialog] = useState(false)
  const [replaceMode, setReplaceMode]             = useState<'keep_start' | 'new_start'>('new_start')
  const [replaceForm, setReplaceForm]             = useState({ package_id: '', notes: '' })
  const [activeCpForReplace, setActiveCpForReplace] = useState<ClientPackage | null>(null)

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedCp, setSelectedCp]             = useState<ClientPackage | null>(null)
  const [paymentForm, setPaymentForm]           = useState({ amount: '', paid_at: today(), paid_at_disp: todayDisp(), notes: '' })
  const [autoRenew, setAutoRenew]               = useState(false)
  const [savingPayment, setSavingPayment]        = useState(false)

  // Edit dates dialog
  const [showEditDatesDialog, setShowEditDatesDialog] = useState(false)
  const [editDatesCp, setEditDatesCp]           = useState<ClientPackage | null>(null)
  const [editDatesForm, setEditDatesForm]       = useState({ start_date: '', end_date: '', start_disp: '', end_disp: '' })

  // Confirm delete
  const [confirmDeleteCp, setConfirmDeleteCp]   = useState<ClientPackage | null>(null)

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    setTrainerId(user.id)

    const [{ data: cpData }, { data: pkgData }, { data: clientData }] = await Promise.all([
      supabase.from('client_packages').select(`*, packages(*), payments(*)`).eq('client_id', clientId).eq('trainer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('packages').select('*').eq('trainer_id', user.id).eq('active', true),
      supabase.from('clients').select('start_date').eq('id', clientId).single(),
    ])

    if (cpData) {
      setClientPackages(cpData)
      const activeIds = cpData.filter((c: ClientPackage) => c.status === 'active').map((c: ClientPackage) => c.id)
      setExpandedIds(new Set(activeIds))
    }
    if (pkgData) setAvailablePackages(pkgData)
    if (clientData) setCollabStart(clientData.start_date ?? null)
    setLoading(false)
  }

  const getPaymentStatus = (cp: ClientPackage): 'paid' | 'upcoming' | 'pending' | 'late' => {
    const payment = cp.payments?.[0]
    if (!payment) return 'pending'
    if (payment.status === 'paid') return 'paid'
    const left = daysLeft(cp.end_date)
    if (left < 0) return 'late'
    if (left <= 7) return 'upcoming'
    return 'pending'
  }

  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const assignPackage = async () => {
    if (!trainerId || !assignForm.package_id) return
    const pkg = availablePackages.find(p => p.id === assignForm.package_id)
    if (!pkg) return
    const start = new Date(assignForm.start_date)
    const end   = addMonths(start, Math.round(pkg.duration_days / 30))
    const { data: cpData } = await supabase.from('client_packages').insert({
      trainer_id: trainerId, client_id: clientId,
      package_id: assignForm.package_id,
      start_date: assignForm.start_date,
      end_date: end.toISOString().split('T')[0],
      price: pkg.price,
      notes: assignForm.notes || null,
      status: 'active',
    }).select().single()
    if (cpData) {
      await supabase.from('payments').insert({ trainer_id: trainerId, client_id: clientId, client_package_id: cpData.id, amount: cpData.price, status: 'pending' })
    }
    setShowAssignDialog(false)
    setAssignForm({ package_id: '', start_date: today(), start_disp: todayDisp(), notes: '' })
    fetchData()
  }

    const openReplaceDialog = (currentActive: ClientPackage) => {
    setActiveCpForReplace(currentActive)
    setReplaceForm({ package_id: '', notes: '' })
    setReplaceMode('new_start')
    setShowReplaceDialog(true)
  }

  const replacePackage = async () => {
    if (!trainerId || !replaceForm.package_id || !activeCpForReplace) return
    const pkg = availablePackages.find(p => p.id === replaceForm.package_id)
    if (!pkg) return
    // new_start uses end_date of current package (not today), so billing cycles stay aligned
    // even if client paid late
    const startDate = replaceMode === 'keep_start' ? activeCpForReplace.start_date : activeCpForReplace.end_date
    const start = new Date(startDate)
    const end   = addMonths(start, Math.round(pkg.duration_days / 30))

    // Expire the old package
    await supabase.from('client_packages').update({ status: 'expired' }).eq('id', activeCpForReplace.id)

    // Create new package
    const { data: cpData } = await supabase.from('client_packages').insert({
      trainer_id: trainerId, client_id: clientId,
      package_id: replaceForm.package_id,
      start_date: startDate,
      end_date: end.toISOString().split('T')[0],
      price: pkg.price,
      notes: replaceForm.notes || null,
      status: 'active',
    }).select().single()
    if (cpData) {
      await supabase.from('payments').insert({ trainer_id: trainerId, client_id: clientId, client_package_id: cpData.id, amount: cpData.price, status: 'pending' })
    }
    setShowReplaceDialog(false)
    fetchData()
  }

  const deletePackage = async (cp: ClientPackage) => {
    if (cp.payments?.[0]) await supabase.from('payments').delete().eq('client_package_id', cp.id)
    await supabase.from('client_packages').delete().eq('id', cp.id)
    setConfirmDeleteCp(null)
    fetchData()
  }

  const markAsPaid = async () => {
    if (!selectedCp || !trainerId || savingPayment) return
    setSavingPayment(true)
    try {
      const payment = selectedCp.payments?.[0]
      const amount  = parseFloat(paymentForm.amount) || selectedCp.price

      if (payment) {
        const { error } = await supabase.from('payments').update({
          status: 'paid',
          amount,
          paid_at: paymentForm.paid_at,
          notes: paymentForm.notes || null,
        }).eq('id', payment.id)
        if (error) throw error
      } else {
        // Nema payment zapisa — upsert da se izbjegne duplikat
        const { error } = await supabase.from('payments').upsert({
          trainer_id: trainerId,
          client_id: clientId,
          client_package_id: selectedCp.id,
          amount,
          paid_at: paymentForm.paid_at,
          status: 'paid',
          notes: paymentForm.notes || null,
        }, { onConflict: 'client_package_id' })
        if (error) throw error
      }

      // Auto-renew: expire current package and create next period from end_date
      if (autoRenew) {
        const pkg = selectedCp.packages
        const newStart = new Date(selectedCp.end_date)
        const newEnd = addMonths(newStart, Math.round(pkg.duration_days / 30))

        await supabase.from('client_packages').update({ status: 'expired' }).eq('id', selectedCp.id)

        const { data: newCp } = await supabase.from('client_packages').insert({
          trainer_id: trainerId,
          client_id: clientId,
          package_id: selectedCp.package_id,
          start_date: newStart.toISOString().split('T')[0],
          end_date: newEnd.toISOString().split('T')[0],
          price: amount,
          status: 'active',
        }).select().single()
        if (newCp) {
          await supabase.from('payments').insert({
            trainer_id: trainerId,
            client_id: clientId,
            client_package_id: newCp.id,
            amount: newCp.price,
            status: 'pending',
          })
        }
      }

      setShowPaymentDialog(false)
      setAutoRenew(false)
      fetchData()
    } catch (err: any) {
      alert(`Greška pri potvrdi plaćanja: ${err?.message || 'Nepoznata greška'}`)
    } finally {
      setSavingPayment(false)
    }
  }

  const markAsUnpaid = async (cp: ClientPackage) => {
    const payment = cp.payments?.[0]
    if (!payment) return
    await supabase.from('payments').update({ status: 'pending', paid_at: null }).eq('id', payment.id)
    fetchData()
  }

  const openPayment = (cp: ClientPackage) => {
    setSelectedCp(cp)
    setPaymentForm({ amount: cp.price.toString(), paid_at: today(), paid_at_disp: todayDisp(), notes: '' })
    // Pre-check auto-renew if the package end date has passed (client is active, next period needed)
    setAutoRenew(cp.status === 'active' && cp.end_date <= today())
    setShowPaymentDialog(true)
  }

  const openEditDates = (cp: ClientPackage) => {
    setEditDatesCp(cp)
    setEditDatesForm({ start_date: cp.start_date, end_date: cp.end_date, start_disp: isoToDisp(cp.start_date), end_disp: isoToDisp(cp.end_date) })
    setShowEditDatesDialog(true)
  }

  const savePackageDates = async () => {
    if (!editDatesCp) return
    await supabase.from('client_packages').update({
      start_date: editDatesForm.start_date,
      end_date:   editDatesForm.end_date,
    }).eq('id', editDatesCp.id)
    setShowEditDatesDialog(false)
    setEditDatesCp(null)
    fetchData()
  }

  const saveCollabStart = async () => {
    const iso = dispToIso(collabStartDraft)
    const val = iso || null
    await supabase.from('clients').update({ start_date: val }).eq('id', clientId)
    setCollabStart(val)
    setEditingCollabStart(false)
  }

  const active = clientPackages.filter(cp => cp.status === 'active')
  const past   = clientPackages.filter(cp => cp.status !== 'active')
  const hasActive = active.length > 0

  const totalInvoiced = clientPackages.reduce((s, cp) => s + cp.price, 0)
  const totalPaid     = clientPackages.reduce((s, cp) => { const p = cp.payments?.[0]; return s + (p?.status === 'paid' ? (p.amount || cp.price) : 0) }, 0)
  const outstanding   = totalInvoiced - totalPaid

  if (loading) return <p className="text-sm text-gray-500">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">

      {/* Collaboration start date */}
      <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg">
        <Calendar size={13} className="text-gray-400 shrink-0" />
        {editingCollabStart ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-500 shrink-0">{t('collabFrom')}</span>
            <Input type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10}
              value={collabStartDraft}
              onChange={e => setCollabStartDraft(fmtDateInput(e.target.value))}
              className="h-6 text-xs flex-1 max-w-[160px]" />
            <Button size="sm" className="h-6 text-xs px-2" onClick={saveCollabStart}>{tCommon('save')}</Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingCollabStart(false)}>{tCommon('cancel')}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-500">{t('collabFrom')}</span>
            <span className="text-xs font-medium text-gray-700">{collabStart ? fmtDate(collabStart) : t('collabNotSet')}</span>
            <button onClick={() => { setCollabStartDraft(isoToDisp(collabStart)); setEditingCollabStart(true) }}
              className="text-gray-400 hover:text-gray-600 ml-auto">
              <Pencil size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('title')}</h3>
        {!hasActive && (
          <Button size="sm" onClick={() => setShowAssignDialog(true)} className="flex items-center gap-1">
            <Plus size={13} /> {t('assignPackage')}
          </Button>
        )}
      </div>

      {/* Summary row */}
      {clientPackages.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('summaryInvoiced'), value: `${totalInvoiced.toFixed(0)} €`, cls: 'text-gray-900' },
            { label: t('summaryPaid'),     value: `${totalPaid.toFixed(0)} €`,     cls: 'text-emerald-600' },
            { label: t('summaryOwed'),     value: `${outstanding.toFixed(0)} €`,   cls: outstanding > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className={`text-lg font-bold ${item.cls}`}>{item.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {clientPackages.length === 0 ? (
        <p className="text-sm text-gray-400">{t('noPackages')}</p>
      ) : (
        <>
          {/* Active package */}
          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('activeLabel')}</p>
              {active.map(cp => (
                <PackageCard
                  key={cp.id} cp={cp}
                  expanded={expandedIds.has(cp.id)}
                  onToggle={() => toggleExpand(cp.id)}
                  payStatus={getPaymentStatus(cp)}
                  onPay={() => openPayment(cp)}
                  onMarkUnpaid={() => markAsUnpaid(cp)}
                  onReplace={() => openReplaceDialog(cp)}
                  onDelete={() => setConfirmDeleteCp(cp)}
                  onEditDates={() => openEditDates(cp)}
                  showReplaceBtn
                />
              ))}
            </div>
          )}

          {/* Past packages */}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('pastLabel')}</p>
              {past.map(cp => (
                <PackageCard
                  key={cp.id} cp={cp}
                  expanded={expandedIds.has(cp.id)}
                  onToggle={() => toggleExpand(cp.id)}
                  payStatus={getPaymentStatus(cp)}
                  onPay={() => openPayment(cp)}
                  onMarkUnpaid={() => markAsUnpaid(cp)}
                  onReplace={() => {}}
                  onDelete={() => setConfirmDeleteCp(cp)}
                  onEditDates={() => openEditDates(cp)}
                  showReplaceBtn={false}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Assign dialog (no active package) */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('assignPackage')}</DialogTitle><DialogDescription className="sr-only">{t('assignPackage')}</DialogDescription></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('packageLabel')}</Label>
              <select
                value={assignForm.package_id}
                onChange={e => {
                  setAssignForm({ ...assignForm, package_id: e.target.value })
                }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">{t('selectPackage')}</option>
                {availablePackages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.price} € · {durationLabel(pkg.duration_days)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('startDate')}</Label>
              <Input type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10}
                value={assignForm.start_disp}
                onChange={e => {
                  const disp = fmtDateInput(e.target.value)
                  setAssignForm({ ...assignForm, start_disp: disp, start_date: dispToIso(disp) || assignForm.start_date })
                }}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('notesOptional')}</Label>
              <Input value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })} className="h-8 text-sm" placeholder={t('notesPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={assignPackage} disabled={!assignForm.package_id}>{tCommon('assign')}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAssignDialog(false)}>{tCommon('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace dialog */}
      <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw size={16} className="text-gray-500" /> {t('replaceTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('replaceTitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {activeCpForReplace && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                {t('currentPackage')} <span className="font-medium text-gray-700">{activeCpForReplace.packages?.name}</span>
                <span className="ml-2 text-gray-400">{fmtDate(activeCpForReplace.start_date)} – {fmtDate(activeCpForReplace.end_date)}</span>
              </div>
            )}

            {/* Start mode */}
            <div className="space-y-2">
              <Label className="text-xs">{t('replaceStartLabel')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'new_start' as const, label: t('replaceStartNew'), sub: activeCpForReplace ? `Od ${fmtDate(activeCpForReplace.end_date)}` : t('replaceStartNewSub') },
                  { val: 'keep_start' as const, label: t('replaceStartKeep'), sub: activeCpForReplace ? `${t('collabFrom')} ${fmtDate(activeCpForReplace.start_date)}` : '' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setReplaceMode(opt.val)}
                    className={`rounded-xl p-3 text-left border-2 transition-all ${replaceMode === opt.val ? 'border-[var(--app-accent)] bg-[var(--app-accent-muted)]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <p className="text-xs font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('newPackageLabel')}</Label>
              <select
                value={replaceForm.package_id}
                onChange={e => {
                  setReplaceForm({ ...replaceForm, package_id: e.target.value })
                }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">{t('selectPackage')}</option>
                {availablePackages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.price} € · {durationLabel(pkg.duration_days)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('notesOptional')}</Label>
              <Input value={replaceForm.notes} onChange={e => setReplaceForm({ ...replaceForm, notes: e.target.value })} className="h-8 text-sm" />
            </div>

            <p className="text-[11px] text-gray-400">{t('replaceExpiredNotice')}</p>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={replacePackage} disabled={!replaceForm.package_id}
                className="flex items-center gap-1.5"><RefreshCw size={12} /> {t('replaceBtn')}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowReplaceDialog(false)}>{tCommon('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dates dialog */}
      <Dialog open={showEditDatesDialog} onOpenChange={setShowEditDatesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={15} className="text-gray-500" /> Uredi datume paketa
            </DialogTitle>
            <DialogDescription className="sr-only">Uredi datume paketa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {editDatesCp && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Paket: <span className="font-medium text-gray-700">{editDatesCp.packages?.name}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('startDate')}</Label>
                <Input
                  type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10}
                  value={editDatesForm.start_disp}
                  onChange={e => {
                    const disp = fmtDateInput(e.target.value)
                    setEditDatesForm(f => ({ ...f, start_disp: disp, start_date: dispToIso(disp) || f.start_date }))
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Datum isteka</Label>
                <Input
                  type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10}
                  value={editDatesForm.end_disp}
                  onChange={e => {
                    const disp = fmtDateInput(e.target.value)
                    setEditDatesForm(f => ({ ...f, end_disp: disp, end_date: dispToIso(disp) || f.end_date }))
                  }}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">Možeš slobodno postaviti oba datuma neovisno o trajanju paketa.</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={savePackageDates} disabled={!editDatesForm.start_date || !editDatesForm.end_date}>
                <Check size={13} className="mr-1" /> {tCommon('save')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowEditDatesDialog(false)}>{tCommon('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDeleteCp !== null}
        title={t('deleteTitle')}
        description={t('deleteConfirm', { name: confirmDeleteCp?.packages?.name ?? '' })}
        onConfirm={() => confirmDeleteCp && deletePackage(confirmDeleteCp)}
        onCancel={() => setConfirmDeleteCp(null)}
        confirmLabel={t('deleteBtn')}
        destructive
      />

      {/* Payment dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('paymentTitle')}</DialogTitle><DialogDescription className="sr-only">{t('paymentTitle')}</DialogDescription></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-gray-500">
              {t('paymentPackageLabel')} <span className="font-medium text-gray-800">{selectedCp?.packages?.name}</span>
              <span className="ml-2 text-gray-400">({fmtDate(selectedCp?.start_date ?? null)} – {fmtDate(selectedCp?.end_date ?? null)})</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('amount')}</Label>
                <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('paymentDate')}</Label>
                <Input type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10}
                  value={paymentForm.paid_at_disp}
                  onChange={e => {
                    const disp = fmtDateInput(e.target.value)
                    setPaymentForm({ ...paymentForm, paid_at_disp: disp, paid_at: dispToIso(disp) || paymentForm.paid_at })
                  }}
                  className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('notesOptional')}</Label>
              <Input value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="h-8 text-sm" placeholder={t('paymentNotesPlaceholder')} />
            </div>

            {/* Late payment notice */}
            {selectedCp && paymentForm.paid_at > selectedCp.end_date && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Kasno plaćanje.</span> Plaćanje je stiglo {Math.abs(daysLeft(selectedCp.end_date))} {Math.abs(daysLeft(selectedCp.end_date)) === 1 ? 'dan' : 'dana'} nakon isteka.
                </p>
              </div>
            )}

            {/* Auto-renew option */}
            {selectedCp && (
              <button
                type="button"
                onClick={() => setAutoRenew(v => !v)}
                className={`w-full flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                  autoRenew ? 'border-[var(--app-accent)] bg-[var(--app-accent-muted)]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  autoRenew ? 'border-[var(--app-accent)] bg-[var(--app-accent)]' : 'border-gray-300'
                }`}>
                  {autoRenew && <Check size={10} className="text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">Kreiraj sljedeće razdoblje</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatski dodaj{' '}
                    <span className="font-medium text-gray-700">{selectedCp.packages?.name}</span>{' '}
                    od{' '}
                    <span className="font-medium text-gray-700">{fmtDate(selectedCp.end_date)}</span>
                    {' '}→{' '}
                    <span className="font-medium text-gray-700">
                      {fmtDate(addMonths(new Date(selectedCp.end_date), Math.round(selectedCp.packages.duration_days / 30)).toISOString().split('T')[0])}
                    </span>
                  </p>
                </div>
              </button>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={markAsPaid} disabled={savingPayment}>
                {savingPayment
                  ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
                  : <Check size={13} className="mr-1" />}
                {t('confirmPayment')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowPaymentDialog(false); setAutoRenew(false) }}>{tCommon('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PackageCard({ cp, expanded, onToggle, payStatus, onPay, onMarkUnpaid, onReplace, onDelete, onEditDates, showReplaceBtn }: {
  cp: ClientPackage; expanded: boolean; onToggle: () => void
  payStatus: 'paid' | 'upcoming' | 'pending' | 'late'; onPay: () => void; onMarkUnpaid: () => void
  onReplace: () => void; onDelete: () => void; onEditDates: () => void; showReplaceBtn: boolean
}) {
  const t = useTranslations('clients.packages')
  const tCommon = useTranslations('common')
  const left     = daysLeft(cp.end_date)
  const progress = Math.max(0, Math.min(100,
    ((Date.now() - new Date(cp.start_date).getTime()) /
     (new Date(cp.end_date).getTime() - new Date(cp.start_date).getTime())) * 100
  ))
  const payment = cp.payments?.[0]

  return (
    <Card className={`overflow-hidden ${cp.status !== 'active' ? 'opacity-70' : ''}`}>
      <div className="h-1" style={{ backgroundColor: cp.packages?.color || '#6366f1' }} />
      <CardContent className="py-3 px-4 space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          {/* Clickable name area */}
          <button type="button" onClick={onToggle} className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cp.packages?.color || '#6366f1' }} />
            <span className="font-medium text-sm">{cp.packages?.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{cp.price} €</span>
          </button>
          {/* Right side: action icons + status + chevron */}
          <div className="flex items-center gap-1.5 shrink-0">
            {showReplaceBtn && (
              <button onClick={onReplace} title={t('replaceTooltip')}
                className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                <RefreshCw size={12} />
              </button>
            )}
            <button onClick={onEditDates} title="Uredi datume"
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={onDelete} title={t('deleteTooltip')}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={12} />
            </button>
            <PaymentStatusBadge status={payStatus} daysLeftVal={left > 0 ? left : undefined} />
            <button type="button" onClick={onToggle}>
              {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Date range + progress */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{fmtDate(cp.start_date)} – {fmtDate(cp.end_date)}</span>
          {cp.status === 'active' && (
            left >= 0 ? (
              <span className="text-gray-400">{t('daysLeft', { days: left })}</span>
            ) : payStatus === 'paid' ? (
              <span className="text-gray-400">Isteklo</span>
            ) : (
              <span className="text-red-500 font-medium">{t('daysOverdue', { days: Math.abs(left) })}</span>
            )
          )}
        </div>

        {cp.status === 'active' && (
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: cp.packages?.color || '#6366f1', opacity: 0.6 }} />
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="pt-2 space-y-3 border-t border-gray-50 mt-1">
            {/* Payment detail */}
            <div className="flex items-center gap-2 justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 mb-0.5">{t('paymentLabel')}</p>
                {payment ? (
                  <div>
                    <p className="text-sm">
                      <span className={payment.status === 'paid' ? 'text-emerald-600 font-medium' : 'text-gray-600'}>
                        {payment.status === 'paid' ? t('paidAmount', { amount: payment.amount }) : t('pendingAmount', { amount: cp.price })}
                      </span>
                    </p>
                    {payment.status === 'paid' && payment.paid_at && <p className="text-xs text-gray-400">{fmtDate(payment.paid_at)}</p>}
                    {payment.notes && <p className="text-xs text-gray-400 italic">{payment.notes}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">{t('noPaymentRecord')}</p>
                )}
              </div>
              {payStatus !== 'paid' ? (
                <Button size="sm" variant="outline" onClick={onPay} className="h-7 text-xs gap-1 shrink-0">
                  <CreditCard size={11} /> {t('markPaidBtn')}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onMarkUnpaid} className="h-7 text-xs gap-1 shrink-0 text-amber-600 border-amber-200 hover:bg-amber-50">
                  <AlertTriangle size={11} /> Neplaćeno
                </Button>
              )}
            </div>

            {cp.notes && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{t('noteLabel')}</p>
                <p className="text-xs text-gray-600">{cp.notes}</p>
              </div>
            )}

          </div>
        )}
      </CardContent>
    </Card>
  )
}
