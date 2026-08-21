import { describe, expect, it } from 'vitest'
import {
  at,
  bottle,
  diaper,
  medication,
  nursing,
  pumping,
  sleep,
  temperature,
} from '@/test/factories'
import {
  HANDOVER_WINDOWS,
  handover,
  handoverWindowStart,
  isEmptyHandover,
} from './handover'
import { HOUR_MS, MINUTE_MS, startOfLocalDay } from './time'
import type { BabyEvent } from './types'

const NOW = at(2026, 1, 15, 18, 0)

describe('handoverWindowStart', () => {
  it('counts back from now for the hour windows', () => {
    expect(handoverWindowStart('4h', NOW)).toBe(NOW - 4 * HOUR_MS)
    expect(handoverWindowStart('8h', NOW)).toBe(NOW - 8 * HOUR_MS)
    expect(handoverWindowStart('12h', NOW)).toBe(NOW - 12 * HOUR_MS)
  })

  it('uses the local calendar day for today, not a rolling 24 hours', () => {
    // Handing over at 9am, "today" means since we got up. A rolling day would
    // drag in yesterday evening and make every count wrong.
    const morning = at(2026, 1, 15, 9, 0)
    expect(handoverWindowStart('today', morning)).toBe(startOfLocalDay(morning))
  })

  it('offers every window it knows how to start', () => {
    for (const window of HANDOVER_WINDOWS) {
      expect(handoverWindowStart(window, NOW)).toBeLessThanOrEqual(NOW)
    }
  })
})

describe('handover', () => {
  it('counts the window and dates the last of each thing', () => {
    const events: BabyEvent[] = [
      nursing(at(2026, 1, 15, 15, 0), 20 * MINUTE_MS),
      bottle(at(2026, 1, 15, 17, 0), 90, 'formula'),
      diaper(at(2026, 1, 15, 16, 30), 'wet'),
      sleep(at(2026, 1, 15, 15, 30), at(2026, 1, 15, 16, 15), 'nap'),
    ]
    const result = handover(events, NOW - 4 * HOUR_MS, NOW)

    expect(result.summary.feeds.count).toBe(2)
    expect(result.summary.feeds.bottleMl).toBe(90)
    expect(result.summary.diapers.wet).toBe(1)
    expect(result.summary.sleep.totalMs).toBe(45 * MINUTE_MS)
    expect(result.lastFeed?.startedAt).toBe(at(2026, 1, 15, 17, 0))
    expect(result.lastDiaper?.startedAt).toBe(at(2026, 1, 15, 16, 30))
    expect(result.lastSleep?.endedAt).toBe(at(2026, 1, 15, 16, 15))
    expect(result.asleepSince).toBeNull()
  })

  it('reports the last feed even when it falls outside the window', () => {
    // "No feeds in the last four hours" is useless at the door. "Last fed at
    // 09:15" is the same fact, stated so the next person can act on it.
    const events = [nursing(at(2026, 1, 15, 9, 15), 20 * MINUTE_MS)]
    const result = handover(events, NOW - 4 * HOUR_MS, NOW)

    expect(result.summary.feeds.count).toBe(0)
    expect(result.lastFeed?.startedAt).toBe(at(2026, 1, 15, 9, 15))
  })

  it('says the baby is asleep right now, because that changes what to say', () => {
    const result = handover(
      [sleep(at(2026, 1, 15, 17, 30), null, 'nap')],
      NOW - 4 * HOUR_MS,
      NOW,
    )
    expect(result.asleepSince).toBe(at(2026, 1, 15, 17, 30))
    // A running sleep is not the "last sleep" — it has not finished.
    expect(result.lastSleep).toBeNull()
  })

  it('lists medications with what and when, not just how many', () => {
    const events: BabyEvent[] = [
      medication(at(2026, 1, 15, 16, 0), 'Calpol', '2.5 ml'),
      medication(at(2026, 1, 15, 14, 0), 'Vitamin D', '1 drop'),
    ]
    const result = handover(events, NOW - 4 * HOUR_MS, NOW)

    expect(result.summary.medications).toEqual([
      { name: 'Vitamin D', dose: '1 drop', at: at(2026, 1, 15, 14, 0) },
      { name: 'Calpol', dose: '2.5 ml', at: at(2026, 1, 15, 16, 0) },
    ])
  })

  it('spells one medicine one way, however it was typed', () => {
    // Two spellings listed separately reads as two different things having been
    // given, which is the one mistake a handover must not make.
    const events: BabyEvent[] = [
      medication(at(2026, 1, 15, 14, 0), 'paracetamol', '2.5 ml'),
      medication(at(2026, 1, 15, 16, 0), 'Paracetamol', '5 ml'),
    ]
    const result = handover(events, NOW - 4 * HOUR_MS, NOW)

    expect(result.summary.medications.map((dose) => dose.name)).toEqual([
      'Paracetamol',
      'Paracetamol',
    ])
    // Each administration is still its own line: the times are the point.
    expect(result.summary.medications.map((dose) => dose.dose)).toEqual([
      '2.5 ml',
      '5 ml',
    ])
  })

  it('carries temperature readings and pumping totals', () => {
    const events: BabyEvent[] = [
      temperature(at(2026, 1, 15, 17, 0), 3760),
      pumping(at(2026, 1, 15, 16, 0), 60, 45),
    ]
    const result = handover(events, NOW - 4 * HOUR_MS, NOW)

    expect(result.summary.temperatures).toEqual([
      { celsiusHundredths: 3760, at: at(2026, 1, 15, 17, 0) },
    ])
    expect(result.summary.pumping).toEqual({ sessions: 1, ml: 105 })
  })

  it('clips a sleep that started before the window to the window', () => {
    const events = [sleep(at(2026, 1, 15, 13, 0), at(2026, 1, 15, 15, 0), 'nap')]
    const result = handover(events, at(2026, 1, 15, 14, 0), NOW)
    expect(result.summary.sleep.totalMs).toBe(HOUR_MS)
  })
})

describe('isEmptyHandover', () => {
  it('is true when nothing at all falls in the window', () => {
    expect(isEmptyHandover(handover([], NOW - 4 * HOUR_MS, NOW))).toBe(true)
  })

  it('is true when the only entry is older than the window', () => {
    const events = [nursing(at(2026, 1, 15, 9, 0), 20 * MINUTE_MS)]
    expect(isEmptyHandover(handover(events, NOW - 4 * HOUR_MS, NOW))).toBe(true)
  })

  it('is false for a single diaper', () => {
    const events = [diaper(at(2026, 1, 15, 17, 0), 'wet')]
    expect(isEmptyHandover(handover(events, NOW - 4 * HOUR_MS, NOW))).toBe(false)
  })

  it('is false when the only entry is a dose', () => {
    const events = [medication(at(2026, 1, 15, 17, 0), 'Calpol', '2.5 ml')]
    expect(isEmptyHandover(handover(events, NOW - 4 * HOUR_MS, NOW))).toBe(false)
  })
})
