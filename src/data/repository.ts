import type { Reminder } from '@/domain/reminders'
import type { StashEntry } from '@/domain/stash'
import type { Baby, BabyEvent, Id, Sex, Timestamp } from '@/domain/types'

/**
 * `Omit` over a union collapses it to the shared keys, which would silently
 * throw away every type-specific field. Distributing over the members keeps
 * `NewEvent` a union of one precise shape per event type.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

/** A new event before the store has assigned identity and audit timestamps. */
export type NewEvent = DistributiveOmit<
  BabyEvent,
  'id' | 'createdAt' | 'updatedAt' | 'babyId'
>

/** A new reminder. The three state timestamps all start null. */
/**
 * A reminder as the sheet describes it.
 *
 * The anchor fields are optional and default to null, which is the "follow the log"
 * behaviour every reminder had before the sheet could ask when the first one is due.
 * Letting them come in with the creation avoids writing the row twice.
 */
export type NewReminder = Pick<Reminder, 'kind' | 'label' | 'intervalMs' | 'enabled'> &
  Partial<Pick<Reminder, 'lastDoneAt' | 'snoozedUntil'>>

export type NewStashEntry = Pick<
  StashEntry,
  'amountMl' | 'location' | 'expressedAt'
>

export type NewPhoto = Pick<StoredPhoto, 'type' | 'data' | 'width' | 'height'>

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
  /**
   * Added after v0.1. The version stays 1 on purpose: an older build reading this
   * file ignores these fields and still restores every baby and event, which is
   * what a backup is for. A version bump would have made it refuse the file.
   */
  reminders?: Reminder[]
  stash?: StashEntry[]
  /**
   * Photos, base64-encoded.
   *
   * Included so "export a complete backup" stays a true sentence — a backup that
   * silently drops the first-smile photo is not a backup. The cost is size, which
   * is why photos are downscaled before they are ever stored (see `ui/photo.ts`)
   * and why the settings screen says the file will be larger once there are any.
   */
  photos?: StoredPhoto[]
}

/**
 * A photo, in its own store rather than on the event that shows it.
 *
 * Every summary, timeline and chart reads whole event records; carrying a JPEG
 * through each of those reads to display a date would be the worst decision in the
 * data layer. The event holds an id and the bytes are fetched only when shown.
 */
export interface StoredPhoto {
  id: Id
  babyId: Id
  /** `image/jpeg` after downscaling, whatever was picked. */
  type: string
  /**
   * The image itself, base64 without a data-URL prefix.
   *
   * Stored as a string rather than a Blob: structured-clone support for Blobs in
   * IndexedDB is real but uneven across the engines this app has to run in, and a
   * photo that fails to round-trip on one browser is a keepsake lost. The size cost
   * of base64 is a third, and downscaling already bounds it.
   */
  data: string
  width: number
  height: number
  createdAt: Timestamp
}

export interface ImportResult {
  babiesImported: number
  eventsImported: number
  remindersImported: number
  stashImported: number
  photosImported: number
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
  createBaby(input: {
    name: string
    birthDate: string | null
    sex?: Sex | null
  }): Promise<Baby>
  updateBaby(id: Id, patch: Partial<Omit<Baby, 'id' | 'createdAt'>>): Promise<Baby>
  deleteBaby(id: Id): Promise<void>

  listEvents(babyId: Id, query?: EventQuery): Promise<BabyEvent[]>
  addEvent(babyId: Id, event: NewEvent): Promise<BabyEvent>
  /** Applies a partial change and bumps `updatedAt`. */
  updateEvent(id: Id, patch: Partial<BabyEvent>): Promise<BabyEvent>
  deleteEvent(id: Id): Promise<void>

  listReminders(babyId: Id): Promise<Reminder[]>
  addReminder(babyId: Id, reminder: NewReminder): Promise<Reminder>
  updateReminder(id: Id, patch: Partial<Reminder>): Promise<Reminder>
  deleteReminder(id: Id): Promise<void>

  /** The bytes for one photo, or null once it has been deleted. */
  getPhoto(id: Id): Promise<StoredPhoto | null>
  addPhoto(babyId: Id, photo: NewPhoto): Promise<StoredPhoto>
  deletePhoto(id: Id): Promise<void>

  listStash(babyId: Id): Promise<StashEntry[]>
  addStash(babyId: Id, entry: NewStashEntry): Promise<StashEntry>
  updateStash(id: Id, patch: Partial<StashEntry>): Promise<StashEntry>
  deleteStash(id: Id): Promise<void>

  exportAll(): Promise<ExportBundle>
  importBundle(bundle: unknown): Promise<ImportResult>
  /** The one-tap "delete everything" the privacy promise depends on. */
  clearAll(): Promise<void>
}
