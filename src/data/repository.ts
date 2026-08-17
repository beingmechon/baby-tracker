import type { Baby, BabyEvent, Id, Timestamp } from '@/domain/types'

/**
 * `Omit` over a union collapses it to the shared keys, which would silently
 * throw away every type-specific field. Distributing over the members keeps
 * `NewEvent` a union of four precise shapes.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

/** A new event before the store has assigned identity and audit timestamps. */
export type NewEvent = DistributiveOmit<
  BabyEvent,
  'id' | 'createdAt' | 'updatedAt' | 'babyId'
>

export interface EventQuery {
  /** Inclusive lower bound on `startedAt`. */
  since?: Timestamp
  /** Exclusive upper bound on `startedAt`. */
  until?: Timestamp
}

/** The on-disk shape of a full export. Versioned so importers can adapt. */
export interface ExportBundle {
  format: 'baby-tracker-export'
  version: 1
  exportedAt: Timestamp
  babies: Baby[]
  events: BabyEvent[]
}

export interface ImportResult {
  babiesImported: number
  eventsImported: number
  /** Entries rejected by validation, with a reason, so nothing fails silently. */
  skipped: { reason: string; count: number }[]
}

/**
 * The single seam between the app and where data lives.
 *
 * v0.1 ships one implementation, backed by IndexedDB. Keeping every call the UI
 * makes behind this interface is what lets v0.3 add a self-hosted sync backend,
 * or a native SQLite store inside a Capacitor shell, without the UI noticing.
 */
export interface Repository {
  listBabies(): Promise<Baby[]>
  createBaby(input: { name: string; birthDate: string | null }): Promise<Baby>
  updateBaby(id: Id, patch: Partial<Omit<Baby, 'id' | 'createdAt'>>): Promise<Baby>
  deleteBaby(id: Id): Promise<void>

  listEvents(babyId: Id, query?: EventQuery): Promise<BabyEvent[]>
  addEvent(babyId: Id, event: NewEvent): Promise<BabyEvent>
  /** Applies a partial change and bumps `updatedAt`. */
  updateEvent(id: Id, patch: Partial<BabyEvent>): Promise<BabyEvent>
  deleteEvent(id: Id): Promise<void>

  exportAll(): Promise<ExportBundle>
  importBundle(bundle: unknown): Promise<ImportResult>
  /** The one-tap "delete everything" the privacy promise depends on. */
  clearAll(): Promise<void>
}
