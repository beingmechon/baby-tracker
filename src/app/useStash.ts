import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NewStashEntry } from '@/data/repository'
import {
  stashOrder,
  stashTotals,
  takeFromEntry,
  type StashEntry,
  type StashStatus,
  type StashTotals,
} from '@/domain/stash'
import type { Id, Timestamp } from '@/domain/types'
import { useRepository } from './repositoryContext'

export interface StashStore {
  entries: StashEntry[]
  /** Most urgent first — the order to take milk out in. */
  order: StashStatus[]
  totals: StashTotals
  error: string | null

  add(entry: NewStashEntry): Promise<void>
  /** Takes milk out, removing the entry when nothing is left. */
  use(id: Id, usedMl: number): Promise<void>
  discard(id: Id): Promise<void>
  reload(): Promise<void>
}

/** Stable empty list, so an unloaded stash does not invalidate memos each render. */
const NO_ENTRIES: StashEntry[] = []

export function useStash(babyId: Id | null, now: Timestamp): StashStore {
  const repository = useRepository()
  // Tagged with whose stash this is, for the same reason the event and reminder
  // stores do it: switching baby must never show one baby's milk under another's.
  const [loaded, setLoaded] = useState<{ babyId: Id | null; entries: StashEntry[] }>({
    babyId: null,
    entries: [],
  })
  const [error, setError] = useState<string | null>(null)
  const entries = loaded.babyId === babyId ? loaded.entries : NO_ENTRIES

  const reload = useCallback(async () => {
    if (babyId === null) {
      setLoaded({ babyId: null, entries: [] })
      return
    }
    try {
      setLoaded({ babyId, entries: await repository.listStash(babyId) })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the stash')
    }
  }, [repository, babyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const order = useMemo(() => stashOrder(entries, now), [entries, now])
  const totals = useMemo(() => stashTotals(entries, now), [entries, now])

  const mutate = useCallback(
    async (operation: () => Promise<unknown>) => {
      try {
        await operation()
        await reload()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save the stash')
      }
    },
    [reload],
  )

  return {
    entries,
    order,
    totals,
    error,

    add: async (entry) => {
      if (babyId === null) return
      await mutate(() => repository.addStash(babyId, entry))
    },

    use: async (id, usedMl) => {
      const entry = entries.find((candidate) => candidate.id === id)
      if (entry === undefined) return
      const remaining = takeFromEntry(entry, usedMl)
      // An emptied entry is deleted rather than kept at zero: a row reading "0 ml"
      // in a stash list is noise a tired parent has to read past every time.
      await mutate(() =>
        remaining === null
          ? repository.deleteStash(id)
          : repository.updateStash(id, { amountMl: remaining }),
      )
    },

    discard: async (id) => {
      await mutate(() => repository.deleteStash(id))
    },

    reload,
  }
}
