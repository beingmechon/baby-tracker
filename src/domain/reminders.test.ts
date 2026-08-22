import { describe, expect, it } from 'vitest'
import { at, bottle, diaper, nursing, pumping } from '@/test/factories'
import { HOUR_MS, MINUTE_MS } from './time'
import {
  alertedPatch,
  donePatch,
  firstDuePatch,
  isValidInterval,
  nextOccurrenceOf,
  reminderStatus,
  reminderStatuses,
  shouldAlert,
  snoozePatch,
  type Reminder,
  type ReminderKind,
} from './reminders'

const CREATED = at(2026, 1, 15, 6, 0)

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    babyId: 'baby-1',
    kind: 'custom',
    label: 'Vitamin D',
    intervalMs: 3 * HOUR_MS,
    enabled: true,
    lastDoneAt: null,
    lastAlertedAt: null,
    snoozedUntil: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  }
}

describe('reminderStatus', () => {
  it('counts a custom reminder from when it was created', () => {
    const status = reminderStatus(reminder(), [], at(2026, 1, 15, 7, 0))
    expect(status.dueAt).toBe(at(2026, 1, 15, 9, 0))
    expect(status.state).toBe('upcoming')
    expect(status.remainingMs).toBe(2 * HOUR_MS)
  })

  it('reports overdue as a negative remaining time, not as zero', () => {
    // A parent wants to know it is 40 minutes late, not merely that it is late.
    const status = reminderStatus(reminder(), [], at(2026, 1, 15, 9, 40))
    expect(status.state).toBe('due')
    expect(status.remainingMs).toBe(-40 * MINUTE_MS)
  })

  it('is off when disabled, with no due time at all', () => {
    const status = reminderStatus(reminder({ enabled: false }), [], CREATED)
    expect(status).toMatchObject({ state: 'off', dueAt: null, remainingMs: 0 })
  })

  it('counts a feed reminder from the last feed, not from when it last alerted', () => {
    // This is the whole point of anchoring: the baby ate at 08:00, so the next
    // reminder is 11:00 even though the reminder itself fired at 09:00.
    const events = [nursing(at(2026, 1, 15, 8, 0), 15 * MINUTE_MS)]
    const status = reminderStatus(
      reminder({ kind: 'feed', lastAlertedAt: at(2026, 1, 15, 9, 0) }),
      events,
      at(2026, 1, 15, 9, 30),
    )
    expect(status.dueAt).toBe(at(2026, 1, 15, 11, 0))
    expect(status.state).toBe('upcoming')
  })

  it('uses the most recent feed of either kind', () => {
    const events = [
      nursing(at(2026, 1, 15, 8, 0), 15 * MINUTE_MS),
      bottle(at(2026, 1, 15, 10, 0), 120),
    ]
    expect(
      reminderStatus(reminder({ kind: 'feed' }), events, at(2026, 1, 15, 10, 30)).dueAt,
    ).toBe(at(2026, 1, 15, 13, 0))
  })

  it('falls back to creation time when nothing has been logged yet', () => {
    expect(reminderStatus(reminder({ kind: 'feed' }), [], CREATED).dueAt).toBe(
      CREATED + 3 * HOUR_MS,
    )
  })

  it('anchors a diaper reminder to the last diaper', () => {
    const events = [
      diaper(at(2026, 1, 15, 8, 0), 'wet'),
      diaper(at(2026, 1, 15, 11, 0), 'dirty'),
      nursing(at(2026, 1, 15, 12, 0), 10 * MINUTE_MS),
    ]
    const status = reminderStatus(
      reminder({ kind: 'diaper', intervalMs: 2 * HOUR_MS }),
      events,
      at(2026, 1, 15, 12, 0),
    )
    // The 11:00 diaper, not the 08:00 one and not the 12:00 feed.
    expect(status.dueAt).toBe(at(2026, 1, 15, 13, 0))
  })

  it('treats a live snooze as the due time', () => {
    const now = at(2026, 1, 15, 10, 0)
    const status = reminderStatus(
      reminder({ snoozedUntil: at(2026, 1, 15, 10, 10) }),
      [],
      now,
    )
    expect(status.state).toBe('snoozed')
    expect(status.remainingMs).toBe(10 * MINUTE_MS)
  })

  it('goes back to due once a snooze expires', () => {
    const status = reminderStatus(
      reminder({ snoozedUntil: at(2026, 1, 15, 10, 10) }),
      [],
      at(2026, 1, 15, 10, 11),
    )
    expect(status.state).toBe('due')
  })
})

describe('the pumping anchor', () => {
  it('counts from the last pumping session', () => {
    // Wired up when pumping gained a log of its own; before that a pumping
    // reminder could only count from itself.
    const events = [pumping(at(2026, 1, 15, 9, 0), 60, 80)]
    const status = reminderStatus(
      reminder({ kind: 'pumping' }),
      events,
      at(2026, 1, 15, 10, 0),
    )
    expect(status.dueAt).toBe(at(2026, 1, 15, 12, 0))
  })

  it('is not moved by a feed', () => {
    const events = [nursing(at(2026, 1, 15, 11, 0), 15 * MINUTE_MS)]
    expect(
      reminderStatus(reminder({ kind: 'pumping' }), events, at(2026, 1, 15, 11, 30)).dueAt,
    ).toBe(CREATED + 3 * HOUR_MS)
  })
})

describe('reminderStatuses', () => {
  it('sorts soonest first and puts disabled reminders last', () => {
    const now = at(2026, 1, 15, 7, 0)
    const ordered = reminderStatuses(
      [
        reminder({ id: 'late', intervalMs: 5 * HOUR_MS }),
        reminder({ id: 'off', enabled: false, intervalMs: MINUTE_MS }),
        reminder({ id: 'soon', intervalMs: 2 * HOUR_MS }),
      ],
      [],
      now,
    )
    expect(ordered.map((s) => s.reminder.id)).toEqual(['soon', 'late', 'off'])
  })
})

describe('shouldAlert', () => {
  it('alerts once, then stays quiet while still overdue', () => {
    const events: never[] = []
    const due = reminder()
    const now = at(2026, 1, 15, 9, 1)
    expect(shouldAlert(due, events, now)).toBe(true)

    const afterAlert = { ...due, ...alertedPatch(now) }
    // Still overdue ten minutes later, but it has had its say.
    expect(shouldAlert(afterAlert, events, at(2026, 1, 15, 9, 11))).toBe(false)
  })

  it('does not alert before it is due, or when disabled', () => {
    expect(shouldAlert(reminder(), [], at(2026, 1, 15, 8, 59))).toBe(false)
    expect(shouldAlert(reminder({ enabled: false }), [], at(2026, 1, 20))).toBe(false)
  })

  it('stays quiet during a snooze and speaks up when it expires', () => {
    // The case that a single lastFired field got wrong: alerting used to advance
    // the interval by three hours, which swallowed the ten-minute snooze whole.
    const now = at(2026, 1, 15, 9, 1)
    const snoozed = { ...reminder(), ...alertedPatch(now), ...snoozePatch(now) }
    expect(reminderStatus(snoozed, [], at(2026, 1, 15, 9, 5)).state).toBe('snoozed')
    expect(shouldAlert(snoozed, [], at(2026, 1, 15, 9, 5))).toBe(false)
    expect(shouldAlert(snoozed, [], at(2026, 1, 15, 9, 12))).toBe(true)
  })

  it('stays overdue when an alert is ignored, rather than rescheduling itself', () => {
    const advanced = { ...reminder(), ...alertedPatch(at(2026, 1, 15, 9, 1)) }
    // Two hours later it is still due — alerting is not resolving.
    expect(reminderStatus(advanced, [], at(2026, 1, 15, 11, 0)).state).toBe('due')
    // But it does not alert twice for the same occurrence.
    expect(shouldAlert(advanced, [], at(2026, 1, 15, 11, 0))).toBe(false)
  })

  it('alerts again an interval after being marked done', () => {
    const done = { ...reminder(), ...alertedPatch(at(2026, 1, 15, 9, 1)), ...donePatch(at(2026, 1, 15, 9, 2)) }
    expect(shouldAlert(done, [], at(2026, 1, 15, 11, 0))).toBe(false)
    expect(shouldAlert(done, [], at(2026, 1, 15, 12, 3))).toBe(true)
  })

  it('does not read as due when a feed lands during a snooze', () => {
    // A stale snooze must not outrank a fresh feed: the baby has just eaten.
    const now = at(2026, 1, 15, 11, 1)
    const snoozed = {
      ...reminder({ kind: 'feed' }),
      ...alertedPatch(now),
      ...snoozePatch(now),
    }
    const fed = [nursing(at(2026, 1, 15, 11, 5), 12 * MINUTE_MS)]
    expect(reminderStatus(snoozed, fed, at(2026, 1, 15, 11, 12)).state).toBe('upcoming')
    expect(shouldAlert(snoozed, fed, at(2026, 1, 15, 11, 12))).toBe(false)
  })

  it('goes quiet for a feed reminder as soon as a feed is logged', () => {
    // The interaction that matters: an overdue "next feed" reminder is dismissed
    // by feeding the baby, not by finding a button.
    const alerted = {
      ...reminder({ kind: 'feed' }),
      ...alertedPatch(at(2026, 1, 15, 9, 1)),
    }
    const now = at(2026, 1, 15, 9, 30)
    expect(reminderStatus(alerted, [], now).state).toBe('due')

    const fed = [nursing(at(2026, 1, 15, 9, 20), 12 * MINUTE_MS)]
    expect(reminderStatus(alerted, fed, now).state).toBe('upcoming')
    expect(shouldAlert(alerted, fed, now)).toBe(false)
  })

  it('alerts for a feed reminder again an interval after that feed', () => {
    const alerted = {
      ...reminder({ kind: 'feed' }),
      ...alertedPatch(at(2026, 1, 15, 9, 1)),
    }
    const fed = [nursing(at(2026, 1, 15, 9, 20), 12 * MINUTE_MS)]
    expect(shouldAlert(alerted, fed, at(2026, 1, 15, 12, 21))).toBe(true)
  })
})

describe('donePatch', () => {
  it('restarts the interval from now', () => {
    const now = at(2026, 1, 15, 9, 30)
    const done = { ...reminder(), ...donePatch(now) }
    expect(reminderStatus(done, [], now).dueAt).toBe(at(2026, 1, 15, 12, 30))
  })

  it('clears a snooze, so Done is not undone by an old snooze', () => {
    const now = at(2026, 1, 15, 9, 30)
    const done = {
      ...reminder({ snoozedUntil: at(2026, 1, 15, 23, 0) }),
      ...donePatch(now),
    }
    expect(reminderStatus(done, [], now).state).toBe('upcoming')
  })
})

describe('isValidInterval', () => {
  it('requires at least a minute', () => {
    expect(isValidInterval(MINUTE_MS)).toBe(true)
    expect(isValidInterval(3 * HOUR_MS)).toBe(true)
    expect(isValidInterval(0)).toBe(false)
    expect(isValidInterval(-HOUR_MS)).toBe(false)
    expect(isValidInterval(30_000)).toBe(false)
    expect(isValidInterval(NaN)).toBe(false)
    expect(isValidInterval(Infinity)).toBe(false)
  })
})

describe('every kind is handled', () => {
  it('produces a due time for each kind rather than throwing', () => {
    const kinds: ReminderKind[] = ['feed', 'diaper', 'pumping', 'custom']
    for (const kind of kinds) {
      const status = reminderStatus(reminder({ kind }), [], CREATED)
      expect(status.dueAt, kind).toBe(CREATED + 3 * HOUR_MS)
    }
  })
})

describe('firstDuePatch', () => {
  const NOW = at(2026, 5, 10, 14, 0)

  it('counts from now when asked to', () => {
    expect(firstDuePatch('now', 3 * HOUR_MS, NOW)).toEqual({
      lastDoneAt: NOW,
      snoozedUntil: null,
    })
  })

  it('anchors backwards so the first occurrence lands on the chosen time', () => {
    // To be due at 18:00 with a 3h interval, the anchor is 15:00.
    const target = at(2026, 5, 10, 18, 0)
    expect(firstDuePatch('at', 3 * HOUR_MS, NOW, target)).toEqual({
      lastDoneAt: target - 3 * HOUR_MS,
      snoozedUntil: null,
    })
  })

  it('falls back to following the log when no time is given', () => {
    expect(firstDuePatch('at', 3 * HOUR_MS, NOW, null)).toEqual({
      lastDoneAt: null,
      snoozedUntil: null,
    })
  })

  it('clears the anchor for the log mode, so the last real event decides', () => {
    expect(firstDuePatch('log', 3 * HOUR_MS, NOW)).toEqual({
      lastDoneAt: null,
      snoozedUntil: null,
    })
  })

  it('clears a snooze in every mode, so an old deferral cannot outrank the choice', () => {
    for (const mode of ['log', 'now', 'at'] as const) {
      expect(firstDuePatch(mode, HOUR_MS, NOW, NOW + HOUR_MS).snoozedUntil).toBeNull()
    }
  })

  it('actually produces the requested due time when fed back through the status', () => {
    // The end-to-end property, rather than trusting the arithmetic above.
    const target = at(2026, 5, 10, 18, 0)
    const patch = firstDuePatch('at', 3 * HOUR_MS, NOW, target)
    const reminder: Reminder = {
      id: 'r1',
      babyId: 'b1',
      kind: 'custom',
      label: 'Vitamin D',
      intervalMs: 3 * HOUR_MS,
      enabled: true,
      lastDoneAt: patch.lastDoneAt ?? null,
      lastAlertedAt: null,
      snoozedUntil: null,
      createdAt: NOW - 10 * HOUR_MS,
      updatedAt: NOW,
    }
    expect(reminderStatus(reminder, [], NOW).dueAt).toBe(target)
  })
})

describe('nextOccurrenceOf', () => {
  it('is later today when the time has not passed', () => {
    const now = at(2026, 5, 10, 14, 0)
    expect(nextOccurrenceOf(18, 0, now)).toBe(at(2026, 5, 10, 18, 0))
  })

  it('is tomorrow when it already has', () => {
    // Setting "18:00" at 8pm means tomorrow evening, not two hours ago — a first
    // occurrence in the past would fire the moment it was saved.
    const now = at(2026, 5, 10, 20, 0)
    expect(nextOccurrenceOf(18, 0, now)).toBe(at(2026, 5, 11, 18, 0))
  })

  it('treats the exact current minute as already passed', () => {
    const now = at(2026, 5, 10, 18, 0)
    expect(nextOccurrenceOf(18, 0, now)).toBe(at(2026, 5, 11, 18, 0))
  })

  it('crosses a month boundary', () => {
    const now = at(2026, 5, 31, 23, 30)
    expect(nextOccurrenceOf(9, 0, now)).toBe(at(2026, 6, 1, 9, 0))
  })
})
