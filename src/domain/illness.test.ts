import { describe, expect, it } from 'vitest'
import { at, symptom, visit } from '@/test/factories'
import {
  EPISODE_GAP_MS,
  nextVisit,
  questionProgress,
  splitVisits,
  symptomEpisodes,
  symptomKey,
  symptomNames,
  symptomsForVisit,
} from './illness'
import { DAY_MS, HOUR_MS } from './time'
import type { BabyEvent } from './types'

const NOW = at(2026, 1, 15, 12, 0)

describe('symptomKey', () => {
  it('treats spacing and case as the same symptom', () => {
    expect(symptomKey('Cough')).toBe(symptomKey(' cough '))
  })
})

describe('symptomEpisodes', () => {
  it('groups a run of entries about one thing into a single episode', () => {
    const events: BabyEvent[] = [
      symptom(at(2026, 1, 12, 9, 0), 'Cough', 'mild'),
      symptom(at(2026, 1, 13, 9, 0), 'cough', 'moderate'),
      symptom(at(2026, 1, 14, 9, 0), 'Cough', 'severe'),
    ]
    const episodes = symptomEpisodes(events, NOW)

    expect(episodes).toHaveLength(1)
    expect(episodes[0]).toMatchObject({
      name: 'Cough',
      startedAt: at(2026, 1, 12, 9, 0),
      lastNotedAt: at(2026, 1, 14, 9, 0),
      worst: 'severe',
      ongoing: true,
    })
    expect(episodes[0]?.entries).toHaveLength(3)
  })

  it('splits into two episodes across a long gap', () => {
    // Otherwise "when did this start" answers with the first cough of the child's
    // life, which is the one answer that is never wanted.
    const events: BabyEvent[] = [
      symptom(at(2025, 11, 1, 9, 0), 'Cough'),
      symptom(at(2026, 1, 14, 9, 0), 'Cough'),
    ]
    const episodes = symptomEpisodes(events, NOW)

    expect(episodes).toHaveLength(2)
    expect(episodes[0]?.startedAt).toBe(at(2026, 1, 14, 9, 0))
    expect(episodes[1]?.startedAt).toBe(at(2025, 11, 1, 9, 0))
  })

  it('keeps entries in one episode right up to the gap', () => {
    const first = at(2026, 1, 13, 9, 0)
    const events = [symptom(first, 'Rash'), symptom(first + EPISODE_GAP_MS, 'Rash')]
    expect(symptomEpisodes(events, NOW)).toHaveLength(1)
  })

  it('keeps different symptoms apart', () => {
    const events: BabyEvent[] = [
      symptom(at(2026, 1, 14, 9, 0), 'Cough'),
      symptom(at(2026, 1, 14, 10, 0), 'Rash'),
    ]
    expect(symptomEpisodes(events, NOW).map((episode) => episode.name).sort()).toEqual([
      'Cough',
      'Rash',
    ])
  })

  it('takes the most recent spelling as the name', () => {
    const events: BabyEvent[] = [
      symptom(at(2026, 1, 13, 9, 0), 'runny nose'),
      symptom(at(2026, 1, 14, 9, 0), 'Runny nose'),
    ]
    expect(symptomEpisodes(events, NOW)[0]?.name).toBe('Runny nose')
  })

  it('stops calling an old episode ongoing', () => {
    const events = [symptom(at(2025, 11, 1, 9, 0), 'Cough')]
    expect(symptomEpisodes(events, NOW)[0]?.ongoing).toBe(false)
  })

  it('reports the worst the parent said it was, not the latest', () => {
    const events: BabyEvent[] = [
      symptom(at(2026, 1, 13, 9, 0), 'Cough', 'severe'),
      symptom(at(2026, 1, 14, 9, 0), 'Cough', 'mild'),
    ]
    expect(symptomEpisodes(events, NOW)[0]?.worst).toBe('severe')
  })

  it('ignores an unnamed symptom rather than making an empty episode', () => {
    expect(symptomEpisodes([symptom(NOW, '   ')], NOW)).toEqual([])
  })

  it('has nothing to say about a log with no symptoms in it', () => {
    expect(symptomEpisodes([], NOW)).toEqual([])
  })
})

describe('splitVisits', () => {
  it('puts the next appointment first and the last one first among past', () => {
    const events: BabyEvent[] = [
      visit(at(2026, 1, 20, 10, 0), 'Vaccinations'),
      visit(at(2026, 1, 17, 10, 0), '8-week check'),
      visit(at(2026, 1, 10, 10, 0), 'Rash'),
      visit(at(2025, 12, 20, 10, 0), 'First check'),
    ]
    const { upcoming, past } = splitVisits(events, NOW)

    expect(upcoming.map((v) => v.reason)).toEqual(['8-week check', 'Vaccinations'])
    expect(past.map((v) => v.reason)).toEqual(['Rash', 'First check'])
  })

  it('counts a visit happening right now as past, not pending', () => {
    const { upcoming, past } = splitVisits([visit(NOW, 'Check')], NOW)
    expect(upcoming).toHaveLength(0)
    expect(past).toHaveLength(1)
  })
})

describe('nextVisit', () => {
  it('is the soonest appointment still to come', () => {
    const events: BabyEvent[] = [
      visit(at(2026, 1, 20, 10, 0), 'Vaccinations'),
      visit(at(2026, 1, 17, 10, 0), '8-week check'),
    ]
    expect(nextVisit(events, NOW)?.reason).toBe('8-week check')
  })

  it('is null when everything is behind us', () => {
    expect(nextVisit([visit(at(2026, 1, 10, 10, 0), 'Rash')], NOW)).toBeNull()
  })
})

describe('symptomNames', () => {
  it('lists each name once, most recently noted first', () => {
    const events: BabyEvent[] = [
      symptom(at(2026, 1, 10, 9, 0), 'Rash'),
      symptom(at(2026, 1, 14, 9, 0), 'Cough'),
      symptom(at(2025, 11, 1, 9, 0), 'Cough'),
    ]
    expect(symptomNames(events, NOW)).toEqual(['Cough', 'Rash'])
  })
})

describe('symptomsForVisit', () => {
  it('carries the recent entries, oldest first, so a sheet reads as a story', () => {
    const events: BabyEvent[] = [
      symptom(at(2026, 1, 14, 9, 0), 'Cough'),
      symptom(at(2026, 1, 13, 9, 0), 'Cough'),
    ]
    expect(symptomsForVisit(events, NOW).map((entry) => entry.startedAt)).toEqual([
      at(2026, 1, 13, 9, 0),
      at(2026, 1, 14, 9, 0),
    ])
  })

  it('leaves out anything older than the window', () => {
    const events = [symptom(NOW - 20 * DAY_MS, 'Cough'), symptom(NOW - HOUR_MS, 'Cough')]
    expect(symptomsForVisit(events, NOW)).toHaveLength(1)
  })

  it('leaves out a future-dated entry, which cannot be history', () => {
    expect(symptomsForVisit([symptom(NOW + HOUR_MS, 'Cough')], NOW)).toEqual([])
  })
})

describe('questionProgress', () => {
  it('counts the ticked ones', () => {
    const appointment = visit(NOW, 'Check', [
      { text: 'Is the rash worth worrying about?', asked: true },
      { text: 'Should she be on vitamin D?', asked: false },
    ])
    expect(questionProgress(appointment)).toEqual({ asked: 1, total: 2 })
  })

  it('is zero of zero for a visit with no questions', () => {
    expect(questionProgress(visit(NOW, 'Check'))).toEqual({ asked: 0, total: 0 })
  })
})
