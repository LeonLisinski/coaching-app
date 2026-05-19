'use client'

import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Activity,
  Camera,
  Dumbbell,
  FileText,
  Flame,
  StickyNote,
  Target,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAppTheme } from '@/app/contexts/app-theme'
import type {
  CheckinParameterSnapshot,
  CheckinPhotoEntry,
  ExerciseHighlight,
  WeeklyNutrition,
  WeeklyReportSnapshot,
  WeeklySessionSummary,
  WeeklyTrainings,
} from '@/lib/weekly-report'

// Internal context so sub-components don't need prop drilling
const DCtx = React.createContext(false)
const useDark = () => useContext(DCtx)

type Props = {
  snapshot: WeeklyReportSnapshot
  /** Optional override for trainer notes (used in live preview). */
  trainerNotesOverride?: string | null
}

export default function WeeklyReportView({ snapshot, trainerNotesOverride }: Props) {
  const t = useTranslations('clients.weeklyReports')
  const locale = useLocale()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  }
  const fmtRange = `${fmtDate(snapshot.range.start)} — ${fmtDate(snapshot.range.end)}`
  const trainerNotes = trainerNotesOverride !== undefined
    ? trainerNotesOverride
    : snapshot.trainerNotes

  return (
    <DCtx.Provider value={isDark}>
      <div className="space-y-4">
        {/* HEADER */}
        <SectionCard>
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            <FileText size={13} />
            {t('section.header')}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
            <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{snapshot.client.name}</h2>
            <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>·</span>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>{fmtRange}</span>
            {snapshot.range.isPartial ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                {t('list.partialBadge')}
              </span>
            ) : null}
          </div>
          {snapshot.client.goal ? (
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <Target size={12} className={`inline mr-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              {snapshot.client.goal}
            </p>
          ) : null}
        </SectionCard>

        {/* TL;DR SUMMARY */}
        <SummarySection snapshot={snapshot} />

        {/* TRAININGS */}
        <SectionShell icon={<Dumbbell size={14} />} label={t('section.trainings')}>
          <TrainingsSection trainings={snapshot.trainings} />
        </SectionShell>

        {/* NUTRITION */}
        <SectionShell icon={<UtensilsCrossed size={14} />} label={t('section.nutrition')}>
          <NutritionSection nutrition={snapshot.nutrition} />
        </SectionShell>

        {/* PARAMETERS */}
        <SectionShell icon={<Activity size={14} />} label={t('section.parameters')}>
          <ParametersSection parameters={snapshot.parameters} />
        </SectionShell>

        {/* PHOTOS */}
        <SectionShell icon={<Camera size={14} />} label={t('section.photos')}>
          <PhotosSection photoSets={snapshot.photoSets} />
        </SectionShell>

        {/* TRAINER NOTES */}
        {trainerNotes && trainerNotes.trim() ? (
          <SectionShell icon={<StickyNote size={14} />} label={t('section.trainerNotes')}>
            <p className={`whitespace-pre-wrap text-sm ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>{trainerNotes}</p>
          </SectionShell>
        ) : null}
      </div>
    </DCtx.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared card wrapper
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  const isDark = useDark()
  return (
    <div
      className="rounded-xl p-4"
      style={isDark
        ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }
        : { background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Shell
// ─────────────────────────────────────────────────────────────────────────────

function SectionShell({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const isDark = useDark()
  return (
    <SectionCard>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
        {icon}
        {label}
      </div>
      {children}
    </SectionCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

function SummarySection({ snapshot }: { snapshot: WeeklyReportSnapshot }) {
  const t = useTranslations('clients.weeklyReports.summary')
  const tSec = useTranslations('clients.weeklyReports.section')
  const isDark = useDark()
  const s = snapshot.summary

  const workoutsValue = s.workoutsPlannedCount > 0
    ? t('workoutsValue', { done: s.workoutsCompletedCount, planned: s.workoutsPlannedCount })
    : t('workoutsValueNoPlan', { done: s.workoutsCompletedCount })
  const nutritionValue = t('nutritionValue', {
    confirmed: s.nutritionConfirmedDays,
    total: s.nutritionTotalDays,
  })

  const weightValue = (() => {
    if (s.weightDelta != null && s.weightStart != null && s.weightEnd != null) {
      const sign = s.weightDelta > 0 ? '+' : ''
      const dColor = s.weightDelta > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : s.weightDelta < 0 ? (isDark ? 'text-rose-400' : 'text-rose-700') : (isDark ? 'text-gray-300' : 'text-gray-700')
      return (
        <span className={dColor}>
          {sign}{s.weightDelta} kg
          <span className={`ml-1 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>({s.weightStart} → {s.weightEnd})</span>
        </span>
      )
    }
    if (s.weightEnd != null) return <span>{s.weightEnd} kg</span>
    return <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>{t('weightNone')}</span>
  })()

  return (
    <SectionCard>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
        <Flame size={14} />
        {tSec('summary')}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat
          label={t('workouts')}
          value={workoutsValue}
          valueClass={
            s.workoutsPlannedCount > 0 && s.workoutsCompletedCount >= s.workoutsPlannedCount
              ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
              : s.workoutsPlannedCount > 0 && s.workoutsCompletedCount === 0
                ? (isDark ? 'text-rose-400' : 'text-rose-700')
                : (isDark ? 'text-gray-200' : 'text-gray-900')
          }
        />
        <SummaryStat
          label={t('nutrition')}
          value={nutritionValue}
          valueClass={
            s.nutritionTotalDays > 0 && s.nutritionConfirmedDays / s.nutritionTotalDays >= 0.85
              ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
              : s.nutritionTotalDays > 0 && s.nutritionConfirmedDays / s.nutritionTotalDays < 0.5
                ? (isDark ? 'text-rose-400' : 'text-rose-700')
                : (isDark ? 'text-gray-200' : 'text-gray-900')
          }
        />
        <SummaryStat label={t('weight')} value={weightValue} />
        <SummaryStat
          label={t('totalVolume')}
          value={`${formatNumber(s.totalVolumeKg)} ${t('totalVolumeUnit')}`}
        />
      </div>
      {(s.avgCalories != null || s.avgProtein != null) ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 mt-3"
          style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f3f4f6' }}
        >
          <SummaryStat
            label={t('avgKcal')}
            value={s.avgCalories != null ? `${s.avgCalories} kcal` : t('avgKcalNone')}
            compact
          />
          <SummaryStat
            label={t('avgProtein')}
            value={s.avgProtein != null ? `${s.avgProtein} g` : t('avgKcalNone')}
            compact
          />
        </div>
      ) : null}
    </SectionCard>
  )
}

function SummaryStat({
  label, value, valueClass, compact,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  compact?: boolean
}) {
  const isDark = useDark()
  return (
    <div className={compact ? 'space-y-0' : 'space-y-0.5'}>
      <p className={`text-[11px] font-medium uppercase tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-sm font-semibold leading-tight ${valueClass || (isDark ? 'text-gray-200' : 'text-gray-900')}`}>{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Trainings
// ─────────────────────────────────────────────────────────────────────────────

function TrainingsSection({ trainings }: { trainings: WeeklyTrainings }) {
  const t = useTranslations('clients.weeklyReports.trainings')
  const locale = useLocale()
  const isDark = useDark()
  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', weekday: 'short' })

  return (
    <div className="space-y-4">
      {/* Planned vs done */}
      {trainings.plannedDays.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>{t('plannedVsDone')}</p>
            <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
              {trainings.plannedDays.filter(d => d.logged).length}/{trainings.plannedDays.length}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {trainings.plannedDays.map(d => (
              <div
                key={`${d.date}-${d.dayName}`}
                className="rounded-lg px-3 py-2 text-xs"
                style={d.logged
                  ? isDark
                    ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#6ee7b7' }
                    : { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }
                  : isDark
                    ? { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5' }
                    : { background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239' }
                }
              >
                <p className="font-semibold">{d.dayName}</p>
                <p className="text-[11px] opacity-75">{fmtDate(d.date)}</p>
                <p className="mt-1 text-[10px] uppercase font-bold tracking-wide">
                  {d.logged ? t('plannedDayLogged') : t('plannedDayMissed')}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('noPlannedDays')}</p>
      )}

      {/* Sessions */}
      {trainings.sessions.length === 0 ? (
        <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('noSessions')}</p>
      ) : (
        <div className="space-y-2">
          <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>{t('sessionsList')}</p>
          {trainings.sessions.map(s => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}

      {/* Volume bar chart */}
      {trainings.sessions.length >= 2 && (
        <div>
          <p className={`mb-2 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>Volumen po sesiji</p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={trainings.sessions.map(s => ({
                name: s.dayName?.split(' ')[0] ?? s.date.slice(5),
                vol: s.totalVolumeKg,
              }))}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.07)' : '#f0f0f0'} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: unknown) => [`${formatNumber(Number(v))} kg`, 'Volumen']}
                contentStyle={{ fontSize: 11, background: isDark ? 'rgb(18,18,26)' : 'white', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', borderRadius: 8, color: isDark ? '#e5e7eb' : '#111827' }}
              />
              <Bar dataKey="vol" radius={[4, 4, 0, 0]}>
                {trainings.sessions.map((_, i) => (
                  <Cell key={i} fill="#a78bfa" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Volume row */}
      {trainings.totalVolumeKg > 0 ? (
        <div
          className="grid grid-cols-2 gap-3 rounded-lg px-4 py-3 text-sm"
          style={isDark
            ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
            : { background: '#f9fafb', border: '1px solid #e5e7eb' }}
        >
          <div>
            <p className={`text-[11px] font-medium uppercase tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('totalVolume')}</p>
            <p className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{formatNumber(trainings.totalVolumeKg)} {t('volumeUnit')}</p>
          </div>
          {trainings.avgSessionVolumeKg != null ? (
            <div>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('avgVolume')}</p>
              <p className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{formatNumber(trainings.avgSessionVolumeKg)} {t('volumeUnit')}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Best progressions */}
      <ProgressionsBlock highlights={trainings.bestProgressions} kind="up" />

      {/* Biggest regressions */}
      <ProgressionsBlock highlights={trainings.biggestRegressions} kind="down" />
    </div>
  )
}

function SessionRow({ session }: { session: WeeklySessionSummary }) {
  const t = useTranslations('clients.weeklyReports.trainings')
  const locale = useLocale()
  const isDark = useDark()
  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', weekday: 'short' })

  return (
    <div
      className="rounded-lg p-3 space-y-1.5"
      style={isDark
        ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
        : { background: 'white', border: '1px solid #e5e7eb' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold leading-tight ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
            {session.dayName || t('session')}
          </p>
          <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{fmtDate(session.date)}</p>
        </div>
        <div className={`shrink-0 text-right text-[11px] leading-tight ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          <p>{t('exerciseCount', { count: session.exerciseCount })} · {t('setCount', { count: session.totalSetsCompleted })}</p>
          <p className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{formatNumber(session.totalVolumeKg)} {t('volumeUnit')}</p>
        </div>
      </div>
      {session.topProgression ? (
        <div style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6', paddingTop: 6 }}>
          <ProgressionInline highlight={{
            exerciseName: session.topProgression.exerciseName,
            sessionDate: session.date,
            weightDelta: session.topProgression.weightDelta,
            repsDelta: session.topProgression.repsDelta,
            kind: session.topProgression.kind,
          }} />
        </div>
      ) : null}
    </div>
  )
}

function ProgressionsBlock({ highlights, kind }: { highlights: ExerciseHighlight[]; kind: 'up' | 'down' }) {
  const t = useTranslations('clients.weeklyReports.trainings')
  const isDark = useDark()
  if (highlights.length === 0) return null
  const Icon = kind === 'up' ? TrendingUp : TrendingDown

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={14} className={kind === 'up' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-rose-400' : 'text-rose-600')} />
        <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
          {kind === 'up' ? t('bestProgressionsTitle') : t('regressionsTitle')}
        </p>
      </div>
      <p className={`mb-2 text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
        {kind === 'up' ? t('bestProgressionsSub') : t('regressionsSub')}
      </p>
      <ul className="space-y-1.5">
        {highlights.map((h, i) => (
          <li key={`${h.exerciseName}-${i}`}>
            <ProgressionInline highlight={h} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProgressionInline({ highlight }: { highlight: ExerciseHighlight }) {
  const t = useTranslations('clients.weeklyReports.trainings')
  const isDark = useDark()
  const colorClass =
    highlight.kind === 'up'
      ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
      : highlight.kind === 'down'
        ? (isDark ? 'text-rose-400' : 'text-rose-700')
        : (isDark ? 'text-gray-500' : 'text-gray-600')

  let deltaText = ''
  const w = highlight.weightDelta
  const r = highlight.repsDelta
  if (w != null && Math.abs(w) > 0.05) {
    deltaText = w > 0 ? t('deltaWeightUp', { kg: w.toFixed(1) }) : t('deltaWeightDown', { kg: Math.abs(w).toFixed(1) })
  } else if (r != null && r !== 0) {
    deltaText = r > 0 ? t('deltaRepsUp', { reps: r }) : t('deltaRepsDown', { reps: Math.abs(r) })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px]">
      <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{highlight.exerciseName}</span>
      {deltaText ? <span className={`font-semibold ${colorClass}`}>{deltaText}</span> : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Nutrition
// ─────────────────────────────────────────────────────────────────────────────

function NutritionSection({ nutrition }: { nutrition: WeeklyNutrition }) {
  const t = useTranslations('clients.weeklyReports.nutrition')
  const locale = useLocale()
  const isDark = useDark()
  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', weekday: 'short' })

  if (nutrition.totalDays === 0 || nutrition.confirmedDays === 0) {
    return <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('noLogs')}</p>
  }

  const pct = nutrition.totalDays > 0
    ? Math.round((nutrition.confirmedDays / nutrition.totalDays) * 100)
    : 0

  const macroRow = [
    { key: 'calories', label: t('avgKcal'), avg: nutrition.avgCalories, target: nutrition.targets?.calories ?? null, unit: 'kcal' },
    { key: 'protein', label: t('avgProtein'), avg: nutrition.avgProtein, target: nutrition.targets?.protein ?? null, unit: 'g' },
    { key: 'carbs', label: t('avgCarbs'), avg: nutrition.avgCarbs, target: nutrition.targets?.carbs ?? null, unit: 'g' },
    { key: 'fat', label: t('avgFat'), avg: nutrition.avgFat, target: nutrition.targets?.fat ?? null, unit: 'g' },
  ]

  return (
    <div className="space-y-4">
      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
        {t('confirmedRatio', { confirmed: nutrition.confirmedDays, total: nutrition.totalDays, pct })}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {macroRow.map(m => {
          const dev = m.avg != null && m.target != null && m.target > 0
            ? Math.round(((m.avg - m.target) / m.target) * 100)
            : null
          const devColor =
            dev == null ? (isDark ? 'text-gray-500' : 'text-gray-500') :
              Math.abs(dev) <= 10 ? (isDark ? 'text-emerald-400' : 'text-emerald-700') :
                Math.abs(dev) <= 20 ? (isDark ? 'text-amber-400' : 'text-amber-700') : (isDark ? 'text-rose-400' : 'text-rose-700')
          return (
            <div
              key={m.key}
              className="rounded-lg px-3 py-2.5"
              style={isDark
                ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }
                : { background: 'white', border: '1px solid #e5e7eb' }}
            >
              <p className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{m.label}</p>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                {m.avg != null ? `${m.avg} ${m.unit}` : '—'}
              </p>
              {m.target != null ? (
                <p className={`text-[11px] ${devColor}`}>
                  {t('vsTarget', { value: `${m.target} ${m.unit}` })}
                  {dev != null ? <span className="ml-1">({dev > 0 ? '+' : ''}{dev}%)</span> : null}
                </p>
              ) : (
                <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t('noTarget')}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Per-day grid */}
      <div>
        <p className={`mb-2 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>{t('perDayTitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {nutrition.days.map(d => {
            const targetKcal = nutrition.targets?.calories ?? null
            const isBest = nutrition.bestDay?.date === d.date
            const isWorst = nutrition.worstDay?.date === d.date
            const isOnTarget = d.confirmed && targetKcal != null && d.calories != null
              ? Math.abs(d.calories - targetKcal) / targetKcal <= 0.1
              : null

            let style: React.CSSProperties
            if (!d.confirmed) {
              style = isDark
                ? { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#4b5563' }
                : { background: 'rgba(249,250,251,0.5)', border: '1px solid #e5e7eb', color: '#9ca3af' }
            } else if (isBest) {
              style = isDark
                ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#6ee7b7' }
                : { background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }
            } else if (isWorst) {
              style = isDark
                ? { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fcd34d' }
                : { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }
            } else {
              style = isDark
                ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#d1d5db' }
                : { background: 'white', border: '1px solid #e5e7eb', color: '#111827' }
            }

            return (
              <div key={d.date} className="rounded-lg px-2.5 py-2 text-xs" style={style}>
                <p className="font-semibold text-[10px]">{fmtDate(d.date)}</p>
                {d.confirmed && d.calories != null ? (
                  <p className="font-bold text-sm leading-tight">{d.calories}</p>
                ) : (
                  <p className="text-[10px] italic">{t('noConfirmed')}</p>
                )}
                {d.confirmed && d.protein != null ? (
                  <p className="text-[10px] opacity-80">P {d.protein} · C {d.carbs ?? '—'} · F {d.fat ?? '—'}</p>
                ) : null}
                {isBest ? <p className="text-[10px] font-semibold mt-0.5">★ {t('bestDay')}</p> : null}
                {isWorst ? <p className="text-[10px] font-semibold mt-0.5">! {t('worstDay')}</p> : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Calories bar chart */}
      {nutrition.days.filter(d => d.confirmed && d.calories != null).length >= 2 && (
        <div>
          <p className={`mb-2 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>Kalorije po danu</p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={nutrition.days.map(d => ({
                name: new Date(d.date + 'T12:00:00').toLocaleDateString('hr', { day: '2-digit', month: 'short' }),
                kcal: d.confirmed && d.calories != null ? d.calories : null,
              }))}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.07)' : '#f0f0f0'} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#6b7280' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: unknown) => [v != null ? `${v} kcal` : '—', 'Kalorije']}
                contentStyle={{ fontSize: 11, background: isDark ? 'rgb(18,18,26)' : 'white', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', borderRadius: 8, color: isDark ? '#e5e7eb' : '#111827' }}
              />
              {nutrition.targets?.calories != null && (
                <ReferenceLine
                  y={nutrition.targets.calories}
                  stroke={isDark ? '#6b7280' : '#9ca3af'}
                  strokeDasharray="4 4"
                  label={{ value: 'cilj', position: 'insideTopRight', fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }}
                />
              )}
              <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
                {nutrition.days.map((d, i) => (
                  <Cell
                    key={i}
                    fill={!d.confirmed || d.calories == null
                      ? (isDark ? '#374151' : '#e5e7eb')
                      : nutrition.targets?.calories != null && Math.abs(d.calories - nutrition.targets.calories) / nutrition.targets.calories <= 0.1
                        ? '#34d399'
                        : '#fb923c'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className={`mt-1 text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Zelena = ±10% od cilja · Narančasta = izvan cilja · Siva = nepotvrđeno
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Parameters
// ─────────────────────────────────────────────────────────────────────────────

function ParametersSection({ parameters }: { parameters: CheckinParameterSnapshot[] }) {
  const t = useTranslations('clients.weeklyReports.parameters')
  const locale = useLocale()
  const isDark = useDark()
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short' }) : '—'

  if (parameters.length === 0) {
    return <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('noParams')}</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {parameters.map(p => (
        <div
          key={p.paramId}
          className="rounded-lg px-3 py-2.5"
          style={isDark
            ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }
            : { background: 'white', border: '1px solid #e5e7eb' }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{p.paramName}</p>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={isDark
                ? { background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }
                : { background: '#f3f4f6', color: '#6b7280' }}
            >
              {p.paramType === 'number' && p.series.length > 1 ? t('dailyParam') : t('weeklyParam')}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {formatParamValue(p.currentValue)}
              {p.paramUnit ? <span className={`ml-0.5 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{p.paramUnit}</span> : null}
            </span>
            {p.avgValue != null && p.series.length > 1 ? (
              <span className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
                ⌀ {p.avgValue}{p.paramUnit ? ` ${p.paramUnit}` : ''}
              </span>
            ) : null}
          </div>
          <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            {t('lastEntry', { date: fmtDate(p.currentValueDate) })}
          </p>
          {p.series.length > 2 ? <Sparkline points={p.series.map(s => s.value)} /> : null}
        </div>
      ))}
    </div>
  )
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 100
  const h = 20
  const step = w / (points.length - 1)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(2)} ${(h - ((p - min) / range) * h).toFixed(2)}`)
    .join(' ')
  const trend = points[points.length - 1] - points[0]
  const stroke = Math.abs(trend) < 0.01 ? '#9ca3af' : trend > 0 ? '#10b981' : '#ef4444'

  return (
    <svg width={w} height={h} className="mt-1.5" viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Photos (signed URLs on demand)
// ─────────────────────────────────────────────────────────────────────────────

function PhotosSection({ photoSets }: { photoSets: WeeklyReportSnapshot['photoSets'] }) {
  const t = useTranslations('clients.weeklyReports.photos')
  const locale = useLocale()
  const isDark = useDark()
  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  // Collect all storage paths and request signed URLs in one shot
  const paths = useMemo(() => {
    const out: string[] = []
    for (const set of photoSets) {
      for (const p of set.photos) {
        if (p.storagePath && !p.storagePath.startsWith('http')) out.push(p.storagePath)
      }
    }
    return out
  }, [photoSets])

  const [signed, setSigned] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (paths.length === 0) {
      setSigned({})
      setLoading(false)
      return
    }
    setLoading(true)
    supabase.storage
      .from('checkin-images')
      .createSignedUrls(paths, 3600)
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) {
          const m: Record<string, string> = {}
          data.forEach((d, i) => {
            if (d.signedUrl) m[paths[i]] = d.signedUrl
          })
          setSigned(m)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [paths])

  if (photoSets.length === 0) {
    return <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('noPhotos')}</p>
  }

  const resolve = (p: CheckinPhotoEntry) =>
    p.storagePath?.startsWith('http') ? p.storagePath : signed[p.storagePath] || null

  return (
    <div className="space-y-3">
      {photoSets.map(set => (
        <div key={set.checkinId}>
          <p className={`mb-1.5 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>{t('fromDate', { date: fmtDate(set.date) })}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {set.photos.map((p, i) => {
              const url = resolve(p)
              return (
                <div
                  key={`${set.checkinId}-${i}`}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg"
                  style={isDark
                    ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }
                    : { background: '#f3f4f6', border: '1px solid #e5e7eb' }}
                >
                  {url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url}
                      alt={p.position}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className={`flex h-full items-center justify-center text-xs ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>
                      {loading ? '…' : t('loadError')}
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                    {p.position}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return Math.round(n * 10) / 10 + ''
}

function formatParamValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? '✓' : '—'
  if (typeof v === 'number') return Math.round(v * 100) / 100 + ''
  return String(v)
}
