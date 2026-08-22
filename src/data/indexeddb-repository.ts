import type { Reminder } from '@/domain/reminders'
import { isValidStashAmount, type StashEntry } from '@/domain/stash'
import type { Baby, BabyEvent, Id, Sex, Timestamp } from '@/domain/types'
import { newId } from './ids'
import {
  DB_NAME,
  DB_VERSION,
  STORE_BABIES,
  STORE_EVENTS,
  STORE_REMINDERS,
  STORE_PHOTOS,
  STORE_STASH,
  openDatabase,
  requestToPromise,
  transactionDone,
} from './idb'
import type {
  EventQuery,
  ExportBundle,
  ImportResult,
  NewEvent,
  NewPhoto,
  NewReminder,
  NewStashEntry,
  Repository,
  StoredPhoto,
} from './repository'
import {
  parseBaby,
  parseEvent,
  parsePhoto,
  parseReminder,
  parseStashEntry,
} from './validate'

export interface RepositoryOptions {
  /** Injectable so tests can control time and ids. */
  now?: () => Timestamp
  generateId?: () => Id
  databaseName?: string
}

export class IndexedDbRepository implements Repository {
  private readonly now: () => Timestamp
  private readonly generateId: () => Id
  private readonly databaseName: string
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor(options: RepositoryOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.generateId = options.generateId ?? newId
    this.databaseName = options.databaseName ?? DB_NAME
  }

  private db(): Promise<IDBDatabase> {
    // Cached so concurrent callers share one connection, but cleared on failure
    // so a transient open error does not permanently break the app.
    if (this.dbPromise === null) {
      this.dbPromise = openDatabase(this.databaseName, DB_VERSION).catch((error) => {
        this.dbPromise = null
        throw error
      })
    }
    return this.dbPromise
  }

  /** Closes the connection. Needed so tests and data deletion can reopen. */
  async close(): Promise<void> {
    if (this.dbPromise === null) return
    const db = await this.dbPromise.catch(() => null)
    db?.close()
    this.dbPromise = null
  }

  private async readAll<T>(store: string): Promise<T[]> {
    const db = await this.db()
    const tx = db.transaction(store, 'readonly')
    const result = await requestToPromise<T[]>(tx.objectStore(store).getAll())
    await transactionDone(tx)
    return result
  }

  async listBabies(): Promise<Baby[]> {
    const babies = await this.readAll<Baby>(STORE_BABIES)
    return babies
      // Records written before growth tracking existed have no `sex` key at all.
      // Normalising on read means the rest of the app never has to distinguish
      // "not recorded" from "written by an older version".
      .map((baby) => ({ ...baby, sex: baby.sex ?? null }))
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  async createBaby(input: {
    name: string
    birthDate: string | null
    sex?: Sex | null
  }): Promise<Baby> {
    const name = input.name.trim()
    if (name.length === 0) throw new Error('A baby needs a name')

    const baby: Baby = {
      id: this.generateId(),
      name,
      birthDate: input.birthDate,
      sex: input.sex ?? null,
      createdAt: this.now(),
    }
    const db = await this.db()
    const tx = db.transaction(STORE_BABIES, 'readwrite')
    tx.objectStore(STORE_BABIES).put(baby)
    await transactionDone(tx)
    return baby
  }

  async updateBaby(
    id: Id,
    patch: Partial<Omit<Baby, 'id' | 'createdAt'>>,
  ): Promise<Baby> {
    const db = await this.db()
    const tx = db.transaction(STORE_BABIES, 'readwrite')
    const store = tx.objectStore(STORE_BABIES)
    const existing = await requestToPromise<Baby | undefined>(store.get(id))
    if (existing === undefined) {
      tx.abort()
      throw new Error(`No baby with id ${id}`)
    }
    const updated: Baby = { ...existing, ...patch, id: existing.id }
    store.put(updated)
    await transactionDone(tx)
    return updated
  }

  async deleteBaby(id: Id): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(
      [STORE_BABIES, STORE_EVENTS, STORE_REMINDERS, STORE_STASH, STORE_PHOTOS],
      'readwrite',
    )
    tx.objectStore(STORE_BABIES).delete(id)

    // Cascade, so deleting a profile leaves no orphaned rows behind.
    for (const storeName of [
      STORE_EVENTS,
      STORE_REMINDERS,
      STORE_STASH,
      STORE_PHOTOS,
    ]) {
      const store = tx.objectStore(storeName)
      const keys = await requestToPromise<IDBValidKey[]>(
        store.index('babyId').getAllKeys(id),
      )
      for (const key of keys) store.delete(key)
    }

    await transactionDone(tx)
  }

  async listEvents(babyId: Id, query: EventQuery = {}): Promise<BabyEvent[]> {
    const db = await this.db()
    const tx = db.transaction(STORE_EVENTS, 'readonly')
    const index = tx.objectStore(STORE_EVENTS).index('babyId_startedAt')

    // A bounded key range on [babyId, startedAt] keeps a long history cheap:
    // the timeline reads a day, not every event ever logged.
    const lower: [Id, Timestamp] = [babyId, query.since ?? -Infinity]
    const upper: [Id, Timestamp] = [babyId, query.until ?? Infinity]
    const range = IDBKeyRange.bound(lower, upper, false, query.until !== undefined)

    const events = await requestToPromise<BabyEvent[]>(index.getAll(range))
    await transactionDone(tx)
    // Newest first: the timeline and every "last feed" lookup want it that way.
    return events.sort((a, b) => b.startedAt - a.startedAt)
  }

  async addEvent(babyId: Id, event: NewEvent): Promise<BabyEvent> {
    const timestamp = this.now()
    const stored = {
      ...event,
      id: this.generateId(),
      babyId,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as BabyEvent

    const db = await this.db()
    const tx = db.transaction(STORE_EVENTS, 'readwrite')
    tx.objectStore(STORE_EVENTS).put(stored)
    await transactionDone(tx)
    return stored
  }

  async updateEvent(id: Id, patch: Partial<BabyEvent>): Promise<BabyEvent> {
    const db = await this.db()
    const tx = db.transaction(STORE_EVENTS, 'readwrite')
    const store = tx.objectStore(STORE_EVENTS)
    const existing = await requestToPromise<BabyEvent | undefined>(store.get(id))
    if (existing === undefined) {
      tx.abort()
      throw new Error(`No event with id ${id}`)
    }
    // Identity and creation time are never patchable, whatever the caller sends.
    const updated = {
      ...existing,
      ...patch,
      id: existing.id,
      babyId: existing.babyId,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    } as BabyEvent
    store.put(updated)
    await transactionDone(tx)
    return updated
  }

  async deleteEvent(id: Id): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(STORE_EVENTS, 'readwrite')
    tx.objectStore(STORE_EVENTS).delete(id)
    await transactionDone(tx)
  }

  async listReminders(babyId: Id): Promise<Reminder[]> {
    const db = await this.db()
    const tx = db.transaction(STORE_REMINDERS, 'readonly')
    const index = tx.objectStore(STORE_REMINDERS).index('babyId')
    const reminders = await requestToPromise<Reminder[]>(index.getAll(babyId))
    await transactionDone(tx)
    return reminders.sort((a, b) => a.createdAt - b.createdAt)
  }

  async addReminder(babyId: Id, reminder: NewReminder): Promise<Reminder> {
    const timestamp = this.now()
    const stored: Reminder = {
      ...reminder,
      id: this.generateId(),
      babyId,
      lastDoneAt: reminder.lastDoneAt ?? null,
      lastAlertedAt: null,
      snoozedUntil: reminder.snoozedUntil ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const db = await this.db()
    const tx = db.transaction(STORE_REMINDERS, 'readwrite')
    tx.objectStore(STORE_REMINDERS).put(stored)
    await transactionDone(tx)
    return stored
  }

  async updateReminder(id: Id, patch: Partial<Reminder>): Promise<Reminder> {
    const db = await this.db()
    const tx = db.transaction(STORE_REMINDERS, 'readwrite')
    const store = tx.objectStore(STORE_REMINDERS)
    const existing = await requestToPromise<Reminder | undefined>(store.get(id))
    if (existing === undefined) {
      tx.abort()
      throw new Error(`No reminder with id ${id}`)
    }
    const updated: Reminder = {
      ...existing,
      ...patch,
      id: existing.id,
      babyId: existing.babyId,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    }
    store.put(updated)
    await transactionDone(tx)
    return updated
  }

  async deleteReminder(id: Id): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(STORE_REMINDERS, 'readwrite')
    tx.objectStore(STORE_REMINDERS).delete(id)
    await transactionDone(tx)
  }

  async listStash(babyId: Id): Promise<StashEntry[]> {
    const db = await this.db()
    const tx = db.transaction(STORE_STASH, 'readonly')
    const index = tx.objectStore(STORE_STASH).index('babyId')
    const entries = await requestToPromise<StashEntry[]>(index.getAll(babyId))
    await transactionDone(tx)
    return entries.sort((a, b) => a.expressedAt - b.expressedAt)
  }

  async addStash(babyId: Id, entry: NewStashEntry): Promise<StashEntry> {
    if (!isValidStashAmount(entry.amountMl)) {
      throw new Error('A stash entry needs an amount')
    }
    const timestamp = this.now()
    const stored: StashEntry = {
      ...entry,
      id: this.generateId(),
      babyId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const db = await this.db()
    const tx = db.transaction(STORE_STASH, 'readwrite')
    tx.objectStore(STORE_STASH).put(stored)
    await transactionDone(tx)
    return stored
  }

  async updateStash(id: Id, patch: Partial<StashEntry>): Promise<StashEntry> {
    const db = await this.db()
    const tx = db.transaction(STORE_STASH, 'readwrite')
    const store = tx.objectStore(STORE_STASH)
    const existing = await requestToPromise<StashEntry | undefined>(store.get(id))
    if (existing === undefined) {
      tx.abort()
      throw new Error(`No stash entry with id ${id}`)
    }
    const updated: StashEntry = {
      ...existing,
      ...patch,
      id: existing.id,
      babyId: existing.babyId,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    }
    store.put(updated)
    await transactionDone(tx)
    return updated
  }

  async deleteStash(id: Id): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(STORE_STASH, 'readwrite')
    tx.objectStore(STORE_STASH).delete(id)
    await transactionDone(tx)
  }

  async getPhoto(id: Id): Promise<StoredPhoto | null> {
    const db = await this.db()
    const tx = db.transaction(STORE_PHOTOS, 'readonly')
    const photo = await requestToPromise<StoredPhoto | undefined>(
      tx.objectStore(STORE_PHOTOS).get(id),
    )
    await transactionDone(tx)
    return photo ?? null
  }

  async addPhoto(babyId: Id, photo: NewPhoto): Promise<StoredPhoto> {
    const stored: StoredPhoto = {
      ...photo,
      id: this.generateId(),
      babyId,
      createdAt: this.now(),
    }
    const db = await this.db()
    const tx = db.transaction(STORE_PHOTOS, 'readwrite')
    tx.objectStore(STORE_PHOTOS).put(stored)
    await transactionDone(tx)
    return stored
  }

  async deletePhoto(id: Id): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(STORE_PHOTOS, 'readwrite')
    tx.objectStore(STORE_PHOTOS).delete(id)
    await transactionDone(tx)
  }

  async exportAll(): Promise<ExportBundle> {
    const [babies, events, reminders, stash, photos] = await Promise.all([
      this.readAll<Baby>(STORE_BABIES),
      this.readAll<BabyEvent>(STORE_EVENTS),
      this.readAll<Reminder>(STORE_REMINDERS),
      this.readAll<StashEntry>(STORE_STASH),
      this.readAll<StoredPhoto>(STORE_PHOTOS),
    ])
    return {
      format: 'baby-tracker-export',
      version: 1,
      exportedAt: this.now(),
      babies,
      events: events.sort((a, b) => a.startedAt - b.startedAt),
      reminders,
      stash,
      photos,
    }
  }

  async importBundle(bundle: unknown): Promise<ImportResult> {
    if (typeof bundle !== 'object' || bundle === null) {
      throw new Error('That file does not look like a Baby Tracker export')
    }
    const candidate = bundle as Partial<ExportBundle>
    if (candidate.format !== 'baby-tracker-export') {
      throw new Error('That file does not look like a Baby Tracker export')
    }
    if (candidate.version !== 1) {
      throw new Error(
        `This export was written by a newer version (v${String(candidate.version)}). Please update the app first.`,
      )
    }

    const rawBabies = Array.isArray(candidate.babies) ? candidate.babies : []
    const rawEvents = Array.isArray(candidate.events) ? candidate.events : []
    // Absent from every export written before these features, which must still
    // import.
    const rawReminders = Array.isArray(candidate.reminders) ? candidate.reminders : []
    const rawStash = Array.isArray(candidate.stash) ? candidate.stash : []
    const rawPhotos = Array.isArray(candidate.photos) ? candidate.photos : []

    const babies = rawBabies.map(parseBaby).filter((b): b is Baby => b !== null)
    const events = rawEvents.map(parseEvent).filter((e): e is BabyEvent => e !== null)
    const reminders = rawReminders
      .map(parseReminder)
      .filter((r): r is Reminder => r !== null)
    const stash = rawStash
      .map(parseStashEntry)
      .filter((entry): entry is StashEntry => entry !== null)
    const photos = rawPhotos
      .map(parsePhoto)
      .filter((photo): photo is StoredPhoto => photo !== null)

    // An event whose baby is in neither the file nor the store would be
    // invisible in the UI forever, so it is dropped rather than silently kept.
    const existingIds = new Set((await this.listBabies()).map((b) => b.id))
    for (const baby of babies) existingIds.add(baby.id)
    const importable = events.filter((event) => existingIds.has(event.babyId))
    const importableReminders = reminders.filter((r) => existingIds.has(r.babyId))
    const importableStash = stash.filter((entry) => existingIds.has(entry.babyId))
    const importablePhotos = photos.filter((photo) => existingIds.has(photo.babyId))

    const db = await this.db()
    const tx = db.transaction(
      [STORE_BABIES, STORE_EVENTS, STORE_REMINDERS, STORE_STASH, STORE_PHOTOS],
      'readwrite',
    )
    const babyStore = tx.objectStore(STORE_BABIES)
    const eventStore = tx.objectStore(STORE_EVENTS)
    const reminderStore = tx.objectStore(STORE_REMINDERS)
    const stashStore = tx.objectStore(STORE_STASH)
    for (const baby of babies) babyStore.put(baby)
    // put() by id makes import idempotent: importing the same file twice
    // overwrites rather than duplicating.
    for (const event of importable) eventStore.put(event)
    for (const reminder of importableReminders) reminderStore.put(reminder)
    for (const entry of importableStash) stashStore.put(entry)
    for (const photo of importablePhotos) tx.objectStore(STORE_PHOTOS).put(photo)
    await transactionDone(tx)

    const skipped: ImportResult['skipped'] = []
    if (rawBabies.length > babies.length) {
      skipped.push({
        reason: 'malformed baby records',
        count: rawBabies.length - babies.length,
      })
    }
    if (rawEvents.length > events.length) {
      skipped.push({
        reason: 'malformed events',
        count: rawEvents.length - events.length,
      })
    }
    if (events.length > importable.length) {
      skipped.push({
        reason: 'events referring to an unknown baby',
        count: events.length - importable.length,
      })
    }
    if (rawReminders.length > importableReminders.length) {
      skipped.push({
        reason: 'malformed or orphaned reminders',
        count: rawReminders.length - importableReminders.length,
      })
    }
    if (rawStash.length > importableStash.length) {
      skipped.push({
        reason: 'malformed or orphaned stash entries',
        count: rawStash.length - importableStash.length,
      })
    }
    if (rawPhotos.length > importablePhotos.length) {
      skipped.push({
        reason: 'malformed or orphaned photos',
        count: rawPhotos.length - importablePhotos.length,
      })
    }

    return {
      babiesImported: babies.length,
      eventsImported: importable.length,
      remindersImported: importableReminders.length,
      stashImported: importableStash.length,
      photosImported: importablePhotos.length,
      skipped,
    }
  }

  async clearAll(): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(
      [STORE_BABIES, STORE_EVENTS, STORE_REMINDERS, STORE_STASH, STORE_PHOTOS],
      'readwrite',
    )
    tx.objectStore(STORE_BABIES).clear()
    tx.objectStore(STORE_EVENTS).clear()
    tx.objectStore(STORE_REMINDERS).clear()
    tx.objectStore(STORE_STASH).clear()
    // Photos too. "Delete everything" that leaves a child's photographs on the
    // device would be the most serious broken promise in the app.
    tx.objectStore(STORE_PHOTOS).clear()
    await transactionDone(tx)
  }
}
