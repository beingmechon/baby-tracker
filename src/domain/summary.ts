import { addDays, overlapMs, startOfLocalDay } from './time'
import type { BabyEvent, DiaperKind, Timestamp } from './types'

export interface FeedSummary {
  /** Nursing sessions plus bottles. */
  count: number
  nursingCount: number
  bottleCount: number
  nursingMs: number
  /** Total bottle volume in canonical millilitres. */
  bottleMl: number
}

export interface SleepSummary {
  /** Total sleep clipped to the window, so nap + night always equals total. */
  totalMs: number
  napMs: number
  nightMs: number
  /** Longest single stretch, clipped to the window. */
  longestMs: number
  sessions: number
}

export type DiaperSummary = Record<DiaperKind, number> & { total: number }

export interface PumpingSummary {
  sessions: number
  /** Total expressed volume in canonical millilitres. */
  ml: number
}

/**
 * Medication and temperature are listed rather than counted.
 *
 * "2 doses" is the wrong thing to hand over at the door: the next caregiver needs
 * to know *what* was given and *when*, so they do not give it again.
 */
export interface Summary {
  windowStart: Timestamp
  windowEnd: Timestamp
  feeds: FeedSummary
  sleep: SleepSummary
  diapers: DiaperSummary
  pumping: PumpingSummary
  medications: { name: string; dose: string; at: Timestamp }[]
  temperatures: { celsiusHundredths: number; at: Timestamp }[]
}

/**
 * Aggregates every event touching `[windowStart, windowEnd)`.
 *
 * `now` matters because a running sleep has no end yet: it counts up to the
 * present moment and no further, which keeps "total sleep today" honest while
 * the baby is still asleep.
 *
 * Sleep is attributed by *overlap* with the window rather than by start time,
 * so a 7pm–6am night splits across the two days it actually spans and a daily
 * total can never exceed 24 hours. Point-in-time events (feeds, diapers) belong
 * to the window containing the moment they were logged.
 */
export function summarizeWindow(
  events: BabyEvent[],
  windowStart: Timestamp,
  windowEnd: Timestamp,
  now: Timestamp,
): Summary {
  const feeds: FeedSummary = {
    count: 0,
    nursingCount: 0,
    bottleCount: 0,
    nursingMs: 0,
    bottleMl: 0,
  }
  const sleep: SleepSummary = {
    totalMs: 0,
    napMs: 0,
    nightMs: 0,
    longestMs: 0,
    sessions: 0,
  }
  const diapers: DiaperSummary = { wet: 0, dirty: 0, mixed: 0, dry: 0, total: 0 }
  const pumping: PumpingSummary = { sessions: 0, ml: 0 }
  const medications: Summary['medications'] = []
  const temperatures: Summary['temperatures'] = []

  for (const event of events) {
    if (event.type === 'sleep') {
      const end = event.endedAt ?? now
      const inWindow = overlapMs(event.startedAt, end, windowStart, windowEnd)
      if (inWindow <= 0) continue
      sleep.totalMs += inWindow
      sleep.sessions += 1
      if (event.kind === 'night') sleep.nightMs += inWindow
      else sleep.napMs += inWindow
      if (inWindow > sleep.longestMs) sleep.longestMs = inWindow
      continue
    }

    if (event.startedAt < windowStart || event.startedAt >= windowEnd) continue

    switch (event.type) {
      case 'nursing':
        feeds.count += 1
        feeds.nursingCount += 1
        feeds.nursingMs += event.durationMs
        break
      case 'bottle':
        feeds.count += 1
        feeds.bottleCount += 1
        feeds.bottleMl += event.amountMl
        break
      case 'diaper':
        diapers[event.kind] += 1
        diapers.total += 1
        break
      case 'pumping':
        pumping.sessions += 1
        pumping.ml += event.leftMl + event.rightMl
        break
      case 'medication':
        medications.push({
          name: event.name,
          dose: event.dose,
          at: event.startedAt,
        })
        break
      case 'temperature':
        temperatures.push({
          celsiusHundredths: event.celsiusHundredths,
          at: event.startedAt,
        })
        break
    }
  }

  medications.sort((a, b) => a.at - b.at)
  temperatures.sort((a, b) => a.at - b.at)

  return {
    windowStart,
    windowEnd,
    feeds,
    sleep,
    diapers,
    pumping,
    medications,
    temperatures,
  }
}

/** Aggregates the local calendar day containing `dayAnchor`. */
export function summarizeDay(
  events: BabyEvent[],
  dayAnchor: Timestamp,
  now: Timestamp,
): Summary {
  const dayStart = startOfLocalDay(dayAnchor)
  return summarizeWindow(events, dayStart, addDays(dayStart, 1), now)
}

/**
 * A caregiver handover line: "since 6:00 pm — 2 feeds, 1 nap, 3 diapers".
 * Full multi-caregiver sync is v0.3, but the summary itself is useful the
 * moment you hand the baby over at the door.
 */
export function summarizeSince(
  events: BabyEvent[],
  since: Timestamp,
  now: Timestamp,
): Summary {
  // `now + 1` keeps the window end-exclusive while still including an event
  // logged this very millisecond.
  return summarizeWindow(events, since, now + 1, now)
}
