'use client'
import { PieChart, Pie, Cell } from 'recharts'
import { useTranslations, useLocale } from 'next-intl'

type Props = {
  accentHex: string
  isDark: boolean
  progressPercent: number
  paidByStart: number
  totalMonth: number
  latePayments: number
}

export default function DashboardDonut({
  accentHex, isDark, progressPercent, paidByStart, totalMonth, latePayments,
}: Props) {
  const t  = useTranslations('dashboard')
  const t2 = useTranslations('dashboard2')
  const locale = useLocale()
  const now = new Date()
  const pieData = [{ value: progressPercent }, { value: Math.max(0, 100 - progressPercent) }]

  const cardStyle = isDark ? { background: 'oklch(0.195 0.018 264)' } : undefined
  const cardCls = `rounded-2xl border p-5 ${isDark ? 'border-white/8' : 'bg-white border-gray-100 shadow-sm'}`
  const textPrimary = isDark ? '#f3f4f6' : '#111827'
  const textSub     = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div className={`${cardCls} flex flex-col items-center justify-center`} style={cardStyle}>
      <p className="text-sm font-semibold mb-0.5" style={{ color: textPrimary }}>{t('revenue.thisMonth')}</p>
      <p className="text-xs mb-4" style={{ color: textSub }}>{now.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</p>
      <div className="relative">
        <PieChart width={140} height={140}>
          <Pie data={pieData} cx={65} cy={65} innerRadius={44} outerRadius={60}
            startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
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
  )
}
