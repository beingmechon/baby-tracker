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

/** `9:05 pm` — a 12-hour clock, lowercase, because it is easier to skim. */
export function formatClock(ts: Timestamp): string {
  const d = new Date(ts)
  const hours = d.getHours()
  const suffix = hours < 12 ? 'am' : 'pm'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${`${d.getMinutes()}`.padStart(2, '0')} ${suffix}`
}

/**
 * `1h 24m`, `24m`, `48s`. Durations under a minute keep seconds so a running
 * timer visibly moves the moment you start it.
 */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms)
  const totalMinutes = Math.floor(safe / MINUTE_MS)
  if (totalMinutes < 1) return `${Math.floor(safe / 1000)}s`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
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

/** `just now`, `20m ago`, `3h 5m ago`. */
export function formatAgo(ts: Timestamp, now: Timestamp): string {
  const delta = now - ts
  if (delta < MINUTE_MS) return 'just now'
  return `${formatDuration(delta)} ago`
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

/** `6 days old`, `7 weeks old`, `14 months old`, `2 years old`. */
export function formatAge(birthDate: string | null, now: Timestamp): string | null {
  const days = ageInDays(birthDate, now)
  if (days === null) return null
  if (days === 0) return 'born today'
  if (days === 1) return '1 day old'
  if (days < 14) return `${days} days old`
  if (days < 60) {
    const weeks = Math.floor(days / 7)
    return `${weeks} weeks old`
  }

  const months = ageInMonths(birthDate, now) ?? 0
  if (months < 24) return `${months} months old`

  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (remainder === 0) return `${years} years old`
  return `${years}y ${remainder}m old`
}
