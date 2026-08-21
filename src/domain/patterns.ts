import { addDays, DAY_MS, HOUR_MS, MINUTE_MS, overlapMs, startOfLocalDay } from './time'
import type { NightWindow } from './sleep'
import { isNightHour } from './sleep'
import type { BabyEvent, SleepEvent, Timestamp } from './types'

/**
 * Patterns in a baby's own data: when the next nap is likely, what a day looks
 * like at a glance, and how this week compares with last.
 *
 * This is the feature other trackers charge for, so two rules govern all of it.
 *
 * First, everything is computed from *this baby's* logs. There is no model, no
 * population average and no server — a prediction here is a median of what this
 * baby actually did, which is both the honest thing to offer and the only thing an
 * offline app can offer.
 *
 * Second, it describes and never prescribes. "Slept 40m less than last week" is a
 * fact about a log. "Your baby is not sleeping enough" would be a judgement about a
 * child, and this project does not make those.
 */

/** How far back to look for a pattern. A week covers a routine without stale data. */
export const LOOKBACK_DAYS = 7

/**
 * The shortest and longest gaps counted as a real wake window.
 *
 * Below ten minutes it is one sleep logged as two — a baby resettled, or a stop
 * button pressed twice. Above eight hours a nap was missed rather than skipped, and
 * including it would drag the median hours out.
 */
const MIN_WAKE_WINDOW = 10 * MINUTE_MS
const MAX_WAKE_WINDOW = 8 * HOUR_MS

/** The median. Used throughout rather than the mean: one four-hour car nap should
 *  not move a prediction, and with a week of data outliers are common. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] as number
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

/** The interquartile range, as the spread a prediction is honest about. */
export function interquartileRange(values: readonly number[]): number | null {
  if (values.length < 4) return null
  const sorted = [...values].sort((a, b) => a - b)
  const quartile = (fraction: number): number => {
    const position = (sorted.length - 1) * fraction
    const lower = Math.floor(position)
    const upper = Math.ceil(position)
    const weight = position - lower
    return (sorted[lower] as number) * (1 - weight) + (sorted[upper] as number) * weight
  }
  return quartile(0.75) - quartile(0.25)
}

function sleepsAscending(events: readonly BabyEvent[]): SleepEvent[] {
  return events
    .filter((event): event is SleepEvent => event.type === 'sleep')
    .sort((a, b) => a.startedAt - b.startedAt)
}

/**
 * The gaps between waking and the next nap, over the lookback window.
 *
 * Only gaps that ended in a nap count. The wake window before bedtime is
 * reliably the longest of the day, so mixing it in would push every nap
 * prediction later than the baby's own routine.
 */
export function napWakeWindows(
  events: readonly BabyEvent[],
  now: Timestamp,
  lookbackDays = LOOKBACK_DAYS,
): number[] {
  const since = now - lookbackDays * DAY_MS
  const sleeps = sleepsAscending(events)
  const windows: number[] = []

  for (let i = 0; i < sleeps.length - 1; i += 1) {
    const previous = sleeps[i] as SleepEvent
    const next = sleeps[i + 1] as SleepEvent
    if (previous.endedAt === null) continue
    if (next.kind !== 'nap') continue
    if (next.startedAt < since) continue

    const gap = next.startedAt - previous.endedAt
    if (gap >= MIN_WAKE_WINDOW && gap <= MAX_WAKE_WINDOW) windows.push(gap)
  }

  return windows
}

export type PredictionConfidence = 'low' | 'fair' | 'good'

export interface NapPrediction {
  /** When the next nap is likely to start, on this baby's own pattern. */
  expectedAt: Timestamp
  /** Half-width of the likely window, from the spread of past wake windows. */
  spreadMs: number
  /** Completed wake windows the estimate rests on. */
  samples: number
  confidence: PredictionConfidence
  /** The median wake window itself, which the screen shows as the reasoning. */
  typicalWakeWindowMs: number
}

/**
 * When the next nap is likely, or null when there is no honest answer.
 *
 * Returns null while the baby is asleep, during the night window, and whenever
 * there are fewer than three completed wake windows to reason from. A prediction
 * from two data points would be a guess wearing a timestamp, and a parent deciding
 * whether to start the car deserves better than that.
 */
export function predictNextNap(
  events: readonly BabyEvent[],
  now: Timestamp,
  nightWindow: NightWindow,
  lookbackDays = LOOKBACK_DAYS,
): NapPrediction | null {
  const sleeps = sleepsAscending(events)
  const running = sleeps.find((sleep) => sleep.endedAt === null)
  if (running !== undefined) return null

  // Overnight, the next sleep is bedtime, and a parent does not need an app to
  // tell them that.
  if (isNightHour(now, nightWindow)) return null

  const lastEnded = sleeps.reduce<SleepEvent | null>((latest, sleep) => {
    if (sleep.endedAt === null) return latest
    if (latest === null || (sleep.endedAt as number) > (latest.endedAt as number)) {
      return sleep
    }
    return latest
  }, null)
  if (lastEnded === null || lastEnded.endedAt === null) return null

  const windows = napWakeWindows(events, now, lookbackDays)
  if (windows.length < 3) return null

  const typical = median(windows)
  if (typical === null) return null

  const spread = interquartileRange(windows) ?? 30 * MINUTE_MS
  const confidence: PredictionConfidence =
    windows.length < 5 ? 'low' : spread > 45 * MINUTE_MS ? 'fair' : 'good'

  return {
    expectedAt: lastEnded.endedAt + typical,
    // Half the interquartile range either side: the middle half of this baby's own
    // wake windows, not a confidence interval dressed up from a normal curve.
    spreadMs: Math.max(10 * MINUTE_MS, spread / 2),
    samples: windows.length,
    confidence,
    typicalWakeWindowMs: typical,
  }
}

/* ── The day wheel ─────────────────────────────────────────────────────────── */

export type WheelKind = 'sleep' | 'feed' | 'diaper'

export interface WheelArc {
  kind: 'sleep'
  /** 0 at local midnight, 1 at the next. */
  startFraction: number
  endFraction: number
  night: boolean
}

export interface WheelMark {
  kind: 'feed' | 'diaper'
  fraction: number
  id: string
}

export interface DayWheel {
  dayStart: Timestamp
  arcs: WheelArc[]
  marks: WheelMark[]
  /** Where "now" sits, or null when the day being shown is not today. */
  nowFraction: number | null
  /**
   * The day's totals, attributed the same way `dailyTotals` attributes them, so
   * the figure in the middle of the ring and the figure in the week chart can
   * never disagree. A ring has a hole in it; this is what belongs there.
   */
  sleepMs: number
  feeds: number
  diapers: number
}

/**
 * A day as fractions of a circle.
 *
 * Sleep becomes arcs clipped to the day, so a night that crosses midnight draws
 * correctly on both days rather than wrapping around and overwriting itself. Feeds
 * and diapers become marks, because a feed is an instant and drawing it as a wedge
 * would imply a duration nobody recorded.
 */
export function dayWheel(
  events: readonly BabyEvent[],
  dayAnchor: Timestamp,
  now: Timestamp,
): DayWheel {
  const dayStart = startOfLocalDay(dayAnchor)
  const dayEnd = addDays(dayStart, 1)
  const span = dayEnd - dayStart
  const fraction = (at: Timestamp): number =>
    Math.min(1, Math.max(0, (at - dayStart) / span))

  const arcs: WheelArc[] = []
  const marks: WheelMark[] = []
  let sleepMs = 0
  let feeds = 0
  let diapers = 0

  for (const event of events) {
    if (event.type === 'sleep') {
      const end = event.endedAt ?? now
      const inDay = overlapMs(event.startedAt, end, dayStart, dayEnd)
      if (inDay <= 0) continue
      sleepMs += inDay
      arcs.push({
        kind: 'sleep',
        startFraction: fraction(event.startedAt),
        endFraction: fraction(end),
        night: event.kind === 'night',
      })
      continue
    }

    if (event.startedAt < dayStart || event.startedAt >= dayEnd) continue

    if (event.type === 'nursing' || event.type === 'bottle') {
      marks.push({ kind: 'feed', fraction: fraction(event.startedAt), id: event.id })
      feeds += 1
    } else if (event.type === 'diaper') {
      marks.push({ kind: 'diaper', fraction: fraction(event.startedAt), id: event.id })
      diapers += 1
    }
  }

  const isToday = startOfLocalDay(now) === dayStart
  return {
    dayStart,
    arcs: arcs.sort((a, b) => a.startFraction - b.startFraction),
    marks: marks.sort((a, b) => a.fraction - b.fraction),
    nowFraction: isToday ? fraction(now) : null,
    sleepMs,
    feeds,
    diapers,
  }
}

/* ── Weekly pattern and trends ─────────────────────────────────────────────── */

export interface DayTotals {
  dayStart: Timestamp
  sleepMs: number
  napMs: number
  nightMs: number
  feeds: number
  diapers: number
}

/**
 * Per-day totals, oldest first, with sleep attributed by overlap so a night that
 * crosses midnight is split between the two days it actually spans. Without that,
 * one day shows fourteen hours and the next shows none.
 */
export function dailyTotals(
  events: readonly BabyEvent[],
  now: Timestamp,
  days = LOOKBACK_DAYS,
): DayTotals[] {
  const today = startOfLocalDay(now)
  const totals: DayTotals[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayStart = addDays(today, -offset)
    const dayEnd = addDays(dayStart, 1)
    const day: DayTotals = {
      dayStart,
      sleepMs: 0,
      napMs: 0,
      nightMs: 0,
      feeds: 0,
      diapers: 0,
    }

    for (const event of events) {
      if (event.type === 'sleep') {
        const end = event.endedAt ?? now
        const inDay = overlapMs(event.startedAt, end, dayStart, dayEnd)
        if (inDay <= 0) continue
        day.sleepMs += inDay
        if (event.kind === 'night') day.nightMs += inDay
        else day.napMs += inDay
        continue
      }
      if (event.startedAt < dayStart || event.startedAt >= dayEnd) continue
      if (event.type === 'nursing' || event.type === 'bottle') day.feeds += 1
      else if (event.type === 'diaper') day.diapers += 1
    }

    totals.push(day)
  }

  return totals
}

export interface SleepTrend {
  /** Median night sleep across the most recent seven days. */
  thisWeekMs: number
  /** The seven days before that. */
  lastWeekMs: number
  deltaMs: number
}

/**
 * How this week's night sleep compares with last week's.
 *
 * Medians, not totals: a single missed log would otherwise read as a week of lost
 * sleep. Returns null until there are two weeks with something logged in each,
 * because a comparison against a week of silence is not a comparison.
 */
export function nightSleepTrend(
  events: readonly BabyEvent[],
  now: Timestamp,
): SleepTrend | null {
  const fortnight = dailyTotals(events, now, 14)
  const lastWeek = fortnight.slice(0, 7).filter((day) => day.sleepMs > 0)
  const thisWeek = fortnight.slice(7).filter((day) => day.sleepMs > 0)
  if (lastWeek.length < 2 || thisWeek.length < 2) return null

  const before = median(lastWeek.map((day) => day.nightMs))
  const after = median(thisWeek.map((day) => day.nightMs))
  if (before === null || after === null) return null

  return { thisWeekMs: after, lastWeekMs: before, deltaMs: after - before }
}

/**
 * A run of feeds close together — what parents call cluster feeding.
 *
 * Worth naming on screen because it is alarming the first time and completely
 * normal, and because a parent counting six feeds in an evening wants to know that
 * the app sees a pattern rather than a problem.
 */
export interface FeedCluster {
  count: number
  startedAt: Timestamp
  /** How long the run has been going. */
  spanMs: number
}

export function detectFeedCluster(
  events: readonly BabyEvent[],
  now: Timestamp,
  windowMs = 3 * HOUR_MS,
  minimumFeeds = 3,
): FeedCluster | null {
  const recent = events
    .filter(
      (event) =>
        (event.type === 'nursing' || event.type === 'bottle') &&
        event.startedAt > now - windowMs &&
        event.startedAt <= now,
    )
    .sort((a, b) => a.startedAt - b.startedAt)

  if (recent.length < minimumFeeds) return null
  const first = recent[0] as BabyEvent
  return {
    count: recent.length,
    startedAt: first.startedAt,
    spanMs: now - first.startedAt,
  }
}

export type DeviationKind = 'lessSleep' | 'moreSleep' | 'fewerFeeds'

export interface Deviation {
  kind: DeviationKind
  /** Signed difference from the trailing median, in ms for sleep. */
  deltaMs: number
}

/**
 * A gentle note when today looks unlike this baby's recent days.
 *
 * Informational only, and deliberately hard to trigger: a quarter of a day's sleep
 * either way, with at least four days of history behind it. A tracker that
 * remarks on every ordinary fluctuation teaches a parent to ignore it, which is
 * worse than saying nothing. Never a diagnosis, and never advice — see the house
 * rules in CONTRIBUTING.md.
 */
export function detectDeviation(
  events: readonly BabyEvent[],
  now: Timestamp,
): Deviation | null {
  const week = dailyTotals(events, now, 8)
  const today = week[week.length - 1]
  const before = week.slice(0, -1).filter((day) => day.sleepMs > 0)
  if (today === undefined || before.length < 4) return null

  // Only once the day is far enough along for a total to mean anything.
  const elapsedToday = now - today.dayStart
  if (elapsedToday < 12 * HOUR_MS) return null

  const typicalSleep = median(before.map((day) => day.sleepMs))
  if (typicalSleep === null || typicalSleep === 0) return null

  const delta = today.sleepMs - typicalSleep
  if (Math.abs(delta) < typicalSleep * 0.25) return null

  return { kind: delta < 0 ? 'lessSleep' : 'moreSleep', deltaMs: delta }
}
