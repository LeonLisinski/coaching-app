'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, CreditCard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useTranslations } from 'next-intl'

type Package = {
  id: string
  name: string
  price: number
  duration_days: number
  color: string
}

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

type Payment = {
  id: string
  amount: number
  paid_at: string | null
  status: string
  notes: string | null
}

type Props = {
  clientId: string
}

export default function ClientPackages({ clientId }: Props) {
  const t = useTranslations('clients.packages')
  const tCommon = useTranslations('common')

  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([])
  const [availablePackages, setAvailablePackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedClientPackage, setSelectedClientPackage] = useState<ClientPackage | null>(null)
  const [trainerId, setTrainerId] = useState<string | null>(null)

  const [assignForm, setAssignForm] = useState({
    package_id: '',
    start_date: new Date().toISOString().split('T')[0],
    price: '',
    notes: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paid_at: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setTrainerId(user.id)

    const [{ data: cpData }, { data: pkgData }] = await Promise.all([
      supabase
        .from('client_packages')
        .select(`*, packages(*), payments(*)`)
        .eq('client_id', clientId)
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('packages')
        .select('*')
        .eq('trainer_id', user.id)
        .eq('active', true)
    ])

    if (cpData) setClientPackages(cpData)
    if (pkgData) setAvailablePackages(pkgData)
    setLoading(false)
  }

  const getPaymentStatus = (cp: ClientPackage): 'paid' | 'upcoming' | 'pending' | 'late' => {
    const payment = cp.payments?.[0]
    if (!payment) return 'pending'
    if (payment.status === 'paid') return 'paid'
    const endDate = new Date(cp.end_date)
    const now = new Date()
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (now > endDate) return 'late'
    if (diffDays <= 3) return 'upcoming'
    return 'pending'
  }

  const statusLabel = {
    paid: { label: t('paid'), color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    upcoming: { label: 'Dospijeva uskoro', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    pending: { label: 'Čeka plaćanje', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
    late: { label: 'Kasni', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  }

  const assignPackage = async () => {
    if (!trainerId || !assignForm.package_id) return
    const pkg = availablePackages.find(p => p.id === assignForm.package_id)
    if (!pkg) return

    const startDate = new Date(assignForm.start_date)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + pkg.duration_days)

    const { data: cpData, error } = await supabase
      .from('client_packages')
      .insert({
        trainer_id: trainerId,
        client_id: clientId,
        package_id: assignForm.package_id,
        start_date: assignForm.start_date,
        end_date: endDate.toISOString().split('T')[0],
        price: parseFloat(assignForm.price) || pkg.price,
        notes: assignForm.notes || null,
      })
      .select()
      .single()

    if (cpData) {
      await supabase.from('payments').insert({
        trainer_id: trainerId,
        client_id: clientId,
        client_package_id: cpData.id,
        amount: cpData.price,
        status: 'pending',
      })
    }

    setShowAssignDialog(false)
    setAssignForm({ package_id: '', start_date: new Date().toISOString().split('T')[0], price: '', notes: '' })
    fetchData()
  }

  const markAsPaid = async () => {
    if (!selectedClientPackage || !trainerId) return
    const payment = selectedClientPackage.payments?.[0]
    if (!payment) return

    await supabase.from('payments').update({
      status: 'paid',
      amount: parseFloat(paymentForm.amount) || selectedClientPackage.price,
      paid_at: paymentForm.paid_at,
      notes: paymentForm.notes || null,
    }).eq('id', payment.id)

    setShowPaymentDialog(false)
    fetchData()
  }

  const openPaymentDialog = (cp: ClientPackage) => {
    setSelectedClientPackage(cp)
    setPaymentForm({
      amount: cp.price.toString(),
      paid_at: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setShowPaymentDialog(true)
  }

  if (loading) return <p className="text-sm text-gray-500">{tCommon('loading')}</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('title')}</h3>
        <Button size="sm" onClick={() => setShowAssignDialog(true)} className="flex items-center gap-1">
          <Plus size={13} />
          {t('assignPackage')}
        </Button>
      </div>

      {clientPackages.length === 0 ? (
        <p className="text-sm text-gray-400">{t('noPackages')}</p>
      ) : (
        clientPackages.map(cp => {
          const status = getPaymentStatus(cp)
          const s = statusLabel[status]
          return (
            <Card key={cp.id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div
                      style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cp.packages?.color || '#3b82f6', marginTop: 4, flexShrink: 0 }}
                    />
                    <div>
                      <p className="font-medium text-sm">{cp.packages?.name}</p>
                      <p className="text-xs text-gray-400">
                        {cp.start_date} → {cp.end_date} • {cp.price}€
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 99,
                        backgroundColor: s.bg,
                        color: s.color,
                        border: `1px solid ${s.border}`,
                        fontWeight: 500,
                      }}
                    >
                      {s.label}
                    </span>
                    {status !== 'paid' && (
                      <Button size="sm" variant="outline" onClick={() => openPaymentDialog(cp)} className="h-6 text-xs px-2">
                        <CreditCard size={11} className="mr-1" />
                        {t('markPaid')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assignPackage')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('packageLabel')}</Label>
              <select
                value={assignForm.package_id}
                onChange={(e) => {
                  const pkg = availablePackages.find(p => p.id === e.target.value)
                  setAssignForm({ ...assignForm, package_id: e.target.value, price: pkg?.price.toString() || '' })
                }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">{t('selectPackage')}</option>
                {availablePackages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} • {pkg.price}€ • {pkg.duration_days} {t('days', { count: pkg.duration_days })}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('startDate')}</Label>
                <Input
                  type="date"
                  value={assignForm.start_date}
                  onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('price')}</Label>
                <Input
                  type="number"
                  value={assignForm.price}
                  onChange={(e) => setAssignForm({ ...assignForm, price: e.target.value })}
                  className="h-8 text-sm"
                  placeholder={t('pricePlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('notesOptional')}</Label>
              <Input
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                className="h-8 text-sm"
                placeholder={t('notesPlaceholder')}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={assignPackage} disabled={!assignForm.package_id}>
                {tCommon('assign')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAssignDialog(false)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('markPaid')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-gray-500">
              {t('packageInPayment')} <span className="font-medium text-gray-800">{selectedClientPackage?.packages?.name}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('amount')}</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('paymentDate')}</Label>
                <Input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('notesOptional')}</Label>
              <Input
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="h-8 text-sm"
                placeholder={t('paymentNotesPlaceholder')}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={markAsPaid}>
                {tCommon('confirm')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowPaymentDialog(false)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
