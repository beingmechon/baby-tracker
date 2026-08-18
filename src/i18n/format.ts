import { MINUTE_MS, splitDuration, type AgeDescription } from '@/domain/time'
import type { Timestamp, VolumeUnit } from '@/domain/types'
import { mlToOz } from '@/domain/units'
import type { Translator } from './translate'

/**
 * Turns the numeric output of `domain/` into localized words.
 *
 * This is the seam the i18n work exists to create: `domain/` computes, this file
 * says it in the reader's language. Nothing here does arithmetic that belongs in
 * the domain, and nothing in the domain holds a translatable string.
 */

/** `1h 24m`, `24m`, `48s` — pattern and spacing come from the catalogue. */
export function formatDuration(t: Translator, ms: number): string {
  const { hours, minutes, seconds, subMinute } = splitDuration(ms)
  if (subMinute) return t.t('duration.seconds', { seconds })
  if (hours === 0) return t.t('duration.minutes', { minutes })
  if (minutes === 0) return t.t('duration.hours', { hours })
  return t.t('duration.hoursMinutes', { hours, minutes })
}

/** `just now`, `20m ago`, `3h 5m ago`. */
export function formatAgo(t: Translator, ts: Timestamp, now: Timestamp): string {
  const delta = now - ts
  if (delta < MINUTE_MS) return t.t('duration.justNow')
  return t.t('duration.ago', { duration: formatDuration(t, delta) })
}

/** `5 days old`, `7 weeks old`, `2y 3m old`. */
export function formatAge(t: Translator, age: AgeDescription | null): string | null {
  if (age === null) return null
  switch (age.unit) {
    case 'bornToday':
      return t.t('age.bornToday')
    case 'days':
      return t.plural('age.days', age.count)
    case 'weeks':
      return t.plural('age.weeks', age.count)
    case 'months':
      return t.plural('age.months', age.count)
    case 'years':
      return t.plural('age.years', age.count)
    case 'yearsMonths':
      return t.t('age.yearsMonths', { years: age.years, months: age.months })
  }
}

/**
 * A bottle volume in the user's unit, with locale-aware digits — a decimal comma
 * where the locale uses one.
 */
export function formatVolume(t: Translator, ml: number, unit: VolumeUnit): string {
  if (unit === 'oz') {
    const oz = mlToOz(ml)
    const rounded = Math.round(oz * 10) / 10
    return `${t.number(rounded, { maximumFractionDigits: 1 })} oz`
  }
  return `${t.number(Math.round(ml))} ml`
}

/** A date for prose, e.g. "17 Aug" — never for storage or file names. */
export function formatShortDate(locale: string, ts: Timestamp): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(ts),
  )
}
