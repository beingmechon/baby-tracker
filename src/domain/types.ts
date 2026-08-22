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
  | 'symptom'
  | 'visit'
  | 'food'

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

/**
 * How a symptom seemed *to the parent*.
 *
 * Their own impression, recorded so a diary can show a direction over days — the
 * thing a doctor asks and nobody can remember. It is not a clinical grade and the
 * app never acts on it: nothing is triaged, ranked or flagged from this value.
 */
export type SymptomImpression = 'mild' | 'moderate' | 'severe'

/**
 * The nine major food allergens named in United States federal law — the eight of
 * the Food Allergen Labeling and Consumer Protection Act of 2004, plus sesame,
 * added by the FASTER Act with effect from January 2023.
 *
 * A published regulatory list, not medical advice and not this project's opinion
 * about what any child should eat. It is here because "which of the nine have we
 * introduced?" is a question parents are asked and cannot answer from memory, and
 * because a list defined by statute is one this app can carry without inventing
 * anything. Other countries name more — celery, mustard, lupin and molluscs in the
 * EU and UK, for instance — and adding them is a matter of extending this list;
 * see docs/ROADMAP.md.
 */
export type Allergen =
  | 'milk'
  | 'egg'
  | 'peanut'
  | 'treeNut'
  | 'wheat'
  | 'soy'
  | 'fish'
  | 'shellfish'
  | 'sesame'

/** How much of it actually went in, as the parent saw it. */
export type FoodAcceptance = 'refused' | 'tasted' | 'some' | 'most' | 'all'

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

export interface SymptomEvent extends EventBase {
  type: 'symptom'
  /**
   * Free text, with the parent's own past entries offered as suggestions.
   *
   * A fixed list would be either incomplete or a set of clinical categories, and
   * this app is not in a position to offer either. "Whatever you would say out
   * loud" is the right vocabulary for a diary a parent keeps.
   */
  name: string
  impression: SymptomImpression
  // "Anything else" is the inherited `note`. A second field of the same name on
  // this interface would have silently been the same property, so this event's
  // free text lives where every other event's does — and is editable through the
  // ordinary edit sheet for free.
}

/**
 * A doctor, midwife or health-visitor appointment, with the questions to ask.
 *
 * The only event type that is *expected* to be in the future: the whole point of a
 * questions list is that you write it down at 3am and take it with you next week.
 * Everything that aggregates events therefore has to tolerate a future timestamp,
 * which the window functions already do — they filter rather than assume.
 */
export interface DoctorVisitEvent extends EventBase {
  type: 'visit'
  reason: string
  /** The clinic, doctor or health visitor. Free text; often left empty. */
  who: string
  questions: VisitQuestion[]
  // What was said goes in the inherited `note`, for the same reason as above.
}

export interface VisitQuestion {
  text: string
  /** Ticked off in the room, which is the only reason the list is worth keeping. */
  asked: boolean
}

export interface FoodEvent extends EventBase {
  type: 'food'
  name: string
  acceptance: FoodAcceptance
  /**
   * Which of the nine the parent says this food contained.
   *
   * Chosen by them, never inferred from the name. The app has no food-composition
   * database and will not pretend to: guessing that hummus contains sesame is right,
   * guessing that a supermarket biscuit does not contain egg is how an app tells a
   * parent something dangerous and untrue.
   */
  allergens: Allergen[]
  /**
   * Whether the parent noticed a reaction. Deliberately a flag and not a severity
   * scale — grading a reaction is triage, and this app does not triage. What it
   * looked like goes in the inherited `note`.
   */
  reaction: boolean
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
  | SymptomEvent
  | DoctorVisitEvent
  | FoodEvent
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

export function isSymptom(event: BabyEvent): event is SymptomEvent {
  return event.type === 'symptom'
}

export function isDoctorVisit(event: BabyEvent): event is DoctorVisitEvent {
  return event.type === 'visit'
}

export function isFood(event: BabyEvent): event is FoodEvent {
  return event.type === 'food'
}

/** Total output of a pumping session. */
export function pumpedMl(event: PumpingEvent): number {
  return event.leftMl + event.rightMl
}

/** A sleep with no end time is the one currently in progress. */
export function isSleepInProgress(event: BabyEvent): event is SleepEvent {
  return isSleep(event) && event.endedAt === null
}
