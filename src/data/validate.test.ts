import { describe, expect, it } from 'vitest'
import { parseBaby, parseEvent } from './validate'

const validBase = { id: 'e1', babyId: 'b1', startedAt: 1000 }

describe('parseBaby', () => {
  it('accepts a well-formed baby', () => {
    expect(
      parseBaby({
        id: 'b1',
        name: 'Mira',
        birthDate: '2026-01-01',
        sex: 'female',
        createdAt: 5,
      }),
    ).toEqual({
      id: 'b1',
      name: 'Mira',
      birthDate: '2026-01-01',
      sex: 'female',
      createdAt: 5,
    })
  })

  it('imports a baby exported before growth tracking existed', () => {
    // No `sex` key at all. It must import, with percentiles simply unavailable
    // until the parent fills it in — not fail, and not be guessed.
    const baby = parseBaby({ id: 'b1', name: 'Mira', createdAt: 5 })
    expect(baby).not.toBeNull()
    expect(baby!.sex).toBeNull()
  })

  it('drops a sex that is not one of the two WHO reference sets', () => {
    expect(parseBaby({ id: 'b1', name: 'Mira', sex: 'unknown' })?.sex).toBeNull()
    expect(parseBaby({ id: 'b1', name: 'Mira', sex: 3 })?.sex).toBeNull()
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

  describe('symptom', () => {
    it('accepts a named symptom with an impression', () => {
      expect(
        parseEvent({
          ...validBase,
          type: 'symptom',
          name: 'Cough',
          impression: 'moderate',
        }),
      ).toMatchObject({ type: 'symptom', name: 'Cough', impression: 'moderate' })
    })

    it('rejects an unnamed symptom, which is not an observation', () => {
      expect(
        parseEvent({ ...validBase, type: 'symptom', impression: 'mild' }),
      ).toBeNull()
    })

    it('rejects an impression it does not know how to name', () => {
      expect(
        parseEvent({
          ...validBase,
          type: 'symptom',
          name: 'Cough',
          impression: 'catastrophic',
        }),
      ).toBeNull()
    })
  })

  describe('visit', () => {
    it('accepts a visit with its questions', () => {
      expect(
        parseEvent({
          ...validBase,
          type: 'visit',
          reason: '8-week check',
          who: 'Dr Rao',
          questions: [{ text: 'Vitamin D?', asked: true }],
        }),
      ).toMatchObject({
        type: 'visit',
        reason: '8-week check',
        who: 'Dr Rao',
        questions: [{ text: 'Vitamin D?', asked: true }],
      })
    })

    it('rejects a visit with no reason', () => {
      expect(parseEvent({ ...validBase, type: 'visit', who: 'Dr Rao' })).toBeNull()
    })

    it('treats a missing questions list as no questions', () => {
      expect(
        parseEvent({ ...validBase, type: 'visit', reason: 'Check' }),
      ).toMatchObject({ questions: [] })
      expect(
        parseEvent({ ...validBase, type: 'visit', reason: 'Check', questions: 'no' }),
      ).toMatchObject({ questions: [] })
    })

    it('drops a malformed question rather than the whole visit', () => {
      const parsed = parseEvent({
        ...validBase,
        type: 'visit',
        reason: 'Check',
        questions: [{ text: 'Real one' }, { asked: true }, 'not an object', null],
      })
      expect(parsed).toMatchObject({ questions: [{ text: 'Real one', asked: false }] })
    })

    it('caps the questions list from a hand-edited file', () => {
      // An unbounded array from an untrusted file is an unbounded render.
      const parsed = parseEvent({
        ...validBase,
        type: 'visit',
        reason: 'Check',
        questions: Array.from({ length: 500 }, (_, i) => ({ text: `q${i}` })),
      })
      expect(parsed as { questions: unknown[] }).toMatchObject({
        questions: expect.any(Array),
      })
      expect((parsed as { questions: unknown[] }).questions.length).toBe(50)
    })

    it('accepts a visit in the future, which is the point of one', () => {
      const parsed = parseEvent({
        ...validBase,
        startedAt: 4_000_000_000_000,
        type: 'visit',
        reason: 'Vaccinations',
      })
      expect(parsed).not.toBeNull()
    })
  })

  describe('growth', () => {
    it('accepts each measurement kind', () => {
      for (const measure of ['weight', 'length', 'head']) {
        expect(
          parseEvent({ ...validBase, type: 'growth', measure, value: 4500 }),
        ).toMatchObject({ measure, value: 4500 })
      }
    })

    it('rejects an unknown measurement', () => {
      expect(
        parseEvent({ ...validBase, type: 'growth', measure: 'shoe_size', value: 3 }),
      ).toBeNull()
    })

    it('rejects a zero or negative measurement', () => {
      // Not merely implausible: it makes the z-score NaN, which would then
      // propagate silently into the chart.
      expect(
        parseEvent({ ...validBase, type: 'growth', measure: 'weight', value: 0 }),
      ).toBeNull()
      expect(
        parseEvent({ ...validBase, type: 'growth', measure: 'weight', value: -100 }),
      ).toBeNull()
    })

    it('rejects a missing or non-numeric value', () => {
      expect(parseEvent({ ...validBase, type: 'growth', measure: 'weight' })).toBeNull()
      expect(
        parseEvent({ ...validBase, type: 'growth', measure: 'weight', value: '4500' }),
      ).toBeNull()
      expect(
        parseEvent({ ...validBase, type: 'growth', measure: 'weight', value: NaN }),
      ).toBeNull()
    })
  })
})
