import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ExportBundle, ImportResult, NewEvent } from '@/data/repository'
import { findLastFeed } from '@/domain/feeds'
import { classifySleep, findSleepInProgress, type NightWindow } from '@/domain/sleep'
import { cleanTogetherIds, logTargets } from '@/domain/together'
import type {
  Baby,
  BabyEvent,
  BottleContents,
  BreastSide,
  DiaperKind,
  Id,
  MeasureKind,
  SleepEvent,
  SymptomImpression,
  TemperatureSite,
  VisitQuestion,
  Timestamp,
} from '@/domain/types'
import { useRepository } from './repositoryContext'

export interface BabyStore {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  babies: Baby[]
  activeBaby: Baby | null
  /** The active baby's events, newest first. */
  events: BabyEvent[]
  sleepInProgress: SleepEvent | null

  createBaby(input: { name: string; birthDate: string | null }): Promise<Baby>
  updateBaby(id: Id, patch: Partial<Omit<Baby, 'id' | 'createdAt'>>): Promise<void>
  deleteBaby(id: Id): Promise<void>

  logNursing(input: {
    side: BreastSide
    startedAt: Timestamp
    durationMs: number
  }): Promise<void>
  logBottle(input: {
    contents: BottleContents
    amountMl: number
    startedAt: Timestamp
  }): Promise<void>
  logDiaper(input: { kind: DiaperKind; startedAt: Timestamp }): Promise<void>
  /** `value` is canonical: grams for weight, millimetres for length and head. */
  logGrowth(input: {
    measure: MeasureKind
    value: number
    startedAt: Timestamp
  }): Promise<void>
  logPumping(input: {
    leftMl: number
    rightMl: number
    durationMs: number
    startedAt: Timestamp
  }): Promise<void>
  logTemperature(input: {
    celsiusHundredths: number
    site: TemperatureSite
    startedAt: Timestamp
  }): Promise<void>
  logMedication(input: {
    name: string
    dose: string
    startedAt: Timestamp
  }): Promise<void>
  logSymptom(input: {
    name: string
    impression: SymptomImpression
    note: string
    startedAt: Timestamp
  }): Promise<void>
  /** A visit may be in the future: that is where the questions list earns its keep. */
  logVisit(input: {
    reason: string
    who: string
    note: string
    questions: VisitQuestion[]
    startedAt: Timestamp
  }): Promise<void>
  startSleep(startedAt: Timestamp): Promise<void>
  endSleep(id: Id, endedAt: Timestamp): Promise<void>
  /** Re-logs the last feed as-is — the "one tap repeats" shortcut. */
  repeatLastFeed(at: Timestamp): Promise<void>

  updateEvent(id: Id, patch: Partial<BabyEvent>): Promise<void>
  deleteEvent(id: Id): Promise<void>

  exportAll(): Promise<ExportBundle>
  importBundle(bundle: unknown): Promise<ImportResult>
  clearAll(): Promise<void>
  reload(): Promise<void>
}

/** One stable empty array, so a baby with nothing loaded yet does not invalidate
 *  every memo downstream on each render. */
const NO_EVENTS: BabyEvent[] = []

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

/**
 * The app's single source of truth.
 *
 * Every write goes to the repository and then reloads from it, rather than
 * patching local state optimistically. For a local IndexedDB store the reload
 * costs a millisecond or two, and it means what you see is always what is
 * actually saved — the property that matters most in an app whose whole promise
 * is that your data is safe on your own device.
 */
/**
 * @param togetherIds Babies logged together — twins mode. Every point-in-time
 *   event written for the active baby is written for the others too. Empty is off,
 *   which is the ordinary single-baby path unchanged.
 */
export function useBabyStore(
  activeBabyId: Id | null,
  nightWindow: NightWindow,
  togetherIds: readonly Id[] = [],
): BabyStore {
  const repository = useRepository()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [babies, setBabies] = useState<Baby[]>([])
  /**
   * The loaded events, tagged with whose they are.
   *
   * Switching baby changes `activeBabyId` synchronously but the read from storage
   * resolves a tick later, so a plain `events` array would spend that tick showing
   * one baby's entries under another baby's name. Tagging them means the wrong
   * baby's data is never rendered at all — an empty timeline for a few
   * milliseconds is honest, and showing someone else's feeds is not.
   */
  const [loaded, setLoaded] = useState<{ babyId: Id | null; events: BabyEvent[] }>({
    babyId: null,
    events: [],
  })

  const activeBaby = useMemo(() => {
    if (babies.length === 0) return null
    return babies.find((baby) => baby.id === activeBabyId) ?? babies[0] ?? null
  }, [babies, activeBabyId])

  const activeId = activeBaby?.id ?? null
  // Recomputed from the loaded babies so a group naming a deleted baby is pruned
  // before anything is written for an id that no longer exists.
  const babyIds = useMemo(() => babies.map((baby) => baby.id), [babies])
  const events = loaded.babyId === activeId ? loaded.events : NO_EVENTS

  const reload = useCallback(async () => {
    try {
      const loadedBabies = await repository.listBabies()
      setBabies(loadedBabies)

      const target =
        loadedBabies.find((baby) => baby.id === activeBabyId) ?? loadedBabies[0] ?? null
      // The full history is read: a year of dense logging is a few thousand small
      // records, which IndexedDB returns in single-digit milliseconds. The
      // [babyId, startedAt] index is already in place for when windowing pays off.
      setLoaded({
        babyId: target?.id ?? null,
        events: target === null ? [] : await repository.listEvents(target.id),
      })

      setStatus('ready')
      setError(null)
    } catch (cause) {
      setStatus('error')
      setError(messageFor(cause))
    }
  }, [repository, activeBabyId])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Runs a write, then refreshes from storage. Surfaces failures as `error`. */
  const mutate = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      try {
        const result = await operation()
        await reload()
        return result
      } catch (cause) {
        setError(messageFor(cause))
        throw cause
      }
    },
    [reload],
  )

  /**
   * Writes one event for every baby it belongs to.
   *
   * One baby normally; both twins when the group is on. Written sequentially with
   * the baby on screen first, and *not* wrapped in a transaction: if the second
   * write fails, the first is still a true record of something that happened, and
   * rolling it back would discard a real event to preserve a symmetry nobody asked
   * for. The error surfaces either way.
   */
  const addEvent = useCallback(
    async (event: NewEvent) => {
      const targets = logTargets(
        activeId,
        cleanTogetherIds(togetherIds, babyIds),
        event.type,
      )
      if (targets.length === 0) throw new Error('No baby selected')
      await mutate(async () => {
        for (const babyId of targets) {
          await repository.addEvent(babyId, event)
        }
      })
    },
    [activeId, babyIds, togetherIds, mutate, repository],
  )

  const sleepInProgress = useMemo(() => findSleepInProgress(events), [events])

  const store: BabyStore = {
    status,
    error,
    babies,
    activeBaby,
    events,
    sleepInProgress,

    createBaby: (input) => mutate(() => repository.createBaby(input)),
    updateBaby: async (id, patch) => {
      await mutate(() => repository.updateBaby(id, patch))
    },
    deleteBaby: async (id) => {
      await mutate(() => repository.deleteBaby(id))
    },

    logNursing: ({ side, startedAt, durationMs }) =>
      addEvent({ type: 'nursing', side, startedAt, durationMs }),
    logBottle: ({ contents, amountMl, startedAt }) =>
      addEvent({ type: 'bottle', contents, amountMl, startedAt }),
    logDiaper: ({ kind, startedAt }) => addEvent({ type: 'diaper', kind, startedAt }),
    logGrowth: ({ measure, value, startedAt }) =>
      addEvent({ type: 'growth', measure, value, startedAt }),
    logPumping: ({ leftMl, rightMl, durationMs, startedAt }) =>
      addEvent({ type: 'pumping', leftMl, rightMl, durationMs, startedAt }),
    logTemperature: ({ celsiusHundredths, site, startedAt }) =>
      addEvent({ type: 'temperature', celsiusHundredths, site, startedAt }),
    logMedication: ({ name, dose, startedAt }) =>
      addEvent({ type: 'medication', name, dose, startedAt }),
    logSymptom: ({ name, impression, note, startedAt }) =>
      addEvent({ type: 'symptom', name, impression, note, startedAt }),
    logVisit: ({ reason, who, note, questions, startedAt }) =>
      addEvent({ type: 'visit', reason, who, note, questions, startedAt }),

    startSleep: async (startedAt) => {
      // Only ever one sleep runs at a time; the button that calls this is hidden
      // while a sleep is open, and this guard covers a double-tap racing it.
      if (sleepInProgress !== null) return
      await addEvent({
        type: 'sleep',
        startedAt,
        endedAt: null,
        kind: classifySleep(startedAt, nightWindow),
      })
    },
    endSleep: async (id, endedAt) => {
      await mutate(() => repository.updateEvent(id, { endedAt }))
    },

    repeatLastFeed: async (at) => {
      const last = findLastFeed(events)
      if (last === null) return
      if (last.type === 'nursing') {
        await addEvent({
          type: 'nursing',
          side: last.side,
          startedAt: at,
          durationMs: last.durationMs,
        })
        return
      }
      await addEvent({
        type: 'bottle',
        contents: last.contents,
        amountMl: last.amountMl,
        startedAt: at,
      })
    },

    updateEvent: async (id, patch) => {
      await mutate(() => repository.updateEvent(id, patch))
    },
    deleteEvent: async (id) => {
      await mutate(() => repository.deleteEvent(id))
    },

    exportAll: () => repository.exportAll(),
    importBundle: (bundle) => mutate(() => repository.importBundle(bundle)),
    clearAll: async () => {
      await mutate(() => repository.clearAll())
    },
    reload,
  }

  return store
}
