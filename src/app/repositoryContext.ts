import { createContext, useContext } from 'react'
import { IndexedDbRepository } from '@/data/indexeddb-repository'
import type { Repository } from '@/data/repository'

/**
 * Kept apart from the provider component so this module exports no components —
 * which is what lets React Fast Refresh work properly during development.
 */
export const RepositoryContext = createContext<Repository | null>(null)

/** One connection for the whole app. */
export const defaultRepository: Repository = new IndexedDbRepository()

export function useRepository(): Repository {
  const repository = useContext(RepositoryContext)
  if (repository === null) {
    throw new Error('useRepository must be used inside a RepositoryProvider')
  }
  return repository
}
