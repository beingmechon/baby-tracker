import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NewReminder } from '@/data/repository'
import {
  alertedPatch,
  donePatch,
  reminderStatuses,
  shouldAlert,
  snoozePatch,
  type Reminder,
  type ReminderStatus,
} from '@/domain/reminders'
import type { BabyEvent, Id, Timestamp } from '@/domain/types'
import { useRepository } from './repositoryContext'

export interface ReminderStore {
  reminders: Reminder[]
  /** Soonest first, disabled last. */
  statuses: ReminderStatus[]
  /** Due or overdue right now — what the home screen surfaces. */
  due: ReminderStatus[]
  error: string | null

  add(reminder: NewReminder): Promise<void>
  update(id: Id, patch: Partial<Reminder>): Promise<void>
  remove(id: Id): Promise<void>
  snooze(id: Id, now: Timestamp): Promise<void>
  markDone(id: Id, now: Timestamp): Promise<void>
  reload(): Promise<void>
}

/** Stable empty list, for the same reason `NO_EVENTS` exists in the event store. */
const NO_REMINDERS: Reminder[] = []

/**
 * Reminder state, plus the loop that turns a due reminder into a notification.
 *
 * The alerting effect is deliberately driven by `now` rather than by its own
 * `setTimeout`: the page already ticks for the running timers, a timeout does not
 * survive the tab being suspended and resumed, and a wall-clock comparison on
 * each tick gets the answer right whether five seconds or five hours have passed.
 */
export function useReminders(
  babyId: Id | null,
  events: readonly BabyEvent[],
  now: Timestamp,
  alert: (status: ReminderStatus) => Promise<void> | void,
): ReminderStore {
  const repository = useRepository()
  // Tagged with whose reminders these are, for the same reason the event store
  // does it: switching baby must never show one baby's reminders under another's.
  const [loaded, setLoaded] = useState<{ babyId: Id | null; reminders: Reminder[] }>({
    babyId: null,
    reminders: [],
  })
  const [error, setError] = useState<string | null>(null)
  const reminders = loaded.babyId === babyId ? loaded.reminders : NO_REMINDERS

  const reload = useCallback(async () => {
    if (babyId === null) {
      setLoaded({ babyId: null, reminders: [] })
      return
    }
    try {
      setLoaded({ babyId, reminders: await repository.listReminders(babyId) })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load reminders')
    }
  }, [repository, babyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const statuses = useMemo(
    () => reminderStatuses(reminders, events, now),
    [reminders, events, now],
  )

  const mutate = useCallback(
    async (operation: () => Promise<unknown>) => {
      try {
        await operation()
        await reload()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save the reminder')
      }
    },
    [reload],
  )

  /**
   * Ids already alerted in this page's lifetime, keyed by the occasion they were
   * alerted for. Storage is the durable record — this only closes the window
   * between raising a notification and the reload that persists `lastAlertedAt`,
   * during which the effect could otherwise fire again on the next tick.
   */
  const alerted = useRef(new Map<Id, Timestamp>())

  useEffect(() => {
    const pending = statuses.filter(
      (status) =>
        status.dueAt !== null &&
        shouldAlert(status.reminder, events, now) &&
        alerted.current.get(status.reminder.id) !== status.dueAt,
    )
    if (pending.length === 0) return

    for (const status of pending) {
      alerted.current.set(status.reminder.id, status.dueAt as Timestamp)
    }

    void (async () => {
      for (const status of pending) {
        await alert(status)
        await mutate(() =>
          repository.updateReminder(status.reminder.id, alertedPatch(now)),
        )
      }
    })()
  }, [statuses, events, now, alert, mutate, repository])

  return {
    reminders,
    statuses,
    due: statuses.filter((status) => status.state === 'due'),
    error,

    add: async (reminder) => {
      if (babyId === null) return
      await mutate(() => repository.addReminder(babyId, reminder))
    },
    update: async (id, patch) => {
      await mutate(() => repository.updateReminder(id, patch))
    },
    remove: async (id) => {
      await mutate(() => repository.deleteReminder(id))
    },
    snooze: async (id, at) => {
      await mutate(() => repository.updateReminder(id, snoozePatch(at)))
    },
    markDone: async (id, at) => {
      await mutate(() => repository.updateReminder(id, donePatch(at)))
    },
    reload,
  }
}
