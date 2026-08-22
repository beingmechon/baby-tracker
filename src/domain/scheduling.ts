import type { ReminderStatus } from './reminders'
import { DAY_MS } from './time'
import type { Id, Timestamp } from './types'

/**
 * Which reminders to hand to the operating system to fire later.
 *
 * This is the one thing the web app genuinely cannot do. A page can raise a
 * notification while it is running; nothing in a browser can wake an app the user
 * closed two hours ago, because web push needs a server holding a subscription and
 * Notification Triggers was withdrawn before it shipped. The Android shell hands the
 * due times to the OS alarm scheduler instead, which fires them whether the app is
 * running, backgrounded, or dead.
 *
 * The decision of *what* to schedule is pure and lives here, so it is testable
 * without a device. `app/scheduledAlerts.ts` is the thin part that talks to Android.
 */

/**
 * How far ahead to hand anything over.
 *
 * Android caps how many alarms an app may hold, and a reminder due in nine days is
 * a reminder whose anchor will almost certainly have moved before then — the next
 * feed reschedules the moment a feed is logged. A day ahead covers every real case.
 */
export const SCHEDULE_HORIZON_MS = DAY_MS

export interface PlannedAlert {
  /** The reminder this alert belongs to. */
  reminderId: Id
  /**
   * A stable 31-bit id, because Android identifies a pending notification by int.
   *
   * Derived from the reminder's own id so rescheduling replaces the pending alert
   * rather than stacking a second one beside it.
   */
  nativeId: number
  at: Timestamp
}

/**
 * A stable, non-negative 31-bit hash of a string id.
 *
 * FNV-1a, which is small, has no dependencies and spreads short strings well. A
 * collision would mean two reminders sharing one pending alert, so the ids are UUIDs
 * and the space is two billion — but the consequence is a missed alert, not a wrong
 * one, and the alert is re-planned on every change anyway.
 */
export function nativeIdFor(id: Id): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    // 16777619, as 32-bit multiplication that stays exact in a double.
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  // Clear the top bit: Android wants a signed int, and a negative id is rejected.
  return hash & 0x7fffffff
}

/**
 * The alerts to hand over, given the current reminder states.
 *
 * Excludes anything disabled, anything already overdue (the app shows those as
 * overdue on opening, which is the honest fallback and does not need an alarm), and
 * anything beyond the horizon.
 */
export function plannedAlerts(
  statuses: readonly ReminderStatus[],
  now: Timestamp,
  horizonMs = SCHEDULE_HORIZON_MS,
): PlannedAlert[] {
  const planned: PlannedAlert[] = []

  for (const status of statuses) {
    if (!status.reminder.enabled) continue
    if (status.dueAt === null) continue
    // Strictly future: an alarm for a moment that has passed either fires
    // immediately or is dropped, depending on the OS version, and neither is what
    // the screen is already saying.
    if (status.dueAt <= now) continue
    if (status.dueAt > now + horizonMs) continue

    planned.push({
      reminderId: status.reminder.id,
      nativeId: nativeIdFor(status.reminder.id),
      at: status.dueAt,
    })
  }

  return planned.sort((a, b) => a.at - b.at)
}

/**
 * Whether two plans differ, so an unchanged plan does not re-issue every alarm.
 *
 * The reminder clock ticks every twenty seconds; rescheduling the same three alarms
 * three times a minute for months is exactly the kind of thing that shows up in a
 * battery report.
 */
export function samePlan(
  a: readonly PlannedAlert[],
  b: readonly PlannedAlert[],
): boolean {
  if (a.length !== b.length) return false
  return a.every((alert, index) => {
    const other = b[index]
    return (
      other !== undefined && other.nativeId === alert.nativeId && other.at === alert.at
    )
  })
}
