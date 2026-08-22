import { describe, expect, it } from 'vitest'
import { at, bottle, diaper, nursing, sleep } from '@/test/factories'
import type { NightWindow } from './sleep'
import {
  dailyTotals,
  dayWheel,
  detectDeviation,
  detectFeedCluster,
  interquartileRange,
  median,
  napWakeWindows,
  nightSleepTrend,
  predictNextNap,
} from './patterns'
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time'
import type { BabyEvent } from './types'

const NIGHT: NightWindow = { startHour: 19, endHour: 6 }

describe('median', () => {
  it('takes the middle of an odd list and the mean of the middle two', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('is null for nothing', () => {
    expect(median([])).toBeNull()
  })

  it('is unmoved by one wild outlier, which is why it is used', () => {
    // One four-hour car nap must not drag every prediction later.
    expect(median([90, 95, 100, 105, 600])).toBe(100)
  })
})

describe('interquartileRange', () => {
  it('measures the spread of the middle half', () => {
    expect(interquartileRange([1, 2, 3, 4, 5])).toBe(2)
  })

  it('needs four values to mean anything', () => {
    expect(interquartileRange([1, 2, 3])).toBeNull()
  })
})

describe('napWakeWindows', () => {
  it('measures the gap from waking to the next nap', () => {
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 15, 9, 0), at(2026, 1, 15, 10, 0), 'nap'),
      sleep(at(2026, 1, 15, 11, 30), at(2026, 1, 15, 12, 30), 'nap'),
    ]
    expect(napWakeWindows(events, at(2026, 1, 15, 18, 0))).toEqual([90 * MINUTE_MS])
  })

  it('ignores the gap before bedtime, which is always the longest of the day', () => {
    // Mixing it in would push every nap prediction later than the real routine.
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 15, 15, 0), at(2026, 1, 15, 16, 0), 'nap'),
      sleep(at(2026, 1, 15, 19, 30), at(2026, 1, 16, 6, 0), 'night'),
    ]
    expect(napWakeWindows(events, at(2026, 1, 16, 9, 0))).toEqual([])
  })

  it('ignores a gap too short to be a wake window', () => {
    // One sleep logged as two: a resettle, or the stop button pressed twice.
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 15, 9, 0), at(2026, 1, 15, 10, 0), 'nap'),
      sleep(at(2026, 1, 15, 10, 5), at(2026, 1, 15, 11, 0), 'nap'),
    ]
    expect(napWakeWindows(events, at(2026, 1, 15, 18, 0))).toEqual([])
  })

  it('ignores a gap too long to be anything but a missed nap', () => {
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 15, 6, 0), at(2026, 1, 15, 7, 0), 'nap'),
      sleep(at(2026, 1, 15, 17, 0), at(2026, 1, 15, 18, 0), 'nap'),
    ]
    expect(napWakeWindows(events, at(2026, 1, 15, 20, 0))).toEqual([])
  })

  it('skips a sleep still running, which has no end to measure from', () => {
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 15, 9, 0), null, 'nap'),
      sleep(at(2026, 1, 15, 13, 0), at(2026, 1, 15, 14, 0), 'nap'),
    ]
    expect(napWakeWindows(events, at(2026, 1, 15, 18, 0))).toEqual([])
  })

  it('only looks back as far as it is asked to', () => {
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 1, 9, 0), at(2026, 1, 1, 10, 0), 'nap'),
      sleep(at(2026, 1, 1, 11, 30), at(2026, 1, 1, 12, 30), 'nap'),
    ]
    expect(napWakeWindows(events, at(2026, 1, 15, 12, 0), 7)).toEqual([])
  })
})

describe('predictNextNap', () => {
  /** Three days of a 90-minute routine, then awake since 10:00 today. */
  function routine(): BabyEvent[] {
    const events: BabyEvent[] = []
    for (const day of [12, 13, 14]) {
      events.push(
        sleep(at(2026, 1, day, 8, 0), at(2026, 1, day, 9, 0), 'nap'),
        sleep(at(2026, 1, day, 10, 30), at(2026, 1, day, 11, 30), 'nap'),
        sleep(at(2026, 1, day, 13, 0), at(2026, 1, day, 14, 0), 'nap'),
      )
    }
    events.push(sleep(at(2026, 1, 15, 9, 0), at(2026, 1, 15, 10, 0), 'nap'))
    return events
  }

  it('predicts the next nap a typical wake window after waking', () => {
    const prediction = predictNextNap(routine(), at(2026, 1, 15, 10, 30), NIGHT)
    expect(prediction).not.toBeNull()
    expect(prediction!.typicalWakeWindowMs).toBe(90 * MINUTE_MS)
    // Woke at 10:00, so 11:30.
    expect(prediction!.expectedAt).toBe(at(2026, 1, 15, 11, 30))
  })

  it('rates a tight, well-sampled routine as good', () => {
    const prediction = predictNextNap(routine(), at(2026, 1, 15, 10, 30), NIGHT)
    expect(prediction!.samples).toBeGreaterThanOrEqual(5)
    expect(prediction!.confidence).toBe('good')
  })

  it('says nothing while the baby is asleep', () => {
    const events = [...routine(), sleep(at(2026, 1, 15, 11, 30), null, 'nap')]
    expect(predictNextNap(events, at(2026, 1, 15, 12, 0), NIGHT)).toBeNull()
  })

  it('says nothing overnight, when the answer is bedtime', () => {
    expect(predictNextNap(routine(), at(2026, 1, 15, 21, 0), NIGHT)).toBeNull()
  })

  it('refuses to guess from too little history', () => {
    // Two data points and a timestamp is a guess wearing a disguise, and a parent
    // deciding whether to start the car deserves better.
    const thin: BabyEvent[] = [
      sleep(at(2026, 1, 15, 8, 0), at(2026, 1, 15, 9, 0), 'nap'),
      sleep(at(2026, 1, 15, 10, 30), at(2026, 1, 15, 11, 30), 'nap'),
    ]
    expect(predictNextNap(thin, at(2026, 1, 15, 12, 0), NIGHT)).toBeNull()
  })

  it('says nothing at all with no sleep logged', () => {
    expect(predictNextNap([], at(2026, 1, 15, 12, 0), NIGHT)).toBeNull()
  })

  it('reports a wider spread when the routine is irregular', () => {
    const events: BabyEvent[] = []
    // Wake windows of 45m, 2h, 1h, 3h, 90m — a real newborn, not a timetable.
    const gaps = [45, 120, 60, 180, 90]
    let cursor = at(2026, 1, 14, 7, 0)
    for (const gap of gaps) {
      const wokeAt = cursor
      const nextStart = wokeAt + gap * MINUTE_MS
      events.push(sleep(nextStart, nextStart + 40 * MINUTE_MS, 'nap'))
      cursor = nextStart + 40 * MINUTE_MS
    }
    events.unshift(sleep(at(2026, 1, 14, 6, 0), at(2026, 1, 14, 7, 0), 'nap'))

    const prediction = predictNextNap(events, cursor + 10 * MINUTE_MS, NIGHT)
    expect(prediction).not.toBeNull()
    expect(prediction!.confidence).not.toBe('good')
    expect(prediction!.spreadMs).toBeGreaterThan(20 * MINUTE_MS)
  })
})

describe('dayWheel', () => {
  const DAY = at(2026, 1, 15)

  it('places a sleep as an arc and a feed as a mark', () => {
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 15, 6, 0), at(2026, 1, 15, 12, 0), 'nap'),
      nursing(at(2026, 1, 15, 18, 0), 15 * MINUTE_MS),
    ]
    const wheel = dayWheel(events, DAY, at(2026, 1, 15, 20, 0))
    expect(wheel.arcs).toHaveLength(1)
    expect(wheel.arcs[0]).toMatchObject({ startFraction: 0.25, endFraction: 0.5 })
    expect(wheel.marks).toHaveLength(1)
    expect(wheel.marks[0]).toMatchObject({ kind: 'feed', fraction: 0.75 })
  })

  it('clips a night that crosses midnight to each day it spans', () => {
    // Without clipping the arc would wrap past 1 and draw over itself.
    const overnight = sleep(at(2026, 1, 14, 22, 0), at(2026, 1, 15, 6, 0), 'night')
    const first = dayWheel([overnight], at(2026, 1, 14), at(2026, 1, 15, 12, 0))
    const second = dayWheel([overnight], DAY, at(2026, 1, 15, 12, 0))

    expect(first.arcs[0]).toMatchObject({ endFraction: 1 })
    expect(second.arcs[0]).toMatchObject({ startFraction: 0, endFraction: 0.25 })
  })

  it('draws a running sleep up to now and no further', () => {
    const wheel = dayWheel(
      [sleep(at(2026, 1, 15, 9, 0), null, 'nap')],
      DAY,
      at(2026, 1, 15, 12, 0),
    )
    expect(wheel.arcs[0]!.endFraction).toBe(0.5)
  })

  it('marks where now is, but only on today', () => {
    expect(dayWheel([], DAY, at(2026, 1, 15, 6, 0)).nowFraction).toBe(0.25)
    expect(dayWheel([], DAY, at(2026, 1, 16, 6, 0)).nowFraction).toBeNull()
  })

  it('totals the day it draws, attributing a clipped night to the day it fell in', () => {
    // The figure in the middle of the ring has to agree with the week chart, so it
    // is attributed by overlap in exactly the same way.
    const events: BabyEvent[] = [
      sleep(at(2026, 1, 14, 22, 0), at(2026, 1, 15, 6, 0), 'night'),
      sleep(at(2026, 1, 15, 10, 0), at(2026, 1, 15, 11, 30), 'nap'),
      nursing(at(2026, 1, 15, 8, 0), 15 * MINUTE_MS),
      nursing(at(2026, 1, 15, 13, 0), 15 * MINUTE_MS),
      diaper(at(2026, 1, 15, 9, 0), 'wet'),
    ]
    const wheel = dayWheel(events, DAY, at(2026, 1, 15, 20, 0))
    expect(wheel.sleepMs).toBe(6 * HOUR_MS + 90 * MINUTE_MS)
    expect(wheel.feeds).toBe(2)
    expect(wheel.diapers).toBe(1)
  })

  it('reports an empty day as empty rather than as no day', () => {
    const wheel = dayWheel([], DAY, at(2026, 1, 15, 20, 0))
    expect(wheel.sleepMs).toBe(0)
    expect(wheel.feeds).toBe(0)
    expect(wheel.diapers).toBe(0)
  })

  it('counts a running sleep only as far as now', () => {
    const wheel = dayWheel(
      [sleep(at(2026, 1, 15, 9, 0), null, 'nap')],
      DAY,
      at(2026, 1, 15, 12, 0),
    )
    expect(wheel.sleepMs).toBe(3 * HOUR_MS)
  })

  it('leaves out events from other days', () => {
    const wheel = dayWheel(
      [diaper(at(2026, 1, 14, 12, 0), 'wet')],
      DAY,
      at(2026, 1, 15, 20, 0),
    )
    expect(wheel.marks).toEqual([])
  })
})

describe('dailyTotals', () => {
  it('splits a night across the two days it spans', () => {
    // 22:00–06:00 is two hours of one day and six of the next; a day showing
    // fourteen hours next to a day showing none would be nonsense.
    const events = [sleep(at(2026, 1, 14, 22, 0), at(2026, 1, 15, 6, 0), 'night')]
    const totals = dailyTotals(events, at(2026, 1, 15, 12, 0), 2)
    expect(totals[0]!.nightMs).toBe(2 * HOUR_MS)
    expect(totals[1]!.nightMs).toBe(6 * HOUR_MS)
  })

  it('counts feeds and diapers on the day they happened', () => {
    const events: BabyEvent[] = [
      nursing(at(2026, 1, 15, 9, 0), 15 * MINUTE_MS),
      bottle(at(2026, 1, 15, 13, 0), 120),
      diaper(at(2026, 1, 15, 14, 0), 'wet'),
      diaper(at(2026, 1, 14, 14, 0), 'wet'),
    ]
    const totals = dailyTotals(events, at(2026, 1, 15, 20, 0), 2)
    expect(totals[1]).toMatchObject({ feeds: 2, diapers: 1 })
    expect(totals[0]).toMatchObject({ feeds: 0, diapers: 1 })
  })

  it('returns a row per day, oldest first, even with nothing logged', () => {
    const totals = dailyTotals([], at(2026, 1, 15, 12, 0), 7)
    expect(totals).toHaveLength(7)
    expect(totals[6]!.dayStart).toBeGreaterThan(totals[0]!.dayStart)
    expect(totals.every((day) => day.sleepMs === 0)).toBe(true)
  })
})

describe('nightSleepTrend', () => {
  function fortnight(lastWeekHours: number, thisWeekHours: number): BabyEvent[] {
    const events: BabyEvent[] = []
    for (let offset = 13; offset >= 0; offset -= 1) {
      const hours = offset >= 7 ? lastWeekHours : thisWeekHours
      // Sleep inside a single day, so the split-across-midnight logic does not
      // muddy what this test is about.
      const dayStart = at(2026, 1, 15) - offset * DAY_MS
      events.push(sleep(dayStart + 20 * HOUR_MS, dayStart + (20 + hours) * HOUR_MS, 'night'))
    }
    return events
  }

  it('compares this week with last, in medians', () => {
    const trend = nightSleepTrend(fortnight(9, 10), at(2026, 1, 15, 12, 0))
    expect(trend).not.toBeNull()
    expect(trend!.deltaMs).toBeCloseTo(HOUR_MS, -3)
  })

  it('reports a decline as a negative delta rather than hiding it', () => {
    const trend = nightSleepTrend(fortnight(10, 9), at(2026, 1, 15, 12, 0))
    expect(trend!.deltaMs).toBeLessThan(0)
  })

  it('says nothing without two weeks to compare', () => {
    const events = [sleep(at(2026, 1, 15, 20, 0), at(2026, 1, 16, 6, 0), 'night')]
    expect(nightSleepTrend(events, at(2026, 1, 16, 12, 0))).toBeNull()
  })
})

describe('detectFeedCluster', () => {
  it('names a run of feeds close together', () => {
    const now = at(2026, 1, 15, 20, 0)
    const events: BabyEvent[] = [
      nursing(at(2026, 1, 15, 18, 15), 10 * MINUTE_MS),
      nursing(at(2026, 1, 15, 19, 0), 10 * MINUTE_MS),
      nursing(at(2026, 1, 15, 19, 40), 10 * MINUTE_MS),
    ]
    const cluster = detectFeedCluster(events, now)
    expect(cluster).toMatchObject({ count: 3, startedAt: at(2026, 1, 15, 18, 15) })
  })

  it('stays quiet for ordinary spacing', () => {
    const events: BabyEvent[] = [
      nursing(at(2026, 1, 15, 14, 0), 15 * MINUTE_MS),
      nursing(at(2026, 1, 15, 17, 30), 15 * MINUTE_MS),
    ]
    expect(detectFeedCluster(events, at(2026, 1, 15, 18, 0))).toBeNull()
  })

  it('ignores feeds outside the window and in the future', () => {
    const events: BabyEvent[] = [
      nursing(at(2026, 1, 15, 10, 0), 10 * MINUTE_MS),
      nursing(at(2026, 1, 15, 10, 30), 10 * MINUTE_MS),
      nursing(at(2026, 1, 15, 11, 0), 10 * MINUTE_MS),
      nursing(at(2026, 1, 15, 23, 0), 10 * MINUTE_MS),
    ]
    expect(detectFeedCluster(events, at(2026, 1, 15, 20, 0))).toBeNull()
  })
})

describe('detectDeviation', () => {
  function week(hoursPerDay: number, todayHours: number): BabyEvent[] {
    const events: BabyEvent[] = []
    for (let offset = 7; offset >= 1; offset -= 1) {
      const dayStart = at(2026, 1, 15) - offset * DAY_MS
      events.push(sleep(dayStart + 8 * HOUR_MS, dayStart + (8 + hoursPerDay) * HOUR_MS))
    }
    const today = at(2026, 1, 15)
    events.push(sleep(today + 2 * HOUR_MS, today + (2 + todayHours) * HOUR_MS))
    return events
  }

  it('notes a day well below this baby’s own recent days', () => {
    const deviation = detectDeviation(week(14, 8), at(2026, 1, 15, 20, 0))
    expect(deviation).toMatchObject({ kind: 'lessSleep' })
    expect(deviation!.deltaMs).toBeLessThan(0)
  })

  it('stays quiet about ordinary variation', () => {
    // A tracker that remarks on every fluctuation teaches a parent to ignore it.
    expect(detectDeviation(week(14, 13), at(2026, 1, 15, 20, 0))).toBeNull()
  })

  it('says nothing early in the day, when a total means nothing yet', () => {
    expect(detectDeviation(week(14, 2), at(2026, 1, 15, 9, 0))).toBeNull()
  })

  it('says nothing without enough history to compare against', () => {
    const events = [sleep(at(2026, 1, 15, 2, 0), at(2026, 1, 15, 6, 0))]
    expect(detectDeviation(events, at(2026, 1, 15, 20, 0))).toBeNull()
  })
})
