/**
 * Check-in vrijednosti su mapirane po ID-u retka u checkin_parameters, ne po fiksnom ključu "weight".
 * Ovdje odabiremo koji tjedni numerički parametar tretiramo kao masu (za pregled / grafove).
 */

export type CheckinParamRow = {
  id: string
  name: string
  type: string
  unit: string | null
  frequency: string
  order_index?: number
  /** Ako true, parametar je u skupu do 3 za karticu tjednog pregleda klijenta (isti za sve klijente). */
  show_in_overview?: boolean | null
}

const WEIGHT_NAME_RE = /weight|težina|tezina|tjelesna|body\s*weight|^bw$/i

function normUnit(u: string | null | undefined): string {
  return (u ?? '').trim().toLowerCase().replace(/\.$/, '')
}

/**
 * 1) Tjedni + number parametar s jedinicom kg (ili lbs kao sekundarna oznaka)
 * 2) Tjedni + number čije ime nalikuje na masu/tjelesnu težinu
 * 3) Inače prvi tjedni numerički parametar (često je prvi upisan masa)
 */
export function resolveWeightParameterId(params: CheckinParamRow[]): string | null {
  const weeklyNumbers = params.filter(p => p.frequency === 'weekly' && p.type === 'number')
  if (!weeklyNumbers.length) return null

  const byKg = weeklyNumbers.find(p => {
    const u = normUnit(p.unit)
    return u === 'kg' || u === 'lbs' || u === 'lb'
  })
  if (byKg) return byKg.id

  const byName = weeklyNumbers.find(p => WEIGHT_NAME_RE.test(p.name.trim()))
  if (byName) return byName.id

  const sorted = [...weeklyNumbers].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  return sorted[0]?.id ?? null
}

export function parseNumericCheckinValue(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

export function extractWeightFromCheckinValues(
  values: Record<string, unknown> | null | undefined,
  weightParamId: string | null,
): number | null {
  if (!values) return null
  if (weightParamId) {
    const v = parseNumericCheckinValue(values[weightParamId])
    if (v != null) return v
  }
  return parseNumericCheckinValue(values.weight ?? values.tezina)
}
