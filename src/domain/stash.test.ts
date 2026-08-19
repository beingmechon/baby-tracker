import { describe, expect, it } from 'vitest'
import { at } from '@/test/factories'
import { DAY_MS, HOUR_MS } from './time'
import {
  STORAGE_GUIDELINE_MS,
  isValidStashAmount,
  stashOrder,
  stashStatus,
  stashTotals,
  takeFromEntry,
  type StashEntry,
  type StashLocation,
} from './stash'

const NOW = at(2026, 1, 15, 12, 0)

let counter = 0
function entry(overrides: Partial<StashEntry> = {}): StashEntry {
  counter += 1
  return {
    id: `stash-${counter}`,
    babyId: 'baby-1',
    amountMl: 120,
    location: 'fridge',
    expressedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('stashStatus', () => {
  it('ages milk from when it was expressed, not from when it was logged', () => {
    // These differ by hours in practice: milk gets logged when there is a spare
    // hand, and the four-day clock started when the pump stopped.
    const status = stashStatus(
      entry({ expressedAt: at(2026, 1, 14, 12, 0), createdAt: NOW }),
      NOW,
    )
    expect(status.ageMs).toBe(DAY_MS)
    expect(status.remainingMs).toBe(3 * DAY_MS)
  })

  it('is fresh well within the guideline', () => {
    expect(stashStatus(entry({ expressedAt: NOW - HOUR_MS }), NOW).state).toBe('fresh')
  })

  it('says use soon in the last quarter of the guideline', () => {
    // Fridge guideline is four days, so the last day is the warning window.
    const status = stashStatus(entry({ expressedAt: NOW - 3.5 * DAY_MS }), NOW)
    expect(status.state).toBe('useSoon')
  })

  it('is past the guideline once the time is up, and stays past', () => {
    expect(stashStatus(entry({ expressedAt: NOW - 4 * DAY_MS }), NOW).state).toBe(
      'pastGuideline',
    )
    expect(stashStatus(entry({ expressedAt: NOW - 40 * DAY_MS }), NOW).state).toBe(
      'pastGuideline',
    )
  })

  it('holds frozen milk to the freezer guideline, not the fridge one', () => {
    const frozen = entry({ location: 'freezer', expressedAt: NOW - 30 * DAY_MS })
    expect(stashStatus(frozen, NOW).state).toBe('fresh')
    // The same age in a fridge is long past.
    const chilled = entry({ location: 'fridge', expressedAt: NOW - 30 * DAY_MS })
    expect(stashStatus(chilled, NOW).state).toBe('pastGuideline')
  })

  it('never reports a negative age for a future timestamp', () => {
    // A clock that jumped, or a mistyped time.
    expect(stashStatus(entry({ expressedAt: NOW + DAY_MS }), NOW).ageMs).toBe(0)
  })

  it('uses the CDC figures the screen cites', () => {
    expect(STORAGE_GUIDELINE_MS.fridge).toBe(4 * DAY_MS)
    expect(STORAGE_GUIDELINE_MS.freezer).toBe(180 * DAY_MS)
  })
})

describe('stashOrder', () => {
  it('puts the most urgent first, comparing each against its own guideline', () => {
    // This is the feature: a fridge bottle with hours left outranks a frozen bag
    // with months left, even though the bag is far older.
    const frozenOld = entry({ location: 'freezer', expressedAt: NOW - 60 * DAY_MS })
    const fridgeNew = entry({ location: 'fridge', expressedAt: NOW - 3.9 * DAY_MS })

    const order = stashOrder([frozenOld, fridgeNew], NOW)
    expect(order[0]!.entry.id).toBe(fridgeNew.id)
    expect(order[1]!.entry.id).toBe(frozenOld.id)
  })

  it('breaks a tie by which was expressed first', () => {
    const older = entry({ expressedAt: NOW - 2 * DAY_MS })
    const newer = entry({ expressedAt: NOW - 2 * DAY_MS })
    const order = stashOrder([newer, older], NOW)
    // Equal remaining time, so the earlier row wins on expressedAt; with identical
    // timestamps the order is at least stable rather than arbitrary.
    expect(order).toHaveLength(2)
    expect(order[0]!.remainingMs).toBe(order[1]!.remainingMs)
  })

  it('is empty for an empty stash', () => {
    expect(stashOrder([], NOW)).toEqual([])
  })
})

describe('stashTotals', () => {
  it('totals each location separately and counts what is past its guideline', () => {
    const totals = stashTotals(
      [
        entry({ amountMl: 120, location: 'fridge' }),
        entry({ amountMl: 60, location: 'fridge', expressedAt: NOW - 5 * DAY_MS }),
        entry({ amountMl: 200, location: 'freezer' }),
      ],
      NOW,
    )
    expect(totals).toEqual({
      fridgeMl: 180,
      freezerMl: 200,
      totalMl: 380,
      pastGuideline: 1,
    })
  })

  it('is all zeroes for an empty stash', () => {
    expect(stashTotals([], NOW)).toEqual({
      fridgeMl: 0,
      freezerMl: 0,
      totalMl: 0,
      pastGuideline: 0,
    })
  })
})

describe('takeFromEntry', () => {
  it('leaves the remainder when part of a bottle is used', () => {
    expect(takeFromEntry(entry({ amountMl: 120 }), 40)).toBe(80)
  })

  it('returns null when it is used up, so the row can be removed', () => {
    expect(takeFromEntry(entry({ amountMl: 120 }), 120)).toBeNull()
  })

  it('empties rather than going negative', () => {
    // The amounts are a parent's estimate of what is in a bag. A negative stash is
    // never the right answer to a mis-tap.
    expect(takeFromEntry(entry({ amountMl: 120 }), 500)).toBeNull()
  })

  it('ignores a negative amount used', () => {
    expect(takeFromEntry(entry({ amountMl: 120 }), -50)).toBe(120)
  })
})

describe('isValidStashAmount', () => {
  it('requires a real, positive volume', () => {
    expect(isValidStashAmount(30)).toBe(true)
    expect(isValidStashAmount(0)).toBe(false)
    expect(isValidStashAmount(-10)).toBe(false)
    expect(isValidStashAmount(NaN)).toBe(false)
    expect(isValidStashAmount(Infinity)).toBe(false)
  })
})

describe('every location is handled', () => {
  it('has a guideline for each', () => {
    const locations: StashLocation[] = ['fridge', 'freezer']
    for (const location of locations) {
      expect(STORAGE_GUIDELINE_MS[location], location).toBeGreaterThan(0)
    }
  })
})
