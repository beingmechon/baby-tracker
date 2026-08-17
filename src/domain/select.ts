import { addDays, startOfLocalDay } from './time'
import type { BabyEvent, Timestamp } from './types'

/**
 * The events a given day's timeline should show, newest first.
 *
 * Point-in-time events belong to the day they happened. Sleeps are included if
 * they *overlap* the day at all, so a night that began at 10pm yesterday still
 * appears on this morning's timeline — which is where you look for it when you
 * want to know what time she finally went down.
 */
export function selectEventsForDay(
  events: BabyEvent[],
  dayAnchor: Timestamp,
  now: Timestamp,
): BabyEvent[] {
  const dayStart = startOfLocalDay(dayAnchor)
  const dayEnd = addDays(dayStart, 1)

  return events
    .filter((event) => {
      if (event.type === 'sleep') {
        const end = event.endedAt ?? now
        return event.startedAt < dayEnd && end >= dayStart
      }
      return event.startedAt >= dayStart && event.startedAt < dayEnd
    })
    .sort((a, b) => b.startedAt - a.startedAt)
}

/** True when the anchor falls on the same local day as `now`. */
export function isToday(dayAnchor: Timestamp, now: Timestamp): boolean {
  return startOfLocalDay(dayAnchor) === startOfLocalDay(now)
}
