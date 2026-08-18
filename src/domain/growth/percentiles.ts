import { fromWhoUnits, toWhoUnits } from '../measure'
import { DAY_MS, ageInDays } from '../time'
import type { MeasureKind, Sex, Timestamp } from '../types'
import {
  WHO_LENGTH_FOR_AGE,
  WHO_WEIGHT_FOR_AGE,
  type LmsPoint,
} from './whoReference'

/**
 * Percentiles from the WHO Child Growth Standards.
 *
 * The WHO publishes each standard as LMS parameters per age: a Box-Cox power
 * (L), the median (M) and a coefficient of variation (S). Together they describe
 * a skewed distribution, which is what makes a percentile meaningful for infant
 * weight — the distribution is not symmetric, so mean ± SD would be wrong.
 *
 * Nothing here interprets a result. A percentile is a description of where a
 * measurement sits among healthy babies of the same age and sex; it is not a
 * verdict, and the UI must never present it as one. See docs/MEDICAL_DISCLAIMER.md.
 */

export interface Lms {
  l: number
  m: number
  s: number
}

export interface PercentileResult {
  /** Standard deviations from the median, in the LMS-transformed space. */
  z: number
  /** 0–100. Clamped only by floating-point precision, not by policy. */
  percentile: number
}

/**
 * The average length of a month in the Gregorian calendar (365.25 / 12). The WHO
 * builds its by-month tables on exactly this figure, so converting age in days
 * this way lands on the same grid the tables were tabulated from.
 */
export const DAYS_PER_MONTH = 30.4375

/** Fractional age in months — the input the reference tables are indexed by. */
export function ageInMonthsExact(
  birthDate: string | null,
  now: Timestamp,
): number | null {
  const days = ageInDays(birthDate, now)
  return days === null ? null : days / DAYS_PER_MONTH
}

/** Fractional months between two instants, for growth velocity. */
export function monthsBetween(from: Timestamp, to: Timestamp): number {
  return (to - from) / DAY_MS / DAYS_PER_MONTH
}

/**
 * The reference table for a measurement, or null when the WHO set this project
 * ships does not cover it.
 *
 * Head circumference returns null deliberately: the reference was not in the
 * source spreadsheets, and a made-up curve behind a number a parent shows to a
 * doctor is the one failure mode this project will not risk. Head measurements
 * are still tracked, just without a percentile.
 */
export function referenceTable(
  measure: MeasureKind,
  sex: Sex,
): readonly LmsPoint[] | null {
  switch (measure) {
    case 'weight':
      return WHO_WEIGHT_FOR_AGE[sex]
    case 'length':
      return WHO_LENGTH_FOR_AGE[sex]
    case 'head':
      return null
  }
}

/**
 * The LMS parameters at a fractional age, linearly interpolated between the two
 * bracketing monthly rows. Returns null outside the table's range rather than
 * extrapolating — a percentile for an age the standard does not cover would be
 * an invention.
 */
export function lmsAt(table: readonly LmsPoint[], ageMonths: number): Lms | null {
  const first = table[0]
  const last = table[table.length - 1]
  if (first === undefined || last === undefined) return null
  if (ageMonths < first[0] || ageMonths > last[0]) return null

  for (let i = 0; i < table.length - 1; i += 1) {
    const lower = table[i]
    const upper = table[i + 1]
    if (lower === undefined || upper === undefined) continue
    if (ageMonths >= lower[0] && ageMonths <= upper[0]) {
      const span = upper[0] - lower[0]
      const weight = span === 0 ? 0 : (ageMonths - lower[0]) / span
      return {
        l: lower[1] + (upper[1] - lower[1]) * weight,
        m: lower[2] + (upper[2] - lower[2]) * weight,
        s: lower[3] + (upper[3] - lower[3]) * weight,
      }
    }
  }
  return null
}

/**
 * The LMS z-score. `value` is in the units the WHO tables use — kg or cm.
 *
 * The L = 0 branch is not dead code: the transform degenerates to a plain log
 * when the Box-Cox power is zero, and some rows of the length standard are very
 * close to it.
 */
export function zScore(value: number, { l, m, s }: Lms): number {
  if (value <= 0 || m <= 0 || s <= 0) return NaN
  return l === 0 ? Math.log(value / m) / s : ((value / m) ** l - 1) / (l * s)
}

/** The inverse: the measurement that sits exactly `z` standard deviations out. */
export function valueAtZ(z: number, { l, m, s }: Lms): number {
  return l === 0 ? m * Math.exp(s * z) : m * (1 + l * s * z) ** (1 / l)
}

/**
 * Abramowitz & Stegun 7.1.26 — maximum absolute error 1.5e-7, which is four
 * orders of magnitude finer than the single percentile point this app displays.
 * Hand-rolled because `Math` has no erf and a stats library would be a whole
 * dependency for eleven lines.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * abs)
  const poly =
    t * (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-abs * abs))
}

/** The standard normal CDF, as a percentage. */
export function percentileFromZ(z: number): number {
  return 50 * (1 + erf(z / Math.SQRT2))
}

export interface PercentileInput {
  measure: MeasureKind
  sex: Sex
  /** Fractional age in months at the time of the measurement. */
  ageMonths: number
  /** Canonical stored value: grams for weight, millimetres for length. */
  value: number
}

/**
 * Where a measurement sits against the reference, or null when no reference
 * applies — an unsupported measurement, or an age outside the shipped tables.
 */
export function percentileFor({
  measure,
  sex,
  ageMonths,
  value,
}: PercentileInput): PercentileResult | null {
  const table = referenceTable(measure, sex)
  if (table === null) return null
  const lms = lmsAt(table, ageMonths)
  if (lms === null) return null

  const z = zScore(toWhoUnits(value, measure), lms)
  if (!Number.isFinite(z)) return null
  return { z, percentile: percentileFromZ(z) }
}

export interface CurvePoint {
  ageMonths: number
  /** Canonical units, so the chart plots reference and measurements on one axis. */
  value: number
}

/**
 * One reference curve for the chart. `z` picks which curve: -1.881 is the 3rd
 * percentile, 0 the median, +1.881 the 97th.
 *
 * Sampled evenly rather than at the table's monthly rows, because a newborn's
 * chart spans only two or three months and joining four monthly points with
 * straight lines puts a visible kink in what is a smooth curve. Between rows the
 * LMS parameters are interpolated and the value recomputed, which is how the WHO
 * itself derives intermediate ages.
 */
export function referenceCurve(
  measure: MeasureKind,
  sex: Sex,
  z: number,
  maxAgeMonths: number,
  samples = 48,
): CurvePoint[] {
  const table = referenceTable(measure, sex)
  if (table === null) return []
  const last = table[table.length - 1]
  if (last === undefined) return []

  // Never past the end of the reference: an extrapolated curve is an invention.
  const limit = Math.min(maxAgeMonths, last[0])
  const points: CurvePoint[] = []
  for (let i = 0; i <= samples; i += 1) {
    const ageMonths = (limit * i) / samples
    const lms = lmsAt(table, ageMonths)
    if (lms === null) continue
    points.push({ ageMonths, value: fromWhoUnits(valueAtZ(z, lms), measure) })
  }
  return points
}

/** The z-scores of the curves the chart draws, outermost first. */
export const CHART_CURVES = [
  { z: -1.8808, percentile: 3 },
  { z: 0, percentile: 50 },
  { z: 1.8808, percentile: 97 },
] as const

/** The oldest age the shipped reference covers for a measurement, in months. */
export function referenceMaxAgeMonths(measure: MeasureKind, sex: Sex): number | null {
  const table = referenceTable(measure, sex)
  const last = table?.[table.length - 1]
  return last === undefined ? null : last[0]
}
