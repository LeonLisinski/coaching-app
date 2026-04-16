'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ClipboardList, CreditCard, Dumbbell, UtensilsCrossed, Package,
  TrendingDown, TrendingUp, Minus,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

type TimelineEvent = {
  id: string
  date: string
  type: 'checkin' | 'payment' | 'workout_plan' | 'meal_plan' | 'package'
  title: string
  subtitle?: string
  meta?: string
  color: string
  icon: React.ElementType
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('hr-HR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ClientTimeline({ clientId }: { clientId: string }) {
  const t = useTranslations('clientDetail')
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTimeline() }, [clientId])

  const fetchTimeline = async () => {
    const [
      { data: checkins },
      { data: packages },
      { data: workoutPlans },
      { data: mealPlans },
    ] = await Promise.all([
      supabase
        .from('checkins')
        .select('id, date, values')
        .eq('client_id', clientId)
        .order('date', { ascending: false })
        .limit(50),
      supabase
        .from('client_packages')
        .select('id, start_date, price, status, notes, packages(name, color), payments(paid_at, amount, status)')
        .eq('client_id', clientId)
        .order('start_date', { ascending: false }),
      supabase
        .from('client_workout_plans')
        .select('id, assigned_at, workout_plan:workout_plans(name)')
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false })
        .limit(20),
      supabase
        .from('client_meal_plans')
        .select('id, assigned_at, meal_plan:meal_plans(name)')
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false })
        .limit(20),
    ])

    const all: TimelineEvent[] = []

    // Checkins — weight/body_fat live inside the values JSON
    let prevWeight: number | null = null
    const sortedCheckins = [...(checkins || [])].sort((a, b) => a.date.localeCompare(b.date))
    sortedCheckins.forEach((c: any) => {
      const weight = c.values?.weight ?? c.values?.tezina ?? null
      const bodyFat = c.values?.body_fat ?? c.values?.postotak_masnoce ?? null
      const weightDiff = prevWeight !== null && weight ? weight - prevWeight : null
      prevWeight = weight ?? prevWeight
      const parts: string[] = []
      if (weight) parts.push(t('timelineWeightEntry', { weight }))
      if (bodyFat) parts.push(t('timelineBodyFat', { fat: bodyFat }))
      all.push({
        id: `ci-${c.id}`,
        date: c.date,
        type: 'checkin',
        title: t('timelineWeeklyCheckin'),
        subtitle: parts.join(' · ') || undefined,
        meta: weightDiff !== null
          ? weightDiff > 0 ? `+${weightDiff.toFixed(1)} kg`
            : weightDiff < 0 ? `${weightDiff.toFixed(1)} kg`
            : '±0 kg'
          : undefined,
        color: '#7c3aed',
        icon: ClipboardList,
      })
    })

    // Packages
    ;(packages || []).forEach((pkg: any) => {
      const pkgName = pkg.packages?.name || t('timelinePackage')
      const pkgColor = pkg.packages?.color || '#7c3aed'
      const statusLabel = pkg.status === 'active'
        ? t('timelineActiveStatus')
        : pkg.status === 'expired'
          ? t('timelineExpiredStatus')
          : pkg.status
      all.push({
        id: `pkg-${pkg.id}`,
        date: pkg.start_date,
        type: 'package',
        title: `${t('timelinePackage')}: ${pkgName}`,
        subtitle: `${pkg.price} € · ${statusLabel}`,
        color: pkgColor,
        icon: Package,
      })
      // Payment event
      const payment = (pkg.payments as any[])?.[0]
      if (payment?.status === 'paid' && payment?.paid_at) {
        all.push({
          id: `pay-${pkg.id}`,
          date: payment.paid_at,
          type: 'payment',
          title: `${t('timelinePayment')} ${pkgName}`,
          subtitle: `${payment.amount || pkg.price} €`,
          color: '#059669',
          icon: CreditCard,
        })
      }
    })

    // Workout plans
    ;(workoutPlans || []).forEach((wp: any) => {
      const planName = (wp.workout_plan as any)?.name || t('timelineTrainingFallback')
      all.push({
        id: `wp-${wp.id}`,
        date: (wp.assigned_at || '').split('T')[0],
        type: 'workout_plan',
        title: t('timelineAssignedTraining'),
        subtitle: planName,
        color: '#4f46e5',
        icon: Dumbbell,
      })
    })

    // Meal plans
    ;(mealPlans || []).forEach((mp: any) => {
      const planName = (mp.meal_plan as any)?.name || t('timelineMealFallback')
      all.push({
        id: `mp-${mp.id}`,
        date: (mp.assigned_at || '').split('T')[0],
        type: 'meal_plan',
        title: t('timelineAssignedMeal'),
        subtitle: planName,
        color: '#ea580c',
        icon: UtensilsCrossed,
      })
    })

    // Sort descending by date
    all.sort((a, b) => b.date.localeCompare(a.date))
    setEvents(all)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 bg-gray-100 rounded w-40" />
              <div className="h-2.5 bg-gray-100 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <ClipboardList size={32} className="mx-auto text-gray-200 mb-3" />
        <p className="text-sm text-gray-400">{t('timelineEmpty')}</p>
        <p className="text-xs text-gray-300 mt-1">{t('timelineEmptyHint')}</p>
      </div>
    )
  }

  // Group by month
  const grouped: Record<string, TimelineEvent[]> = {}
  events.forEach(e => {
    const key = e.date.slice(0, 7) // YYYY-MM
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  })

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([monthKey, monthEvents]) => {
        const [year, month] = monthKey.split('-')
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('hr-HR', { month: 'long', year: 'numeric' })

        return (
          <div key={monthKey}>
            {/* Month header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest capitalize">{label}</span>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-300">{monthEvents.length}</span>
            </div>

            {/* Events */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-100" />

              <div className="space-y-4">
                {monthEvents.map((event) => {
                  const Icon = event.icon
                  const weightDiff = event.meta
                  const isPositive = weightDiff?.startsWith('+')
                  const isNegative = weightDiff?.startsWith('-')

                  return (
                    <div key={event.id} className="flex gap-4 relative">
                      {/* Icon dot */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 border-2 border-white"
                        style={{ backgroundColor: `${event.color}20` }}
                      >
                        <Icon size={13} style={{ color: event.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5 pb-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 leading-tight">{event.title}</p>
                            {event.subtitle && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{event.subtitle}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {weightDiff && (
                              <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                                isPositive ? 'bg-amber-50 text-amber-600' :
                                isNegative ? 'bg-emerald-50 text-emerald-600' :
                                'bg-gray-50 text-gray-400'
                              }`}>
                                {isPositive ? <TrendingUp size={10} /> : isNegative ? <TrendingDown size={10} /> : <Minus size={10} />}
                                {weightDiff}
                              </span>
                            )}
                            <span className="text-[11px] text-gray-300 whitespace-nowrap">
                              {new Date(event.date).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
