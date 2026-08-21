/**
 * The domain model. Deliberately free of any storage, React or browser
 * dependency so it can be lifted into a native shell (or a sync server)
 * without change. See docs/ARCHITECTURE.md.
 */

export type Id = string

/** Epoch milliseconds, UTC. Always store absolute time, render in local time. */
export type Timestamp = number

export type BreastSide = 'left' | 'right'
export type BottleContents = 'breast_milk' | 'formula'
export type DiaperKind = 'wet' | 'dirty' | 'mixed' | 'dry'
export type SleepKind = 'nap' | 'night'
export type VolumeUnit = 'ml' | 'oz'
export type EventType =
  | 'nursing'
  | 'bottle'
  | 'sleep'
  | 'diaper'
  | 'growth'
  | 'pumping'
  | 'temperature'
  | 'medication'

/**
 * Recorded only because the WHO publishes separate growth references for boys
 * and girls, and picking the wrong one shifts a percentile by several points.
 * Optional everywhere: a parent who would rather not record it gets the rest of
 * the app, minus percentiles.
 */
export type Sex = 'male' | 'female'

export type MeasureKind = 'weight' | 'length' | 'head'

/** Where a temperature was taken. It materially changes the number. */
export type TemperatureSite = 'armpit' | 'ear' | 'forehead' | 'mouth' | 'rectal'

/** Which units measurements are shown and entered in. */
export type MeasureSystem = 'metric' | 'imperial'

export interface Baby {
  id: Id
  name: string
  /** ISO `YYYY-MM-DD` in the baby's local calendar, or null if not given. */
  birthDate: string | null
  /** null when not recorded; growth percentiles are hidden rather than guessed. */
  sex: Sex | null
  createdAt: Timestamp
}

interface EventBase {
  id: Id
  babyId: Id
  startedAt: Timestamp
  note?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface NursingEvent extends EventBase {
  type: 'nursing'
  side: BreastSide
  durationMs: number
}

export interface BottleEvent extends EventBase {
  type: 'bottle'
  contents: BottleContents
  /** Canonical storage is always millilitres; oz is a display concern. */
  amountMl: number
}

export interface SleepEvent extends EventBase {
  type: 'sleep'
  /** null means the sleep is still running right now. */
  endedAt: Timestamp | null
  kind: SleepKind
}

export interface DiaperEvent extends EventBase {
  type: 'diaper'
  kind: DiaperKind
}

export interface GrowthEvent extends EventBase {
  type: 'growth'
  measure: MeasureKind
  /**
   * Canonical storage is **grams** for weight and **millimetres** for length and
   * head circumference — whole numbers at finer precision than any home scale or
   * tape offers, so converting between metric and imperial for display can never
   * drift the stored value.
   */
  value: number
}

export interface PumpingEvent extends EventBase {
  type: 'pumping'
  /**
   * Output per side in canonical millilitres. Both are recorded even when one is
   * zero: a persistent difference between sides is a thing parents watch for, and
   * a single total would throw that away.
   */
  leftMl: number
  rightMl: number
  durationMs: number
}

export interface TemperatureEvent extends EventBase {
  type: 'temperature'
  /**
   * Hundredths of a degree Celsius — 37.5 °C is 3750.
   *
   * One canonical unit, held as an integer, so a reading typed in Fahrenheit and
   * read back in Fahrenheit returns what was typed instead of drifting.
   */
  celsiusHundredths: number
  site: TemperatureSite
}

export interface MedicationEvent extends EventBase {
  type: 'medication'
  name: string
  /**
   * Free text, deliberately: doses come in millilitres, milligrams, drops and
   * fractions of a tablet, and a structured amount-plus-unit would be a precision
   * the app does not actually have.
   */
  dose: string
}

export type BabyEvent =
  | NursingEvent
  | BottleEvent
  | SleepEvent
  | DiaperEvent
  | GrowthEvent
  | PumpingEvent
  | TemperatureEvent
  | MedicationEvent
export type FeedEvent = NursingEvent | BottleEvent

export function isFeed(event: BabyEvent): event is FeedEvent {
  return event.type === 'nursing' || event.type === 'bottle'
}

export function isSleep(event: BabyEvent): event is SleepEvent {
  return event.type === 'sleep'
}

export function isDiaper(event: BabyEvent): event is DiaperEvent {
  return event.type === 'diaper'
}

export function isGrowth(event: BabyEvent): event is GrowthEvent {
  return event.type === 'growth'
}

export function isPumping(event: BabyEvent): event is PumpingEvent {
  return event.type === 'pumping'
}

export function isTemperature(event: BabyEvent): event is TemperatureEvent {
  return event.type === 'temperature'
}

export function isMedication(event: BabyEvent): event is MedicationEvent {
  return event.type === 'medication'
}

/** Total output of a pumping session. */
export function pumpedMl(event: PumpingEvent): number {
  return event.leftMl + event.rightMl
}

/** A sleep with no end time is the one currently in progress. */
export function isSleepInProgress(event: BabyEvent): event is SleepEvent {
  return isSleep(event) && event.endedAt === null
}
