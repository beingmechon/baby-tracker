import { ageInDays } from './time'
import type {
  BabyEvent,
  MedicationEvent,
  TemperatureEvent,
  TemperatureSite,
  Timestamp,
} from './types'

/**
 * Temperature and medication.
 *
 * The most medically adjacent code in the project, so the boundary is drawn
 * explicitly: everything here either converts a unit or compares a number to a
 * published figure. Nothing decides anything about a baby. The layer above states
 * what the figure is and where it came from, and says plainly that the app cannot
 * assess anyone — see docs/MEDICAL_DISCLAIMER.md and the house rules in
 * CONTRIBUTING.md.
 */

export const TEMPERATURE_SITES: readonly TemperatureSite[] = [
  'armpit',
  'ear',
  'forehead',
  'mouth',
  'rectal',
]

/**
 * 38.0 °C, in the hundredths-of-a-degree the events store.
 *
 * The figure nearly every health service names as a fever — the NHS, the CDC and
 * the WHO all use 38 °C — and it is a threshold, not a diagnosis. Readings from an
 * armpit or forehead typically come in lower than a rectal one for the same baby,
 * which the screen says rather than this code pretending to correct for.
 */
export const RAISED_THRESHOLD = 3800

/** 36.0 °C. Guidance treats a persistently low reading as worth attention too. */
export const LOW_THRESHOLD = 3600

/** Under this age, guidance on a raised temperature is markedly more urgent. */
export const YOUNG_INFANT_DAYS = 90

export type TemperatureBand = 'low' | 'normal' | 'raised'

export interface TemperatureReading {
  event: TemperatureEvent
  band: TemperatureBand
  /**
   * True when the baby was under three months at the time of the reading *and*
   * the reading is raised.
   *
   * Surfaced because every health service singles this case out, and leaving it
   * unsaid to avoid sounding medical would be the more harmful choice. The wording
   * above reports what guidance says; it does not tell a parent what to do.
   */
  youngInfant: boolean
}

export function describeTemperature(
  event: TemperatureEvent,
  birthDate: string | null,
): TemperatureReading {
  const band: TemperatureBand =
    event.celsiusHundredths >= RAISED_THRESHOLD
      ? 'raised'
      : event.celsiusHundredths < LOW_THRESHOLD
        ? 'low'
        : 'normal'

  // Age at the reading, not age today: a fever recorded at six weeks does not stop
  // having been a six-week-old's fever once the baby is four months old.
  const days = ageInDays(birthDate, event.startedAt)
  return {
    event,
    band,
    youngInfant: band === 'raised' && days !== null && days < YOUNG_INFANT_DAYS,
  }
}

/** °C from the stored hundredths. */
export function toCelsius(hundredths: number): number {
  return hundredths / 100
}

export function celsiusToFahrenheit(celsius: number): number {
  return celsius * (9 / 5) + 32
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * (5 / 9)
}

/**
 * Stored as hundredths of a degree Celsius, always.
 *
 * One canonical unit and an integer, so a reading typed in Fahrenheit, displayed
 * in Celsius and read back in Fahrenheit returns the number that was typed rather
 * than drifting by a hundredth each way.
 */
export function toHundredths(value: number, unit: 'c' | 'f'): number {
  return Math.round((unit === 'f' ? fahrenheitToCelsius(value) : value) * 100)
}

export function fromHundredths(hundredths: number, unit: 'c' | 'f'): number {
  const celsius = toCelsius(hundredths)
  const value = unit === 'f' ? celsiusToFahrenheit(celsius) : celsius
  return Math.round(value * 10) / 10
}

/** A plausible body temperature. Anything outside this is a typo or a broken thermometer. */
export function isValidTemperature(hundredths: number): boolean {
  return Number.isFinite(hundredths) && hundredths >= 3000 && hundredths <= 4500
}

/** The most recent temperature reading, or null. */
export function latestTemperature(
  events: readonly BabyEvent[],
): TemperatureEvent | null {
  let latest: TemperatureEvent | null = null
  for (const event of events) {
    if (event.type !== 'temperature') continue
    if (latest === null || event.startedAt > latest.startedAt) latest = event
  }
  return latest
}

export interface MedicationSummary {
  /** The name as most recently spelled by the parent. */
  name: string
  lastGivenAt: Timestamp
  lastDose: string
  timesGiven: number
}

/**
 * Medications grouped by name, most recently given first.
 *
 * Matched case- and space-insensitively so "Calpol" and "calpol " are one entry,
 * because "last given" is the question this answers and two spellings of the same
 * bottle would answer it wrongly. The display name is whichever spelling was used
 * most recently, so correcting it once corrects it everywhere.
 */
/**
 * The grouping key for a medication name.
 *
 * Exported because anything that shows medication names has to group them the same
 * way. Two screens disagreeing about whether "Calpol" and "calpol" are one bottle
 * is worse than either answer.
 */
export function medicationKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function medicationSummaries(
  events: readonly BabyEvent[],
): MedicationSummary[] {
  const byKey = new Map<string, MedicationSummary>()

  for (const event of events) {
    if (event.type !== 'medication') continue
    const key = medicationKey(event.name)
    if (key.length === 0) continue

    const existing = byKey.get(key)
    if (existing === undefined) {
      byKey.set(key, {
        name: event.name.trim(),
        lastGivenAt: event.startedAt,
        lastDose: event.dose,
        timesGiven: 1,
      })
      continue
    }

    existing.timesGiven += 1
    if (event.startedAt > existing.lastGivenAt) {
      existing.lastGivenAt = event.startedAt
      existing.lastDose = event.dose
      existing.name = event.name.trim()
    }
  }

  return [...byKey.values()].sort((a, b) => b.lastGivenAt - a.lastGivenAt)
}

/** Every distinct medication name logged, for suggesting the next dose. */
export function medicationNames(events: readonly BabyEvent[]): string[] {
  return medicationSummaries(events).map((summary) => summary.name)
}

/** The most recent medication event, whatever it was. */
export function latestMedication(
  events: readonly BabyEvent[],
): MedicationEvent | null {
  let latest: MedicationEvent | null = null
  for (const event of events) {
    if (event.type !== 'medication') continue
    if (latest === null || event.startedAt > latest.startedAt) latest = event
  }
  return latest
}
