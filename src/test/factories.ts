import type {
  BottleEvent,
  PumpingEvent,
  DiaperEvent,
  DiaperKind,
  GrowthEvent,
  MeasureKind,
  MedicationEvent,
  NursingEvent,
  ActivityEvent,
  ActivityKind,
  Allergen,
  DoctorVisitEvent,
  FoodAcceptance,
  FoodEvent,
  MilestoneEvent,
  PottyEvent,
  PottyPlace,
  PottyResult,
  SymptomEvent,
  SymptomImpression,
  VisitQuestion,
  SleepEvent,
  SleepKind,
  TemperatureEvent,
  TemperatureSite,
  Timestamp,
} from '@/domain/types'

/**
 * Builders for test events. Timestamps are built from *local* calendar parts so
 * every assertion about wall-clock behaviour (nap vs night, day boundaries)
 * holds in whatever timezone CI happens to run in.
 */

export const BABY_ID = 'baby-1'

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

/** A local wall-clock time, e.g. `at(2026, 1, 15, 20, 30)` is 8:30pm local. */
export function at(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Timestamp {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

export function nursing(
  startedAt: Timestamp,
  durationMs: number,
  side: NursingEvent['side'] = 'left',
): NursingEvent {
  return {
    id: nextId('nursing'),
    babyId: BABY_ID,
    type: 'nursing',
    startedAt,
    durationMs,
    side,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function bottle(
  startedAt: Timestamp,
  amountMl: number,
  contents: BottleEvent['contents'] = 'formula',
): BottleEvent {
  return {
    id: nextId('bottle'),
    babyId: BABY_ID,
    type: 'bottle',
    startedAt,
    amountMl,
    contents,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function sleep(
  startedAt: Timestamp,
  endedAt: Timestamp | null,
  kind: SleepKind = 'nap',
): SleepEvent {
  return {
    id: nextId('sleep'),
    babyId: BABY_ID,
    type: 'sleep',
    startedAt,
    endedAt,
    kind,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function diaper(startedAt: Timestamp, kind: DiaperKind): DiaperEvent {
  return {
    id: nextId('diaper'),
    babyId: BABY_ID,
    type: 'diaper',
    startedAt,
    kind,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function growth(
  startedAt: Timestamp,
  measure: MeasureKind,
  /** Canonical: grams for weight, millimetres for length and head. */
  value: number,
): GrowthEvent {
  return {
    id: nextId('growth'),
    babyId: BABY_ID,
    type: 'growth',
    startedAt,
    measure,
    value,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function pumping(
  startedAt: Timestamp,
  leftMl: number,
  rightMl: number,
  durationMs = 15 * 60_000,
): PumpingEvent {
  return {
    id: nextId('pumping'),
    babyId: BABY_ID,
    type: 'pumping',
    startedAt,
    leftMl,
    rightMl,
    durationMs,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function temperature(
  startedAt: Timestamp,
  celsiusHundredths: number,
  site: TemperatureSite = 'armpit',
): TemperatureEvent {
  return {
    id: nextId('temperature'),
    babyId: BABY_ID,
    type: 'temperature',
    startedAt,
    celsiusHundredths,
    site,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function medication(
  startedAt: Timestamp,
  name: string,
  dose = '',
): MedicationEvent {
  return {
    id: nextId('medication'),
    babyId: BABY_ID,
    type: 'medication',
    startedAt,
    name,
    dose,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function symptom(
  startedAt: Timestamp,
  name: string,
  impression: SymptomImpression = 'mild',
  note = '',
): SymptomEvent {
  return {
    id: nextId('symptom'),
    babyId: BABY_ID,
    type: 'symptom',
    startedAt,
    name,
    impression,
    note,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function visit(
  startedAt: Timestamp,
  reason: string,
  questions: VisitQuestion[] = [],
  who = '',
  note = '',
): DoctorVisitEvent {
  return {
    id: nextId('visit'),
    babyId: BABY_ID,
    type: 'visit',
    startedAt,
    reason,
    who,
    note,
    questions,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function food(
  startedAt: Timestamp,
  name: string,
  allergens: Allergen[] = [],
  acceptance: FoodAcceptance = 'some',
  reaction = false,
): FoodEvent {
  return {
    id: nextId('food'),
    babyId: BABY_ID,
    type: 'food',
    startedAt,
    name,
    acceptance,
    allergens,
    reaction,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function activity(
  startedAt: Timestamp,
  kind: ActivityKind,
  durationMs = 0,
): ActivityEvent {
  return {
    id: nextId('activity'),
    babyId: BABY_ID,
    type: 'activity',
    startedAt,
    kind,
    durationMs,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function potty(
  startedAt: Timestamp,
  result: PottyResult,
  place: PottyPlace = 'potty',
): PottyEvent {
  return {
    id: nextId('potty'),
    babyId: BABY_ID,
    type: 'potty',
    startedAt,
    result,
    place,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

export function milestone(
  startedAt: Timestamp,
  name: string,
  photoId: string | null = null,
): MilestoneEvent {
  return {
    id: nextId('milestone'),
    babyId: BABY_ID,
    type: 'milestone',
    startedAt,
    name,
    photoId,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}
