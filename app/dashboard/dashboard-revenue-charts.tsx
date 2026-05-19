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
  const t  = useTranslations('dashboard.overview')
  const t2 = useTranslations('dashboard')
  const locale = useLocale()
  const now = new Date()
  const pieData = [{ value: progressPercent }, { value: Math.max(0, 100 - progressPercent) }]

  return (
    <>
      {/* Revenue bar chart */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('revenue.title')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t2('revenueLastSixMonths')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `${accentHex}35` }} />
              <span className="text-xs text-gray-400">{t('revenue.expected')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: accentHex }} />
              <span className="text-xs text-gray-400">{t('revenue.collected')}</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={monthlyRevenue} barCategoryGap="40%">
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              formatter={(v: number | undefined, name: string | undefined) => [`${v ?? 0}€`, name === 'ocekivano' ? t('revenue.expected') : t('revenue.collected')]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 10,
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
                backgroundColor: isDark ? 'oklch(0.165 0.018 264)' : 'white',
                color: isDark ? '#e5e7eb' : '#111827',
              }}
              cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
            />
            <Bar dataKey="naplaceno" stackId="rev" fill={accentHex} radius={[0, 0, 0, 0]} />
            <Bar dataKey="ocekivano" stackId="rev" fill={`${accentHex}35`} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Donut — this month */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center">
        <p className="text-sm font-semibold text-gray-900 mb-1">{t('revenue.thisMonth')}</p>
        <p className="text-xs text-gray-400 mb-4">{now.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</p>
        <div className="relative">
          <PieChart width={150} height={150}>
            <Pie data={pieData} cx={70} cy={70} innerRadius={48} outerRadius={65} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
              <Cell fill={accentHex} />
              <Cell fill={`${accentHex}25`} />
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-extrabold leading-none" style={{ color: accentHex }}>{progressPercent}%</p>
            <p className="text-[10px] text-gray-400 mt-1">{t('revenue.paid')}</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-700 mt-3">
          {paidByStart}€
          <span className="text-gray-300 mx-1">/</span>
          <span className="text-gray-400 font-normal">{totalMonth}€</span>
        </p>
        {latePayments > 0 && (
          <p className="text-xs text-rose-500 mt-1.5 font-medium">{t2('latePaymentCount', { count: latePayments })}</p>
        )}
      </div>
    </>
  )
}
