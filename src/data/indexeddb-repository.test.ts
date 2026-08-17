import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MINUTE_MS } from '@/domain/time'
import type { BabyEvent, SleepEvent } from '@/domain/types'
import { at } from '@/test/factories'
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

describe('clearAll', () => {
  it('removes every baby and every event', async () => {
    const baby = await seedBaby()
    await repo.addEvent(baby.id, { type: 'diaper', kind: 'wet', startedAt: clock })

    await repo.clearAll()

    await expect(repo.listBabies()).resolves.toHaveLength(0)
    await expect(repo.listEvents(baby.id)).resolves.toHaveLength(0)
  })
})
