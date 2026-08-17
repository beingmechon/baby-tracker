import { describe, expect, it } from 'vitest'
import { at, bottle, diaper, nursing, sleep } from '@/test/factories'
import { HOUR_MS, MINUTE_MS } from './time'
import {
  findLastFeed,
  findLastNursingSide,
  sinceLastFeedMs,
  suggestNextSide,
} from './feeds'

describe('findLastFeed', () => {
  it('picks the most recent feed regardless of kind or list order', () => {
    const latest = bottle(at(2026, 1, 15, 11, 0), 120)
    const events = [
      nursing(at(2026, 1, 15, 8, 0), 15 * MINUTE_MS),
      latest,
      nursing(at(2026, 1, 15, 9, 30), 12 * MINUTE_MS),
    ]
    expect(findLastFeed(events)?.id).toBe(latest.id)
  })

  it('ignores sleeps and diapers', () => {
    const events = [
      sleep(at(2026, 1, 15, 13, 0), at(2026, 1, 15, 14, 0)),
      diaper(at(2026, 1, 15, 15, 0), 'wet'),
    ]
    expect(findLastFeed(events)).toBeNull()
  })
})

describe('findLastNursingSide', () => {
  it('remembers the side used most recently', () => {
    const events = [
      nursing(at(2026, 1, 15, 8, 0), 15 * MINUTE_MS, 'left'),
      nursing(at(2026, 1, 15, 11, 0), 14 * MINUTE_MS, 'right'),
    ]
    expect(findLastNursingSide(events)).toBe('right')
  })

  it('is not confused by a later bottle feed', () => {
    const events = [
      nursing(at(2026, 1, 15, 8, 0), 15 * MINUTE_MS, 'right'),
      bottle(at(2026, 1, 15, 12, 0), 120),
    ]
    expect(findLastNursingSide(events)).toBe('right')
  })

  it('is null with no nursing history', () => {
    expect(findLastNursingSide([bottle(at(2026, 1, 15, 12, 0), 120)])).toBeNull()
  })
})

describe('suggestNextSide', () => {
  it('alternates from the last side used', () => {
    expect(suggestNextSide('left')).toBe('right')
    expect(suggestNextSide('right')).toBe('left')
  })

  it('falls back to a side when there is no history', () => {
    expect(suggestNextSide(null)).toBe('left')
  })
})

describe('sinceLastFeedMs', () => {
  const now = at(2026, 1, 15, 12, 0)

  it('measures from the start of the feed, as feeding intervals are counted', () => {
    const events = [nursing(at(2026, 1, 15, 10, 0), 30 * MINUTE_MS)]
    expect(sinceLastFeedMs(events, now)).toBe(2 * HOUR_MS)
  })

  it('is null with no feeds yet', () => {
    expect(sinceLastFeedMs([], now)).toBeNull()
  })
})
