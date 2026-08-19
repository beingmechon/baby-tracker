import { G_PER_OZ, gramsToPoundsOunces, mmToInches } from '@/domain/measure'
import type { ReminderKind, ReminderStatus } from '@/domain/reminders'
import { MINUTE_MS, splitDuration, type AgeDescription } from '@/domain/time'
import type {
  MeasureKind,
  MeasureSystem,
  Timestamp,
  VolumeUnit,
} from '@/domain/types'
import { mlToOz } from '@/domain/units'
import type { MessageKey } from './messages/en'
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

const MEASURE_NAMES: Record<MeasureKind, MessageKey> = {
  weight: 'event.growth.weight',
  length: 'event.growth.length',
  head: 'event.growth.head',
}

const MEASURE_SHORT_NAMES: Record<MeasureKind, MessageKey> = {
  weight: 'growth.measure.weight',
  length: 'growth.measure.length',
  head: 'growth.measure.head',
}

/** The unambiguous name — "Head circumference". Use wherever there is room. */
export function measureName(t: Translator, measure: MeasureKind): string {
  return t.t(MEASURE_NAMES[measure])
}

/**
 * The short name — "Head". Only for a segmented control, where three options
 * have to share a phone's width; "Head" is unambiguous once it sits beside
 * "Weight" and "Length".
 */
export function measureShortName(t: Translator, measure: MeasureKind): string {
  return t.t(MEASURE_SHORT_NAMES[measure])
}

/**
 * A measurement in the parent's own units: `6.4 kg`, `14 lb 3 oz`, `62.5 cm`.
 *
 * Imperial weight is two units because that is how it is said and how a scale
 * reads it — "14.19 lb" is a number no parent would repeat out loud. Unit
 * symbols are not translated: kg, cm, lb and in are international, and putting
 * them in the catalogue would invite them being localised wrongly.
 */
export function formatMeasure(
  t: Translator,
  value: number,
  measure: MeasureKind,
  system: MeasureSystem,
): string {
  if (measure === 'weight') {
    if (system === 'imperial') {
      const { pounds, ounces } = gramsToPoundsOunces(value)
      return t.t('growth.poundsOunces', {
        pounds: t.number(pounds),
        ounces: t.number(ounces),
      })
    }
    return `${t.number(value / 1000, { maximumFractionDigits: 2 })} kg`
  }

  if (system === 'imperial') {
    return `${t.number(mmToInches(value), { maximumFractionDigits: 1 })} in`
  }
  return `${t.number(value / 10, { maximumFractionDigits: 1 })} cm`
}

/**
 * A signed change, in whichever unit keeps the number legible: a week's weight
 * gain is `+180 g`, not `+0.18 kg`. Newborns lose weight in their first days, so
 * the sign is always shown rather than assumed positive.
 */
export function formatMeasureDelta(
  t: Translator,
  delta: number,
  measure: MeasureKind,
  system: MeasureSystem,
): string {
  const signed = (value: number, options: Intl.NumberFormatOptions = {}) =>
    t.number(value, { signDisplay: 'always', ...options })

  if (measure === 'weight') {
    if (system === 'imperial') {
      const ounces = delta / G_PER_OZ
      return Math.abs(ounces) < 16
        ? `${signed(Math.round(ounces))} oz`
        : `${signed(ounces / 16, { maximumFractionDigits: 1 })} lb`
    }
    return Math.abs(delta) < 1000
      ? `${signed(Math.round(delta))} g`
      : `${signed(delta / 1000, { maximumFractionDigits: 2 })} kg`
  }

  if (system === 'imperial') {
    return `${signed(mmToInches(delta), { maximumFractionDigits: 1 })} in`
  }
  return `${signed(delta / 10, { maximumFractionDigits: 1 })} cm`
}

/**
 * Where a measurement sits against the WHO reference, in words.
 *
 * Outside the 1st and 99th the exact figure stops being meaningful to a parent
 * and starts sounding like a verdict, so it is described rather than numbered.
 */
export function formatPercentile(t: Translator, percentile: number): string {
  if (percentile < 1) return t.t('growth.percentileBelowFirst')
  if (percentile > 99) return t.t('growth.percentileAboveLast')
  return t.t('growth.percentile', { percentile: t.ordinal(Math.round(percentile)) })
}

const REMINDER_KIND_NAMES: Record<ReminderKind, MessageKey> = {
  feed: 'reminders.kind.feed',
  diaper: 'reminders.kind.diaper',
  pumping: 'reminders.kind.pumping',
  custom: 'reminders.kind.custom',
}

/**
 * What to call a reminder: its own name if the parent gave it one, otherwise the
 * name of its kind. A custom reminder without a label is possible in an imported
 * file, so this never returns an empty string.
 */
export function reminderName(t: Translator, kind: ReminderKind, label: string): string {
  const trimmed = label.trim()
  return trimmed.length > 0 ? trimmed : t.t(REMINDER_KIND_NAMES[kind])
}

/**
 * A reminder's state as one short phrase: `in 2h 10m`, `40m overdue`,
 * `snoozed · 8m`, `Due now`.
 *
 * Overdue reads as a duration rather than a time, because "40m overdue" answers
 * the question a parent is actually asking and "due at 11:00" makes them do the
 * subtraction.
 */
export function formatReminderState(t: Translator, status: ReminderStatus): string {
  switch (status.state) {
    case 'off':
      return t.t('reminders.off')
    case 'snoozed':
      return t.t('reminders.snoozedFor', {
        duration: formatDuration(t, status.remainingMs),
      })
    case 'upcoming':
      return t.t('reminders.upcoming', {
        duration: formatDuration(t, status.remainingMs),
      })
    case 'due': {
      const overdueMs = -status.remainingMs
      // Under a minute late is "due now"; a countdown to the second would be
      // noise on something that is only accurate to the interval anyway.
      return overdueMs < MINUTE_MS
        ? t.t('reminders.due')
        : t.t('reminders.overdue', { duration: formatDuration(t, overdueMs) })
    }
  }
}
