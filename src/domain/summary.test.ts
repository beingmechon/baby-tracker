import { describe, expect, it } from 'vitest'
import { at, bottle, diaper, nursing, sleep } from '@/test/factories'
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time'
import { summarizeDay, summarizeSince } from './summary'

const DAY = at(2026, 1, 15)
const NOON = at(2026, 1, 15, 12, 0)

describe('summarizeDay — feeds', () => {
  it('counts nursing and bottles separately and together', () => {
    const events = [
      nursing(at(2026, 1, 15, 7, 0), 15 * MINUTE_MS),
      nursing(at(2026, 1, 15, 10, 0), 20 * MINUTE_MS),
      bottle(at(2026, 1, 15, 13, 0), 120),
      bottle(at(2026, 1, 15, 16, 0), 90),
    ]
    const { feeds } = summarizeDay(events, DAY, at(2026, 1, 15, 18, 0))
    expect(feeds.count).toBe(4)
    expect(feeds.nursingCount).toBe(2)
    expect(feeds.bottleCount).toBe(2)
    expect(feeds.nursingMs).toBe(35 * MINUTE_MS)
    expect(feeds.bottleMl).toBe(210)
  })

  it('excludes feeds from neighbouring days', () => {
    const events = [
      bottle(at(2026, 1, 14, 23, 30), 120),
      bottle(at(2026, 1, 15, 9, 0), 90),
      bottle(at(2026, 1, 16, 0, 30), 60),
    ]
    const { feeds } = summarizeDay(events, DAY, NOON)
    expect(feeds.count).toBe(1)
    expect(feeds.bottleMl).toBe(90)
  })
})

describe('summarizeDay — diapers', () => {
  it('counts each kind and a total', () => {
    const events = [
      diaper(at(2026, 1, 15, 7, 0), 'wet'),
      diaper(at(2026, 1, 15, 9, 0), 'wet'),
      diaper(at(2026, 1, 15, 11, 0), 'dirty'),
      diaper(at(2026, 1, 15, 14, 0), 'mixed'),
      diaper(at(2026, 1, 15, 17, 0), 'dry'),
    ]
    const { diapers } = summarizeDay(events, DAY, at(2026, 1, 15, 18, 0))
    expect(diapers).toEqual({ wet: 2, dirty: 1, mixed: 1, dry: 1, total: 5 })
  })
})

describe('summarizeDay — sleep', () => {
  it('splits nap and night so the two always sum to the total', () => {
    const events = [
      sleep(at(2026, 1, 15, 10, 0), at(2026, 1, 15, 11, 30), 'nap'),
      sleep(at(2026, 1, 15, 14, 0), at(2026, 1, 15, 15, 0), 'nap'),
      sleep(at(2026, 1, 15, 20, 0), at(2026, 1, 15, 23, 0), 'night'),
    ]
    const { sleep: s } = summarizeDay(events, DAY, at(2026, 1, 15, 23, 30))
    expect(s.napMs).toBe(2.5 * HOUR_MS)
    expect(s.nightMs).toBe(3 * HOUR_MS)
    expect(s.napMs + s.nightMs).toBe(s.totalMs)
    expect(s.sessions).toBe(3)
  })

  it('reports the longest single stretch', () => {
    const events = [
      sleep(at(2026, 1, 15, 10, 0), at(2026, 1, 15, 10, 40), 'nap'),
      sleep(at(2026, 1, 15, 13, 0), at(2026, 1, 15, 15, 0), 'nap'),
    ]
    const { sleep: s } = summarizeDay(events, DAY, at(2026, 1, 15, 16, 0))
    expect(s.longestMs).toBe(2 * HOUR_MS)
  })

  it('splits a sleep across midnight between the two days it spans', () => {
    // 10pm on the 15th to 5am on the 16th.
    const night = sleep(at(2026, 1, 15, 22, 0), at(2026, 1, 16, 5, 0), 'night')
    const now = at(2026, 1, 16, 8, 0)

    expect(summarizeDay([night], DAY, now).sleep.totalMs).toBe(2 * HOUR_MS)
    expect(summarizeDay([night], at(2026, 1, 16), now).sleep.totalMs).toBe(5 * HOUR_MS)
  })

  it('counts a running sleep only up to now', () => {
    const running = sleep(at(2026, 1, 15, 11, 0), null, 'nap')
    const { sleep: s } = summarizeDay([running], DAY, NOON)
    expect(s.totalMs).toBe(HOUR_MS)
  })

  it('never reports more than 24 hours of sleep in a day', () => {
    // A pathological entry — a sleep spanning three days — must still clip.
    const absurd = sleep(at(2026, 1, 14), at(2026, 1, 17), 'night')
    const { sleep: s } = summarizeDay([absurd], DAY, at(2026, 1, 17))
    expect(s.totalMs).toBe(DAY_MS)
  })

  it('is all zeroes for a day with nothing logged', () => {
    const { sleep: s, feeds, diapers } = summarizeDay([], DAY, NOON)
    expect(s.totalMs).toBe(0)
    expect(s.longestMs).toBe(0)
    expect(feeds.count).toBe(0)
    expect(diapers.total).toBe(0)
  })
})

describe('summarizeSince — caregiver handover', () => {
  it('summarizes only the window since the handover', () => {
    const events = [
      bottle(at(2026, 1, 15, 8, 0), 120),
      bottle(at(2026, 1, 15, 14, 0), 150),
      diaper(at(2026, 1, 15, 15, 0), 'dirty'),
      sleep(at(2026, 1, 15, 15, 30), at(2026, 1, 15, 16, 30), 'nap'),
    ]
    const since = at(2026, 1, 15, 13, 0)
    const summary = summarizeSince(events, since, at(2026, 1, 15, 17, 0))

    expect(summary.feeds.count).toBe(1)
    expect(summary.feeds.bottleMl).toBe(150)
    expect(summary.diapers.total).toBe(1)
    expect(summary.sleep.totalMs).toBe(HOUR_MS)
  })

  it('includes an event logged at this very moment', () => {
    const now = at(2026, 1, 15, 17, 0)
    const summary = summarizeSince([bottle(now, 60)], at(2026, 1, 15, 13, 0), now)
    expect(summary.feeds.count).toBe(1)
  })

  it('counts only the part of an earlier sleep that falls in the window', () => {
    // Nap ran 12:30–13:30; the shift started at 13:00.
    const nap = sleep(at(2026, 1, 15, 12, 30), at(2026, 1, 15, 13, 30), 'nap')
    const summary = summarizeSince([nap], at(2026, 1, 15, 13, 0), at(2026, 1, 15, 17, 0))
    expect(summary.sleep.totalMs).toBe(30 * MINUTE_MS)
  })
})
