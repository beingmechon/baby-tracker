import { describe, expect, it } from 'vitest'
import { at, food } from '@/test/factories'
import {
  ALLERGENS,
  allergenStatuses,
  allergensOffered,
  foodKey,
  foodNames,
  foodSummaries,
  recentFoods,
} from './food'
import { DAY_MS } from './time'
import type { BabyEvent } from './types'

const NOW = at(2026, 6, 15, 12, 0)

describe('the allergen list', () => {
  it('is the nine named in US federal law, sesame included', () => {
    // Eight from the 2004 labelling act, plus sesame from the FASTER Act (2023).
    expect(ALLERGENS).toHaveLength(9)
    expect(ALLERGENS).toContain('sesame')
  })
})

describe('foodKey', () => {
  it('treats spacing and case as the same food', () => {
    expect(foodKey('Banana')).toBe(foodKey(' banana '))
  })
})

describe('foodSummaries', () => {
  it('groups a food by name and counts the offerings', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Banana'),
      food(at(2026, 6, 12, 12, 0), 'banana'),
      food(at(2026, 6, 14, 12, 0), 'Banana'),
    ]
    const summaries = foodSummaries(events)

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      name: 'Banana',
      times: 3,
      firstOfferedAt: at(2026, 6, 10, 12, 0),
      lastOfferedAt: at(2026, 6, 14, 12, 0),
      reacted: false,
    })
  })

  it('takes the most recent spelling as the name', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'dal'),
      food(at(2026, 6, 14, 12, 0), 'Dal'),
    ]
    expect(foodSummaries(events)[0]?.name).toBe('Dal')
  })

  it('keeps a reaction flagged even after later offerings went fine', () => {
    // Silently clearing this would be the worst kind of helpful.
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Egg', ['egg'], 'tasted', true),
      food(at(2026, 6, 14, 12, 0), 'Egg', ['egg'], 'all', false),
    ]
    expect(foodSummaries(events)[0]?.reacted).toBe(true)
  })

  it('accumulates every allergen ever tagged on a food', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Biscuit', ['wheat']),
      food(at(2026, 6, 14, 12, 0), 'Biscuit', ['egg']),
    ]
    expect(foodSummaries(events)[0]?.allergens.sort()).toEqual(['egg', 'wheat'])
  })

  it('orders by the most recent offering', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Banana'),
      food(at(2026, 6, 14, 12, 0), 'Avocado'),
    ]
    expect(foodSummaries(events).map((s) => s.name)).toEqual(['Avocado', 'Banana'])
  })

  it('ignores an unnamed entry', () => {
    expect(foodSummaries([food(NOW, '  ')])).toEqual([])
  })
})

describe('allergenStatuses', () => {
  it('reports all nine, whatever has been logged', () => {
    expect(allergenStatuses([])).toHaveLength(9)
    expect(allergenStatuses([]).every((s) => s.state === 'notTried')).toBe(true)
  })

  it('counts offerings tagged with an allergen and names the foods', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Scrambled egg', ['egg']),
      food(at(2026, 6, 14, 12, 0), 'Omelette', ['egg']),
    ]
    const egg = allergenStatuses(events).find((s) => s.allergen === 'egg')

    expect(egg).toMatchObject({
      state: 'noReaction',
      times: 2,
      firstOfferedAt: at(2026, 6, 10, 12, 0),
      lastOfferedAt: at(2026, 6, 14, 12, 0),
    })
    expect(egg?.foods).toEqual(['Omelette', 'Scrambled egg'])
  })

  it('never infers an allergen from the food name', () => {
    // "Scrambled egg" untagged stays untried. The app has no food database and
    // must not behave as though it does.
    const events = [food(at(2026, 6, 10, 12, 0), 'Scrambled egg')]
    expect(allergenStatuses(events).find((s) => s.allergen === 'egg')?.state).toBe(
      'notTried',
    )
  })

  it('flags a reaction on the allergen, not just the food', () => {
    const events = [food(at(2026, 6, 10, 12, 0), 'Peanut butter', ['peanut'], 'tasted', true)]
    expect(allergenStatuses(events).find((s) => s.allergen === 'peanut')?.state).toBe(
      'reacted',
    )
  })

  it('keeps the reaction flag when a later offering was fine', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Peanut butter', ['peanut'], 'tasted', true),
      food(at(2026, 6, 14, 12, 0), 'Peanut butter', ['peanut'], 'some', false),
    ]
    expect(allergenStatuses(events).find((s) => s.allergen === 'peanut')?.state).toBe(
      'reacted',
    )
  })

  it('lists a food once even when offered repeatedly', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Egg', ['egg']),
      food(at(2026, 6, 14, 12, 0), 'egg', ['egg']),
    ]
    expect(allergenStatuses(events).find((s) => s.allergen === 'egg')?.foods).toEqual([
      'egg',
    ])
  })
})

describe('allergensOffered', () => {
  it('counts how many of the nine have been offered at all', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Yoghurt', ['milk']),
      food(at(2026, 6, 11, 12, 0), 'Toast', ['wheat']),
      food(at(2026, 6, 12, 12, 0), 'Banana'),
    ]
    expect(allergensOffered(events)).toBe(2)
  })

  it('counts one that produced a reaction as offered', () => {
    const events = [food(at(2026, 6, 10, 12, 0), 'Egg', ['egg'], 'tasted', true)]
    expect(allergensOffered(events)).toBe(1)
  })
})

describe('foodNames', () => {
  it('lists each food once, most recent first', () => {
    const events: BabyEvent[] = [
      food(at(2026, 6, 10, 12, 0), 'Banana'),
      food(at(2026, 6, 14, 12, 0), 'Avocado'),
      food(at(2026, 6, 8, 12, 0), 'Avocado'),
    ]
    expect(foodNames(events)).toEqual(['Avocado', 'Banana'])
  })
})

describe('recentFoods', () => {
  it('is the last week, newest first', () => {
    const events: BabyEvent[] = [
      food(NOW - 2 * DAY_MS, 'Banana'),
      food(NOW - 20 * DAY_MS, 'Rice'),
      food(NOW - DAY_MS, 'Avocado'),
    ]
    expect(recentFoods(events, NOW).map((e) => e.name)).toEqual(['Avocado', 'Banana'])
  })

  it('leaves out a future-dated entry', () => {
    expect(recentFoods([food(NOW + DAY_MS, 'Banana')], NOW)).toEqual([])
  })
})
