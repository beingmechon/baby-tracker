import { DAY_MS, addDays, birthTimestamp } from '../time'
import type { BabyEvent, GrowthEvent, MeasureKind, Timestamp } from '../types'
import { monthsBetween } from './percentiles'

/** Every measurement kind, in the order they are offered in the UI. */
export const MEASURE_KINDS: readonly MeasureKind[] = ['weight', 'length', 'head']

/**
 * Reading a growth history: what the latest measurement is, and how fast it is
 * changing. Pure and numeric — the words and units belong to the layers above.
 */

/** Every measurement of one kind, oldest first, which is chart order. */
export function growthSeries(
  events: readonly BabyEvent[],
  measure: MeasureKind,
): GrowthEvent[] {
  return events
    .filter(
      (event): event is GrowthEvent =>
        event.type === 'growth' && event.measure === measure,
    )
    .sort((a, b) => a.startedAt - b.startedAt)
}

/** The most recent measurement of a kind, or null if there is none. */
export function latestMeasurement(
  events: readonly BabyEvent[],
  measure: MeasureKind,
): GrowthEvent | null {
  const series = growthSeries(events, measure)
  return series[series.length - 1] ?? null
}

/** The latest value of each measurement kind, for a ledger or a prefilled sheet. */
export function latestMeasurements(
  events: readonly BabyEvent[],
): Partial<Record<MeasureKind, number>> {
  const latest: Partial<Record<MeasureKind, number>> = {}
  for (const measure of MEASURE_KINDS) {
    const event = latestMeasurement(events, measure)
    if (event !== null) latest[measure] = event.value
  }
  return latest
}

export interface GrowthChange {
  /** Canonical units, signed: negative when the measurement went down. */
  delta: number
  /** Canonical units per week, over the interval between the two readings. */
  perWeek: number
  from: Timestamp
  to: Timestamp
}

/**
 * The change between the two most recent measurements of a kind.
 *
 * Deliberately the last two rather than a fit over the whole history: a parent
 * asking "is she gaining?" means since the last weigh-in, and a regression line
 * over five months would smooth away exactly the recent change they are asking
 * about. Two readings on the same day return null — a per-week rate from a
 * zero-length interval is a division by zero dressed up as information.
 */
export function growthChange(
  events: readonly BabyEvent[],
  measure: MeasureKind,
): GrowthChange | null {
  const series = growthSeries(events, measure)
  const previous = series[series.length - 2]
  const latest = series[series.length - 1]
  if (previous === undefined || latest === undefined) return null

  const days = (latest.startedAt - previous.startedAt) / DAY_MS
  if (days < 1) return null

  const delta = latest.value - previous.value
  return {
    delta,
    perWeek: (delta / days) * 7,
    from: previous.startedAt,
    to: latest.startedAt,
  }
}

/** The age in fractional months at which a measurement was taken. */
export function measurementAgeMonths(
  event: GrowthEvent,
  birthTimestamp: Timestamp,
): number {
  return monthsBetween(birthTimestamp, event.startedAt)
}

/**
 * The measurement taken on the day the baby was born, if there is one.
 *
 * Birth stats are stored as ordinary growth events dated at birth rather than as
 * fields on the baby, so they plot on the chart and export with everything else.
 * The cost of that choice is this function: "the birth weight" has to be recognised
 * by its date instead of read from a labelled field.
 *
 * Matched on the whole local day, not the exact millisecond, because a parent
 * entering it later types a date and not a time.
 */
export function birthMeasurement(
  events: readonly BabyEvent[],
  measure: MeasureKind,
  birthDate: string | null,
): GrowthEvent | null {
  const birth = birthTimestamp(birthDate)
  if (birth === null) return null
  const dayEnd = addDays(birth, 1)
  return (
    growthSeries(events, measure).find(
      (event) => event.startedAt >= birth && event.startedAt < dayEnd,
    ) ?? null
  )
}

/**
 * Change from the birth measurement to the latest one.
 *
 * The comparison parents are actually told at every appointment — "back to birth
 * weight yet?" in the first fortnight, "doubled her birth weight" later — and the
 * one thing a chart of two dots cannot show them. Null when either end is missing,
 * or when the latest *is* the birth measurement and the answer would be zero.
 */
export function changeSinceBirth(
  events: readonly BabyEvent[],
  measure: MeasureKind,
  birthDate: string | null,
): { from: GrowthEvent; to: GrowthEvent; delta: number } | null {
  const from = birthMeasurement(events, measure, birthDate)
  const to = latestMeasurement(events, measure)
  if (from === null || to === null || from.id === to.id) return null
  return { from, to, delta: to.value - from.value }
}
