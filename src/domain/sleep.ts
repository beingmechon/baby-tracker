import { HOUR_MS, MINUTE_MS } from './time'
import type { BabyEvent, SleepEvent, SleepKind, Timestamp } from './types'
import { isSleep } from './types'

/**
 * Where the user's night sits on the clock. Everything about nap-vs-night
 * classification flows from these two numbers, so they are settings rather
 * than constants — 7pm–6am is a reasonable default, not a universal truth.
 */
export interface NightWindow {
  /** Local hour the night begins, e.g. 19 for 7pm. */
  startHour: number
  /** Local hour the night ends, e.g. 6 for 6am. */
  endHour: number
}

export const DEFAULT_NIGHT_WINDOW: NightWindow = { startHour: 19, endHour: 6 }

/** True when the local wall-clock hour of `ts` falls inside the night window. */
export function isNightHour(ts: Timestamp, window: NightWindow): boolean {
  const hour = new Date(ts).getHours()
  // The window wraps midnight, so it is a union of two ranges rather than one.
  return hour >= window.startHour || hour < window.endHour
}

/**
 * Auto-detects nap vs night from when the sleep *started*. A sleep that begins
 * at 8pm is night sleep even though it ends at 3am; one that begins at 2pm is a
 * nap even if it runs long. The user can always override on the event.
 */
export function classifySleep(
  startedAt: Timestamp,
  window: NightWindow = DEFAULT_NIGHT_WINDOW,
): SleepKind {
  return isNightHour(startedAt, window) ? 'night' : 'nap'
}

/** The elapsed duration of a sleep, measured to `now` while it is running. */
export function sleepDuration(event: SleepEvent, now: Timestamp): number {
  return Math.max(0, (event.endedAt ?? now) - event.startedAt)
}

/** The single running sleep, if any. */
export function findSleepInProgress(events: BabyEvent[]): SleepEvent | null {
  for (const event of events) {
    if (isSleep(event) && event.endedAt === null) return event
  }
  return null
}

/**
 * Time awake since the last completed sleep ended — the "wake window" parents
 * use to time the next nap. Returns null while a sleep is running, or when
 * there is no completed sleep to measure from.
 */
export function wakeWindowMs(events: BabyEvent[], now: Timestamp): number | null {
  if (findSleepInProgress(events)) return null

  let latestEnd: Timestamp | null = null
  for (const event of events) {
    if (!isSleep(event) || event.endedAt === null) continue
    if (latestEnd === null || event.endedAt > latestEnd) latestEnd = event.endedAt
  }
  if (latestEnd === null) return null
  return Math.max(0, now - latestEnd)
}

/**
 * Age-appropriate wake windows, used only to colour the wake-window display —
 * never to tell a parent what to do. Sources vary and babies vary more, so
 * these are wide, forgiving bands.
 */
export function typicalWakeWindowMs(ageDays: number | null): number | null {
  if (ageDays === null) return null
  if (ageDays < 84) return 75 * MINUTE_MS // 0–3 months
  if (ageDays < 182) return 2 * HOUR_MS // 3–6 months
  if (ageDays < 365) return 3 * HOUR_MS // 6–12 months
  return 4 * HOUR_MS
}
