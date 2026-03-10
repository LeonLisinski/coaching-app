'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, CreditCard, ChevronDown, ChevronUp, Check, Clock, AlertTriangle, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useTranslations } from 'next-intl'

type Package = { id: string; name: string; price: number; duration_days: number; color: string }

type Payment = { id: string; amount: number; paid_at: string | null; status: string; notes: string | null }

type ClientPackage = {
  id: string
  package_id: string
  start_date: string
  end_date: string
  price: number
  status: string
  notes: string | null
  packages: Package
  payments: Payment[]
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

function PaymentStatusBadge({ status, daysLeftVal }: { status: 'paid' | 'upcoming' | 'pending' | 'late'; daysLeftVal?: number }) {
  const cfg = {
    paid:     { icon: <Check size={11} />,          label: 'Plaćeno',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    upcoming: { icon: <Clock size={11} />,           label: `Dospijeva za ${daysLeftVal}d`, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending:  { icon: <Clock size={11} />,           label: 'Na čekanju',        cls: 'bg-gray-50 text-gray-600 border-gray-200' },
    late:     { icon: <AlertTriangle size={11} />,   label: 'Kasni s plaćanjem', cls: 'bg-red-50 text-red-700 border-red-200' },
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

  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([])
  const [availablePackages, setAvailablePackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedCp, setSelectedCp] = useState<ClientPackage | null>(null)
  const [trainerId, setTrainerId] = useState<string | null>(null)

  const [assignForm, setAssignForm] = useState({
    package_id: '', start_date: new Date().toISOString().split('T')[0], price: '', notes: '',
  })
  const [paymentForm, setPaymentForm] = useState({
    amount: '', paid_at: new Date().toISOString().split('T')[0], notes: '',
  })

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setTrainerId(user.id)

    const [{ data: cpData }, { data: pkgData }] = await Promise.all([
      supabase.from('client_packages')
        .select(`*, packages(*), payments(*)`)
        .eq('client_id', clientId).eq('trainer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('packages').select('*').eq('trainer_id', user.id).eq('active', true),
    ])

    if (cpData) {
      setClientPackages(cpData)
      // Auto-expand active packages
      const activeIds = cpData.filter((c: ClientPackage) => c.status === 'active').map((c: ClientPackage) => c.id)
      setExpandedIds(new Set(activeIds))
    }
    if (pkgData) setAvailablePackages(pkgData)
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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const assignPackage = async () => {
    if (!trainerId || !assignForm.package_id) return
    const pkg = availablePackages.find(p => p.id === assignForm.package_id)
    if (!pkg) return
    const startDate = new Date(assignForm.start_date)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + pkg.duration_days)

    const { data: cpData } = await supabase.from('client_packages').insert({
      trainer_id: trainerId, client_id: clientId,
      package_id: assignForm.package_id,
      start_date: assignForm.start_date,
      end_date: endDate.toISOString().split('T')[0],
      price: parseFloat(assignForm.price) || pkg.price,
      notes: assignForm.notes || null,
      status: 'active',
    }).select().single()

    if (cpData) {
      await supabase.from('payments').insert({
        trainer_id: trainerId, client_id: clientId,
        client_package_id: cpData.id,
        amount: cpData.price, status: 'pending',
      })
    }

    setShowAssignDialog(false)
    setAssignForm({ package_id: '', start_date: new Date().toISOString().split('T')[0], price: '', notes: '' })
    fetchData()
  }

  const markAsPaid = async () => {
    if (!selectedCp) return
    const payment = selectedCp.payments?.[0]
    if (!payment) return
    await supabase.from('payments').update({
      status: 'paid',
      amount: parseFloat(paymentForm.amount) || selectedCp.price,
      paid_at: paymentForm.paid_at,
      notes: paymentForm.notes || null,
    }).eq('id', payment.id)
    setShowPaymentDialog(false)
    fetchData()
  }

  const openPayment = (cp: ClientPackage) => {
    setSelectedCp(cp)
    setPaymentForm({ amount: cp.price.toString(), paid_at: new Date().toISOString().split('T')[0], notes: '' })
    setShowPaymentDialog(true)
  }

  // Summary calculations
  const totalInvoiced = clientPackages.reduce((s, cp) => s + cp.price, 0)
  const totalPaid = clientPackages.reduce((s, cp) => {
    const p = cp.payments?.[0]
    return s + (p?.status === 'paid' ? (p.amount || cp.price) : 0)
  }, 0)
  const outstanding = totalInvoiced - totalPaid
  const active = clientPackages.filter(cp => cp.status === 'active')
  const past = clientPackages.filter(cp => cp.status !== 'active')

  if (loading) return <p className="text-sm text-gray-500">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('title')}</h3>
        <Button size="sm" onClick={() => setShowAssignDialog(true)} className="flex items-center gap-1">
          <Plus size={13} /> {t('assignPackage')}
        </Button>
      </div>

      {/* Summary row */}
      {clientPackages.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ukupno fakturirano', value: `${totalInvoiced.toFixed(0)} €`, cls: 'text-gray-900' },
            { label: 'Plaćeno', value: `${totalPaid.toFixed(0)} €`, cls: 'text-emerald-600' },
            { label: 'Duguje', value: `${outstanding.toFixed(0)} €`, cls: outstanding > 0 ? 'text-red-600' : 'text-gray-400' },
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
          {/* Active packages */}
          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aktivan</p>
              {active.map(cp => <PackageCard key={cp.id} cp={cp} expanded={expandedIds.has(cp.id)} onToggle={() => toggleExpand(cp.id)} payStatus={getPaymentStatus(cp)} onPay={() => openPayment(cp)} />)}
            </div>
          )}

          {/* Past packages */}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Prethodni</p>
              {past.map(cp => <PackageCard key={cp.id} cp={cp} expanded={expandedIds.has(cp.id)} onToggle={() => toggleExpand(cp.id)} payStatus={getPaymentStatus(cp)} onPay={() => openPayment(cp)} />)}
            </div>
          )}
        </>
      )}

      {/* Assign dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('assignPackage')}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('packageLabel')}</Label>
              <select
                value={assignForm.package_id}
                onChange={e => {
                  const pkg = availablePackages.find(p => p.id === e.target.value)
                  setAssignForm({ ...assignForm, package_id: e.target.value, price: pkg?.price.toString() || '' })
                }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">{t('selectPackage')}</option>
                {availablePackages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.price} € · {pkg.duration_days} dana</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('startDate')}</Label>
                <Input type="date" value={assignForm.start_date}
                  onChange={e => setAssignForm({ ...assignForm, start_date: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('price')}</Label>
                <Input type="number" value={assignForm.price}
                  onChange={e => setAssignForm({ ...assignForm, price: e.target.value })}
                  className="h-8 text-sm" placeholder={t('pricePlaceholder')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('notesOptional')}</Label>
              <Input value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })}
                className="h-8 text-sm" placeholder={t('notesPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={assignPackage} disabled={!assignForm.package_id}>{tCommon('assign')}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAssignDialog(false)}>{tCommon('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Označi plaćanje</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-gray-500">
              Paket: <span className="font-medium text-gray-800">{selectedCp?.packages?.name}</span>
              <span className="ml-2 text-gray-400">({fmtDate(selectedCp?.start_date ?? null)} – {fmtDate(selectedCp?.end_date ?? null)})</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Iznos (€)</Label>
                <Input type="number" value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Datum plaćanja</Label>
                <Input type="date" value={paymentForm.paid_at}
                  onChange={e => setPaymentForm({ ...paymentForm, paid_at: e.target.value })} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Napomena (opcionalno)</Label>
              <Input value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="h-8 text-sm" placeholder="Npr. gotovina, poseban dogovor..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={markAsPaid}><Check size={13} className="mr-1" /> Potvrdi plaćanje</Button>
              <Button size="sm" variant="outline" onClick={() => setShowPaymentDialog(false)}>{tCommon('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PackageCard({ cp, expanded, onToggle, payStatus, onPay }: {
  cp: ClientPackage
  expanded: boolean
  onToggle: () => void
  payStatus: 'paid' | 'upcoming' | 'pending' | 'late'
  onPay: () => void
}) {
  const left = daysLeft(cp.end_date)
  const progress = Math.max(0, Math.min(100,
    ((Date.now() - new Date(cp.start_date).getTime()) /
     (new Date(cp.end_date).getTime() - new Date(cp.start_date).getTime())) * 100
  ))
  const payment = cp.payments?.[0]

  return (
    <Card className={`overflow-hidden ${cp.status !== 'active' ? 'opacity-70' : ''}`}>
      {/* Colored top bar */}
      <div className="h-1" style={{ backgroundColor: cp.packages?.color || '#6366f1' }} />
      <CardContent className="py-3 px-4 space-y-2">
        {/* Header row */}
        <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-left">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cp.packages?.color || '#6366f1' }} />
            <span className="font-medium text-sm">{cp.packages?.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{cp.price} €</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PaymentStatusBadge status={payStatus} daysLeftVal={left > 0 ? left : undefined} />
            {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </button>

        {/* Date range + progress */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{fmtDate(cp.start_date)} – {fmtDate(cp.end_date)}</span>
          {cp.status === 'active' && (
            <span className={left >= 0 ? 'text-gray-400' : 'text-red-500 font-medium'}>
              {left >= 0 ? `${left} dana ostalo` : `${Math.abs(left)} dana prekoračeno`}
            </span>
          )}
        </div>

        {cp.status === 'active' && (
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: cp.packages?.color || '#6366f1', opacity: 0.6 }}
            />
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="pt-2 space-y-3 border-t border-gray-50 mt-1">
            {/* Payment detail */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Plaćanje</p>
                {payment ? (
                  <div>
                    <p className="text-sm">
                      <span className={payment.status === 'paid' ? 'text-emerald-600 font-medium' : 'text-gray-600'}>
                        {payment.status === 'paid' ? `${payment.amount} € plaćeno` : `${cp.price} € na čekanju`}
                      </span>
                    </p>
                    {payment.status === 'paid' && payment.paid_at && (
                      <p className="text-xs text-gray-400">{fmtDate(payment.paid_at)}</p>
                    )}
                    {payment.notes && <p className="text-xs text-gray-400 italic">{payment.notes}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Nema zapisa o plaćanju</p>
                )}
              </div>
              {payStatus !== 'paid' && (
                <Button size="sm" variant="outline" onClick={onPay} className="h-7 text-xs gap-1">
                  <CreditCard size={11} /> Označi plaćeno
                </Button>
              )}
            </div>
            {cp.notes && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Napomena</p>
                <p className="text-xs text-gray-600">{cp.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
