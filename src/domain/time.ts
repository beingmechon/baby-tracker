import type { Timestamp } from './types'

export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/** Midnight at the start of the local calendar day containing `ts`. */
export function startOfLocalDay(ts: Timestamp): Timestamp {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ts: Timestamp, days: number): Timestamp {
  // Going through Date rather than adding DAY_MS keeps this correct across
  // daylight-saving transitions, where a local day is 23 or 25 hours long.
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** The local calendar day as `YYYY-MM-DD`, for grouping and for CSV export. */
export function localDateKey(ts: Timestamp): string {
  const d = new Date(ts)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * A wall-clock time in the given locale — `9:05 pm` in en, `21:05` in es.
 *
 * The locale is an explicit argument rather than read from the environment, so
 * this stays deterministic under test and so CSV export can ask for something
 * unambiguous regardless of what the user reads the app in.
 */
export function formatClock(ts: Timestamp, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
    .format(new Date(ts))
    // Intl yields "9:05 PM"; lowercase skims better and matches the app's register.
    .replace(/(AM|PM)$/i, (meridiem) => meridiem.toLowerCase())
}

/** 24-hour `21:05`, for exports and anywhere a machine may read it back. */
export function formatClock24(ts: Timestamp): string {
  const d = new Date(ts)
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`
}

export interface DurationParts {
  hours: number
  minutes: number
  seconds: number
  /** True when the whole duration is under a minute. */
  subMinute: boolean
}

/**
 * Decomposes a duration into the numbers a caller needs in order to render it.
 *
 * The *words* live in the message catalogue, not here: "1h 24m" is English, and
 * another locale may space, order or abbreviate it differently. Keeping this
 * numeric is what lets `domain/` stay free of language.
 */
export function splitDuration(ms: number): DurationParts {
  const safe = Math.max(0, ms)
  const totalMinutes = Math.floor(safe / MINUTE_MS)
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    // Under a minute we show seconds, so a fresh timer visibly moves.
    seconds: Math.floor(safe / 1000),
    subMinute: totalMinutes < 1,
  }
}

/**
 * A long span at the granularity a person would actually say it in.
 *
 * `splitDuration` is built for feeds and naps and tops out at hours, which is
 * right there and absurd elsewhere: six months of freezer life came out as
 * "4319h 59m". Anything past a couple of days wants days, weeks or months.
 *
 * Rounds to the nearest unit rather than flooring. At this granularity the figure
 * is an approximation by construction, and "4 days" beats "3 days" for something
 * four hours short of four days.
 */
export type CoarseSpan = {
  unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
  count: number
}

export function describeSpan(ms: number): CoarseSpan {
  const safe = Math.max(0, ms)
  if (safe < HOUR_MS) return { unit: 'minutes', count: Math.round(safe / MINUTE_MS) }
  if (safe < 2 * DAY_MS) return { unit: 'hours', count: Math.round(safe / HOUR_MS) }
  if (safe < 14 * DAY_MS) return { unit: 'days', count: Math.round(safe / DAY_MS) }
  if (safe < 70 * DAY_MS) return { unit: 'weeks', count: Math.round(safe / (7 * DAY_MS)) }
  // 30.4375 days is the average Gregorian month, the same figure the growth code
  // uses, so "6 months" of freezer life comes out as six and not five.
  return { unit: 'months', count: Math.round(safe / (30.4375 * DAY_MS)) }
}

/** `00:42` / `1:07:03` — a monospace-friendly form for live timers. */
export function formatStopwatch(ms: number): string {
  const safe = Math.max(0, ms)
  const totalSeconds = Math.floor(safe / 1000)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  const mm = `${minutes}`.padStart(2, '0')
  const ss = `${seconds}`.padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * How much of `[start, end)` falls inside `[windowStart, windowEnd)`.
 * Used so a sleep that crosses midnight contributes only its real share to
 * each day's total, and daily figures actually add up.
 */
export function overlapMs(
  start: Timestamp,
  end: Timestamp,
  windowStart: Timestamp,
  windowEnd: Timestamp,
): number {
  return Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart))
}

/** Parses a `YYYY-MM-DD` birth date into local midnight, or null if invalid. */
function parseBirthDate(birthDate: string | null): Date | null {
  if (!birthDate) return null
  const parts = birthDate.split('-').map(Number)
  const [year, month, day] = parts
  if (year === undefined || month === undefined || day === undefined) return null
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }
  const d = new Date(year, month - 1, day)
  // Rejects impossible dates like 2026-02-31, which Date silently rolls over.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null
  }
  return d
}

/** Whole days elapsed since a `YYYY-MM-DD` birth date, or null if unknown. */
export function ageInDays(birthDate: string | null, now: Timestamp): number | null {
  const birth = parseBirthDate(birthDate)
  if (birth === null) return null
  const days = Math.round((startOfLocalDay(now) - birth.getTime()) / DAY_MS)
  return days < 0 ? null : days
}

/**
 * Whole *calendar* months elapsed, not days divided by an average month.
 * Average-day division reports a baby's first birthday as "11 months", which
 * is the kind of small wrongness that makes an app feel untrustworthy.
 */
export function ageInMonths(birthDate: string | null, now: Timestamp): number | null {
  const birth = parseBirthDate(birthDate)
  if (birth === null) return null
  const today = new Date(startOfLocalDay(now))
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth())
  // The month has not completed until the day-of-month comes around again.
  if (today.getDate() < birth.getDate()) months -= 1
  return months < 0 ? null : months
}

/** A structured age, for the i18n layer to render into words. */
export type AgeDescription =
  | { unit: 'bornToday' }
  | { unit: 'days' | 'weeks' | 'months' | 'years'; count: number }
  | { unit: 'yearsMonths'; years: number; months: number }

/**
 * Chooses the granularity a parent would actually use: days for a newborn, then
 * weeks, then months, then years. Returns data, not a sentence.
 */
export function describeAge(
  birthDate: string | null,
  now: Timestamp,
): AgeDescription | null {
  const days = ageInDays(birthDate, now)
  if (days === null) return null
  if (days === 0) return { unit: 'bornToday' }
  if (days < 14) return { unit: 'days', count: days }
  if (days < 60) return { unit: 'weeks', count: Math.floor(days / 7) }

  const months = ageInMonths(birthDate, now) ?? 0
  if (months < 24) return { unit: 'months', count: months }

  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (remainder === 0) return { unit: 'years', count: years }
  return { unit: 'yearsMonths', years, months: remainder }
}
