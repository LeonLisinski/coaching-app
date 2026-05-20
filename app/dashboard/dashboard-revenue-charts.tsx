'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'
import { useTranslations, useLocale } from 'next-intl'

type MonthlyRevenue = { month: string; ocekivano: number; naplaceno: number }

type Props = {
  monthlyRevenue: MonthlyRevenue[]
  accentHex: string
  isDark: boolean
  progressPercent: number
  paidByStart: number
  totalMonth: number
  latePayments: number
}

export default function DashboardRevenueCharts({
  monthlyRevenue, accentHex, isDark, progressPercent, paidByStart, totalMonth, latePayments,
}: Props) {
  const t  = useTranslations('dashboard')
  const t2 = useTranslations('dashboard2')
  const locale = useLocale()
  const now = new Date()
  const pieData = [{ value: progressPercent }, { value: Math.max(0, 100 - progressPercent) }]

  const cardStyle = isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined
  const cardCls = `rounded-2xl border p-5 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`
  const labelColor = isDark ? '#6b7280' : '#9ca3af'
  const textPrimary = isDark ? '#f3f4f6' : '#111827'
  const textSub = isDark ? '#6b7280' : '#9ca3af'

  return (
    <>
      {/* Revenue bar chart */}
      <div className={`lg:col-span-2 ${cardCls}`} style={cardStyle}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>{t('revenue.title')}</p>
            <p className="text-xs mt-0.5" style={{ color: textSub }}>{t2('revenueLastSixMonths')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `${accentHex}40` }} />
              <span className="text-xs" style={{ color: textSub }}>{t('revenue.expected')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: accentHex }} />
              <span className="text-xs" style={{ color: textSub }}>{t('revenue.collected')}</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={monthlyRevenue} barCategoryGap="40%">
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: labelColor }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: labelColor }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              formatter={(v: number | undefined, name: string | undefined) => [`${v ?? 0}€`, name === 'ocekivano' ? t('revenue.expected') : t('revenue.collected')]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 10,
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.6)' : '0 4px 12px rgba(0,0,0,0.08)',
                backgroundColor: isDark ? 'oklch(0.165 0.018 264)' : 'white',
                color: isDark ? '#e5e7eb' : '#111827',
              }}
              cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
            />
            <Bar dataKey="naplaceno" stackId="rev" fill={accentHex} radius={[0, 0, 0, 0]} />
            <Bar dataKey="ocekivano" stackId="rev" fill={`${accentHex}35`} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Donut — this month */}
      <div className={`${cardCls} flex flex-col items-center justify-center`} style={cardStyle}>
        <p className="text-sm font-semibold mb-0.5" style={{ color: textPrimary }}>{t('revenue.thisMonth')}</p>
        <p className="text-xs mb-5" style={{ color: textSub }}>{now.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</p>
        <div className="relative">
          <PieChart width={150} height={150}>
            <Pie data={pieData} cx={70} cy={70} innerRadius={48} outerRadius={65} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
              <Cell fill={accentHex} />
              <Cell fill={isDark ? `${accentHex}25` : `${accentHex}18`} />
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-extrabold leading-none" style={{ color: accentHex }}>{progressPercent}%</p>
            <p className="text-[10px] mt-1" style={{ color: textSub }}>{t('revenue.paid')}</p>
          </div>
        </div>
        <p className="text-sm font-semibold mt-3" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
          {paidByStart}€
          <span style={{ color: isDark ? '#374151' : '#d1d5db', margin: '0 4px' }}>/</span>
          <span style={{ color: isDark ? '#6b7280' : '#9ca3af', fontWeight: 400 }}>{totalMonth}€</span>
        </p>
        {latePayments > 0 && (
          <p className="text-xs mt-1.5 font-medium text-rose-500">{t2('latePaymentCount', { count: latePayments })}</p>
        )}
      </div>
    </>
  )
}
