'use client'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Banknote, CheckCircle2, Clock, Trash2, RotateCcw, Check, AlertTriangle } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function avatarCls(gender: string | null) {
  if (gender === 'F') return 'bg-gradient-to-br from-rose-400 to-pink-500'
  if (gender === 'M') return 'bg-gradient-to-br from-sky-400 to-blue-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-500'
}

type PackageItem = {
  id: string
  price: number
  startDate: string
  endDate: string
  isPaid: boolean
  paidAmount: number
  paymentId: string | null
  clientName: string
  clientGender: string | null
  packageName: string | null
}

export default function MobileFinanceView() {
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const tF = useTranslations('finance2')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [items, setItems] = useState<PackageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'unpaid' | 'all'>('unpaid')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionItem, setActionItem] = useState<PackageItem | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const [{ data: cpData }, { data: pkgData }, { data: clientsData }] = await Promise.all([
      supabase.from('client_packages')
        .select('id, client_id, package_id, start_date, end_date, price, payments(*)')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('packages').select('id, name').eq('trainer_id', user.id),
      supabase.from('clients')
        .select('id, gender, profiles!clients_user_id_fkey(full_name)')
        .eq('trainer_id', user.id),
    ])

    const pkgMap: Record<string, string> = {}
    pkgData?.forEach(p => { pkgMap[p.id] = p.name })

    const clientMap: Record<string, { name: string; gender: string | null }> = {}
    clientsData?.forEach((c: any) => {
      clientMap[c.id] = { name: c.profiles?.full_name || '—', gender: c.gender || null }
    })

    setItems((cpData || []).map((cp: any) => {
      const payment = cp.payments?.[0]
      const isPaid = payment?.status === 'paid'
      return {
        id: cp.id,
        price: cp.price || 0,
        startDate: cp.start_date,
        endDate: cp.end_date,
        isPaid,
        paidAmount: isPaid ? (payment?.amount || cp.price || 0) : 0,
        paymentId: payment?.id || null,
        clientName: clientMap[cp.client_id]?.name || '—',
        clientGender: clientMap[cp.client_id]?.gender || null,
        packageName: pkgMap[cp.package_id] || null,
      }
    }))
    setLoading(false)
  }

  const markPaid = async (item: PackageItem) => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    if (item.paymentId) {
      await supabase.from('payments').update({ status: 'paid', paid_at: today, amount: item.price }).eq('id', item.paymentId)
    } else {
      await supabase.from('payments').insert({
        trainer_id: user.id, client_id: undefined, client_package_id: item.id,
        amount: item.price, paid_at: today, status: 'paid',
      })
    }
    setActionItem(null)
    fetchData()
  }

  const markUnpaid = async (item: PackageItem) => {
    if (!item.paymentId) return
    await supabase.from('payments').update({ status: 'pending', paid_at: null }).eq('id', item.paymentId)
    setActionItem(null)
    fetchData()
  }

  const deletePkg = async (id: string) => {
    await supabase.from('payments').delete().eq('client_package_id', id)
    await supabase.from('client_packages').delete().eq('id', id)
    setConfirmDeleteId(null)
    setActionItem(null)
    fetchData()
  }

  const paid   = items.filter(p => p.isPaid)
  const unpaid = items.filter(p => !p.isPaid)
  const totalFakturirano = items.reduce((s, p) => s + p.price, 0)
  const totalPaid   = paid.reduce((s, p) => s + p.paidAmount, 0)
  const totalUnpaid = unpaid.reduce((s, p) => s + p.price, 0)

  const displayed = tab === 'unpaid' ? unpaid : items

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-36 bg-gray-100 rounded-3xl" />
      <div className="h-24 bg-gray-100 rounded-2xl" />
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">{tF('mobileSectionTitle')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{tF('mobileSectionSub')}</p>
      </div>

      {/* Summary card */}
      <div className="rounded-3xl px-5 py-5 text-white overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${accentHex} 0%, color-mix(in srgb, ${accentHex} 70%, #0f0a1e) 100%)` }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />
        <p className="text-white/60 text-xs font-medium uppercase tracking-wide">{tF('mobileTotalLabel')}</p>
        <p className="text-white font-black text-3xl mt-1">{totalFakturirano.toLocaleString('hr-HR')} €</p>
        <div className="flex gap-6 mt-4">
          <div>
            <p className="text-white/60 text-xs">{tF('mobileCollectedLabel')}</p>
            <p className="text-emerald-300 font-bold text-lg">{totalPaid.toLocaleString('hr-HR')} €</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">{tF('mobilePendingLabel')}</p>
            <p className={`font-bold text-lg ${totalUnpaid > 0 ? 'text-yellow-300' : 'text-white/40'}`}>
              {totalUnpaid.toLocaleString('hr-HR')} €
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: tF('mobileStatTotal'),   value: items.length,   icon: Banknote,     color: accentHex  },
          { label: tF('mobileStatPaid'),    value: paid.length,    icon: CheckCircle2, color: '#16a34a'  },
          { label: tF('mobileStatUnpaid'),  value: unpaid.length,  icon: Clock,        color: unpaid.length > 0 ? '#d97706' : '#6b7280' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1.5"
                style={{ backgroundColor: `${s.color}18` }}>
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 font-medium leading-tight">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['unpaid', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${tab === t ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={tab === t ? { backgroundColor: accentHex } : {}}>
            {t === 'unpaid' ? tF('mobileTabUnpaid', { count: unpaid.length }) : tF('mobileTabAll', { count: items.length })}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-center">
          <div>
            <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-500">{tF('mobileAllPaidMsg')}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {displayed.map(p => (
              <button key={p.id} onClick={() => setActionItem(p)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors">
                <div className={`w-10 h-10 rounded-xl ${avatarCls(p.clientGender)} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-xs font-bold">{getInitials(p.clientName)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.clientName}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {p.packageName || tF('mobileDefaultPkg')}
                    {p.endDate && ` · do ${new Date(p.endDate).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">{p.price.toLocaleString('hr-HR')} €</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-yellow-50 text-yellow-600'}`}>
                    {p.isPaid ? tF('paidLabel') : tF('unpaidLabel')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom action sheet */}
      {actionItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setActionItem(null)}>
          <div className="w-full bg-white rounded-t-3xl shadow-2xl pb-safe" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5 pb-2">
              <p className="font-bold text-gray-900 text-sm">{actionItem.clientName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {actionItem.packageName} · {actionItem.price.toLocaleString('hr-HR')} €
              </p>

              {/* Late payment note */}
              {!actionItem.isPaid && actionItem.endDate < new Date().toISOString().split('T')[0] && (
                <div className="flex items-start gap-2 mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-600">
                    {tF('mobileLateWarning')}{' '}
                    <span className="font-bold">{new Date(actionItem.endDate).toLocaleDateString(locale)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="px-4 pb-6 pt-2 space-y-2">
              {!actionItem.isPaid ? (
                <button onClick={() => markPaid(actionItem)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-white font-semibold text-sm"
                  style={{ backgroundColor: accentHex }}>
                  <Check size={16} /> {tF('mobileMarkPaid')}
                </button>
              ) : (
                <button onClick={() => markUnpaid(actionItem)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm">
                  <RotateCcw size={16} /> {tF('mobileMarkUnpaid')}
                </button>
              )}
              <button onClick={() => { setConfirmDeleteId(actionItem.id); setActionItem(null) }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-semibold text-sm">
                <Trash2 size={16} /> {tF('mobileDeleteRecord')}
              </button>
              <button onClick={() => setActionItem(null)}
                className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-semibold text-sm">
                {tCommon('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-center text-sm font-bold text-gray-900">{tF('deleteConfirmTitle')}</h3>
            <p className="text-center text-xs text-gray-500 mt-1.5 mb-5">
              {tF('mobileDeleteConfirmDesc')}
            </p>
            <div className="flex gap-2">
              <button onClick={() => deletePkg(confirmDeleteId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm">
                {tF('deleteBtn')}
              </button>
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
                {tCommon('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
