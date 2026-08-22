import { DAY_MS, addDays, startOfLocalDay } from './time'
import type {
  ActivityEvent,
  ActivityKind,
  BabyEvent,
  PottyEvent,
  Timestamp,
} from './types'

/**
 * Activities, and potty training.
 *
 * Two features that look unrelated and are the same shape: a small thing that
 * happened, counted over a day or a week. They sit together because they bracket the
 * same span of childhood — tummy time from the first weeks, the potty from about two
 * — and neither deserves a screen of its own.
 *
 * Tummy time is the only one with a target, and the target is the parent's, not the
 * app's. Health services do publish guidance, and the screen repeats what it is
 * while making clear the number in the field was typed by a person.
 *
 * The potty numbers are a record and not a scoreboard. Accidents are part of
 * learning; the file counts them because a parent asked to see a pattern needs the
 * whole pattern, and the screen says plainly that the figures are not a verdict.
 */

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'tummy',
  'bath',
  'walk',
  'play',
  'reading',
  'other',
]

export function activityEvents(events: readonly BabyEvent[]): ActivityEvent[] {
  return events
    .filter((event): event is ActivityEvent => event.type === 'activity')
    .sort((a, b) => b.startedAt - a.startedAt)
}

export function pottyEvents(events: readonly BabyEvent[]): PottyEvent[] {
  return events
    .filter((event): event is PottyEvent => event.type === 'potty')
    .sort((a, b) => b.startedAt - a.startedAt)
}

export interface ActivityDayTotal {
  kind: ActivityKind
  times: number
  totalMs: number
}

/**
 * What was done on a given local day, busiest first.
 *
 * By start time rather than by overlap: a bath does not straddle midnight, and
 * treating a twenty-minute activity like a night's sleep would be machinery for
 * nothing.
 */
export function activityTotalsForDay(
  events: readonly BabyEvent[],
  dayAnchor: Timestamp,
): ActivityDayTotal[] {
  const dayStart = startOfLocalDay(dayAnchor)
  const dayEnd = addDays(dayStart, 1)
  const byKind = new Map<ActivityKind, ActivityDayTotal>()

  for (const event of activityEvents(events)) {
    if (event.startedAt < dayStart || event.startedAt >= dayEnd) continue
    const existing = byKind.get(event.kind)
    if (existing === undefined) {
      byKind.set(event.kind, {
        kind: event.kind,
        times: 1,
        totalMs: event.durationMs,
      })
      continue
    }
    existing.times += 1
    existing.totalMs += event.durationMs
  }

  return [...byKind.values()].sort(
    (a, b) => b.totalMs - a.totalMs || b.times - a.times,
  )
}

/** Total time at one activity on a day. The tummy-time goal is measured against it. */
export function activityMsForDay(
  events: readonly BabyEvent[],
  kind: ActivityKind,
  dayAnchor: Timestamp,
): number {
  return (
    activityTotalsForDay(events, dayAnchor).find((total) => total.kind === kind)
      ?.totalMs ?? 0
  )
}

export interface PottyTotals {
  /** Wee, poo or both, in the right place. */
  hits: number
  accidents: number
  /** Sat down and nothing happened, which is still worth logging. */
  sits: number
}

export function pottyTotalsForDay(
  events: readonly BabyEvent[],
  dayAnchor: Timestamp,
): PottyTotals {
  const dayStart = startOfLocalDay(dayAnchor)
  const dayEnd = addDays(dayStart, 1)
  const totals: PottyTotals = { hits: 0, accidents: 0, sits: 0 }

  for (const event of pottyEvents(events)) {
    if (event.startedAt < dayStart || event.startedAt >= dayEnd) continue
    if (event.result === 'accident') totals.accidents += 1
    else if (event.result === 'nothing') totals.sits += 1
    else totals.hits += 1
  }

  return totals
}

/**
 * The longest run of consecutive accident-free days, and the current one.
 *
 * A day counts towards a run only if something was logged on it: a week nobody
 * touched the app is not a week without accidents, and claiming it would turn the
 * one number a parent might feel proud of into a lie.
 *
 * Measured in whole local days, ending today.
 */
export function accidentFreeStreak(
  events: readonly BabyEvent[],
  now: Timestamp,
  maxDays = 365,
): { best: number; current: number } {
  const potty = pottyEvents(events)
  if (potty.length === 0) return { best: 0, current: 0 }

  const today = startOfLocalDay(now)
  const oldest = startOfLocalDay((potty[potty.length - 1] as PottyEvent).startedAt)
  const days = Math.min(maxDays, Math.round((today - oldest) / DAY_MS) + 1)

  let best = 0
  let running = 0
  let current = 0
  let currentStillOpen = true

  // Oldest day first, so `running` builds forwards and the final value at "today"
  // is the current streak.
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayStart = addDays(today, -offset)
    const totals = pottyTotalsForDay(events, dayStart)
    const logged = totals.hits + totals.accidents + totals.sits > 0

    if (!logged) {
      // A gap neither extends a run nor breaks it: nothing is known about that day.
      continue
    }
    if (totals.accidents > 0) {
      running = 0
      currentStillOpen = false
      current = 0
      continue
    }
    running += 1
    if (running > best) best = running
    if (currentStillOpen || running > 0) current = running
  }

  return { best, current }
}

/** Activity events in the last week, newest first. */
export function recentActivities(
  events: readonly BabyEvent[],
  now: Timestamp,
  days = 7,
): ActivityEvent[] {
  const since = now - days * DAY_MS
  return activityEvents(events).filter(
    (event) => event.startedAt >= since && event.startedAt <= now,
  )
}
