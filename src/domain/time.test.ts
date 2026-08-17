import { describe, expect, it } from 'vitest'
import { at } from '@/test/factories'
import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  addDays,
  ageInDays,
  ageInMonths,
  describeAge,
  formatClock,
  formatClock24,
  formatStopwatch,
  localDateKey,
  overlapMs,
  splitDuration,
  startOfLocalDay,
} from './time'

describe('startOfLocalDay', () => {
  it('snaps any time to local midnight', () => {
    expect(startOfLocalDay(at(2026, 1, 15, 23, 59))).toBe(at(2026, 1, 15))
    expect(startOfLocalDay(at(2026, 1, 15, 0, 0))).toBe(at(2026, 1, 15))
  })
})

describe('addDays', () => {
  it('advances the local calendar day', () => {
    expect(addDays(at(2026, 1, 15), 1)).toBe(at(2026, 1, 16))
  })

  it('crosses month and year boundaries', () => {
    expect(addDays(at(2026, 12, 31), 1)).toBe(at(2027, 1, 1))
    expect(addDays(at(2026, 3, 1), -1)).toBe(at(2026, 2, 28))
  })
})

describe('localDateKey', () => {
  it('zero-pads month and day', () => {
    expect(localDateKey(at(2026, 3, 7, 13, 0))).toBe('2026-03-07')
  })
})

describe('formatClock', () => {
  it('renders a 12-hour clock', () => {
    expect(formatClock(at(2026, 1, 15, 13, 5))).toBe('1:05 pm')
    expect(formatClock(at(2026, 1, 15, 9, 30))).toBe('9:30 am')
  })

  it('renders both midnights as 12', () => {
    expect(formatClock(at(2026, 1, 15, 0, 0))).toBe('12:00 am')
    expect(formatClock(at(2026, 1, 15, 12, 0))).toBe('12:00 pm')
  })
})

describe('formatStopwatch', () => {
  it('pads to mm:ss and grows to h:mm:ss', () => {
    expect(formatStopwatch(42_000)).toBe('00:42')
    expect(formatStopwatch(7 * MINUTE_MS + 3000)).toBe('07:03')
    expect(formatStopwatch(HOUR_MS + 7 * MINUTE_MS + 3000)).toBe('1:07:03')
  })
})

describe('ageInDays', () => {
  const now = at(2026, 1, 15, 9, 0)

  it('counts whole local days since birth', () => {
    expect(ageInDays('2026-01-15', now)).toBe(0)
    expect(ageInDays('2026-01-14', now)).toBe(1)
    expect(ageInDays('2025-12-16', now)).toBe(30)
  })

  it('returns null when the birth date is unknown or unparseable', () => {
    expect(ageInDays(null, now)).toBeNull()
    expect(ageInDays('not-a-date', now)).toBeNull()
  })

  it('rejects a date that does not exist rather than rolling it over', () => {
    expect(ageInDays('2026-02-31', now)).toBeNull()
  })

  it('returns null for a future birth date rather than a negative age', () => {
    expect(ageInDays('2026-02-01', now)).toBeNull()
  })

  it('is unaffected by a daylight-saving shift in the interval', () => {
    // Most northern-hemisphere DST transitions fall inside this range; the
    // count must stay a whole number of calendar days either way.
    expect(ageInDays('2026-03-01', at(2026, 4, 1, 9, 0))).toBe(31)
  })
})

describe('ageInMonths', () => {
  it('counts completed calendar months', () => {
    expect(ageInMonths('2026-01-15', at(2026, 6, 15))).toBe(5)
    // One day short of the fifth month is still four months.
    expect(ageInMonths('2026-01-15', at(2026, 6, 14))).toBe(4)
  })

  it('calls a first birthday twelve months, not eleven', () => {
    expect(ageInMonths('2025-06-15', at(2026, 6, 15))).toBe(12)
  })
})

describe('overlapMs', () => {
  const dayStart = at(2026, 1, 15)
  const dayEnd = at(2026, 1, 16)

  it('counts a fully contained interval in full', () => {
    const start = at(2026, 1, 15, 13, 0)
    expect(overlapMs(start, start + HOUR_MS, dayStart, dayEnd)).toBe(HOUR_MS)
  })

  it('clips an interval that runs past midnight', () => {
    // 11pm to 2am: 1 hour belongs to the 15th.
    const start = at(2026, 1, 15, 23, 0)
    const end = at(2026, 1, 16, 2, 0)
    expect(overlapMs(start, end, dayStart, dayEnd)).toBe(HOUR_MS)
    expect(overlapMs(start, end, dayEnd, addDays(dayEnd, 1))).toBe(2 * HOUR_MS)
  })

  it('is zero for a disjoint interval', () => {
    const start = at(2026, 1, 20, 1, 0)
    expect(overlapMs(start, start + HOUR_MS, dayStart, dayEnd)).toBe(0)
  })

  it('can never exceed the window itself', () => {
    expect(overlapMs(dayStart - DAY_MS, dayEnd + DAY_MS, dayStart, dayEnd)).toBe(
      dayEnd - dayStart,
    )
  })
})

describe('splitDuration', () => {
  it('keeps seconds under a minute so a fresh timer visibly moves', () => {
    expect(splitDuration(48_000)).toMatchObject({ subMinute: true, seconds: 48 })
    expect(splitDuration(0)).toMatchObject({ subMinute: true, seconds: 0 })
  })

  it('splits into hours and minutes', () => {
    expect(splitDuration(HOUR_MS + 24 * MINUTE_MS)).toMatchObject({
      hours: 1,
      minutes: 24,
      subMinute: false,
    })
    expect(splitDuration(24 * MINUTE_MS)).toMatchObject({ hours: 0, minutes: 24 })
    expect(splitDuration(2 * HOUR_MS)).toMatchObject({ hours: 2, minutes: 0 })
  })

  it('never reports negative time from a clock skew', () => {
    expect(splitDuration(-5000)).toMatchObject({ hours: 0, minutes: 0, seconds: 0 })
  })
})

describe('formatClock24', () => {
  it('is zero-padded and unambiguous, for exports', () => {
    expect(formatClock24(at(2026, 1, 15, 9, 5))).toBe('09:05')
    expect(formatClock24(at(2026, 1, 15, 21, 5))).toBe('21:05')
    expect(formatClock24(at(2026, 1, 15, 0, 0))).toBe('00:00')
  })
})

describe('describeAge', () => {
  const now = at(2026, 6, 15, 9, 0)

  it('picks the granularity a parent would use', () => {
    expect(describeAge('2026-06-15', now)).toEqual({ unit: 'bornToday' })
    expect(describeAge('2026-06-14', now)).toEqual({ unit: 'days', count: 1 })
    expect(describeAge('2026-06-10', now)).toEqual({ unit: 'days', count: 5 })
    expect(describeAge('2026-05-15', now)).toEqual({ unit: 'weeks', count: 4 })
    expect(describeAge('2025-06-15', now)).toEqual({ unit: 'months', count: 12 })
  })

  it('switches to years once months stop being useful', () => {
    expect(describeAge('2024-06-15', now)).toEqual({ unit: 'years', count: 2 })
    expect(describeAge('2024-03-15', now)).toEqual({
      unit: 'yearsMonths',
      years: 2,
      months: 3,
    })
  })

  it('is null without a birth date', () => {
    expect(describeAge(null, now)).toBeNull()
  })
})
