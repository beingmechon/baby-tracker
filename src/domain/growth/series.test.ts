import { describe, expect, it } from 'vitest'
import { at, growth } from '@/test/factories'
import type { BabyEvent } from '../types'
import {
  birthMeasurement,
  changeSinceBirth,
  growthChange,
  growthSeries,
  latestMeasurement,
} from './series'

describe('growthSeries', () => {
  it('picks one measurement kind and orders it oldest first', () => {
    const events: BabyEvent[] = [
      growth(at(2026, 3, 1), 'weight', 5200),
      growth(at(2026, 1, 1), 'weight', 3400),
      growth(at(2026, 2, 1), 'length', 540),
      growth(at(2026, 2, 1), 'weight', 4500),
    ]
    expect(growthSeries(events, 'weight').map((e) => e.value)).toEqual([
      3400, 4500, 5200,
    ])
    expect(growthSeries(events, 'length').map((e) => e.value)).toEqual([540])
    expect(growthSeries(events, 'head')).toEqual([])
  })

  it('ignores every other kind of event', () => {
    const events: BabyEvent[] = [
      {
        id: 'd1',
        babyId: 'baby-1',
        type: 'diaper',
        kind: 'wet',
        startedAt: at(2026, 1, 1),
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    expect(growthSeries(events, 'weight')).toEqual([])
    expect(latestMeasurement(events, 'weight')).toBeNull()
  })
})

describe('growthChange', () => {
  it('reports the gain between the last two readings as a weekly rate', () => {
    const events = [
      growth(at(2026, 1, 1), 'weight', 3400),
      growth(at(2026, 1, 15), 'weight', 4100),
    ]
    const change = growthChange(events, 'weight')
    expect(change).not.toBeNull()
    expect(change!.delta).toBe(700)
    // 700 g over 14 days is 350 g per week.
    expect(change!.perWeek).toBeCloseTo(350, 6)
    expect(change!.from).toBe(at(2026, 1, 1))
  })

  it('reports a loss as a negative rate rather than hiding it', () => {
    // Newborns commonly lose weight in the first days. Showing that honestly is
    // the whole point; a clamped-to-zero gain would be a lie a parent might act on.
    const events = [
      growth(at(2026, 1, 1), 'weight', 3400),
      growth(at(2026, 1, 8), 'weight', 3250),
    ]
    expect(growthChange(events, 'weight')!.perWeek).toBeCloseTo(-150, 6)
  })

  it('needs two readings', () => {
    expect(growthChange([growth(at(2026, 1, 1), 'weight', 3400)], 'weight')).toBeNull()
    expect(growthChange([], 'weight')).toBeNull()
  })

  it('refuses to divide by a zero-length interval', () => {
    const events = [
      growth(at(2026, 1, 1, 9, 0), 'weight', 3400),
      growth(at(2026, 1, 1, 18, 0), 'weight', 3450),
    ]
    // Two weigh-ins on the same day say nothing about a weekly rate.
    expect(growthChange(events, 'weight')).toBeNull()
  })

  it('compares only like with like', () => {
    const events = [
      growth(at(2026, 1, 1), 'weight', 3400),
      growth(at(2026, 1, 15), 'length', 520),
    ]
    expect(growthChange(events, 'weight')).toBeNull()
  })
})

describe('birthMeasurement', () => {
  const BIRTH = '2026-01-01'

  it('finds the measurement taken on the birth day', () => {
    const events = [
      growth(at(2026, 1, 1, 14, 30), 'weight', 3200),
      growth(at(2026, 1, 8, 9, 0), 'weight', 3400),
    ]
    expect(birthMeasurement(events, 'weight', BIRTH)?.value).toBe(3200)
  })

  it('matches the whole day, not an exact instant', () => {
    // A parent entering it later types a date, and the sheet fills in a time.
    const events = [growth(at(2026, 1, 1, 23, 59), 'weight', 3200)]
    expect(birthMeasurement(events, 'weight', BIRTH)?.value).toBe(3200)
  })

  it('is null when the only measurement is from another day', () => {
    const events = [growth(at(2026, 1, 2, 9, 0), 'weight', 3200)]
    expect(birthMeasurement(events, 'weight', BIRTH)).toBeNull()
  })

  it('is null without a birth date, rather than guessing the earliest entry', () => {
    const events = [growth(at(2026, 1, 1, 9, 0), 'weight', 3200)]
    expect(birthMeasurement(events, 'weight', null)).toBeNull()
  })

  it('keeps the measures apart', () => {
    const events = [growth(at(2026, 1, 1, 9, 0), 'weight', 3200)]
    expect(birthMeasurement(events, 'length', BIRTH)).toBeNull()
  })
})

describe('changeSinceBirth', () => {
  const BIRTH = '2026-01-01'

  it('is the gain from birth to the latest reading', () => {
    const events = [
      growth(at(2026, 1, 1, 9, 0), 'weight', 3200),
      growth(at(2026, 1, 8, 9, 0), 'weight', 3050),
      growth(at(2026, 2, 1, 9, 0), 'weight', 4100),
    ]
    expect(changeSinceBirth(events, 'weight', BIRTH)?.delta).toBe(900)
  })

  it('is negative in the first fortnight, which is normal and must not be hidden', () => {
    const events = [
      growth(at(2026, 1, 1, 9, 0), 'weight', 3200),
      growth(at(2026, 1, 4, 9, 0), 'weight', 3020),
    ]
    expect(changeSinceBirth(events, 'weight', BIRTH)?.delta).toBe(-180)
  })

  it('is null when the birth measurement is the only one', () => {
    const events = [growth(at(2026, 1, 1, 9, 0), 'weight', 3200)]
    expect(changeSinceBirth(events, 'weight', BIRTH)).toBeNull()
  })

  it('is null with no birth measurement to compare against', () => {
    const events = [growth(at(2026, 1, 8, 9, 0), 'weight', 3400)]
    expect(changeSinceBirth(events, 'weight', BIRTH)).toBeNull()
  })
})
