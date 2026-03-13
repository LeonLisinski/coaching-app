'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Dumbbell, UtensilsCrossed, MessageSquare, ClipboardCheck,
  TrendingUp, TrendingDown, Minus, ArrowRight, Calendar, Scale,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import { useAppTheme } from '@/app/contexts/app-theme'

const ACCENT_HEX: Record<string, string> = {
  violet: '#7c3aed', blue: '#2563eb', indigo: '#4f46e5', sky: '#0284c7',
  teal: '#0d9488', green: '#16a34a', yellow: '#ca8a04', amber: '#d97706',
  orange: '#ea580c', red: '#dc2626', rose: '#ec4899', slate: '#475569',
}

type Props = { clientId: string }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtRelTime(dateStr: string) {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 60) return `prije ${diffMins}m`
  if (diffHours < 24) return `prije ${diffHours}h`
  if (diffDays === 1) return 'jučer'
  if (diffDays < 7) return `prije ${diffDays}d`
  return fmtDate(dateStr.split('T')[0])
}

export default function ClientOverview({ clientId }: Props) {
  const router = useRouter()
  const { accent } = useAppTheme()
  const accentHex = ACCENT_HEX[accent] || '#7c3aed'

  const [loading, setLoading] = useState(true)
  const [weightData, setWeightData] = useState<{ date: string; w: number }[]>([])
  const [lastCheckin, setLastCheckin] = useState<{ date: string; id: string } | null>(null)
  const [activeWorkout, setActiveWorkout] = useState<{ name: string; id: string } | null>(null)
  const [activeMeal, setActiveMeal] = useState<{ name: string; id: string } | null>(null)
  const [lastMessage, setLastMessage] = useState<{ content: string; created_at: string; isTrainer: boolean } | null>(null)
  const [trainerId, setTrainerId] = useState<string | null>(null)

  useEffect(() => { fetchOverview() }, [clientId])

  const fetchOverview = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setTrainerId(user.id)

    // Weight: read directly from checkins.values JSON (no separate entries table needed)
    const { data: recentCheckins } = await supabase
      .from('checkins')
      .select('id, date, values')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(12)

    const weightKeys = ['težina', 'tezina', 'weight', 'masa', 'tjelesna_masa', 'tjelesna masa', 'body_weight']
    const pts = (recentCheckins || [])
      .map((c: any) => {
        const vals = c.values || {}
        // Try known keys, then find first numeric value in the object
        const raw = weightKeys.map(k => vals[k]).find(v => v != null && !isNaN(parseFloat(v)))
          ?? Object.values(vals).find((v: any) => v != null && !isNaN(parseFloat(v)) && parseFloat(v) > 20 && parseFloat(v) < 300)
        return raw != null ? { date: c.date, w: parseFloat(raw) } : null
      })
      .filter(Boolean)
      .reverse() as { date: string; w: number }[]
    if (pts.length > 0) setWeightData(pts)

    // Last check-in
    const { data: lastCi } = await supabase
      .from('checkins')
      .select('id, date')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastCi) setLastCheckin(lastCi)

    // Active workout plan
    const { data: workout } = await supabase
      .from('client_workout_plans')
      .select('id, active, workout_plan:workout_plans(id, name)')
      .eq('client_id', clientId)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (workout?.workout_plan) {
      setActiveWorkout({ name: (workout.workout_plan as any).name, id: workout.id })
    }

    // Active meal plan
    const { data: meal } = await supabase
      .from('client_meal_plans')
      .select('id, active, meal_plan:meal_plans(id, name)')
      .eq('client_id', clientId)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (meal?.meal_plan) {
      setActiveMeal({ name: (meal.meal_plan as any).name, id: meal.id })
    }

    // Last message
    const { data: msgs } = await supabase
      .from('messages')
      .select('content, created_at, sender_id, trainer_id')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (msgs) {
      setLastMessage({
        content: msgs.content,
        created_at: msgs.created_at,
        isTrainer: msgs.sender_id === msgs.trainer_id,
      })
    }

    setLoading(false)
  }

  const weightTrend = weightData.length >= 2
    ? weightData[weightData.length - 1].w - weightData[0].w
    : null

  const TrendIcon = weightTrend === null ? Minus
    : weightTrend > 0 ? TrendingUp
    : TrendingDown

  const trendColor = weightTrend === null ? 'text-gray-400'
    : weightTrend > 0 ? 'text-rose-500'
    : 'text-emerald-500'

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* Weight trend card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15` }}>
              <Scale size={14} style={{ color: accentHex }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Tjelesna masa</p>
              {weightData.length > 0 && (
                <p className="text-xs text-gray-400">
                  Zadnje mjerenje: <span className="font-medium text-gray-600">{weightData[weightData.length - 1]?.w} kg</span>
                </p>
              )}
            </div>
          </div>
          {weightTrend !== null && (
            <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon size={14} />
              <span>{weightTrend > 0 ? '+' : ''}{weightTrend.toFixed(1)} kg</span>
              <span className="text-gray-400 font-normal">({weightData.length} mjerenja)</span>
            </div>
          )}
        </div>

        {weightData.length >= 2 ? (
          <div className="h-28 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentHex} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={accentHex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={d => d?.slice(5).replace('-', '/')}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f3f4f6', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelFormatter={d => fmtDate(d)}
                  formatter={(v: any) => [`${v} kg`, 'Masa']}
                />
                <Area
                  type="monotone"
                  dataKey="w"
                  stroke={accentHex}
                  strokeWidth={2}
                  fill="url(#weightGrad)"
                  dot={{ fill: accentHex, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: accentHex }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-4 text-center">Nema dostupnih mjerenja mase</p>
        )}
      </div>

      {/* Last check-in — full card click */}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer group transition-all hover:shadow-md hover:border-gray-200"
        onClick={() => router.push(`/dashboard/checkins/${clientId}`)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-50">
              <ClipboardCheck size={14} className="text-teal-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Zadnji check-in</p>
          </div>
          <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
        </div>
        {lastCheckin ? (
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-gray-400" />
            <span className="text-sm text-gray-700 font-medium">{fmtDate(lastCheckin.date)}</span>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Nema predanih check-inova</p>
        )}
      </div>

      {/* Active plans — each plan row is clickable */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentHex}15` }}>
            <Dumbbell size={14} style={{ color: accentHex }} />
          </div>
          <p className="text-sm font-semibold text-gray-900">Aktivni planovi</p>
        </div>
        <div className="space-y-1.5">
          {activeWorkout ? (
            <div
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer group/row hover:bg-gray-50 transition-colors"
              onClick={() => router.push(`/dashboard/clients/${clientId}`)}
            >
              <Dumbbell size={12} className="text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-700 truncate flex-1">{activeWorkout.name}</span>
              <ArrowRight size={12} className="text-gray-300 group-hover/row:text-gray-400 shrink-0 transition-colors" />
            </div>
          ) : (
            <p className="text-xs text-gray-400 flex items-center gap-1.5 px-2 py-1">
              <Dumbbell size={11} /> Nema aktivnog plana treninga
            </p>
          )}
          {activeMeal ? (
            <div
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer group/row hover:bg-gray-50 transition-colors"
              onClick={() => router.push(`/dashboard/clients/${clientId}`)}
            >
              <UtensilsCrossed size={12} className="text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-700 truncate flex-1">{activeMeal.name}</span>
              <ArrowRight size={12} className="text-gray-300 group-hover/row:text-gray-400 shrink-0 transition-colors" />
            </div>
          ) : (
            <p className="text-xs text-gray-400 flex items-center gap-1.5 px-2 py-1">
              <UtensilsCrossed size={11} /> Nema aktivnog plana prehrane
            </p>
          )}
        </div>
      </div>

      {/* Last message — full card click */}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:col-span-2 cursor-pointer group transition-all hover:shadow-md hover:border-gray-200"
        onClick={() => router.push(`/dashboard/chat?clientId=${clientId}`)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-50">
              <MessageSquare size={14} className="text-sky-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Zadnja poruka</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium transition-colors" style={{ color: accentHex }}>
            Otvori chat <ArrowRight size={11} />
          </span>
        </div>
        {lastMessage ? (
          <div className="flex items-start gap-3">
            <div className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              lastMessage.isTrainer ? 'bg-gray-100 text-gray-500' : 'bg-sky-100 text-sky-700'
            }`}>
              {lastMessage.isTrainer ? 'Ti' : 'Klijent'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{lastMessage.content}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{fmtRelTime(lastMessage.created_at)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Nema poruka u chatu</p>
        )}
      </div>

    </div>
  )
}
