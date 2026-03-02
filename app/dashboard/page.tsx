'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts'


type ClientSummary = {
  id: string
  full_name: string
  checkin_day: number | null
  last_checkin: string | null
  status: 'submitted' | 'late' | 'neutral'
  total_checkins: number
  checkin_rate: number
}

function getStatus(checkinDay: number | null, lastCheckin: string | null): 'submitted' | 'late' | 'neutral' {
  if (checkinDay === null) return 'neutral'
  const today = new Date()
  const daysAgo = (today.getDay() - checkinDay + 7) % 7
  const expectedDate = new Date(today)
  expectedDate.setDate(today.getDate() - daysAgo)
  expectedDate.setHours(0, 0, 0, 0)
  if (!lastCheckin) return 'late'
  const lastDate = new Date(lastCheckin)
  lastDate.setHours(0, 0, 0, 0)
  return lastDate >= expectedDate ? 'submitted' : 'late'
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tDays = useTranslations('days')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const getMonthLabel = (date: Date) =>
    date.toLocaleDateString(locale, { month: 'short' })
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeClients: 0, checkinSent: 0, checkinLate: 0, checkinToday: 0,
    expectedMonth: 0, collectedMonth: 0, latePayments: 0, avgCheckinRate: 0,
  })
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; ocekivano: number; naplaceno: number }[]>([])
  const [topClients, setTopClients] = useState<ClientSummary[]>([])
  const [progressPercent, setProgressPercent] = useState(0)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: clientsData } = await supabase
      .from('clients')
      .select(`id, profiles!clients_user_id_fkey(full_name), checkin_config(checkin_day)`)
      .eq('trainer_id', user.id)
      .eq('active', true)

    const clientIds = clientsData?.map(c => c.id) || []

    const { data: allCheckins } = await supabase
      .from('checkins')
      .select('client_id, date')
      .in('client_id', clientIds)
      .order('date', { ascending: false })

    const lastCheckinMap: Record<string, string> = {}
    const checkinCountMap: Record<string, number> = {}
    allCheckins?.forEach(c => {
      if (!lastCheckinMap[c.client_id]) lastCheckinMap[c.client_id] = c.date
      checkinCountMap[c.client_id] = (checkinCountMap[c.client_id] || 0) + 1
    })

    const now = new Date()
    const today = now.getDay()

    const mapped: ClientSummary[] = (clientsData || []).map((c: any) => {
      const checkinDay = c.checkin_config?.[0]?.checkin_day ?? null
      const lastCheckin = lastCheckinMap[c.id] || null
      const totalCheckins = checkinCountMap[c.id] || 0
      const weeksActive = Math.max(1, Math.floor((Date.now() - new Date('2024-01-01').getTime()) / (7 * 24 * 60 * 60 * 1000)))
      const checkinRate = Math.min(100, Math.round((totalCheckins / weeksActive) * 100))
      return {
        id: c.id,
        full_name: c.profiles?.full_name || 'Bez imena',
        checkin_day: checkinDay,
        last_checkin: lastCheckin,
        status: getStatus(checkinDay, lastCheckin),
        total_checkins: totalCheckins,
        checkin_rate: checkinRate,
      }
    })

    const submitted = mapped.filter(c => c.status === 'submitted').length
    const late = mapped.filter(c => c.status === 'late').length
    const todayCount = mapped.filter(c => c.checkin_day === today).length
    const avgRate = mapped.length > 0 ? Math.round(mapped.reduce((s, c) => s + c.checkin_rate, 0) / mapped.length) : 0

    const top = [...mapped].filter(c => c.total_checkins > 0).sort((a, b) => b.checkin_rate - a.checkin_rate).slice(0, 5)
    setTopClients(top)

    // Paketi
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: packagesData } = await supabase
      .from('client_packages')
      .select(`id, price, status, end_date, payments(*)`)
      .eq('trainer_id', user.id)
      .eq('status', 'active')

    let expectedMonth = 0, collectedMonth = 0, latePayments = 0
    const monthly: Record<string, { ocekivano: number; naplaceno: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthly[getMonthLabel(d)] = { ocekivano: 0, naplaceno: 0 }
    }

    packagesData?.forEach(cp => {
      if (cp.end_date >= monthStart && cp.end_date <= monthEnd) expectedMonth += cp.price || 0
      const payment = (cp.payments as any[])?.[0]
      if (!payment || payment.status !== 'paid') {
        if (new Date(cp.end_date) < now) latePayments++
      }
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
        const key = getMonthLabel(d)
        if (cp.end_date >= mStart && cp.end_date <= mEnd) monthly[key].ocekivano += cp.price || 0
        ;(cp.payments as any[])?.forEach((p: any) => {
          if (p.status === 'paid' && p.paid_at >= mStart && p.paid_at <= mEnd) {
            monthly[key].naplaceno += p.amount || 0
            if (cp.end_date >= monthStart && cp.end_date <= monthEnd) collectedMonth += p.amount || 0
          }
        })
      }
    })

    const progress = expectedMonth > 0 ? Math.min(100, Math.round((collectedMonth / expectedMonth) * 100)) : 0

    setStats({ activeClients: clientsData?.length || 0, checkinSent: submitted, checkinLate: late, checkinToday: todayCount, expectedMonth, collectedMonth, latePayments, avgCheckinRate: avgRate })
    setMonthlyRevenue(Object.entries(monthly).map(([month, v]) => ({ month, ...v })))
    setProgressPercent(progress)
    setLoading(false)
  }

  const pieData = [{ value: progressPercent }, { value: 100 - progressPercent }]

  const statCards = [
    { label: t('stats.activeClients'), value: stats.activeClients, color: '#6366f1', bg: '#eef2ff', onClick: () => router.push('/dashboard/clients') },
    { label: t('stats.pendingCheckins'), value: stats.checkinSent, color: '#22c55e', bg: '#f0fdf4', onClick: () => router.push('/dashboard/checkins') },
    { label: t('checkinStatus.late'), value: stats.checkinLate, color: '#ef4444', bg: '#fef2f2', onClick: () => router.push('/dashboard/checkins') },
    { label: t('stats.todayCheckins'), value: stats.checkinToday, color: '#f59e0b', bg: '#fffbeb', onClick: () => router.push('/dashboard/checkins') },
    { label: t('revenue.expectedMonth'), value: `${stats.expectedMonth}€`, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: t('revenue.collectedMonth'), value: `${stats.collectedMonth}€`, color: '#10b981', bg: '#ecfdf5' },
    { label: t('revenue.latePayments'), value: stats.latePayments, color: '#f43f5e', bg: '#fff1f2' },
    { label: t('revenue.avgRegularity'), value: `${stats.avgCheckinRate}%`, color: '#0ea5e9', bg: '#f0f9ff' },
  ]

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1300, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#111827' }}>{t('title')}</h1>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '4px 0 0' }}>
          {new Date().toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat kartice */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {statCards.map((card, i) => (
          <div
            key={i}
            onClick={card.onClick}
            style={{
              backgroundColor: 'white',
              borderRadius: 14,
              padding: '20px 22px',
              border: '1px solid #f1f5f9',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              cursor: card.onClick ? 'pointer' : 'default',
              borderLeft: `4px solid ${card.color}`,
              transition: 'box-shadow 0.15s',
            }}
          >
            <p style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: card.color, lineHeight: 1 }}>
              {card.value}
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Grafovi */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 28 }}>

        {/* Bar chart */}
        <div style={{ backgroundColor: 'white', borderRadius: 14, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 20px', color: '#111827' }}>{t('revenue.title')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyRevenue} barGap={6} barCategoryGap="35%">
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number | undefined, name: string | undefined) => [`${v || 0}€`, name === 'ocekivano' ? t('revenue.expected') : t('revenue.collected')]}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="ocekivano" fill="#e0e7ff" radius={[6, 6, 0, 0]} />
              <Bar dataKey="naplaceno" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#e0e7ff' }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{t('revenue.expected')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#6366f1' }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{t('revenue.collected')}</span>
            </div>
          </div>
        </div>

        {/* Progress ring */}
        <div style={{ backgroundColor: 'white', borderRadius: 14, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 16px', color: '#111827' }}>{t('revenue.thisMonth')}</p>
          <div style={{ position: 'relative' }}>
            <PieChart width={160} height={160}>
              <Pie data={pieData} cx={75} cy={75} innerRadius={52} outerRadius={70} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                <Cell fill="#6366f1" />
                <Cell fill="#e0e7ff" />
              </Pie>
            </PieChart>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#6366f1', lineHeight: 1 }}>{progressPercent}%</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{t('revenue.paid')}</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12, fontWeight: 500 }}>
            {stats.collectedMonth}€ <span style={{ color: '#d1d5db' }}>/</span> {stats.expectedMonth}€
          </p>
        </div>
      </div>

      {/* Top klijenti */}
      <div style={{ backgroundColor: 'white', borderRadius: 14, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 20px', color: '#111827' }}>{t('checkinStatus.title')}</p>
        {topClients.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>{t('noUpcomingCheckins')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {topClients.map((client) => {
              const barColor = client.checkin_rate >= 70 ? '#22c55e' : client.checkin_rate >= 40 ? '#f59e0b' : '#ef4444'
              return (
                <div
                  key={client.id}
                  onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                  style={{
                    cursor: 'pointer',
                    padding: '16px',
                    borderRadius: 12,
                    border: '1px solid #f1f5f9',
                    backgroundColor: '#fafafa',
                    textAlign: 'center',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{client.full_name.charAt(0)}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: '#111827' }}>{client.full_name.split(' ')[0]}</p>
                  <div style={{ width: '100%', height: 6, backgroundColor: '#f3f4f6', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${client.checkin_rate}%`, height: '100%', backgroundColor: barColor, borderRadius: 99 }} />
                  </div>
                  <p style={{ fontSize: 14, color: barColor, fontWeight: 700, margin: '0 0 2px' }}>{client.checkin_rate}%</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{client.total_checkins} checkina</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}