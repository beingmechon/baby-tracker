import type { ReactNode } from 'react'
import type { Repository } from '@/data/repository'
import { RepositoryContext, defaultRepository } from './repositoryContext'

/**
 * Makes the storage layer available to the tree. Accepts an override so tests
 * and stories can supply an in-memory or throwaway repository.
 */
export function RepositoryProvider({
  repository = defaultRepository,
  children,
}: {
  repository?: Repository
  children: ReactNode
}) {
  return (
    <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>
  )
}
