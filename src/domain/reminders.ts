import { findLastFeed } from './feeds'
import { MINUTE_MS } from './time'
import type { BabyEvent, Id, Timestamp } from './types'

/**
 * Interval reminders: next feed, pumping, vitamin D drops, tummy time.
 *
 * Pure and numeric, like the rest of `domain/`. Nothing here touches the
 * Notification API or the clock — `now` is always passed in — so every awkward
 * case (a snooze that has just expired, a feed logged while a reminder was
 * overdue) is testable.
 *
 * Three timestamps do three separate jobs, and keeping them separate is what
 * makes the awkward cases work:
 *
 *   - `lastDoneAt` **resolves** a reminder: the interval counts afresh from here.
 *   - `lastAlertedAt` only **deduplicates** alerts, so one occurrence produces one
 *     notification however often the app re-renders.
 *   - `snoozedUntil` **defers** the current occurrence without resolving it.
 *
 * An earlier version used one field for the first two. A ten-minute snooze was
 * then swallowed whole by the three-hour reschedule that alerting itself caused,
 * so Snooze silently did nothing on the reminders people would snooze most.
 */

export type ReminderKind = 'feed' | 'diaper' | 'pumping' | 'custom'

export interface Reminder {
  id: Id
  babyId: Id
  kind: ReminderKind
  /** Used for `custom` only; the built-in kinds are named by the catalogue. */
  label: string
  intervalMs: number
  enabled: boolean
  /** When the reminder was last resolved — by the Done button. */
  lastDoneAt: Timestamp | null
  /** When it last raised a notification. Deduplication only, never an anchor. */
  lastAlertedAt: Timestamp | null
  /** A deferred occurrence. Consumed by the alert it produces. */
  snoozedUntil: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ReminderState = 'off' | 'snoozed' | 'upcoming' | 'due'

export interface ReminderStatus {
  reminder: Reminder
  /** null when the reminder is disabled. */
  dueAt: Timestamp | null
  state: ReminderState
  /** Milliseconds until due; negative once overdue. 0 when disabled. */
  remainingMs: number
}

export const SNOOZE_MS = 10 * MINUTE_MS

export const REMINDER_KINDS: readonly ReminderKind[] = [
  'feed',
  'diaper',
  'pumping',
  'custom',
]

/** The last logged event that resolves this kind of reminder, if any. */
function lastRelevantEvent(
  kind: ReminderKind,
  events: readonly BabyEvent[],
): Timestamp | null {
  if (kind === 'feed') return findLastFeed(events)?.startedAt ?? null
  if (kind === 'diaper') {
    return (
      events
        .filter((event) => event.type === 'diaper')
        .reduce<Timestamp | null>(
          (latest, event) =>
            latest === null || event.startedAt > latest ? event.startedAt : latest,
          null,
        ) ?? null
    )
  }
  // Pumping has no log of its own yet (see docs/ROADMAP.md v0.5); when it gains
  // one, adding a case here is the whole change.
  return null
}

/**
 * The moment the interval counts from: the most recent thing that resolved this
 * reminder.
 *
 * For a feed reminder that is usually the last feed — logging *is* how you
 * dismiss it, which is an action a parent already performs, so there is nothing
 * extra to remember. Done and creation time are the other candidates, and the
 * latest of the three wins.
 */
export function anchorFor(reminder: Reminder, events: readonly BabyEvent[]): Timestamp {
  return Math.max(
    reminder.createdAt,
    reminder.lastDoneAt ?? 0,
    lastRelevantEvent(reminder.kind, events) ?? 0,
  )
}

/**
 * When this reminder next comes up: an interval after it was last resolved, or
 * the end of a snooze, whichever is later.
 *
 * `Math.max` is what stops the two mechanisms fighting. A snooze must outrank the
 * interval so that deferring an overdue reminder actually defers it; a fresh feed
 * must outrank a stale snooze so that feeding the baby does not leave a reminder
 * reading "due".
 */
function effectiveDueAt(reminder: Reminder, events: readonly BabyEvent[]): Timestamp {
  const intervalDue = anchorFor(reminder, events) + reminder.intervalMs
  return Math.max(intervalDue, reminder.snoozedUntil ?? 0)
}

export function reminderStatus(
  reminder: Reminder,
  events: readonly BabyEvent[],
  now: Timestamp,
): ReminderStatus {
  if (!reminder.enabled) {
    return { reminder, dueAt: null, state: 'off', remainingMs: 0 }
  }

  const dueAt = effectiveDueAt(reminder, events)
  const remainingMs = dueAt - now
  const deferred =
    reminder.snoozedUntil !== null && reminder.snoozedUntil > now && remainingMs > 0

  return {
    reminder,
    dueAt,
    state: remainingMs <= 0 ? 'due' : deferred ? 'snoozed' : 'upcoming',
    remainingMs,
  }
}

/** Every reminder's status, soonest first, with disabled ones last. */
export function reminderStatuses(
  reminders: readonly Reminder[],
  events: readonly BabyEvent[],
  now: Timestamp,
): ReminderStatus[] {
  return reminders
    .map((reminder) => reminderStatus(reminder, events, now))
    .sort((a, b) => {
      if (a.dueAt === null) return b.dueAt === null ? 0 : 1
      if (b.dueAt === null) return -1
      return a.dueAt - b.dueAt
    })
}

/**
 * Whether this reminder should raise an alert right now.
 *
 * Distinct from `state === 'due'`, because "due" persists — an overdue reminder
 * goes on being overdue until something resolves it — while an alert must happen
 * once per occurrence. Having already alerted at or after the current due time is
 * exactly what "already said this" means.
 */
export function shouldAlert(
  reminder: Reminder,
  events: readonly BabyEvent[],
  now: Timestamp,
): boolean {
  const { state, dueAt } = reminderStatus(reminder, events, now)
  if (state !== 'due' || dueAt === null) return false
  return reminder.lastAlertedAt === null || reminder.lastAlertedAt < dueAt
}

/** Records an alert and consumes the snooze that may have produced it. */
export function alertedPatch(now: Timestamp): Partial<Reminder> {
  return { lastAlertedAt: now, snoozedUntil: null }
}

/** Defers the current occurrence without resolving it. */
export function snoozePatch(now: Timestamp, snoozeMs = SNOOZE_MS): Partial<Reminder> {
  return { snoozedUntil: now + snoozeMs }
}

/** Resolves the reminder: the interval restarts from now. */
export function donePatch(now: Timestamp): Partial<Reminder> {
  return { lastDoneAt: now, snoozedUntil: null }
}

/**
 * A reminder needs a real interval. Below a minute it would be due again before
 * the notification cleared, which is a way of breaking someone's phone rather
 * than a preference to respect.
 */
export function isValidInterval(intervalMs: number): boolean {
  return Number.isFinite(intervalMs) && intervalMs >= MINUTE_MS
}
