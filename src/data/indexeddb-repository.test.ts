import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS } from '@/domain/time'
import type { BabyEvent, SleepEvent } from '@/domain/types'
import { at } from '@/test/factories'
import { STORE_BABIES, transactionDone } from './idb'
import { IndexedDbRepository } from './indexeddb-repository'

/**
 * Each test gets its own database name so the suite can run in any order
 * without cross-contamination.
 */
let counter = 0
let repo: IndexedDbRepository
let clock = at(2026, 1, 15, 12, 0)

beforeEach(() => {
  counter += 1
  clock = at(2026, 1, 15, 12, 0)
  let ids = 0
  repo = new IndexedDbRepository({
    databaseName: `test-db-${counter}`,
    now: () => clock,
    generateId: () => {
      ids += 1
      return `id-${ids}`
    },
  })
})

afterEach(async () => {
  await repo.close()
})

async function seedBaby(name = 'Mira') {
  return repo.createBaby({ name, birthDate: '2026-01-01' })
}

describe('babies', () => {
  it('creates and lists a baby', async () => {
    const baby = await seedBaby()
    expect(baby.name).toBe('Mira')
    expect(baby.createdAt).toBe(clock)
    await expect(repo.listBabies()).resolves.toHaveLength(1)
  })

  it('trims the name and rejects an empty one', async () => {
    const baby = await repo.createBaby({ name: '  Mira  ', birthDate: null })
    expect(baby.name).toBe('Mira')
    await expect(repo.createBaby({ name: '   ', birthDate: null })).rejects.toThrow(
      /needs a name/,
    )
  })

  it('updates a baby without changing its identity', async () => {
    const baby = await seedBaby()
    const updated = await repo.updateBaby(baby.id, { name: 'Mira Rose' })
    expect(updated.id).toBe(baby.id)
    expect(updated.name).toBe('Mira Rose')
    expect(updated.createdAt).toBe(baby.createdAt)
  })

  it('rejects an update to a baby that does not exist', async () => {
    await expect(repo.updateBaby('nope', { name: 'x' })).rejects.toThrow(/No baby/)
  })

  it('cascades a delete to that baby’s events', async () => {
    const baby = await seedBaby()
    const other = await repo.createBaby({ name: 'Twin', birthDate: null })
    await repo.addEvent(baby.id, { type: 'diaper', kind: 'wet', startedAt: clock })
    await repo.addEvent(other.id, { type: 'diaper', kind: 'wet', startedAt: clock })

    await repo.deleteBaby(baby.id)

    await expect(repo.listEvents(baby.id)).resolves.toHaveLength(0)
    // The sibling's data must survive untouched.
    await expect(repo.listEvents(other.id)).resolves.toHaveLength(1)
  })
})

describe('events', () => {
  it('stamps identity and audit timestamps on add', async () => {
    const baby = await seedBaby()
    const event = await repo.addEvent(baby.id, {
      type: 'bottle',
      contents: 'formula',
      amountMl: 120,
      startedAt: clock,
    })
    expect(event.id).toBeTruthy()
    expect(event.babyId).toBe(baby.id)
    expect(event.createdAt).toBe(clock)
    expect(event.updatedAt).toBe(clock)
  })

  it('returns events newest first', async () => {
    const baby = await seedBaby()
    await repo.addEvent(baby.id, {
      type: 'diaper',
      kind: 'wet',
      startedAt: at(2026, 1, 15, 8, 0),
    })
    await repo.addEvent(baby.id, {
      type: 'diaper',
      kind: 'dirty',
      startedAt: at(2026, 1, 15, 11, 0),
    })

    const events = await repo.listEvents(baby.id)
    expect(events.map((e) => e.startedAt)).toEqual([
      at(2026, 1, 15, 11, 0),
      at(2026, 1, 15, 8, 0),
    ])
  })

  it('scopes a query to one baby', async () => {
    const baby = await seedBaby()
    const other = await repo.createBaby({ name: 'Twin', birthDate: null })
    await repo.addEvent(baby.id, { type: 'diaper', kind: 'wet', startedAt: clock })
    await repo.addEvent(other.id, { type: 'diaper', kind: 'dirty', startedAt: clock })

    const events = await repo.listEvents(baby.id)
    expect(events).toHaveLength(1)
    expect(events[0]?.babyId).toBe(baby.id)
  })

  it('filters by a time range, with an exclusive upper bound', async () => {
    const baby = await seedBaby()
    for (const hour of [8, 10, 12]) {
      await repo.addEvent(baby.id, {
        type: 'diaper',
        kind: 'wet',
        startedAt: at(2026, 1, 15, hour, 0),
      })
    }

    const events = await repo.listEvents(baby.id, {
      since: at(2026, 1, 15, 10, 0),
      until: at(2026, 1, 15, 12, 0),
    })
    expect(events.map((e) => e.startedAt)).toEqual([at(2026, 1, 15, 10, 0)])
  })

  it('updates an event and bumps updatedAt', async () => {
    const baby = await seedBaby()
    const event = await repo.addEvent(baby.id, {
      type: 'sleep',
      kind: 'nap',
      startedAt: at(2026, 1, 15, 11, 0),
      endedAt: null,
    })

    clock += 30 * MINUTE_MS
    const ended = (await repo.updateEvent(event.id, { endedAt: clock })) as SleepEvent
    expect(ended.endedAt).toBe(clock)
    expect(ended.updatedAt).toBe(clock)
    expect(ended.createdAt).toBe(event.createdAt)
  })

  it('refuses to let a patch rewrite identity or ownership', async () => {
    const baby = await seedBaby()
    const other = await repo.createBaby({ name: 'Twin', birthDate: null })
    const event = await repo.addEvent(baby.id, {
      type: 'diaper',
      kind: 'wet',
      startedAt: clock,
    })

    const patched = await repo.updateEvent(event.id, {
      id: 'hacked',
      babyId: other.id,
      createdAt: 0,
    } as Partial<BabyEvent>)

    expect(patched.id).toBe(event.id)
    expect(patched.babyId).toBe(baby.id)
    expect(patched.createdAt).toBe(event.createdAt)
  })

  it('rejects an update to an event that does not exist', async () => {
    await expect(repo.updateEvent('nope', { note: 'x' })).rejects.toThrow(/No event/)
  })

  it('deletes an event', async () => {
    const baby = await seedBaby()
    const event = await repo.addEvent(baby.id, {
      type: 'diaper',
      kind: 'wet',
      startedAt: clock,
    })
    await repo.deleteEvent(event.id)
    await expect(repo.listEvents(baby.id)).resolves.toHaveLength(0)
  })
})

describe('export and import', () => {
  async function seedSomeData() {
    const baby = await seedBaby()
    await repo.addEvent(baby.id, {
      type: 'nursing',
      side: 'left',
      durationMs: 15 * MINUTE_MS,
      startedAt: at(2026, 1, 15, 9, 0),
    })
    await repo.addEvent(baby.id, {
      type: 'bottle',
      contents: 'formula',
      amountMl: 120,
      startedAt: at(2026, 1, 15, 13, 0),
    })
    return baby
  }

  it('exports a versioned bundle with events oldest first', async () => {
    await seedSomeData()
    const bundle = await repo.exportAll()

    expect(bundle.format).toBe('baby-tracker-export')
    expect(bundle.version).toBe(1)
    expect(bundle.babies).toHaveLength(1)
    expect(bundle.events).toHaveLength(2)
    expect(bundle.events[0]?.startedAt).toBeLessThan(bundle.events[1]?.startedAt ?? 0)
  })

  it('round-trips a full export through a clean database', async () => {
    await seedSomeData()
    const bundle = await repo.exportAll()

    const fresh = new IndexedDbRepository({ databaseName: `restore-${counter}` })
    try {
      const result = await fresh.importBundle(JSON.parse(JSON.stringify(bundle)))
      expect(result.babiesImported).toBe(1)
      expect(result.eventsImported).toBe(2)

      const babies = await fresh.listBabies()
      expect(babies[0]?.name).toBe('Mira')
      await expect(fresh.listEvents(babies[0]?.id ?? '')).resolves.toHaveLength(2)
    } finally {
      await fresh.close()
    }
  })

  it('is idempotent — importing the same file twice does not duplicate', async () => {
    const baby = await seedSomeData()
    const bundle = await repo.exportAll()

    await repo.importBundle(bundle)
    await repo.importBundle(bundle)

    await expect(repo.listEvents(baby.id)).resolves.toHaveLength(2)
    await expect(repo.listBabies()).resolves.toHaveLength(1)
  })

  it('rejects a file that is not one of our exports', async () => {
    await expect(repo.importBundle({ hello: 'world' })).rejects.toThrow(/does not look/)
    await expect(repo.importBundle(null)).rejects.toThrow(/does not look/)
  })

  it('refuses an export from a future version rather than guessing', async () => {
    await expect(
      repo.importBundle({ format: 'baby-tracker-export', version: 99 }),
    ).rejects.toThrow(/newer version/)
  })

  it('skips malformed records and reports what it dropped', async () => {
    const baby = await seedBaby()
    const result = await repo.importBundle({
      format: 'baby-tracker-export',
      version: 1,
      babies: [{ id: 'ok', name: 'Fine', birthDate: null, createdAt: 1 }, { name: 'no id' }],
      events: [
        { id: 'e1', babyId: baby.id, type: 'diaper', kind: 'wet', startedAt: 1 },
        { id: 'e2', babyId: baby.id, type: 'diaper', kind: 'purple', startedAt: 1 },
        { id: 'e3', babyId: 'ghost-baby', type: 'diaper', kind: 'wet', startedAt: 1 },
      ],
    })

    expect(result.babiesImported).toBe(1)
    expect(result.eventsImported).toBe(1)
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        { reason: 'malformed baby records', count: 1 },
        { reason: 'malformed events', count: 1 },
        { reason: 'events referring to an unknown baby', count: 1 },
      ]),
    )
  })

  it('tolerates a bundle with no arrays at all', async () => {
    const result = await repo.importBundle({
      format: 'baby-tracker-export',
      version: 1,
    })
    expect(result).toMatchObject({ babiesImported: 0, eventsImported: 0 })
  })
})


describe('reminders', () => {
  it('stamps identity and starts every state timestamp at null', async () => {
    const baby = await seedBaby()
    const reminder = await repo.addReminder(baby.id, {
      kind: 'feed',
      label: '',
      intervalMs: 3 * HOUR_MS,
      enabled: true,
    })
    expect(reminder).toMatchObject({
      babyId: baby.id,
      kind: 'feed',
      lastDoneAt: null,
      lastAlertedAt: null,
      snoozedUntil: null,
      createdAt: clock,
    })
  })

  it('accepts an anchor so a reminder can be due when the parent asked', async () => {
    // The sheet's "first reminder at 6pm" arrives with the creation rather than as a
    // second write, so a reminder is never briefly on the wrong schedule.
    const baby = await seedBaby()
    const reminder = await repo.addReminder(baby.id, {
      kind: 'custom',
      label: 'Iron drops',
      intervalMs: 100 * MINUTE_MS,
      enabled: true,
      lastDoneAt: clock - 40 * MINUTE_MS,
    })
    expect(reminder.lastDoneAt).toBe(clock - 40 * MINUTE_MS)
    expect(reminder.snoozedUntil).toBeNull()
    expect(reminder.lastAlertedAt).toBeNull()
  })

  it('scopes the list to one baby, oldest first', async () => {
    const mira = await seedBaby('Mira')
    const arun = await seedBaby('Arun')
    await repo.addReminder(mira.id, {
      kind: 'feed',
      label: '',
      intervalMs: 3 * HOUR_MS,
      enabled: true,
    })
    clock += MINUTE_MS
    await repo.addReminder(mira.id, {
      kind: 'custom',
      label: 'Vitamin D',
      intervalMs: 24 * HOUR_MS,
      enabled: true,
    })
    await repo.addReminder(arun.id, {
      kind: 'pumping',
      label: '',
      intervalMs: 3 * HOUR_MS,
      enabled: true,
    })

    const forMira = await repo.listReminders(mira.id)
    expect(forMira.map((r) => r.kind)).toEqual(['feed', 'custom'])
    await expect(repo.listReminders(arun.id)).resolves.toHaveLength(1)
  })

  it('updates a reminder and bumps updatedAt without touching identity', async () => {
    const baby = await seedBaby()
    const reminder = await repo.addReminder(baby.id, {
      kind: 'custom',
      label: 'Tummy time',
      intervalMs: 4 * HOUR_MS,
      enabled: true,
    })
    clock += MINUTE_MS
    const updated = await repo.updateReminder(reminder.id, {
      enabled: false,
      snoozedUntil: clock + MINUTE_MS,
    })
    expect(updated).toMatchObject({
      id: reminder.id,
      babyId: baby.id,
      createdAt: reminder.createdAt,
      enabled: false,
      updatedAt: clock,
    })
  })

  it('rejects an update to a reminder that does not exist', async () => {
    await expect(repo.updateReminder('nope', { enabled: false })).rejects.toThrow(
      /No reminder/,
    )
  })

  it('deletes a reminder', async () => {
    const baby = await seedBaby()
    const reminder = await repo.addReminder(baby.id, {
      kind: 'diaper',
      label: '',
      intervalMs: 2 * HOUR_MS,
      enabled: true,
    })
    await repo.deleteReminder(reminder.id)
    await expect(repo.listReminders(baby.id)).resolves.toEqual([])
  })

  it('cascades a delete to that baby’s reminders', async () => {
    const baby = await seedBaby()
    await repo.addReminder(baby.id, {
      kind: 'feed',
      label: '',
      intervalMs: 3 * HOUR_MS,
      enabled: true,
    })
    await repo.deleteBaby(baby.id)
    await expect(repo.listReminders(baby.id)).resolves.toEqual([])
  })

  it('round-trips through an export', async () => {
    const baby = await seedBaby()
    await repo.addReminder(baby.id, {
      kind: 'custom',
      label: 'Vitamin D',
      intervalMs: 24 * HOUR_MS,
      enabled: true,
    })
    const bundle = await repo.exportAll()
    expect(bundle.reminders).toHaveLength(1)

    const fresh = new IndexedDbRepository({
      databaseName: `test-db-${counter}-restore`,
      now: () => clock,
    })
    try {
      const result = await fresh.importBundle(bundle)
      expect(result.remindersImported).toBe(1)
      const restored = await fresh.listReminders(baby.id)
      expect(restored[0]).toMatchObject({ label: 'Vitamin D', kind: 'custom' })
    } finally {
      await fresh.close()
    }
  })

  it('imports an export written before reminders existed', async () => {
    // Exports from v0.1 have no `reminders` key at all. They must restore every
    // baby and event rather than being refused.
    const baby = await seedBaby()
    const bundle = await repo.exportAll()
    const legacy = { ...bundle, reminders: undefined }

    const fresh = new IndexedDbRepository({
      databaseName: `test-db-${counter}-legacy`,
      now: () => clock,
    })
    try {
      const result = await fresh.importBundle(legacy)
      expect(result.babiesImported).toBe(1)
      expect(result.remindersImported).toBe(0)
      expect(result.skipped).toEqual([])
      expect((await fresh.listBabies())[0]?.name).toBe(baby.name)
    } finally {
      await fresh.close()
    }
  })

  it('drops a reminder whose interval would fire continuously', async () => {
    const baby = await seedBaby()
    const bundle = await repo.exportAll()
    const tampered = {
      ...bundle,
      reminders: [
        {
          id: 'r-bad',
          babyId: baby.id,
          kind: 'feed',
          label: '',
          intervalMs: 10,
          enabled: true,
          createdAt: clock,
          updatedAt: clock,
        },
      ],
    }

    const fresh = new IndexedDbRepository({
      databaseName: `test-db-${counter}-tampered`,
      now: () => clock,
    })
    try {
      const result = await fresh.importBundle(tampered)
      expect(result.remindersImported).toBe(0)
      expect(result.skipped).toContainEqual({
        reason: 'malformed or orphaned reminders',
        count: 1,
      })
    } finally {
      await fresh.close()
    }
  })
})

describe('the milk stash', () => {
  it('stores an entry and reads it back oldest first', async () => {
    const baby = await seedBaby()
    await repo.addStash(baby.id, {
      amountMl: 120,
      location: 'fridge',
      expressedAt: clock,
    })
    await repo.addStash(baby.id, {
      amountMl: 200,
      location: 'freezer',
      expressedAt: clock - HOUR_MS,
    })

    const entries = await repo.listStash(baby.id)
    expect(entries.map((entry) => entry.amountMl)).toEqual([200, 120])
  })

  it('refuses an entry with no milk in it', async () => {
    const baby = await seedBaby()
    await expect(
      repo.addStash(baby.id, { amountMl: 0, location: 'fridge', expressedAt: clock }),
    ).rejects.toThrow(/needs an amount/)
  })

  it('scopes the stash to one baby', async () => {
    const mira = await seedBaby('Mira')
    const arun = await seedBaby('Arun')
    await repo.addStash(mira.id, {
      amountMl: 120,
      location: 'fridge',
      expressedAt: clock,
    })
    await expect(repo.listStash(arun.id)).resolves.toEqual([])
  })

  it('updates the amount left without touching identity', async () => {
    const baby = await seedBaby()
    const entry = await repo.addStash(baby.id, {
      amountMl: 120,
      location: 'fridge',
      expressedAt: clock,
    })
    clock += MINUTE_MS
    const updated = await repo.updateStash(entry.id, { amountMl: 80 })
    expect(updated).toMatchObject({
      id: entry.id,
      babyId: baby.id,
      amountMl: 80,
      expressedAt: entry.expressedAt,
      createdAt: entry.createdAt,
      updatedAt: clock,
    })
  })

  it('cascades a delete to that baby’s stash', async () => {
    const baby = await seedBaby()
    await repo.addStash(baby.id, {
      amountMl: 120,
      location: 'fridge',
      expressedAt: clock,
    })
    await repo.deleteBaby(baby.id)
    await expect(repo.listStash(baby.id)).resolves.toEqual([])
  })

  it('round-trips through an export, keeping when it was expressed', async () => {
    const baby = await seedBaby()
    const expressedAt = clock - 6 * HOUR_MS
    await repo.addStash(baby.id, { amountMl: 150, location: 'freezer', expressedAt })
    const bundle = await repo.exportAll()

    const fresh = new IndexedDbRepository({
      databaseName: `test-db-${counter}-stash`,
      now: () => clock,
    })
    try {
      const result = await fresh.importBundle(bundle)
      expect(result.stashImported).toBe(1)
      // The age is computed from this, so a lost expressedAt would silently
      // re-date every bag to the moment of the import.
      expect((await fresh.listStash(baby.id))[0]).toMatchObject({
        amountMl: 150,
        location: 'freezer',
        expressedAt,
      })
    } finally {
      await fresh.close()
    }
  })

  it('drops an entry with no time of expression', async () => {
    const baby = await seedBaby()
    const bundle = await repo.exportAll()
    const tampered = {
      ...bundle,
      stash: [
        { id: 's1', babyId: baby.id, amountMl: 100, location: 'fridge' },
        { id: 's2', babyId: baby.id, amountMl: 100, location: 'sock drawer', expressedAt: clock },
      ],
    }

    const fresh = new IndexedDbRepository({
      databaseName: `test-db-${counter}-badstash`,
      now: () => clock,
    })
    try {
      const result = await fresh.importBundle(tampered)
      expect(result.stashImported).toBe(0)
      expect(result.skipped).toContainEqual({
        reason: 'malformed or orphaned stash entries',
        count: 2,
      })
    } finally {
      await fresh.close()
    }
  })
})

describe('schema migration', () => {
  /**
   * Builds a genuine version-1 database: the schema as v0.1 shipped it.
   *
   * Deliberately not via `openDatabase(name, 1)`. The append-only
   * `if (oldVersion < n)` blocks are not gated on the version being *requested*,
   * so opening a fresh database at version 1 runs the version-2 block too and
   * creates the very store this test needs to be absent. That is harmless in the
   * app, which only ever opens at DB_VERSION, but it makes that helper useless
   * for simulating an older client.
   */
  function openLegacyDatabase(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore('babies', { keyPath: 'id' })
        const events = db.createObjectStore('events', { keyPath: 'id' })
        events.createIndex('babyId_startedAt', ['babyId', 'startedAt'])
        events.createIndex('babyId', 'babyId')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
  }

  it('adds the reminders store to a database created before it existed', async () => {
    // The case that matters on a real phone: version 1 is already on disk with a
    // baby in it. Opening at version 2 must add the new store and keep the data.
    const name = `test-db-${counter}-migrate`
    const v1 = await openLegacyDatabase(name)
    expect([...v1.objectStoreNames]).not.toContain('reminders')
    expect([...v1.objectStoreNames]).not.toContain('stash')

    const tx = v1.transaction(STORE_BABIES, 'readwrite')
    tx.objectStore(STORE_BABIES).put({
      id: 'existing',
      name: 'Mira',
      birthDate: '2026-01-01',
      createdAt: clock,
    })
    await transactionDone(tx)
    v1.close()

    const migrated = new IndexedDbRepository({ databaseName: name, now: () => clock })
    try {
      const babies = await migrated.listBabies()
      expect(babies).toHaveLength(1)
      expect(babies[0]?.name).toBe('Mira')
      // A row written before the sex field existed reads back as "not recorded".
      expect(babies[0]?.sex).toBeNull()

      // And the new stores work, rather than merely existing.
      const reminder = await migrated.addReminder('existing', {
        kind: 'feed',
        label: '',
        intervalMs: 3 * HOUR_MS,
        enabled: true,
      })
      await expect(migrated.listReminders('existing')).resolves.toEqual([reminder])

      const entry = await migrated.addStash('existing', {
        amountMl: 120,
        location: 'fridge',
        expressedAt: clock,
      })
      await expect(migrated.listStash('existing')).resolves.toEqual([entry])
    } finally {
      await migrated.close()
    }
  })
})

describe('photos', () => {
  const PHOTO = { type: 'image/jpeg', data: 'AAAAAAAA', width: 800, height: 600 }

  it('round-trips a photo and hands back an id to point at', async () => {
    const baby = await seedBaby()
    const stored = await repo.addPhoto(baby.id, PHOTO)

    expect(stored).toMatchObject({ babyId: baby.id, ...PHOTO })
    await expect(repo.getPhoto(stored.id)).resolves.toMatchObject({ data: 'AAAAAAAA' })
  })

  it('is null for a photo that was deleted, rather than throwing', async () => {
    const baby = await seedBaby()
    const stored = await repo.addPhoto(baby.id, PHOTO)
    await repo.deletePhoto(stored.id)
    await expect(repo.getPhoto(stored.id)).resolves.toBeNull()
  })

  it('cascades a delete to that baby’s photos', async () => {
    const baby = await seedBaby()
    const other = await seedBaby('Twin')
    const mine = await repo.addPhoto(baby.id, PHOTO)
    const theirs = await repo.addPhoto(other.id, PHOTO)

    await repo.deleteBaby(baby.id)

    await expect(repo.getPhoto(mine.id)).resolves.toBeNull()
    // The sibling's keepsakes are untouched.
    await expect(repo.getPhoto(theirs.id)).resolves.not.toBeNull()
  })

  it('carries photos through an export and back', async () => {
    // A backup that silently drops the first-smile photo is not a backup.
    const baby = await seedBaby()
    const stored = await repo.addPhoto(baby.id, PHOTO)

    const bundle = await repo.exportAll()
    expect(bundle.photos).toHaveLength(1)

    await repo.clearAll()
    const result = await repo.importBundle(bundle)

    expect(result.photosImported).toBe(1)
    await expect(repo.getPhoto(stored.id)).resolves.toMatchObject({ data: 'AAAAAAAA' })
  })

  it('refuses a photo whose baby is not in the file or the store', async () => {
    const baby = await seedBaby()
    const bundle = await repo.exportAll()
    const result = await repo.importBundle({
      ...bundle,
      babies: [],
      photos: [
        {
          id: 'p1',
          babyId: 'nobody',
          type: 'image/jpeg',
          data: 'AAAA',
          width: 10,
          height: 10,
          createdAt: clock,
        },
      ],
    })
    expect(result.photosImported).toBe(0)
    expect(result.skipped.some((s) => /photos/.test(s.reason))).toBe(true)
    expect(baby.id).toBeTruthy()
  })
})

describe('clearAll', () => {
  it('removes every baby, event, reminder and stash entry', async () => {
    const baby = await seedBaby()
    await repo.addEvent(baby.id, { type: 'diaper', kind: 'wet', startedAt: clock })
    await repo.addReminder(baby.id, {
      kind: 'feed',
      label: '',
      intervalMs: 3 * HOUR_MS,
      enabled: true,
    })
    await repo.addStash(baby.id, {
      amountMl: 120,
      location: 'fridge',
      expressedAt: clock,
    })

    await repo.clearAll()

    await expect(repo.listBabies()).resolves.toHaveLength(0)
    await expect(repo.listEvents(baby.id)).resolves.toHaveLength(0)
    // The privacy promise is "delete everything", so a forgotten store here would
    // leave a reminder behind after the user asked for a wipe.
    await expect(repo.listReminders(baby.id)).resolves.toHaveLength(0)
    await expect(repo.listStash(baby.id)).resolves.toHaveLength(0)
  })

  it('removes the photos too', async () => {
    // "Delete everything" that leaves a child's photographs on the device would be
    // the most serious broken promise in the app.
    const baby = await seedBaby()
    const photo = await repo.addPhoto(baby.id, {
      type: 'image/jpeg',
      data: 'AAAA',
      width: 10,
      height: 10,
    })

    await repo.clearAll()

    await expect(repo.getPhoto(photo.id)).resolves.toBeNull()
  })
})
