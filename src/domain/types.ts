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
export type EventType = 'nursing' | 'bottle' | 'sleep' | 'diaper'

export interface Baby {
  id: Id
  name: string
  /** ISO `YYYY-MM-DD` in the baby's local calendar, or null if not given. */
  birthDate: string | null
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

export type BabyEvent = NursingEvent | BottleEvent | SleepEvent | DiaperEvent
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

/** A sleep with no end time is the one currently in progress. */
export function isSleepInProgress(event: BabyEvent): event is SleepEvent {
  return isSleep(event) && event.endedAt === null
}
