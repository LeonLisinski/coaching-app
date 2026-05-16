'use client'

/**
 * Renders a WeeklyReportSnapshot to a downloadable PDF.
 * Uses @react-pdf/renderer — must be rendered client-side only.
 * The parent component lazy-loads this via dynamic import.
 */

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import type { WeeklyReportSnapshot } from '@/lib/weekly-report'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(decimals)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hr', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString('hr', { day: 'numeric', month: 'short' })
}

// ── Styles ───────────────────────────────────────────────────────────────────

const BRAND = '#7c3aed'
const BRAND_LIGHT = '#ede9fe'
const GREEN = '#15803d'
const GREEN_LIGHT = '#dcfce7'
const RED = '#dc2626'
const RED_LIGHT = '#fee2e2'
const GRAY_100 = '#f3f4f6'
const GRAY_400 = '#9ca3af'
const GRAY_600 = '#4b5563'
const GRAY_800 = '#1f2937'

const s = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingVertical: 36, backgroundColor: 'white', fontSize: 10, fontFamily: 'Helvetica', color: GRAY_800 },

  // Header
  headerBlock: { marginBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  clientName: { fontSize: 22, fontWeight: 'bold', color: BRAND },
  partialBadge: { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  partialBadgeText: { fontSize: 9, color: '#92400e', fontWeight: 'bold' },
  dateRange: { fontSize: 11, color: GRAY_600, marginBottom: 3 },
  divider: { height: 1, backgroundColor: GRAY_100, marginVertical: 10 },

  // Section
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 9, fontWeight: 'bold', color: GRAY_400, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  // TL;DR chips
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  chip: { backgroundColor: GRAY_100, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, alignItems: 'center' },
  chipBig: { fontSize: 16, fontWeight: 'bold', color: GRAY_800 },
  chipLabel: { fontSize: 8, color: GRAY_400, marginTop: 2 },
  chipGreen: { backgroundColor: GREEN_LIGHT },
  chipRed: { backgroundColor: RED_LIGHT },

  // Planned days grid
  planGrid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  planCell: { width: 72, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center' },
  planCellDone: { backgroundColor: GREEN_LIGHT },
  planCellMiss: { backgroundColor: RED_LIGHT },
  planCellName: { fontSize: 9, fontWeight: 'bold' },
  planCellDate: { fontSize: 8, color: GRAY_600, marginTop: 2 },
  planCellStatus: { fontSize: 7, fontWeight: 'bold', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Sessions
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: GRAY_100 },
  sessionName: { fontSize: 10, fontWeight: 'bold', flex: 1 },
  sessionDate: { fontSize: 9, color: GRAY_400, marginBottom: 2 },
  sessionMeta: { fontSize: 9, color: GRAY_600 },
  sessionProg: { fontSize: 9, marginTop: 2 },

  // Highlights
  hlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  hlName: { fontSize: 9, flex: 1 },
  hlBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  hlBadgeGreen: { backgroundColor: GREEN_LIGHT },
  hlBadgeRed: { backgroundColor: RED_LIGHT },
  hlBadgeText: { fontSize: 8, fontWeight: 'bold' },

  // Nutrition
  nutRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: GRAY_100, paddingVertical: 5 },
  nutDate: { fontSize: 9, flex: 1 },
  nutCell: { width: 52, textAlign: 'right', fontSize: 9 },
  nutHeader: { fontWeight: 'bold', color: GRAY_400 },

  // Param table
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: GRAY_100, paddingVertical: 5 },
  paramName: { fontSize: 9, flex: 2 },
  paramVal: { fontSize: 9, flex: 1, textAlign: 'right' },

  // Trainer notes
  notesBox: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  notesText: { fontSize: 10, color: '#1e40af', lineHeight: 1.6 },
  notesLabel: { fontSize: 8, fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },

  // Footer
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: GRAY_400 },
})

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
        {summary.weightDelta != null && (
          <View style={[s.chip, summary.weightDelta < 0 ? s.chipGreen : summary.weightDelta > 0 ? s.chipRed : {}]}>
            <Text style={s.chipBig}>{summary.weightDelta > 0 ? '+' : ''}{fmt(summary.weightDelta)} kg</Text>
            <Text style={s.chipLabel}>promjena težine</Text>
          </View>
        )}
        {summary.totalVolumeKg > 0 && (
          <View style={s.chip}>
            <Text style={s.chipBig}>{summary.totalVolumeKg >= 1000 ? `${(summary.totalVolumeKg / 1000).toFixed(1)}k` : fmt(summary.totalVolumeKg, 0)}</Text>
            <Text style={s.chipLabel}>ukupni volumen</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function TrainingsSection({ snap }: { snap: WeeklyReportSnapshot }) {
  const { trainings } = snap
  if (trainings.plannedDays.length === 0 && trainings.sessions.length === 0) return null

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

      {/* Sessions */}
      {trainings.sessions.length > 0 && (
        <View style={{ marginTop: 10 }}>
          {trainings.sessions.map((session, i) => (
            <View key={i} style={s.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.sessionDate}>{fmtShort(session.date)}</Text>
                <Text style={s.sessionName}>{session.dayName || '—'}</Text>
                {session.topProgression && (
                  <Text style={[s.sessionProg, { color: session.topProgression.kind === 'up' ? GREEN : RED }]}>
                    {session.topProgression.exerciseName}
                    {session.topProgression.weightDelta ? ` · ${session.topProgression.weightDelta > 0 ? '+' : ''}${fmt(session.topProgression.weightDelta)} kg` : ''}
                    {session.topProgression.repsDelta && !session.topProgression.weightDelta ? ` · ${session.topProgression.repsDelta > 0 ? '+' : ''}${session.topProgression.repsDelta} pon.` : ''}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.sessionMeta}>{session.exerciseCount} vježbi · {session.totalSetsCompleted} setova</Text>
                <Text style={[s.sessionMeta, { fontWeight: 'bold' }]}>{fmt(session.totalVolumeKg, 0)} kg vol.</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Highlights */}
      {trainings.bestProgressions.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Top napredak</Text>
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
      {trainings.biggestRegressions.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={[s.sectionTitle, { marginBottom: 6 }]}>Regresija</Text>
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

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Prehrana · {nutrition.confirmedDays}/{nutrition.totalDays} potvrđeno</Text>
      {/* Averages vs targets */}
      <View style={[s.chipRow, { marginBottom: 8 }]}>
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

      {/* Day table — only confirmed days */}
      {nutrition.days.filter(d => d.confirmed).length > 0 && (
        <>
          <View style={[s.nutRow, { borderBottomWidth: 2 }]}>
            <Text style={[s.nutDate, s.nutHeader]}>Datum</Text>
            <Text style={[s.nutCell, s.nutHeader]}>kcal</Text>
            <Text style={[s.nutCell, s.nutHeader]}>P</Text>
            <Text style={[s.nutCell, s.nutHeader]}>UH</Text>
            <Text style={[s.nutCell, s.nutHeader]}>M</Text>
          </View>
          {nutrition.days.filter(d => d.confirmed).map((d, i) => (
            <View key={i} style={s.nutRow}>
              <Text style={s.nutDate}>{fmtShort(d.date)}</Text>
              <Text style={s.nutCell}>{fmt(d.calories, 0)}</Text>
              <Text style={s.nutCell}>{fmt(d.protein, 0)}g</Text>
              <Text style={s.nutCell}>{fmt(d.carbs, 0)}g</Text>
              <Text style={s.nutCell}>{fmt(d.fat, 0)}g</Text>
            </View>
          ))}
        </>
      )}
    </View>
  )
}

function ParametersSection({ snap }: { snap: WeeklyReportSnapshot }) {
  const { parameters } = snap
  if (!parameters || parameters.length === 0) return null
  const numericParams = parameters.filter(p => p.paramType === 'number' && p.currentValue != null)
  const otherParams = parameters.filter(p => p.paramType !== 'number' && p.currentValue != null)
  if (numericParams.length === 0 && otherParams.length === 0) return null

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Parametri</Text>
      <View style={[s.paramRow, { borderBottomWidth: 2 }]}>
        <Text style={[s.paramName, { color: GRAY_400, fontWeight: 'bold', fontSize: 8 }]}>PARAMETAR</Text>
        <Text style={[s.paramVal, { color: GRAY_400, fontWeight: 'bold', fontSize: 8 }]}>VRIJEDNOST</Text>
        <Text style={[s.paramVal, { color: GRAY_400, fontWeight: 'bold', fontSize: 8 }]}>PROSJEK</Text>
        <Text style={[s.paramVal, { color: GRAY_400, fontWeight: 'bold', fontSize: 8 }]}>DATUM</Text>
      </View>
      {[...numericParams, ...otherParams].map((p, i) => (
        <View key={i} style={s.paramRow}>
          <Text style={s.paramName}>{p.paramName}{p.paramUnit ? ` (${p.paramUnit})` : ''}</Text>
          <Text style={[s.paramVal, { fontWeight: 'bold' }]}>
            {String(p.currentValue)}{p.paramUnit ? ` ${p.paramUnit}` : ''}
          </Text>
          <Text style={s.paramVal}>{p.avgValue != null ? `${fmt(p.avgValue)} ${p.paramUnit ?? ''}` : '—'}</Text>
          <Text style={s.paramVal}>{p.currentValueDate ? fmtShort(p.currentValueDate) : '—'}</Text>
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

function FooterEl({ snap, pageNumber, totalPages }: { snap: WeeklyReportSnapshot; pageNumber: number; totalPages: number }) {
  const createdAt = new Date().toLocaleDateString('hr', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{snap.client.name} · Tjedni izvještaj · {snap.range.start} – {snap.range.end}</Text>
      <Text style={s.footerText}>Generirano {createdAt} · {pageNumber}/{totalPages}</Text>
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
