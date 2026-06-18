'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface Props {
  data: { month: string; naplaceno: number; fakturirano: number }[]
  isDark: boolean
  accentHex: string
  labelCollected: string
  labelExpected: string
}

export default function FinanceRevenueChart({ data, isDark, accentHex, labelCollected, labelExpected }: Props) {
  return (
    <>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} barCategoryGap="40%">
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}€`} />
          <Tooltip
            cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
            formatter={(v: any, name: any) => [`${v} €`, name === 'naplaceno' ? labelCollected : labelExpected] as any}
            contentStyle={{
              fontSize: 12,
              borderRadius: 10,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : '#e5e7eb'}`,
              boxShadow: isDark ? '0 4px 16px rgb(0 0 0 / 0.5)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              backgroundColor: isDark ? '#1e2030' : '#ffffff',
              color: isDark ? '#e8eaf0' : '#111827',
            }}
          />
          <Bar dataKey="naplaceno" stackId="rev" fill={accentHex} fillOpacity={0.85} radius={[0, 0, 0, 0]} />
          <Bar dataKey="fakturirano" stackId="rev" fill={isDark ? `${accentHex}80` : `${accentHex}30`} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-1">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: `${accentHex}20` }} /> {labelExpected}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: accentHex, opacity: 0.85 }} /> {labelCollected}
        </span>
      </div>
    </>
  )
}
