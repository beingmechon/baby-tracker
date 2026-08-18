import { describe, expect, it } from 'vitest'
import { at, growth } from '@/test/factories'
import type { BabyEvent } from '../types'
import { growthChange, growthSeries, latestMeasurement } from './series'

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
