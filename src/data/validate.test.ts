import { describe, expect, it } from 'vitest'
import { parseBaby, parseEvent } from './validate'

const validBase = { id: 'e1', babyId: 'b1', startedAt: 1000 }

describe('parseBaby', () => {
  it('accepts a well-formed baby', () => {
    expect(
      parseBaby({ id: 'b1', name: 'Mira', birthDate: '2026-01-01', createdAt: 5 }),
    ).toEqual({ id: 'b1', name: 'Mira', birthDate: '2026-01-01', createdAt: 5 })
  })

  it('requires an id and a name', () => {
    expect(parseBaby({ name: 'Mira' })).toBeNull()
    expect(parseBaby({ id: 'b1' })).toBeNull()
    expect(parseBaby({ id: 'b1', name: '' })).toBeNull()
  })

  it('drops a birth date that is not ISO YYYY-MM-DD', () => {
    expect(parseBaby({ id: 'b1', name: 'Mira', birthDate: '01/02/2026' })?.birthDate)
      .toBeNull()
  })

  it('rejects non-objects', () => {
    expect(parseBaby(null)).toBeNull()
    expect(parseBaby('baby')).toBeNull()
    expect(parseBaby([])).toBeNull()
  })
})

describe('parseEvent', () => {
  it('requires identity and a start time', () => {
    expect(parseEvent({ type: 'diaper', kind: 'wet' })).toBeNull()
    expect(parseEvent({ ...validBase, startedAt: -1, type: 'diaper', kind: 'wet' }))
      .toBeNull()
    expect(parseEvent({ ...validBase, startedAt: NaN, type: 'diaper', kind: 'wet' }))
      .toBeNull()
  })

  it('rejects an unknown event type', () => {
    expect(parseEvent({ ...validBase, type: 'teleportation' })).toBeNull()
  })

  it('defaults audit timestamps to the start time when absent', () => {
    const parsed = parseEvent({ ...validBase, type: 'diaper', kind: 'wet' })
    expect(parsed).toMatchObject({ createdAt: 1000, updatedAt: 1000 })
  })

  it('omits an absent note rather than storing an empty string', () => {
    const parsed = parseEvent({ ...validBase, type: 'diaper', kind: 'wet' })
    expect(parsed && 'note' in parsed).toBe(false)
  })

  describe('nursing', () => {
    it('accepts a valid session', () => {
      expect(
        parseEvent({ ...validBase, type: 'nursing', side: 'right', durationMs: 900_000 }),
      ).toMatchObject({ type: 'nursing', side: 'right', durationMs: 900_000 })
    })

    it('rejects an unknown side or a negative duration', () => {
      expect(
        parseEvent({ ...validBase, type: 'nursing', side: 'middle', durationMs: 1 }),
      ).toBeNull()
      expect(
        parseEvent({ ...validBase, type: 'nursing', side: 'left', durationMs: -1 }),
      ).toBeNull()
    })
  })

  describe('bottle', () => {
    it('accepts breast milk and formula', () => {
      expect(
        parseEvent({ ...validBase, type: 'bottle', contents: 'breast_milk', amountMl: 90 }),
      ).toMatchObject({ contents: 'breast_milk', amountMl: 90 })
    })

    it('rejects unknown contents or a non-numeric amount', () => {
      expect(
        parseEvent({ ...validBase, type: 'bottle', contents: 'juice', amountMl: 90 }),
      ).toBeNull()
      expect(
        parseEvent({ ...validBase, type: 'bottle', contents: 'formula', amountMl: '90' }),
      ).toBeNull()
    })
  })

  describe('sleep', () => {
    it('accepts a running sleep with a null end', () => {
      expect(
        parseEvent({ ...validBase, type: 'sleep', kind: 'nap', endedAt: null }),
      ).toMatchObject({ kind: 'nap', endedAt: null })
    })

    it('rejects an end before the start, which would poison every total', () => {
      expect(
        parseEvent({ ...validBase, type: 'sleep', kind: 'nap', endedAt: 500 }),
      ).toBeNull()
    })

    it('rejects an unknown kind', () => {
      expect(
        parseEvent({ ...validBase, type: 'sleep', kind: 'siesta', endedAt: null }),
      ).toBeNull()
    })
  })

  describe('diaper', () => {
    it('accepts each of the four kinds', () => {
      for (const kind of ['wet', 'dirty', 'mixed', 'dry']) {
        expect(parseEvent({ ...validBase, type: 'diaper', kind })).toMatchObject({ kind })
      }
    })
  })
})
