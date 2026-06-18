'use client'

/**
 * Renders a WeeklyReportSnapshot to a downloadable PDF.
 * Uses @react-pdf/renderer — must be rendered client-side only.
 * The parent component lazy-loads this via dynamic import.
 */

import {
  Document,
  Font,
  G,
  Image,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import type {
  WeeklyReportSnapshot,
} from '@/lib/weekly-report'

// Register Roboto which covers Latin Extended (č, ć, đ, š, ž …)
Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
  ],
})
// Disable automatic hyphenation so words never get split mid-character
Font.registerHyphenationCallback(word => [word])

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(decimals)
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('hr', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('hr', { day: 'numeric', month: 'short' })
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n * 10) / 10)
}

function formatParamVal(v: unknown): string {
  if (v == null || v === '') return '—'
  if (v === true || v === 'true') return '✓'
  if (v === false || v === 'false') return '—'
  if (typeof v === 'number') return String(Math.round(v * 100) / 100)
  return String(v)
}

/** Returns the most frequent value from a list of { date, value } entries. */
function computeMode(values: { date: string; value: unknown }[]): unknown {
  if (!values || values.length === 0) return null
  const freq = new Map<string, number>()
  const origVal = new Map<string, unknown>()
  for (const v of values) {
    const key = String(v.value)
    freq.set(key, (freq.get(key) ?? 0) + 1)
    if (!origVal.has(key)) origVal.set(key, v.value)
  }
  let maxFreq = 0
  let modeKey: string | null = null
  for (const [val, count] of freq) {
    if (count > maxFreq) {
      maxFreq = count
      modeKey = val
    }
  }
  return modeKey !== null ? (origVal.get(modeKey) ?? modeKey) : null
}

// ── Colours ───────────────────────────────────────────────────────────────────

const BRAND = '#7c3aed'
const GREEN = '#15803d'
const GREEN_LIGHT = '#dcfce7'
const RED = '#dc2626'
const RED_LIGHT = '#fee2e2'
const AMBER = '#92400e'
const AMBER_LIGHT = '#fef3c7'
const GRAY_100 = '#f3f4f6'
const GRAY_200 = '#e5e7eb'
const GRAY_400 = '#9ca3af'
const GRAY_600 = '#4b5563'
const GRAY_800 = '#1f2937'
const PURPLE = '#a78bfa'
const ORANGE = '#fb923c'

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingVertical: 36, backgroundColor: 'white', fontSize: 10, fontFamily: 'Roboto', color: GRAY_800 },

  // Header
  headerBlock: { marginBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  clientName: { fontSize: 22, fontWeight: 'bold', color: BRAND },
  partialBadge: { backgroundColor: AMBER_LIGHT, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  partialBadgeText: { fontSize: 9, color: AMBER, fontWeight: 'bold' },
  dateRange: { fontSize: 11, color: GRAY_600, marginBottom: 3 },
  divider: { height: 1, backgroundColor: GRAY_100, marginVertical: 10 },

  // Section
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 9, fontWeight: 'bold', color: GRAY_400, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },

  // TL;DR chips
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  chip: { backgroundColor: GRAY_100, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, alignItems: 'center' },
  chipBig: { fontSize: 16, fontWeight: 'bold', color: GRAY_800 },
  chipLabel: { fontSize: 8, color: GRAY_400, marginTop: 2 },
  chipGreen: { backgroundColor: GREEN_LIGHT },
  chipRed: { backgroundColor: RED_LIGHT },

  // Planned days grid
  planGrid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  planCell: { width: 72, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center' },
  planCellDone: { backgroundColor: GREEN_LIGHT },
  planCellMiss: { backgroundColor: RED_LIGHT },
  planCellName: { fontSize: 9, fontWeight: 'bold' },
  planCellDate: { fontSize: 8, color: GRAY_600, marginTop: 2 },
  planCellStatus: { fontSize: 7, fontWeight: 'bold', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Sessions — FIX: alignItems changed to flex-start, flex moved to container View
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: GRAY_100 },
  sessionLeft: { flex: 1, paddingRight: 8 },
  sessionName: { fontSize: 10, fontWeight: 'bold' },
  sessionDate: { fontSize: 9, color: GRAY_400, marginBottom: 2 },
  sessionMeta: { fontSize: 9, color: GRAY_600 },
  sessionProg: { fontSize: 9, marginTop: 3 },

  // Volume stats bar
  volumeRow: { flexDirection: 'row', gap: 12, marginTop: 8, backgroundColor: GRAY_100, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  volumeStat: { flex: 1 },
  volumeLabel: { fontSize: 8, color: GRAY_400, textTransform: 'uppercase' },
  volumeValue: { fontSize: 11, fontWeight: 'bold', color: GRAY_800 },

  // Highlights
  hlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  hlName: { fontSize: 9, flex: 1 },
  hlBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  hlBadgeGreen: { backgroundColor: GREEN_LIGHT },
  hlBadgeRed: { backgroundColor: RED_LIGHT },
  hlBadgeText: { fontSize: 8, fontWeight: 'bold' },

  // Chart
  chartLabel: { fontSize: 7.5, color: GRAY_400, marginTop: 3 },

  // Nutrition day grid
  nutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  nutDayCell: { width: 62, borderRadius: 5, paddingVertical: 5, paddingHorizontal: 5, borderWidth: 1 },
  nutDayCellNone: { borderColor: GRAY_200, backgroundColor: '#f9fafb' },
  nutDayCellConfirmed: { borderColor: GRAY_200, backgroundColor: '#ffffff' },
  nutDayCellBest: { borderColor: '#86efac', backgroundColor: GREEN_LIGHT },
  nutDayCellWorst: { borderColor: '#fcd34d', backgroundColor: AMBER_LIGHT },
  nutDayDate: { fontSize: 7, color: GRAY_400 },
  nutDayKcal: { fontSize: 12, fontWeight: 'bold', color: GRAY_800 },
  nutDayMacro: { fontSize: 6.5, color: GRAY_600, marginTop: 1 },
  nutDayBadge: { fontSize: 7, fontWeight: 'bold', marginTop: 2 },

  // Param cards
  paramGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paramCard: { width: 232, borderRadius: 6, borderWidth: 1, borderColor: GRAY_200, paddingHorizontal: 10, paddingVertical: 8 },
  paramCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 },
  paramCardName: { fontSize: 9, fontWeight: 'bold', flex: 1, paddingRight: 4 },
  paramCardBadge: { fontSize: 6.5, color: GRAY_600, backgroundColor: GRAY_100, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2 },
  paramCardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  paramCardValue: { fontSize: 16, fontWeight: 'bold', color: GRAY_800 },
  paramCardUnit: { fontSize: 9, color: GRAY_400 },
  paramCardMeta: { fontSize: 8, color: GRAY_400, marginTop: 1 },

  // Photos
  photoSetDate: { fontSize: 8, fontWeight: 'bold', color: GRAY_600, marginBottom: 5 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  photoLabel: { fontSize: 7, color: GRAY_400, textTransform: 'uppercase', marginTop: 2 },

  // Trainer notes
  notesBox: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  notesText: { fontSize: 10, color: '#1e40af', lineHeight: 1.6 },
  notesLabel: { fontSize: 8, fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },

  // Footer
  footerText: { fontSize: 8, color: GRAY_400 },
})

// ── SVG Chart Components ──────────────────────────────────────────────────────

type BarDatum = { label: string; value: number | null; color?: string }

/** Bar chart implemented with pure SVG (no recharts). Labels rendered below as PDF Text. */
function BarChartPdf({
  data,
  width = 515,
  barAreaHeight = 80,
  targetLine,
}: {
  data: BarDatum[]
  width?: number
  barAreaHeight?: number
  targetLine?: number | null
}) {
  const valid = data.map(d => d.value).filter((v): v is number => v != null)
  if (valid.length === 0) return null

  const maxVal = Math.max(...valid, targetLine ?? 0) * 1.1 || 1
  const colW = width / data.length
  const barW = Math.max(4, colW * 0.65)
  const padX = (colW - barW) / 2

  return (
    <View>
      <Svg width={width} height={barAreaHeight}>
        {/* Grid lines */}
        {([0.25, 0.5, 0.75, 1] as number[]).map(f => (
          <Line
            key={f}
            x1={0}
            y1={barAreaHeight * (1 - f)}
            x2={width}
            y2={barAreaHeight * (1 - f)}
            stroke={GRAY_100}
            strokeWidth={0.5}
          />
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const x = i * colW + padX
          const h = d.value != null ? Math.max(1, (d.value / maxVal) * barAreaHeight) : 0
          const y = barAreaHeight - h
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={d.value != null ? (d.color ?? PURPLE) : GRAY_200}
              rx={2}
            />
          )
        })}
        {/* Target reference line */}
        {targetLine != null && maxVal > 0 && (
          <Line
            x1={0}
            y1={barAreaHeight - (targetLine / maxVal) * barAreaHeight}
            x2={width}
            y2={barAreaHeight - (targetLine / maxVal) * barAreaHeight}
            stroke={GRAY_400}
            strokeDasharray="4 2"
            strokeWidth={0.8}
          />
        )}
      </Svg>
      {/* X-axis labels as PDF Text */}
      <View style={{ flexDirection: 'row', width }}>
        {data.map((d, i) => (
          <Text key={i} style={{ width: colW, fontSize: 7, color: GRAY_400, textAlign: 'center' }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

/** Sparkline using SVG Path. */
function SparklinePdf({ points, width = 100, height = 18 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = width / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(height - ((p - min) / range) * (height - 2) - 1).toFixed(1)}`)
    .join(' ')
  const trend = points[points.length - 1] - points[0]
  const stroke = Math.abs(trend) < 0.01 ? GRAY_400 : trend > 0 ? '#10b981' : '#ef4444'
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={stroke} strokeWidth={1.5} fill="none" />
    </Svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ snap }: { snap: WeeklyReportSnapshot }) {
  return (
    <View style={s.headerBlock}>
      <View style={s.headerTop}>
        <Text style={s.clientName}>{snap.client.name}</Text>
        {snap.range.isPartial && (
          <View style={s.partialBadge}>
            <Text style={s.partialBadgeText}>DJELOMIČAN TJEDAN</Text>
          </View>
        )}
      </View>
      <Text style={s.dateRange}>
        Tjedni izvještaj · {fmtDate(snap.range.start)} – {fmtDate(snap.range.end)} · {snap.range.days} dana
      </Text>
      {snap.client.goal ? (
        <Text style={[s.dateRange, { marginTop: 1 }]}>Cilj: {snap.client.goal}</Text>
      ) : null}
      <View style={s.divider} />
    </View>
  )
}

function TldrSection({ snap }: { snap: WeeklyReportSnapshot }) {
  const { summary } = snap
  const wRatio = `${summary.workoutsCompletedCount}/${summary.workoutsPlannedCount}`
  const nRatio = `${summary.nutritionConfirmedDays}/${summary.nutritionTotalDays}`
  const wDone = summary.workoutsCompletedCount >= summary.workoutsPlannedCount && summary.workoutsPlannedCount > 0
  const nDone = summary.nutritionConfirmedDays >= summary.nutritionTotalDays && summary.nutritionTotalDays > 0
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Pregled tjedna</Text>
      <View style={s.chipRow}>
        <View style={[s.chip, wDone ? s.chipGreen : {}]}>
          <Text style={s.chipBig}>{wRatio}</Text>
          <Text style={s.chipLabel}>treninga</Text>
        </View>
        <View style={[s.chip, nDone ? s.chipGreen : {}]}>
          <Text style={s.chipBig}>{nRatio}</Text>
          <Text style={s.chipLabel}>potvrđeno prehrana</Text>
        </View>
        {summary.avgCalories != null && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{fmt(summary.avgCalories, 0)}</Text>
            <Text style={s.chipLabel}>kcal prosjek</Text>
          </View>
        )}
        {summary.avgProtein != null && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{fmt(summary.avgProtein, 0)}g</Text>
            <Text style={s.chipLabel}>proteini prosjek</Text>
          </View>
        )}
        {summary.weightStart != null && summary.weightEnd != null ? (
          <View style={[s.chip, summary.weightDelta != null && summary.weightDelta < 0 ? s.chipRed : summary.weightDelta != null && summary.weightDelta > 0 ? s.chipGreen : {}]}>
            <Text style={s.chipBig}>
              {summary.weightDelta != null ? `${summary.weightDelta > 0 ? '+' : ''}${fmt(summary.weightDelta)} kg` : `${fmt(summary.weightEnd)} kg`}
            </Text>
            <Text style={s.chipLabel}>
              {summary.weightDelta != null ? `${fmt(summary.weightStart)} → ${fmt(summary.weightEnd)} kg` : 'težina'}
            </Text>
          </View>
        ) : null}
        {summary.totalVolumeKg > 0 && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{fmtNum(summary.totalVolumeKg)}</Text>
            <Text style={s.chipLabel}>ukupni volumen kg</Text>
          </View>
        )}
        {summary.avgSteps != null && (
          <View style={[s.chip, summary.stepGoal != null && summary.avgSteps >= summary.stepGoal ? s.chipGreen : {}]}>
            <Text style={s.chipBig}>{fmtNum(summary.avgSteps)}</Text>
            <Text style={s.chipLabel}>{summary.stepGoal != null ? `koraka ⌀ / cilj ${fmtNum(summary.stepGoal)}` : 'koraka prosjek'}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function TrainingsSection({ snap }: { snap: WeeklyReportSnapshot }) {
  const { trainings } = snap
  if (trainings.plannedDays.length === 0 && trainings.sessions.length === 0) return null

  const volumeChartData: BarDatum[] = trainings.sessions.map(s => ({
    label: s.dayName?.split(' ')[0] ?? s.date.slice(5),
    value: s.totalVolumeKg,
    color: PURPLE,
  }))

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Treninzi · {trainings.sessions.length}/{trainings.plannedDays.length}</Text>

      {/* Planned grid */}
      {trainings.plannedDays.length > 0 && (
        <View style={s.planGrid}>
          {trainings.plannedDays.map((d, i) => (
            <View key={i} style={[s.planCell, d.logged ? s.planCellDone : s.planCellMiss]}>
              <Text style={[s.planCellName, { color: d.logged ? GREEN : RED }]}>{d.dayName}</Text>
              <Text style={s.planCellDate}>{fmtShort(d.date)}</Text>
              <Text style={[s.planCellStatus, { color: d.logged ? GREEN : RED }]}>
                {d.logged ? 'Odrađeno' : 'Propušteno'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Sessions list */}
      {trainings.sessions.length > 0 && (
        <View style={{ marginTop: 2 }}>
          {trainings.sessions.map((session, i) => (
            <View key={i} style={s.sessionRow}>
              {/* Left: date + name + top progression — flex:1 is on this View, NOT on Text */}
              <View style={s.sessionLeft}>
                <Text style={s.sessionDate}>{fmtShort(session.date)}</Text>
                <Text style={s.sessionName}>{session.dayName || '—'}</Text>
                {session.topProgression && (
                  <Text style={[s.sessionProg, { color: session.topProgression.kind === 'up' ? GREEN : RED }]}>
                    {session.topProgression.exerciseName}
                    {session.topProgression.weightDelta
                      ? ` · ${session.topProgression.weightDelta > 0 ? '+' : ''}${fmt(session.topProgression.weightDelta)} kg`
                      : ''}
                    {session.topProgression.repsDelta && !session.topProgression.weightDelta
                      ? ` · ${session.topProgression.repsDelta > 0 ? '+' : ''}${session.topProgression.repsDelta} pon.`
                      : ''}
                  </Text>
                )}
              </View>
              {/* Right: stats */}
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.sessionMeta}>{session.exerciseCount} vježbi · {session.totalSetsCompleted} setova</Text>
                <Text style={[s.sessionMeta, { fontWeight: 'bold' }]}>{fmt(session.totalVolumeKg, 0)} kg vol.</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Volume bar chart + stats */}
      {trainings.sessions.length >= 2 && (
        <View style={{ marginTop: 12 }}>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Volumen po sesiji</Text>
          <BarChartPdf data={volumeChartData} />
          {trainings.totalVolumeKg > 0 && (
            <View style={s.volumeRow}>
              <View style={s.volumeStat}>
                <Text style={s.volumeLabel}>Ukupni volumen</Text>
                <Text style={s.volumeValue}>{fmtNum(trainings.totalVolumeKg)} kg</Text>
              </View>
              {trainings.avgSessionVolumeKg != null && (
                <View style={s.volumeStat}>
                  <Text style={s.volumeLabel}>Prosjek po sesiji</Text>
                  <Text style={s.volumeValue}>{fmtNum(trainings.avgSessionVolumeKg)} kg</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Best progressions */}
      {trainings.bestProgressions.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={[s.sectionTitle, { marginBottom: 4 }]}>Top napredak</Text>
          {trainings.bestProgressions.map((h, i) => (
            <View key={i} style={s.hlRow}>
              <Text style={s.hlName}>{h.exerciseName}</Text>
              <View style={[s.hlBadge, s.hlBadgeGreen]}>
                <Text style={[s.hlBadgeText, { color: GREEN }]}>
                  {h.weightDelta ? `+${fmt(h.weightDelta)} kg` : h.repsDelta ? `+${h.repsDelta} pon.` : '↑'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Regressions */}
      {trainings.biggestRegressions.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.sectionTitle, { marginBottom: 4 }]}>Regresija</Text>
          {trainings.biggestRegressions.map((h, i) => (
            <View key={i} style={s.hlRow}>
              <Text style={s.hlName}>{h.exerciseName}</Text>
              <View style={[s.hlBadge, s.hlBadgeRed]}>
                <Text style={[s.hlBadgeText, { color: RED }]}>
                  {h.weightDelta ? `${fmt(h.weightDelta)} kg` : h.repsDelta ? `${h.repsDelta} pon.` : '↓'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function NutritionSection({ snap }: { snap: WeeklyReportSnapshot }) {
  const { nutrition } = snap
  if (!nutrition || nutrition.totalDays === 0) return null

  const t = nutrition.targets
  const pct = Math.round((nutrition.confirmedDays / nutrition.totalDays) * 100)

  const kcalChartData: BarDatum[] = nutrition.days.map(d => {
    let color: string
    if (!d.confirmed || d.calories == null) {
      color = GRAY_200
    } else if (t?.calories != null && Math.abs(d.calories - t.calories) / t.calories <= 0.1) {
      color = '#34d399'
    } else {
      color = ORANGE
    }
    return {
      label: new Date(d.date + 'T12:00:00').toLocaleDateString('hr', { day: '2-digit', month: 'short' }),
      value: d.confirmed && d.calories != null ? d.calories : null,
      color,
    }
  })

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>
        Prehrana · {nutrition.confirmedDays}/{nutrition.totalDays} potvrđeno ({pct}%)
      </Text>

      {/* Macro averages */}
      <View style={[s.chipRow, { marginBottom: 10 }]}>
        {nutrition.avgCalories != null && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{fmt(nutrition.avgCalories, 0)}</Text>
            <Text style={s.chipLabel}>kcal prosjek{t?.calories ? ` / ${t.calories}` : ''}</Text>
          </View>
        )}
        {nutrition.avgProtein != null && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{fmt(nutrition.avgProtein, 0)}g</Text>
            <Text style={s.chipLabel}>proteini{t?.protein ? ` / ${t.protein}g` : ''}</Text>
          </View>
        )}
        {nutrition.avgCarbs != null && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{fmt(nutrition.avgCarbs, 0)}g</Text>
            <Text style={s.chipLabel}>ugljikohidrati</Text>
          </View>
        )}
        {nutrition.avgFat != null && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{fmt(nutrition.avgFat, 0)}g</Text>
            <Text style={s.chipLabel}>masti</Text>
          </View>
        )}
      </View>

      {/* Per-day grid cards */}
      {nutrition.confirmedDays > 0 && (
        <View style={s.nutGrid}>
          {nutrition.days.map((d, i) => {
            const isBest = nutrition.bestDay?.date === d.date
            const isWorst = nutrition.worstDay?.date === d.date
            const cellStyle = !d.confirmed
              ? s.nutDayCellNone
              : isBest
                ? s.nutDayCellBest
                : isWorst
                  ? s.nutDayCellWorst
                  : s.nutDayCellConfirmed
            return (
              <View key={i} style={[s.nutDayCell, cellStyle]}>
                <Text style={s.nutDayDate}>{fmtShort(d.date)}</Text>
                {d.confirmed && d.calories != null ? (
                  <>
                    <Text style={s.nutDayKcal}>{d.calories}</Text>
                    {d.protein != null && (
                      <Text style={s.nutDayMacro}>P {d.protein} · UH {d.carbs ?? '—'} · M {d.fat ?? '—'}</Text>
                    )}
                    {isBest && <Text style={[s.nutDayBadge, { color: GREEN }]}>★ Cilj</Text>}
                    {isWorst && <Text style={[s.nutDayBadge, { color: AMBER }]}>! Daleko</Text>}
                  </>
                ) : (
                  <Text style={[s.nutDayDate, { marginTop: 2, color: GRAY_400 }]}>—</Text>
                )}
              </View>
            )
          })}
        </View>
      )}

      {/* Calories bar chart */}
      {nutrition.days.filter(d => d.confirmed && d.calories != null).length >= 2 && (
        <View style={{ marginTop: 4 }}>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Kalorije po danu</Text>
          <BarChartPdf data={kcalChartData} targetLine={t?.calories ?? null} />
          <Text style={s.chartLabel}>
            Zelena = ±10% od cilja · Narančasta = izvan cilja · Siva = nepotvrđeno
          </Text>
        </View>
      )}
    </View>
  )
}

function ParametersSection({ snap }: { snap: WeeklyReportSnapshot }) {
  const { parameters } = snap
  if (!parameters || parameters.length === 0) return null
  const visible = parameters.filter(p => p.currentValue != null)
  if (visible.length === 0) return null

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Check-in parametri</Text>
      <View style={s.paramGrid}>
        {visible.map((p, i) => {
          // For categorical/boolean params, show the most frequent value in the week
          const isNonNumeric = p.paramType !== 'number'
          const displayValue = isNonNumeric && p.allValues && p.allValues.length > 1
            ? computeMode(p.allValues)
            : p.currentValue
          // Count occurrences of the mode for frequency label
          const modeCount = isNonNumeric && p.allValues && displayValue != null
            ? p.allValues.filter(v => String(v.value) === String(displayValue)).length
            : null
          const totalCount = p.allValues?.length ?? null

          return (
            <View key={i} style={s.paramCard}>
              <View style={s.paramCardHeader}>
                <Text style={s.paramCardName}>{p.paramName}</Text>
                <Text style={s.paramCardBadge}>
                  {p.paramType === 'number' && p.series.length > 1 ? 'DNEVNI' : 'TJEDNI'}
                </Text>
              </View>
              <View style={s.paramCardValueRow}>
                <Text style={s.paramCardValue}>{formatParamVal(displayValue)}</Text>
                {p.paramUnit ? <Text style={s.paramCardUnit}>{p.paramUnit}</Text> : null}
              </View>
              {/* Frequency label for categorical params with multiple entries */}
              {modeCount != null && totalCount != null && totalCount > 1 && (
                <Text style={s.paramCardMeta}>{modeCount}× od {totalCount} unosa</Text>
              )}
              {p.avgValue != null && p.series.length > 1 && (
                <Text style={s.paramCardMeta}>⌀ {p.avgValue}{p.paramUnit ? ` ${p.paramUnit}` : ''}</Text>
              )}
              <Text style={s.paramCardMeta}>
                Zadnji unos: {p.currentValueDate ? fmtShort(p.currentValueDate) : '—'}
              </Text>
              {p.series.length > 2 && (
                <View style={{ marginTop: 5 }}>
                  <SparklinePdf points={p.series.map(s => s.value)} width={100} height={18} />
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

function PhotosSection({ photoSets }: { photoSets: WeeklyReportSnapshot['photoSets'] }) {
  // Only render photos that have been resolved — either pre-signed https URLs or data: URLs
  const setsWithUrls = photoSets
    .map(set => ({
      ...set,
      photos: set.photos.filter(p => p.storagePath?.startsWith('http') || p.storagePath?.startsWith('data:')),
    }))
    .filter(set => set.photos.length > 0)

  if (setsWithUrls.length === 0) return null

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Fotografije</Text>
      {setsWithUrls.map((set, si) => (
        <View key={si} style={{ marginBottom: 8 }}>
          <Text style={s.photoSetDate}>{fmtShort(set.date)}</Text>
          <View style={s.photoGrid}>
            {set.photos.map((p, pi) => (
              <View key={pi}>
                <Image
                  src={p.storagePath}
                  style={{ width: 148, height: 200, borderRadius: 4, objectFit: 'cover' }}
                />
                <Text style={s.photoLabel}>{p.position}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

function TrainerNotesSection({ snap }: { snap: WeeklyReportSnapshot }) {
  if (!snap.trainerNotes) return null
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Bilješke trenera</Text>
      <View style={s.notesBox}>
        <Text style={s.notesLabel}>Komentar</Text>
        <Text style={s.notesText}>{snap.trainerNotes}</Text>
      </View>
    </View>
  )
}

// ── Document ─────────────────────────────────────────────────────────────────

function WeeklyReportDocument({ snap }: { snap: WeeklyReportSnapshot }) {
  return (
    <Document
      title={`Izvještaj ${snap.client.name} ${snap.range.start}`}
      author="Coaching App"
      subject="Tjedni izvještaj"
    >
      <Page size="A4" style={s.page}>
        <Header snap={snap} />
        <TldrSection snap={snap} />
        <View style={s.divider} />
        <TrainingsSection snap={snap} />
        <View style={s.divider} />
        <NutritionSection snap={snap} />
        <View style={s.divider} />
        <ParametersSection snap={snap} />
        {snap.photoSets.some(s => s.photos.some(p => p.storagePath?.startsWith('http'))) && (
          <View style={s.divider} />
        )}
        <PhotosSection photoSets={snap.photoSets} />
        {snap.trainerNotes && <View style={s.divider} />}
        <TrainerNotesSection snap={snap} />
        <Text
          style={s.footerText}
          render={({ pageNumber, totalPages }) =>
            `${snap.client.name} · ${snap.range.start} – ${snap.range.end}  ·  Str. ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}

// ── Export trigger ────────────────────────────────────────────────────────────

export async function downloadReportPdf(snap: WeeklyReportSnapshot): Promise<void> {
  const blob = await pdf(<WeeklyReportDocument snap={snap} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `izvjestaj-${snap.client.name.replace(/\s+/g, '-').toLowerCase()}-${snap.range.start}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export default WeeklyReportDocument
