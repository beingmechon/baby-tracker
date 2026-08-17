import { describe, expect, it } from 'vitest'
import { at, bottle, diaper, sleep } from '@/test/factories'
import { isToday, selectEventsForDay } from './select'

const DAY = at(2026, 1, 15)

describe('selectEventsForDay', () => {
  it('keeps only point-in-time events from that day', () => {
    const events = [
      bottle(at(2026, 1, 14, 23, 30), 120),
      bottle(at(2026, 1, 15, 9, 0), 90),
      bottle(at(2026, 1, 16, 0, 30), 60),
    ]
    const selected = selectEventsForDay(events, DAY, at(2026, 1, 16, 12, 0))
    expect(selected).toHaveLength(1)
    expect(selected[0]?.startedAt).toBe(at(2026, 1, 15, 9, 0))
  })

  it('returns events newest first', () => {
    const events = [
      diaper(at(2026, 1, 15, 8, 0), 'wet'),
      diaper(at(2026, 1, 15, 16, 0), 'dirty'),
      diaper(at(2026, 1, 15, 12, 0), 'mixed'),
    ]
    const selected = selectEventsForDay(events, DAY, at(2026, 1, 15, 18, 0))
    expect(selected.map((e) => e.startedAt)).toEqual([
      at(2026, 1, 15, 16, 0),
      at(2026, 1, 15, 12, 0),
      at(2026, 1, 15, 8, 0),
    ])
  })

  it('includes a sleep that started the previous evening', () => {
    const night = sleep(at(2026, 1, 14, 22, 0), at(2026, 1, 15, 6, 0), 'night')
    expect(selectEventsForDay([night], DAY, at(2026, 1, 15, 12, 0))).toHaveLength(1)
  })

  it('includes a sleep that runs past midnight into the next day', () => {
    const night = sleep(at(2026, 1, 15, 22, 0), at(2026, 1, 16, 6, 0), 'night')
    expect(selectEventsForDay([night], DAY, at(2026, 1, 16, 12, 0))).toHaveLength(1)
    expect(selectEventsForDay([night], at(2026, 1, 16), at(2026, 1, 16, 12, 0)))
      .toHaveLength(1)
  })

  it('includes a running sleep on today even though it has no end', () => {
    const running = sleep(at(2026, 1, 15, 13, 0), null, 'nap')
    expect(selectEventsForDay([running], DAY, at(2026, 1, 15, 14, 0))).toHaveLength(1)
  })

  it('excludes a sleep from a day it never touched', () => {
    const nap = sleep(at(2026, 1, 10, 13, 0), at(2026, 1, 10, 14, 0), 'nap')
    expect(selectEventsForDay([nap], DAY, at(2026, 1, 15, 12, 0))).toHaveLength(0)
  })
})

describe('isToday', () => {
  it('compares local calendar days, not elapsed time', () => {
    expect(isToday(at(2026, 1, 15, 1, 0), at(2026, 1, 15, 23, 0))).toBe(true)
    expect(isToday(at(2026, 1, 14, 23, 30), at(2026, 1, 15, 0, 30))).toBe(false)
  })
})
