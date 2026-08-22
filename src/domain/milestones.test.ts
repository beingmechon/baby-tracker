import { describe, expect, it } from 'vitest'
import { at, milestone } from '@/test/factories'
import {
  MILESTONE_SUGGESTIONS,
  latestMilestone,
  milestoneEvents,
  photoMilestones,
  referencedPhotoIds,
  remainingSuggestions,
} from './milestones'
import { DAY_MS } from './time'
import type { BabyEvent } from './types'

const NOW = at(2026, 10, 1, 12, 0)

describe('the suggestion list', () => {
  it('never attaches an age to a milestone', () => {
    // The moment an app says "first steps — 12 months" it has started telling a
    // parent whether their child is late.
    for (const suggestion of MILESTONE_SUGGESTIONS) {
      expect(suggestion).not.toMatch(/\d/)
      expect(suggestion).not.toMatch(/month|week|year/i)
    }
  })
})

describe('milestoneEvents', () => {
  it('is newest first', () => {
    const events: BabyEvent[] = [
      milestone(at(2026, 9, 1), 'First smile'),
      milestone(at(2026, 9, 20), 'Rolled over'),
    ]
    expect(milestoneEvents(events).map((e) => e.name)).toEqual([
      'Rolled over',
      'First smile',
    ])
  })
})

describe('photoMilestones', () => {
  it('is only the ones with a photograph', () => {
    const events: BabyEvent[] = [
      milestone(at(2026, 9, 1), 'First smile', 'photo-1'),
      milestone(at(2026, 9, 20), 'Rolled over'),
    ]
    expect(photoMilestones(events).map((e) => e.name)).toEqual(['First smile'])
  })
})

describe('remainingSuggestions', () => {
  it('stops offering what is already recorded', () => {
    const events = [milestone(at(2026, 9, 1), 'First smile')]
    expect(remainingSuggestions(events)).not.toContain('First smile')
    expect(remainingSuggestions(events)).toContain('First tooth')
  })

  it('matches however the parent capitalised it', () => {
    const events = [milestone(at(2026, 9, 1), 'first SMILE  ')]
    expect(remainingSuggestions(events)).not.toContain('First smile')
  })

  it('offers everything when nothing is recorded', () => {
    expect(remainingSuggestions([])).toHaveLength(MILESTONE_SUGGESTIONS.length)
  })
})

describe('referencedPhotoIds', () => {
  it('collects the ids a milestone points at', () => {
    const events: BabyEvent[] = [
      milestone(at(2026, 9, 1), 'First smile', 'photo-1'),
      milestone(at(2026, 9, 2), 'Rolled over', null),
      milestone(at(2026, 9, 3), 'Sat up', 'photo-2'),
    ]
    expect([...referencedPhotoIds(events)].sort()).toEqual(['photo-1', 'photo-2'])
  })
})

describe('latestMilestone', () => {
  it('is the most recent one that has happened', () => {
    const events: BabyEvent[] = [
      milestone(NOW - 10 * DAY_MS, 'First smile'),
      milestone(NOW - DAY_MS, 'Rolled over'),
    ]
    expect(latestMilestone(events, NOW)?.name).toBe('Rolled over')
  })

  it('ignores one dated in the future, which is a mistyped year', () => {
    const events: BabyEvent[] = [
      milestone(NOW - DAY_MS, 'Rolled over'),
      milestone(NOW + 365 * DAY_MS, 'First steps'),
    ]
    expect(latestMilestone(events, NOW)?.name).toBe('Rolled over')
  })

  it('is null with nothing recorded', () => {
    expect(latestMilestone([], NOW)).toBeNull()
  })
})
