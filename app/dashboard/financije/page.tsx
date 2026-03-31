'use client'
export const dynamic = 'force-dynamic'

import MobileFinanceView from '@/app/dashboard/financije/mobile-finance-view'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid,
} from 'recharts'
import {
  Banknote, TrendingUp, AlertTriangle, Package,
  Check, Clock, ArrowUpRight, ArrowDownRight,
  Calendar, Filter, Trash2, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTranslations } from 'next-intl'

// Builds ISO date string from LOCAL date components — avoids UTC offset shifting the date
function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayIso() { return localIso(new Date()) }

// ─── Types ────────────────────────────────────────────────────────────────────
type Payment = {
  id: string
  amount: number
  paid_at: string | null
  status: string
  notes: string | null
  client_package_id: string
}

type ClientPackage = {
  id: string
  client_id: string
  package_id: string
  start_date: string
  end_date: string
  price: number
  status: string
  notes: string | null
  created_at: string
  // joined separately
  client_name: string
  client_gender: string | null
  pkg_name: string
  pkg_color: string
  pkg_duration: number
  payments: Payment[]
}

type PkgTemplate = { id: string; name: string; price: number; color: string; active: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}. ${m}. ${y}.`
}
function fmtEur(n: number) {
  return new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €'
}
function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
}

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, trend, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  trend?: { dir: 'up' | 'down' | 'neutral'; pct: number }; color: string
}) {
  const cols: Record<string, { bg: string; ico: string; val: string }> = {
    emerald: { bg: 'bg-emerald-50', ico: 'text-emerald-500', val: 'text-emerald-600' },
    violet:  { bg: 'bg-violet-50',  ico: 'text-violet-500',  val: 'text-violet-600' },
    amber:   { bg: 'bg-amber-50',   ico: 'text-amber-500',   val: 'text-amber-600' },
    red:     { bg: 'bg-red-50',     ico: 'text-red-500',     val: 'text-red-600' },
    sky:     { bg: 'bg-sky-50',     ico: 'text-sky-500',     val: 'text-sky-600' },
  }
  const c = cols[color] || cols.violet
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={18} className={c.ico} />
        </div>
        {trend && trend.dir !== 'neutral' && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend.dir === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {trend.dir === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend.pct}%
          </div>
        )}
      </div>
      <p className={`text-2xl font-extrabold leading-none ${c.val}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status, daysLeftVal, t }: { status: string; daysLeftVal?: number; t: (k: string, v?: any) => string }) {
  const cfg: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    paid:     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: t('finance.status.paid'),    icon: <Check size={10} /> },
    pending:  { cls: 'bg-gray-50 text-gray-600 border-gray-200',          label: t('finance.status.pending'), icon: <Clock size={10} /> },
    upcoming: { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: t('finance.status.upcomingDays', { days: daysLeftVal }), icon: <Clock size={10} /> },
    late:     { cls: 'bg-red-50 text-red-700 border-red-200',             label: t('finance.status.late'),    icon: <AlertTriangle size={10} /> },
  }
  const c = cfg[status] || cfg.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function FinancijePageContent() {
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'
  const tRaw = useTranslations()
  const t = (key: string, values?: any) => tRaw(key as any, values)
  const tMonths = useTranslations('common.months')
  const tMonthsFull = useTranslations('common.monthsFull')

  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([])
  const [pkgTemplates, setPkgTemplates] = useState<PkgTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
  const [pkgFilter, setPkgFilter] = useState<string>('all')
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [selectedCp, setSelectedCp] = useState<ClientPackage | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', paid_at: todayIso(), notes: '' })
  const [saving, setSaving] = useState(false)
  const [histPage, setHistPage] = useState(0)
  const [justMarkedId, setJustMarkedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const HIST_PER_PAGE = 10

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch client_packages, packages, payments separately to avoid broken FK joins
    const [{ data: cpData }, { data: pkgData }, { data: clientsData }] = await Promise.all([
      supabase.from('client_packages')
        .select(`id, client_id, package_id, start_date, end_date, price, status, notes, created_at, payments(*)`)
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('packages').select('id, name, color, duration_days, price, active').eq('trainer_id', user.id),
      supabase.from('clients')
        .select('id, gender, profiles!clients_user_id_fkey(full_name)')
        .eq('trainer_id', user.id),
    ])

    // Build lookup maps
    const pkgMap: Record<string, { name: string; color: string; duration_days: number }> = {}
    pkgData?.forEach(p => { pkgMap[p.id] = { name: p.name, color: p.color, duration_days: p.duration_days } })

    const clientMap: Record<string, { name: string; gender: string | null }> = {}
    clientsData?.forEach((c: any) => {
      clientMap[c.id] = { name: c.profiles?.full_name || 'Nepoznato', gender: c.gender }
    })

    const enriched: ClientPackage[] = (cpData || []).map((cp: any) => ({
      ...cp,
      client_name: clientMap[cp.client_id]?.name || '—',
      client_gender: clientMap[cp.client_id]?.gender || null,
      pkg_name: pkgMap[cp.package_id]?.name || '—',
      pkg_color: pkgMap[cp.package_id]?.color || '#6366f1',
      pkg_duration: pkgMap[cp.package_id]?.duration_days || 30,
    }))

    setClientPackages(enriched)
    if (pkgData) setPkgTemplates(pkgData)
    setLoading(false)
  }

  const getPayStatus = (cp: ClientPackage): string => {
    const p = cp.payments?.[0]
    if (!p) return 'pending'
    if (p.status === 'paid') return 'paid'
    const left = daysLeft(cp.end_date)
    if (left < 0) return 'late'
    if (left <= 7) return 'upcoming'
    return 'pending'
  }

  // Revenue using paid_at (matches dashboard logic)
  const getPaidAmount = (cp: ClientPackage): number => {
    const p = cp.payments?.[0]
    return p?.status === 'paid' ? (p.amount || cp.price) : 0
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const monthStart = localIso(new Date(thisYear, thisMonth, 1))
  const monthEnd   = localIso(new Date(thisYear, thisMonth + 1, 0))

  // Filter only by package template (not year) for stats/chart — year filter applies to history table
  const filteredByPkg = useMemo(() => {
    if (pkgFilter === 'all') return clientPackages
    return clientPackages.filter(cp => cp.package_id === pkgFilter)
  }, [clientPackages, pkgFilter])

  const stats = useMemo(() => {
    // Prihod po start_date paketa — paket pripada mjesecu u kojem je počeo
    const lastMonthStart = localIso(new Date(thisYear, thisMonth === 0 ? 11 : thisMonth - 1, 1))
    const lastMonthEnd   = localIso(new Date(thisYear, thisMonth, 0))
    const yearStart = `${thisYear}-01-01`
    const yearEnd   = `${thisYear}-12-31`

    let paidThisMonth = 0, expectedThisMonth = 0, paidByStartThisMonth = 0
    let paidLastMonth = 0
    let paidThisYear  = 0

    filteredByPkg.forEach(cp => {
      // Koristi .find() umjesto [0] — ispravno ako ima više payment zapisa
      const paidPayment = cp.payments?.find((p: Payment) => p.status === 'paid')
      const hasPaid = !!paidPayment
      const price   = cp.price
      const paidAt  = paidPayment?.paid_at || null
      const paidAmt = paidPayment?.amount || price

      // Naplaćeno = plaćanja s paid_at u tekućem/prošlom mj / ovoj godini (stvarni tok)
      // paid_at može biti timestamp ("2026-03-31T22:00:00+00:00") pa uzimamo samo prvih 10 znakova
      const paidDate = paidAt ? (paidAt as string).substring(0, 10) : null
      if (hasPaid && paidDate) {
        if (paidDate >= monthStart     && paidDate <= monthEnd)     paidThisMonth += paidAmt
        if (paidDate >= lastMonthStart && paidDate <= lastMonthEnd) paidLastMonth += paidAmt
        if (paidDate >= yearStart      && paidDate <= yearEnd)      paidThisYear  += paidAmt
      }
      // Paketi koji POČINJU ovaj mj:
      // naplaćeno = svi plaćeni (uključujući expired), očekivano = samo aktivni neplaćeni
      if (cp.start_date >= monthStart && cp.start_date <= monthEnd) {
        if (hasPaid)                        paidByStartThisMonth += paidAmt
        else if (cp.status === 'active')    expectedThisMonth    += price
      }
    })

    const totalThisMonth = paidByStartThisMonth + expectedThisMonth

    // Neplaćeno ukupno = svi aktivni paketi bez uplate (bez filtra po datumu)
    const outstanding = filteredByPkg.reduce((s, cp) => {
      const hasPaid = cp.payments?.[0]?.status === 'paid'
      return s + (hasPaid ? 0 : cp.price)
    }, 0)

    const activePkgs    = filteredByPkg.filter(cp => cp.status === 'active').length
    const activeClients = new Set(filteredByPkg.filter(cp => cp.status === 'active').map(cp => cp.client_id)).size
    const monthTrend    = paidLastMonth > 0
      ? Math.round(((paidThisMonth - paidLastMonth) / paidLastMonth) * 100)
      : 0

    return { paidThisMonth, expectedThisMonth, paidByStartThisMonth, totalThisMonth, paidThisYear, outstanding, activePkgs, activeClients, monthTrend }
  }, [filteredByPkg, thisMonth, thisYear, monthStart, monthEnd])

  // ── Monthly chart (last 12 months, by paid_at) ────────────────────────────
  const monthlyData = useMemo(() => {
    const data: { month: string; naplaceno: number; fakturirano: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const m = d.getMonth()
      const y = d.getFullYear()
      const mStart = localIso(new Date(y, m, 1))
      const mEnd   = localIso(new Date(y, m + 1, 0))

      // naplaćeno = stvarni iznos plaćanja (svi plaćeni, uključujući expired)
      // fakturirano = samo aktivni neplaćeni (expired bez uplate idu u "Neplaćeno", ne ovdje)
      let naplaceno = 0, fakturirano = 0
      filteredByPkg.forEach(cp => {
        if (cp.start_date >= mStart && cp.start_date <= mEnd) {
          const paidPayment = cp.payments?.find((p: Payment) => p.status === 'paid')
          const hasPaid = !!paidPayment
          const paidAmt = paidPayment?.amount || cp.price
          if (hasPaid)                     naplaceno   += paidAmt
          else if (cp.status === 'active') fakturirano += cp.price
        }
      })

      const label = `${tMonths(String(m) as any)}${y !== thisYear ? ` '${String(y).slice(2)}` : ''}`
      data.push({ month: label.trim(), naplaceno, fakturirano })
    }
    return data
  }, [filteredByPkg, thisYear])

  // ── Package popularity ─────────────────────────────────────────────────────
  const pkgPopularity = useMemo(() => {
    const map: Record<string, { name: string; color: string; count: number; revenue: number }> = {}
    clientPackages.forEach(cp => {
      const id = cp.package_id
      if (!map[id]) map[id] = { name: cp.pkg_name, color: cp.pkg_color, count: 0, revenue: 0 }
      map[id].count++
      map[id].revenue += getPaidAmount(cp)
    })
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [clientPackages])

  // ── Filtered + pending ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return clientPackages.filter(cp => {
      const year = new Date(cp.start_date).getFullYear()
      if (yearFilter && year !== yearFilter) return false
      if (pkgFilter !== 'all' && cp.package_id !== pkgFilter) return false
      return true
    })
  }, [clientPackages, yearFilter, pkgFilter])

  const pendingList = useMemo(() => {
    return filteredByPkg
      .filter(cp => ['pending', 'late', 'upcoming'].includes(getPayStatus(cp)))
      .sort((a, b) => {
        const order: Record<string, number> = { late: 0, upcoming: 1, pending: 2 }
        return (order[getPayStatus(a)] ?? 2) - (order[getPayStatus(b)] ?? 2)
      })
  }, [filteredByPkg])

  const allHistory = useMemo(() =>
    [...filtered].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()),
    [filtered])
  const pagedHistory = allHistory.slice(histPage * HIST_PER_PAGE, (histPage + 1) * HIST_PER_PAGE)

  const availableYears = useMemo(() => {
    const years = new Set<number>(clientPackages.map(cp => new Date(cp.start_date).getFullYear()))
    years.add(thisYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [clientPackages, thisYear])

  const markPaid = async () => {
    if (!selectedCp) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return }
      const payment = selectedCp.payments?.[0]
      const amount = parseFloat(payForm.amount) || selectedCp.price
      if (payment) {
        const { error } = await supabase.from('payments').update({
          status: 'paid', amount, paid_at: payForm.paid_at, notes: payForm.notes || null,
        }).eq('id', payment.id)
        if (error) throw error
      } else {
        // Use upsert on client_package_id to avoid duplicate key errors
        const { error } = await supabase.from('payments').upsert({
          trainer_id: user.id, client_id: selectedCp.client_id,
          client_package_id: selectedCp.id, amount,
          paid_at: payForm.paid_at, status: 'paid', notes: payForm.notes || null,
        }, { onConflict: 'client_package_id' })
        if (error) throw error
      }
      setShowPayDialog(false)
      await fetchData()
    } catch (err: any) {
      alert(`Greška pri spremanju: ${err?.message || 'Nepoznata greška'}`)
    } finally {
      setSaving(false)
    }
  }

  const openPayDialog = (cp: ClientPackage) => {
    setSelectedCp(cp)
    setPayForm({ amount: cp.price.toString(), paid_at: todayIso(), notes: '' })
    setShowPayDialog(true)
  }

  const inlineMarkPaid = async (cp: ClientPackage) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = todayIso()
      const payment = cp.payments?.[0]
      let error: any = null
      if (payment) {
        ;({ error } = await supabase.from('payments')
          .update({ status: 'paid', amount: payment.amount || cp.price, paid_at: today })
          .eq('id', payment.id))
      } else {
        // upsert on client_package_id avoids duplicate key if payment already exists
        ;({ error } = await supabase.from('payments').upsert({
          trainer_id: user.id, client_id: cp.client_id, client_package_id: cp.id,
          amount: cp.price, paid_at: today, status: 'paid',
        }, { onConflict: 'client_package_id' }))
      }
      if (error) throw error
      setJustMarkedId(cp.id)
      setTimeout(() => setJustMarkedId(null), 3000)
      await fetchData()
    } catch (err: any) {
      alert(`Greška pri označavanju: ${err?.message || 'Nepoznata greška'}`)
    }
  }

  const markUnpaid = async (cp: ClientPackage) => {
    const payment = cp.payments?.[0]
    if (!payment) return
    await supabase.from('payments').update({ status: 'pending', paid_at: null }).eq('id', payment.id)
    fetchData()
  }

  const deletePkg = async (cpId: string) => {
    await supabase.from('payments').delete().eq('client_package_id', cpId)
    await supabase.from('client_packages').delete().eq('id', cpId)
    setConfirmDeleteId(null)
    fetchData()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-[var(--app-accent)] animate-spin" />
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentHex}15` }}>
              <Banknote size={18} style={{ color: accentHex }} />
            </span>
            {t('finance.title')}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('finance.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm">
            <Calendar size={14} className="text-gray-400" />
            <select value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}
              className="bg-transparent text-gray-700 font-medium focus:outline-none text-sm">
              {availableYears.map(y => <option key={y} value={y}>{y}.</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm">
            <Filter size={14} className="text-gray-400" />
            <select value={pkgFilter} onChange={e => { setPkgFilter(e.target.value); setHistPage(0) }}
              className="bg-transparent text-gray-700 font-medium focus:outline-none text-sm max-w-[140px]">
              <option value="all">{t('finance.allPackages')}</option>
              {pkgTemplates.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`${t('finance.stats.paidThisMonth')} — ${tMonthsFull(String(thisMonth) as any)}`}
          value={fmtEur(stats.paidThisMonth)}
          sub={stats.totalThisMonth > 0 ? `${fmtEur(stats.paidByStartThisMonth)} / ${fmtEur(stats.totalThisMonth)} po paketu` : stats.monthTrend !== 0 ? t('finance.stats.vsLastMonth') : undefined}
          icon={TrendingUp}
          color="emerald"
          trend={stats.monthTrend !== 0 ? { dir: stats.monthTrend >= 0 ? 'up' : 'down', pct: Math.abs(stats.monthTrend) } : { dir: 'neutral', pct: 0 }}
        />
        <StatCard label={`${t('finance.stats.paidThisYear')} — ${thisYear}.`} value={fmtEur(stats.paidThisYear)} icon={Banknote} color="violet" />
        <StatCard
          label={t('finance.stats.outstanding')}
          value={fmtEur(stats.outstanding)}
          sub={`${pendingList.length} ${t('finance.popularity.clients')}`}
          icon={AlertTriangle}
          color={stats.outstanding > 0 ? 'red' : 'sky'}
        />
        <StatCard label={t('finance.stats.activeClients')} value={stats.activePkgs.toString()} sub={`${stats.activeClients} ${t('finance.popularity.clients')}`} icon={Package} color="sky" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Monthly bar chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">{t('finance.chart.title')}</h2>
          <p className="text-xs text-gray-400 mb-4">{t('dashboard.revenue.title')}</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={monthlyData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}€`} />
              <Tooltip
                formatter={(v: any, name: any) => [`${v} €`, name === 'naplaceno' ? t('dashboard.revenue.collected') : t('dashboard.revenue.expected')] as any}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="naplaceno" stackId="rev" fill={accentHex} fillOpacity={0.85} radius={[0, 0, 0, 0]} />
              <Bar dataKey="fakturirano" stackId="rev" fill={`${accentHex}30`} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: `${accentHex}20` }} /> {t('dashboard.revenue.expected')}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: accentHex, opacity: 0.85 }} /> {t('dashboard.revenue.collected')}
            </span>
          </div>
        </div>

        {/* Package popularity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">{t('finance.popularity.title')}</h2>
          <p className="text-xs text-gray-400 mb-4">{t('finance.package')}</p>
          {pkgPopularity.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Package size={28} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">{t('finance.popularity.noPackages')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pkgPopularity.map((p, i) => {
                const maxCount = pkgPopularity[0].count
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-xs font-medium text-gray-700 truncate">{p.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">{p.count}× · {fmtEur(p.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.count / maxCount) * 100}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pending / late */}
      {pendingList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-800">{t('finance.status.pending')}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200">{pendingList.length}</span>
            </div>
            <p className="text-xs text-gray-400 font-medium">{fmtEur(pendingList.reduce((s, cp) => s + cp.price, 0))}</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[448px] overflow-y-auto">
            {pendingList.map(cp => {
              const s = getPayStatus(cp)
              const left = daysLeft(cp.end_date)
              return (
                <div key={cp.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/60 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    cp.client_gender === 'F' ? 'bg-rose-400' : cp.client_gender === 'M' ? 'bg-sky-500' : 'bg-gray-400'
                  }`}>
                    {cp.client_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{cp.client_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cp.pkg_color }} />
                      <p className="text-xs text-gray-400">{cp.pkg_name}</p>
                      <span className="text-xs text-gray-300">·</span>
                      <p className="text-xs text-gray-400">{fmtDate(cp.start_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">{fmtEur(cp.price)}</p>
                      <StatusBadge status={s} daysLeftVal={left > 0 ? left : undefined} t={t} />
                    </div>
                    <button
                      onClick={() => openPayDialog(cp)}
                      className="h-7 text-xs px-3 rounded-lg text-white font-medium flex items-center gap-1"
                      style={{ backgroundColor: accentHex }}
                    >
                      <Check size={11} /> {t('finance.payment.markPaid')}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(cp.id)}
                      title="Obriši"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">{t('finance.table.title')}</h2>
          <p className="text-xs text-gray-400">{allHistory.length}</p>
        </div>

          {allHistory.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Banknote size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{t('finance.table.noData')}</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_70px_88px_88px_108px_148px] gap-x-2 px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-50/60">
              <span>{t('finance.table.client')}</span><span>{t('finance.table.package')}</span><span>{t('finance.table.amount')}</span>
              <span>{t('common.date')}</span><span>{t('finance.status.paid')}</span><span>{t('finance.table.status')}</span><span></span>
            </div>
            <div className="divide-y divide-gray-50">
              {pagedHistory.map(cp => {
                const p = cp.payments?.[0]
                const s = getPayStatus(cp)
                const left = daysLeft(cp.end_date)
                return (
                  <div key={cp.id} className="px-5 py-3 grid md:grid-cols-[1fr_1fr_70px_88px_88px_108px_148px] grid-cols-1 gap-x-2 items-center hover:bg-gray-50/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        cp.client_gender === 'F' ? 'bg-rose-400' : cp.client_gender === 'M' ? 'bg-sky-500' : 'bg-gray-400'
                      }`}>
                        {cp.client_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-800 font-medium truncate">{cp.client_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cp.pkg_color }} />
                      <span className="text-sm text-gray-600 truncate">{cp.pkg_name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">
                      {p?.status === 'paid' ? fmtEur(p.amount) : fmtEur(cp.price)}
                    </span>
                    <span className="text-xs text-gray-500">{fmtDate(cp.start_date)}</span>
                    <span className="text-xs text-gray-500">{p?.paid_at ? fmtDate(p.paid_at) : '—'}</span>
                    {justMarkedId === cp.id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Check size={10} /> Plaćeno ✓
                      </span>
                    ) : s !== 'paid' ? (
                      <button
                        title="Klikni za označi kao plaćeno"
                        onClick={() => inlineMarkPaid(cp)}
                        className="cursor-pointer transition-all hover:scale-105"
                      >
                        <StatusBadge status={s} daysLeftVal={left > 0 ? left : undefined} t={t} />
                      </button>
                    ) : (
                      <StatusBadge status={s} daysLeftVal={left > 0 ? left : undefined} t={t} />
                    )}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {s !== 'paid' ? (
                        <button onClick={() => openPayDialog(cp)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap"
                          style={{ color: accentHex, borderColor: `${accentHex}40` }}>
                          {t('finance.payment.markPaid')}
                        </button>
                      ) : (
                        <button onClick={() => markUnpaid(cp)}
                          title="Označi kao neplaćeno"
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-colors whitespace-nowrap">
                          <RotateCcw size={11} /> Neplaćeno
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(cp.id)}
                        title="Obriši"
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {allHistory.length > HIST_PER_PAGE && (
              <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/40">
                <p className="text-xs text-gray-400">
                  {histPage * HIST_PER_PAGE + 1}–{Math.min((histPage + 1) * HIST_PER_PAGE, allHistory.length)} od {allHistory.length}
                </p>
                <div className="flex gap-2">
                  <button disabled={histPage === 0} onClick={() => setHistPage(p => p - 1)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                    {t('finance.table.prevPage')}
                  </button>
                  <button disabled={(histPage + 1) * HIST_PER_PAGE >= allHistory.length} onClick={() => setHistPage(p => p + 1)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                    {t('finance.table.nextPage')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pay dialog */}
      {showPayDialog && selectedCp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPayDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: accentHex, backgroundImage: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)` }}>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Check size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{t('finance.payment.title')}</h3>
                <p className="text-white/70 text-xs">{selectedCp.client_name} · {selectedCp.pkg_name}</p>
              </div>
              <button onClick={() => setShowPayDialog(false)} className="ml-auto text-white/60 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">{t('finance.payment.amount')}</label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ '--tw-ring-color': accentHex } as any}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">{t('finance.payment.date')}</label>
                  <input type="date" value={payForm.paid_at} onChange={e => setPayForm({ ...payForm, paid_at: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">{t('finance.payment.notes')}</label>
                <input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder={t('finance.payment.notesPlaceholder')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              {/* Late payment notice */}
              {selectedCp && payForm.paid_at > selectedCp.end_date && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Kasno plaćanje</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Sljedeće fakturno razdoblje treba početi od{' '}
                      <span className="font-bold">{fmtDate(selectedCp.end_date)}</span>, a ne od danas.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={markPaid} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: accentHex }}>
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                  {saving ? t('finance.payment.saving') : t('finance.payment.save')}
                </button>
                <button onClick={() => setShowPayDialog(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-xs w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="text-center text-sm font-bold text-gray-900">Obriši zapis?</h3>
              <p className="text-center text-xs text-gray-500 mt-1.5">
                Ovo će trajno obrisati paket i sve vezane uplate. Radnja se ne može poništiti.
              </p>
            </div>
            <div className="flex gap-2 p-4">
              <button onClick={() => deletePkg(confirmDeleteId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors">
                Obriši
              </button>
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FinancijePage() {
  return (
    <>
      <div className="hidden lg:block"><FinancijePageContent /></div>
      <div className="lg:hidden"><MobileFinanceView /></div>
    </>
  )
}
