import { describe, expect, it } from 'vitest'
import type { Reminder, ReminderStatus } from './reminders'
import {
  SCHEDULE_HORIZON_MS,
  nativeIdFor,
  plannedAlerts,
  samePlan,
  type PlannedAlert,
} from './scheduling'
import { HOUR_MS, MINUTE_MS } from './time'
import type { Timestamp } from './types'

const NOW: Timestamp = 1_700_000_000_000

function status(
  id: string,
  dueAt: Timestamp | null,
  enabled = true,
): ReminderStatus {
  const reminder: Reminder = {
    id,
    babyId: 'baby-1',
    kind: 'feed',
    label: '',
    intervalMs: 3 * HOUR_MS,
    enabled,
    lastDoneAt: null,
    lastAlertedAt: null,
    snoozedUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
  }
  return {
    reminder,
    dueAt,
    state: dueAt === null ? 'off' : 'upcoming',
    remainingMs: dueAt === null ? 0 : dueAt - NOW,
  }
}

describe('nativeIdFor', () => {
  it('is stable for the same id', () => {
    expect(nativeIdFor('abc-123')).toBe(nativeIdFor('abc-123'))
  })

  it('differs for different ids', () => {
    expect(nativeIdFor('abc-123')).not.toBe(nativeIdFor('abc-124'))
  })

  it('is always a non-negative 31-bit integer, which is all Android accepts', () => {
    const ids = [
      '',
      'a',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      '00000000-0000-0000-0000-000000000000',
      'reminder-with-a-very-long-identifier-indeed-'.repeat(4),
      '💤-emoji-id',
    ]
    for (const id of ids) {
      const native = nativeIdFor(id)
      expect(Number.isInteger(native)).toBe(true)
      expect(native).toBeGreaterThanOrEqual(0)
      expect(native).toBeLessThanOrEqual(0x7fffffff)
    }
  })
})

describe('plannedAlerts', () => {
  it('hands over a reminder due within the horizon', () => {
    const planned = plannedAlerts([status('a', NOW + HOUR_MS)], NOW)
    expect(planned).toEqual([
      { reminderId: 'a', nativeId: nativeIdFor('a'), at: NOW + HOUR_MS },
    ])
  })

  it('leaves out a disabled reminder', () => {
    expect(plannedAlerts([status('a', null, false)], NOW)).toEqual([])
    // Belt and braces: enabled=false with a due time set should still be skipped.
    expect(plannedAlerts([status('a', NOW + HOUR_MS, false)], NOW)).toEqual([])
  })

  it('leaves out one that is already overdue', () => {
    // The screen already says "overdue" on opening, which is the honest fallback.
    // An alarm for a past moment either fires at once or is dropped, and neither
    // adds anything to what the parent can already see.
    expect(plannedAlerts([status('a', NOW - MINUTE_MS)], NOW)).toEqual([])
    expect(plannedAlerts([status('a', NOW)], NOW)).toEqual([])
  })

  it('leaves out one beyond the horizon', () => {
    expect(plannedAlerts([status('a', NOW + SCHEDULE_HORIZON_MS + 1)], NOW)).toEqual([])
    expect(plannedAlerts([status('a', NOW + SCHEDULE_HORIZON_MS)], NOW)).toHaveLength(1)
  })

  it('returns them soonest first', () => {
    const planned = plannedAlerts(
      [
        status('later', NOW + 5 * HOUR_MS),
        status('soon', NOW + MINUTE_MS),
        status('middle', NOW + HOUR_MS),
      ],
      NOW,
    )
    expect(planned.map((alert) => alert.reminderId)).toEqual([
      'soon',
      'middle',
      'later',
    ])
  })

  it('gives one reminder one alert, so rescheduling replaces rather than stacks', () => {
    const twice = plannedAlerts([status('a', NOW + HOUR_MS)], NOW)
    const again = plannedAlerts([status('a', NOW + 2 * HOUR_MS)], NOW)
    expect(twice[0]?.nativeId).toBe(again[0]?.nativeId)
  })
})

describe('samePlan', () => {
  const plan: PlannedAlert[] = [{ reminderId: 'a', nativeId: 1, at: NOW + HOUR_MS }]

  it('is true for an identical plan', () => {
    expect(samePlan(plan, [{ reminderId: 'a', nativeId: 1, at: NOW + HOUR_MS }])).toBe(
      true,
    )
  })

  it('is false when a time moves', () => {
    expect(
      samePlan(plan, [{ reminderId: 'a', nativeId: 1, at: NOW + 2 * HOUR_MS }]),
    ).toBe(false)
  })

  it('is false when the set changes', () => {
    expect(samePlan(plan, [])).toBe(false)
    expect(
      samePlan(plan, [...plan, { reminderId: 'b', nativeId: 2, at: NOW + HOUR_MS }]),
    ).toBe(false)
  })

  it('is true for two empty plans, so nothing is re-issued when nothing is due', () => {
    // The reminder clock ticks every twenty seconds. Re-issuing alarms on every
    // tick for months is exactly what shows up in a battery report.
    expect(samePlan([], [])).toBe(true)
  })
})
