import { findLastFeed } from './feeds'
import { medicationKey, medicationSummaries } from './health'
import { findSleepInProgress } from './sleep'
import { summarizeSince, type Summary } from './summary'
import { HOUR_MS, startOfLocalDay } from './time'
import type { BabyEvent, DiaperEvent, SleepEvent, Timestamp } from './types'

/**
 * The handover: what the next person needs to know, and nothing else.
 *
 * This is the thing a parent does at the door, on a stair, with a bag over one
 * shoulder — hand the baby to a partner, a grandparent or a nursery worker and say
 * the four facts that matter. It is not a report of the day; it is the shortest
 * true answer to "when did she last eat and when did she last sleep".
 *
 * Deliberately separate from the daily summary. A summary counts a window; a
 * handover also has to say *when* things last happened, because "3 feeds" without
 * "last one at 14:20" tells the next caregiver nothing about what to do next.
 */

/** The offered windows. A shift is four, eight or twelve hours, or the day so far. */
export type HandoverWindow = '4h' | '8h' | '12h' | 'today'

export const HANDOVER_WINDOWS: readonly HandoverWindow[] = ['4h', '8h', '12h', 'today']

/**
 * When the chosen window starts.
 *
 * "Today" means the local calendar day, not the last 24 hours: someone handing over
 * at 9am means "since we got up", and a rolling day would drag in yesterday
 * evening's feeds and make the count wrong.
 */
export function handoverWindowStart(window: HandoverWindow, now: Timestamp): Timestamp {
  switch (window) {
    case '4h':
      return now - 4 * HOUR_MS
    case '8h':
      return now - 8 * HOUR_MS
    case '12h':
      return now - 12 * HOUR_MS
    case 'today':
      return startOfLocalDay(now)
  }
}

export interface Handover {
  since: Timestamp
  now: Timestamp
  summary: Summary
  /** The last feed at all — not the last one inside the window. */
  lastFeed: BabyEvent | null
  lastDiaper: DiaperEvent | null
  /** The most recent completed sleep, for "woke at 13:40". */
  lastSleep: SleepEvent | null
  /** Set when the baby is asleep right now, which changes what to say entirely. */
  asleepSince: Timestamp | null
}

/**
 * Everything the handover screen shows, for a window ending now.
 *
 * The "last" fields deliberately look outside the window. If nothing was logged in
 * the last four hours, the useful thing to say is not "no feeds" — it is "last fed
 * at 09:15", which is the same fact stated so the next person can act on it.
 */
export function handover(
  events: readonly BabyEvent[],
  since: Timestamp,
  now: Timestamp,
): Handover {
  const list = [...events]
  const running = findSleepInProgress(list)

  const lastDiaper = list
    .filter((event): event is DiaperEvent => event.type === 'diaper')
    .reduce<DiaperEvent | null>(
      (latest, event) =>
        latest === null || event.startedAt > latest.startedAt ? event : latest,
      null,
    )

  const lastSleep = list
    .filter((event): event is SleepEvent => event.type === 'sleep' && event.endedAt !== null)
    .reduce<SleepEvent | null>(
      (latest, event) =>
        latest === null || (event.endedAt as number) > (latest.endedAt as number)
          ? event
          : latest,
      null,
    )

  // One bottle, one name. The dose list stays per-administration — the next
  // caregiver needs each time — but "Paracetamol" and "paracetamol" listed as two
  // medicines reads as two different things having been given.
  const summary = summarizeSince(list, since, now)
  const canonical = new Map(
    medicationSummaries(list).map((entry) => [medicationKey(entry.name), entry.name]),
  )
  summary.medications = summary.medications.map((dose) => ({
    ...dose,
    name: canonical.get(medicationKey(dose.name)) ?? dose.name,
  }))

  return {
    since,
    now,
    summary,
    lastFeed: findLastFeed(list),
    lastDiaper,
    lastSleep,
    asleepSince: running === null ? null : running.startedAt,
  }
}

/**
 * True when there is genuinely nothing to hand over.
 *
 * Checked explicitly so the screen can say "nothing logged in this window" rather
 * than print a column of zeroes, which reads as a broken screen.
 */
export function isEmptyHandover(handoverData: Handover): boolean {
  const { summary } = handoverData
  return (
    summary.feeds.count === 0 &&
    summary.sleep.sessions === 0 &&
    summary.diapers.total === 0 &&
    summary.pumping.sessions === 0 &&
    summary.medications.length === 0 &&
    summary.temperatures.length === 0
  )
}
