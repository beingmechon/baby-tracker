import { isValidInterval, type Reminder, type ReminderKind } from '@/domain/reminders'
import type {
  Baby,
  BabyEvent,
  BottleContents,
  BreastSide,
  DiaperKind,
  MeasureKind,
  Sex,
  SleepKind,
} from '@/domain/types'

/**
 * Validators for data arriving from outside the app: an export file the user
 * picked, or a record written by an older version of the app. Import must never
 * be able to corrupt the store, so anything that does not match the model is
 * rejected rather than coerced.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nonNegative(value: unknown): number | null {
  const n = finiteNumber(value)
  return n !== null && n >= 0 ? n : null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

const SIDES: readonly BreastSide[] = ['left', 'right']
const CONTENTS: readonly BottleContents[] = ['breast_milk', 'formula']
const DIAPER_KINDS: readonly DiaperKind[] = ['wet', 'dirty', 'mixed', 'dry']
const SLEEP_KINDS: readonly SleepKind[] = ['nap', 'night']
const MEASURES: readonly MeasureKind[] = ['weight', 'length', 'head']
const SEXES: readonly Sex[] = ['male', 'female']
const REMINDER_KIND_VALUES: readonly ReminderKind[] = [
  'feed',
  'diaper',
  'pumping',
  'custom',
]

/** ISO `YYYY-MM-DD`, or null. Anything else is dropped to null. */
function isoDate(value: unknown): string | null {
  const s = str(value)
  if (s === null) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export function parseBaby(value: unknown): Baby | null {
  if (!isObject(value)) return null
  const id = str(value.id)
  const name = str(value.name)
  if (id === null || name === null) return null
  return {
    id,
    name,
    birthDate: isoDate(value.birthDate),
    // Absent in exports written before growth tracking existed, which must still
    // import cleanly — the app simply hides percentiles until it is set.
    sex: oneOf(value.sex, SEXES),
    createdAt: nonNegative(value.createdAt) ?? 0,
  }
}

export function parseEvent(value: unknown): BabyEvent | null {
  if (!isObject(value)) return null

  const id = str(value.id)
  const babyId = str(value.babyId)
  const startedAt = nonNegative(value.startedAt)
  if (id === null || babyId === null || startedAt === null) return null

  const note = str(value.note)
  const base = {
    id,
    babyId,
    startedAt,
    createdAt: nonNegative(value.createdAt) ?? startedAt,
    updatedAt: nonNegative(value.updatedAt) ?? startedAt,
    ...(note !== null ? { note } : {}),
  }

  switch (value.type) {
    case 'nursing': {
      const side = oneOf(value.side, SIDES)
      const durationMs = nonNegative(value.durationMs)
      if (side === null || durationMs === null) return null
      return { ...base, type: 'nursing', side, durationMs }
    }
    case 'bottle': {
      const contents = oneOf(value.contents, CONTENTS)
      const amountMl = nonNegative(value.amountMl)
      if (contents === null || amountMl === null) return null
      return { ...base, type: 'bottle', contents, amountMl }
    }
    case 'sleep': {
      const kind = oneOf(value.kind, SLEEP_KINDS)
      if (kind === null) return null
      const endedAt = value.endedAt === null ? null : nonNegative(value.endedAt)
      // An end before the start is incoherent; reject rather than store a
      // negative duration that would poison every summary.
      if (endedAt !== null && endedAt < startedAt) return null
      return { ...base, type: 'sleep', kind, endedAt }
    }
    case 'diaper': {
      const kind = oneOf(value.kind, DIAPER_KINDS)
      if (kind === null) return null
      return { ...base, type: 'diaper', kind }
    }
    case 'growth': {
      const measure = oneOf(value.measure, MEASURES)
      const measured = finiteNumber(value.value)
      // A zero or negative weight is not a measurement, and it would produce a
      // NaN z-score that then propagates into the chart.
      if (measure === null || measured === null || measured <= 0) return null
      return { ...base, type: 'growth', measure, value: measured }
    }
    default:
      return null
  }
}

/**
 * A reminder from an export file.
 *
 * The interval is checked against the same rule the UI enforces, so a
 * hand-edited file cannot install a reminder that fires every second.
 */
export function parseReminder(value: unknown): Reminder | null {
  if (!isObject(value)) return null

  const id = str(value.id)
  const babyId = str(value.babyId)
  const kind = oneOf(value.kind, REMINDER_KIND_VALUES)
  const intervalMs = finiteNumber(value.intervalMs)
  if (id === null || babyId === null || kind === null || intervalMs === null) return null
  if (!isValidInterval(intervalMs)) return null

  const createdAt = nonNegative(value.createdAt) ?? 0
  const optionalTime = (candidate: unknown): number | null =>
    candidate === null || candidate === undefined ? null : nonNegative(candidate)

  return {
    id,
    babyId,
    kind,
    // A custom reminder with no label is legal; the UI falls back to the kind.
    label: str(value.label) ?? '',
    intervalMs,
    // Anything other than an explicit `false` leaves the reminder on, matching
    // how the app writes it.
    enabled: value.enabled !== false,
    lastDoneAt: optionalTime(value.lastDoneAt),
    lastAlertedAt: optionalTime(value.lastAlertedAt),
    snoozedUntil: optionalTime(value.snoozedUntil),
    createdAt,
    updatedAt: nonNegative(value.updatedAt) ?? createdAt,
  }
}
