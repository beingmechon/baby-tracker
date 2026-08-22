import { isValidInterval, type Reminder, type ReminderKind } from '@/domain/reminders'
import {
  TEMPERATURE_SITES,
  isValidTemperature,
} from '@/domain/health'
import {
  STASH_LOCATIONS,
  isValidStashAmount,
  type StashEntry,
  type StashLocation,
} from '@/domain/stash'
import type { StoredPhoto } from './repository'
import type {
  Baby,
  BabyEvent,
  BottleContents,
  BreastSide,
  DiaperKind,
  MeasureKind,
  Sex,
  SleepKind,
  ActivityKind,
  Allergen,
  FoodAcceptance,
  PottyPlace,
  PottyResult,
  SymptomImpression,
  VisitQuestion,
  TemperatureSite,
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
const IMPRESSIONS: readonly SymptomImpression[] = ['mild', 'moderate', 'severe']
const ACCEPTANCES: readonly FoodAcceptance[] = [
  'refused',
  'tasted',
  'some',
  'most',
  'all',
]
const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'tummy',
  'bath',
  'walk',
  'play',
  'reading',
  'other',
]
const POTTY_RESULTS: readonly PottyResult[] = [
  'pee',
  'poo',
  'both',
  'nothing',
  'accident',
]
const POTTY_PLACES: readonly PottyPlace[] = ['potty', 'toilet']
const ALLERGENS: readonly Allergen[] = [
  'milk',
  'egg',
  'peanut',
  'treeNut',
  'wheat',
  'soy',
  'fish',
  'shellfish',
  'sesame',
]

/**
 * A cap on the questions list from a file.
 *
 * Nothing about a doctor's appointment needs two hundred questions, and an
 * unbounded array from an untrusted file is an unbounded render.
 */
const MAX_QUESTIONS = 50

function parseQuestions(value: unknown): VisitQuestion[] {
  if (!Array.isArray(value)) return []
  const questions: VisitQuestion[] = []
  for (const entry of value) {
    if (!isObject(entry)) continue
    const text = str(entry.text)
    if (text === null) continue
    questions.push({ text, asked: entry.asked === true })
    if (questions.length >= MAX_QUESTIONS) break
  }
  return questions
}
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
    case 'temperature': {
      const site = oneOf<TemperatureSite>(value.site, TEMPERATURE_SITES)
      const celsiusHundredths = finiteNumber(value.celsiusHundredths)
      if (site === null || celsiusHundredths === null) return null
      // A reading outside human range is a typo or a broken thermometer, and
      // storing it would put a nonsense figure in front of a doctor.
      if (!isValidTemperature(celsiusHundredths)) return null
      return { ...base, type: 'temperature', site, celsiusHundredths }
    }
    case 'medication': {
      const name = str(value.name)
      if (name === null) return null
      return { ...base, type: 'medication', name, dose: str(value.dose) ?? '' }
    }
    case 'symptom': {
      const name = str(value.name)
      const impression = oneOf<SymptomImpression>(value.impression, IMPRESSIONS)
      // An unnamed symptom is not an observation, and an unknown impression would
      // render as an empty word next to it.
      if (name === null || impression === null) return null
      return { ...base, type: 'symptom', name, impression }
    }
    case 'food': {
      const name = str(value.name)
      const acceptance = oneOf<FoodAcceptance>(value.acceptance, ACCEPTANCES)
      if (name === null || acceptance === null) return null
      return {
        ...base,
        type: 'food',
        name,
        acceptance,
        // Unknown allergen names are dropped rather than failing the whole entry:
        // a file from a future version that knows about celery should still import
        // its food log, minus the tag this version cannot name.
        allergens: Array.isArray(value.allergens)
          ? value.allergens.filter((entry): entry is Allergen =>
              (ALLERGENS as readonly string[]).includes(entry as string),
            )
          : [],
        reaction: value.reaction === true,
      }
    }
    case 'activity': {
      const kind = oneOf<ActivityKind>(value.kind, ACTIVITY_KINDS)
      const durationMs = nonNegative(value.durationMs)
      if (kind === null) return null
      // A missing duration means "nobody timed it", not "invalid".
      return { ...base, type: 'activity', kind, durationMs: durationMs ?? 0 }
    }
    case 'potty': {
      const result = oneOf<PottyResult>(value.result, POTTY_RESULTS)
      const place = oneOf<PottyPlace>(value.place, POTTY_PLACES)
      if (result === null) return null
      return { ...base, type: 'potty', result, place: place ?? 'potty' }
    }
    case 'milestone': {
      const name = str(value.name)
      if (name === null) return null
      return {
        ...base,
        type: 'milestone',
        name,
        photoId: str(value.photoId),
      }
    }
    case 'visit': {
      const reason = str(value.reason)
      if (reason === null) return null
      return {
        ...base,
        type: 'visit',
        reason,
        who: str(value.who) ?? '',
        questions: parseQuestions(value.questions),
      }
    }
    case 'pumping': {
      const leftMl = nonNegative(value.leftMl)
      const rightMl = nonNegative(value.rightMl)
      const durationMs = nonNegative(value.durationMs)
      if (leftMl === null || rightMl === null || durationMs === null) return null
      return { ...base, type: 'pumping', leftMl, rightMl, durationMs }
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

/** A milk-stash entry from an export file. */
export function parseStashEntry(value: unknown): StashEntry | null {
  if (!isObject(value)) return null

  const id = str(value.id)
  const babyId = str(value.babyId)
  const location = oneOf<StashLocation>(value.location, STASH_LOCATIONS)
  const amountMl = finiteNumber(value.amountMl)
  const expressedAt = nonNegative(value.expressedAt)
  if (id === null || babyId === null || location === null) return null
  if (amountMl === null || !isValidStashAmount(amountMl)) return null
  // Without a time of expression there is no age, and the age is the point.
  if (expressedAt === null) return null

  const createdAt = nonNegative(value.createdAt) ?? expressedAt
  return {
    id,
    babyId,
    amountMl,
    location,
    expressedAt,
    createdAt,
    updatedAt: nonNegative(value.updatedAt) ?? createdAt,
  }
}

/**
 * A photo from an export file.
 *
 * The size cap matters as much as the shape check. A hand-edited or hostile file
 * could carry a hundred-megabyte string per record; base64 of a downscaled JPEG is
 * a few hundred kilobytes, so anything past a couple of megabytes is not a photo
 * this app produced and is refused rather than written to a phone's storage quota.
 *
 * The data is not decoded or validated as an image. Nothing here executes it, it is
 * only ever handed to an `<img>` as a data URL, and a corrupt one shows a broken
 * image rather than doing harm.
 */
const MAX_PHOTO_BASE64 = 3_000_000

export function parsePhoto(value: unknown): StoredPhoto | null {
  if (!isObject(value)) return null
  const id = str(value.id)
  const babyId = str(value.babyId)
  const data = str(value.data)
  const width = nonNegative(value.width)
  const height = nonNegative(value.height)
  const createdAt = nonNegative(value.createdAt)
  if (id === null || babyId === null || data === null) return null
  if (width === null || height === null) return null
  if (data.length > MAX_PHOTO_BASE64) return null
  // Only the image types the picker can produce, so a file cannot smuggle in an
  // SVG — which is a document that can carry script, not a photograph.
  const type = str(value.type) ?? 'image/jpeg'
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return null
  return {
    id,
    babyId,
    type,
    data,
    width,
    height,
    createdAt: createdAt ?? 0,
  }
}
