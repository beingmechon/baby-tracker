import { describe, expect, it } from 'vitest'
import { activity, at, potty } from '@/test/factories'
import {
  accidentFreeStreak,
  activityMsForDay,
  activityTotalsForDay,
  pottyTotalsForDay,
  recentActivities,
} from './activity'
import { DAY_MS, MINUTE_MS } from './time'
import type { BabyEvent } from './types'

const DAY = at(2026, 9, 10)
const NOON = at(2026, 9, 10, 12, 0)

describe('activityTotalsForDay', () => {
  it('adds up the time at each activity', () => {
    const events: BabyEvent[] = [
      activity(at(2026, 9, 10, 9, 0), 'tummy', 5 * MINUTE_MS),
      activity(at(2026, 9, 10, 14, 0), 'tummy', 7 * MINUTE_MS),
      activity(at(2026, 9, 10, 18, 0), 'bath', 20 * MINUTE_MS),
    ]
    const totals = activityTotalsForDay(events, DAY)

    expect(totals).toEqual([
      { kind: 'bath', times: 1, totalMs: 20 * MINUTE_MS },
      { kind: 'tummy', times: 2, totalMs: 12 * MINUTE_MS },
    ])
  })

  it('counts an untimed activity without inventing a duration', () => {
    const events = [activity(at(2026, 9, 10, 18, 0), 'bath')]
    expect(activityTotalsForDay(events, DAY)).toEqual([
      { kind: 'bath', times: 1, totalMs: 0 },
    ])
  })

  it('leaves out another day', () => {
    const events = [activity(at(2026, 9, 9, 18, 0), 'bath', MINUTE_MS)]
    expect(activityTotalsForDay(events, DAY)).toEqual([])
  })

  it('has nothing to say about an empty log', () => {
    expect(activityTotalsForDay([], DAY)).toEqual([])
  })
})

describe('activityMsForDay', () => {
  it('is the total for one kind', () => {
    const events: BabyEvent[] = [
      activity(at(2026, 9, 10, 9, 0), 'tummy', 5 * MINUTE_MS),
      activity(at(2026, 9, 10, 10, 0), 'play', 30 * MINUTE_MS),
    ]
    expect(activityMsForDay(events, 'tummy', DAY)).toBe(5 * MINUTE_MS)
  })

  it('is zero rather than null when nothing was done', () => {
    expect(activityMsForDay([], 'tummy', DAY)).toBe(0)
  })
})

describe('pottyTotalsForDay', () => {
  it('separates successes, accidents and sits with nothing', () => {
    const events: BabyEvent[] = [
      potty(at(2026, 9, 10, 8, 0), 'pee'),
      potty(at(2026, 9, 10, 10, 0), 'both'),
      potty(at(2026, 9, 10, 12, 0), 'nothing'),
      potty(at(2026, 9, 10, 15, 0), 'accident'),
    ]
    expect(pottyTotalsForDay(events, DAY)).toEqual({
      hits: 2,
      accidents: 1,
      sits: 1,
    })
  })

  it('is all zeroes for a day with nothing logged', () => {
    expect(pottyTotalsForDay([], DAY)).toEqual({ hits: 0, accidents: 0, sits: 0 })
  })
})

describe('accidentFreeStreak', () => {
  it('is nothing at all before anything is logged', () => {
    expect(accidentFreeStreak([], NOON)).toEqual({ best: 0, current: 0 })
  })

  it('counts consecutive logged days with no accident', () => {
    const events: BabyEvent[] = [
      potty(NOON - 2 * DAY_MS, 'pee'),
      potty(NOON - DAY_MS, 'pee'),
      potty(NOON, 'poo'),
    ]
    expect(accidentFreeStreak(events, NOON)).toEqual({ best: 3, current: 3 })
  })

  it('an accident ends the current run but not the best one', () => {
    const events: BabyEvent[] = [
      potty(NOON - 4 * DAY_MS, 'pee'),
      potty(NOON - 3 * DAY_MS, 'pee'),
      potty(NOON - 2 * DAY_MS, 'pee'),
      potty(NOON - DAY_MS, 'accident'),
      potty(NOON, 'pee'),
    ]
    expect(accidentFreeStreak(events, NOON)).toEqual({ best: 3, current: 1 })
  })

  it('does not count a day nobody logged as a day without accidents', () => {
    // Claiming a fortnight of silence as a clean run would turn the one number a
    // parent might feel proud of into a lie.
    const events: BabyEvent[] = [
      potty(NOON - 10 * DAY_MS, 'pee'),
      potty(NOON, 'pee'),
    ]
    expect(accidentFreeStreak(events, NOON)).toEqual({ best: 2, current: 2 })
  })

  it('is zero when today had an accident', () => {
    const events: BabyEvent[] = [
      potty(NOON - DAY_MS, 'pee'),
      potty(NOON, 'accident'),
    ]
    expect(accidentFreeStreak(events, NOON)).toMatchObject({ current: 0 })
  })

  it('counts a sit with nothing as a logged day without an accident', () => {
    const events: BabyEvent[] = [
      potty(NOON - DAY_MS, 'nothing'),
      potty(NOON, 'pee'),
    ]
    expect(accidentFreeStreak(events, NOON)).toEqual({ best: 2, current: 2 })
  })
})

describe('recentActivities', () => {
  it('is the last week, newest first', () => {
    const events: BabyEvent[] = [
      activity(NOON - 2 * DAY_MS, 'tummy', MINUTE_MS),
      activity(NOON - 20 * DAY_MS, 'bath', MINUTE_MS),
      activity(NOON - DAY_MS, 'walk', MINUTE_MS),
    ]
    expect(recentActivities(events, NOON).map((e) => e.kind)).toEqual([
      'walk',
      'tummy',
    ])
  })
})
