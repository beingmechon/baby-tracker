/**
 * A minimal promise wrapper over IndexedDB.
 *
 * Hand-rolled rather than pulled from a library: the surface the app needs is
 * small, and a dependency-light core keeps the audit story for a privacy app
 * short enough that someone can actually read it.
 */

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export const DB_NAME = 'baby-tracker'
export const DB_VERSION = 2
export const STORE_BABIES = 'babies'
export const STORE_EVENTS = 'events'
export const STORE_REMINDERS = 'reminders'

/**
 * Opens the database, running migrations as needed.
 *
 * Each schema change adds a new `if (oldVersion < n)` block and bumps
 * DB_VERSION; blocks are never edited in place, because a user's device may be
 * upgrading from any earlier version.
 */
export function openDatabase(name = DB_NAME, version = DB_VERSION): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion

      if (oldVersion < 1) {
        db.createObjectStore(STORE_BABIES, { keyPath: 'id' })
        const events = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' })
        // The timeline and every summary read one baby's events in time order,
        // so that compound index carries essentially all query load.
        events.createIndex('babyId_startedAt', ['babyId', 'startedAt'])
        events.createIndex('babyId', 'babyId')
      }

      if (oldVersion < 2) {
        // Reminders, added in v0.2. A handful of rows per baby, always read as a
        // whole set, so `babyId` is the only index worth carrying.
        const reminders = db.createObjectStore(STORE_REMINDERS, { keyPath: 'id' })
        reminders.createIndex('babyId', 'babyId')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open the local database'))
    request.onblocked = () =>
      reject(new Error('The database is blocked by another open tab'))
  })
}
