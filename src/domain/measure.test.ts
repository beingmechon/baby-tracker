import { describe, expect, it } from 'vitest'
import {
  fromCanonical,
  fromWhoUnits,
  gramsToPoundsOunces,
  inchesToMm,
  mmToInches,
  poundsOuncesToGrams,
  toCanonical,
  toWhoUnits,
  unitFor,
} from './measure'

describe('pounds and ounces', () => {
  it('splits grams the way a scale is read aloud', () => {
    // 3.5 kg is the classic "7 lb 11 oz".
    expect(gramsToPoundsOunces(3500)).toEqual({ pounds: 7, ounces: 11 })
    expect(gramsToPoundsOunces(453.59237)).toEqual({ pounds: 1, ounces: 0 })
  })

  it('carries into the next pound rather than showing 16 oz', () => {
    // 15.6 oz must read as 1 lb 0 oz, not 0 lb 16 oz.
    const justUnderAPound = 15.6 * (453.59237 / 16)
    expect(gramsToPoundsOunces(justUnderAPound)).toEqual({ pounds: 1, ounces: 0 })
  })

  it('round-trips through grams', () => {
    for (const pounds of [0, 6, 7, 14, 30]) {
      for (const ounces of [0, 1, 7, 15]) {
        const grams = poundsOuncesToGrams(pounds, ounces)
        expect(gramsToPoundsOunces(grams)).toEqual({ pounds, ounces })
      }
    }
  })
})

describe('length', () => {
  it('uses the defined inch, rounded to whole millimetres on the way in', () => {
    expect(inchesToMm(20)).toBe(508)
    expect(mmToInches(254)).toBeCloseTo(10, 9)
    // Canonical storage is whole millimetres, so a fractional inch rounds — at
    // worst half a millimetre, finer than any tape a parent owns.
    expect(inchesToMm(1)).toBe(25)
  })
})

describe('canonical conversion', () => {
  it('stores metric weight as whole grams', () => {
    expect(toCanonical(6.4, 'weight', 'metric')).toBe(6400)
    expect(toCanonical(3.125, 'weight', 'metric')).toBe(3125)
  })

  it('stores metric length as whole millimetres', () => {
    expect(toCanonical(62.5, 'length', 'metric')).toBe(625)
    expect(toCanonical(41.2, 'head', 'metric')).toBe(412)
  })

  it('stores imperial input as the same canonical units', () => {
    expect(toCanonical(14, 'weight', 'imperial')).toBe(6350)
    expect(toCanonical(24, 'length', 'imperial')).toBe(610)
  })

  it('round-trips a metric value the parent typed', () => {
    for (const kg of [2.5, 3.46, 6.4, 10.05]) {
      const canonical = toCanonical(kg, 'weight', 'metric')
      expect(fromCanonical(canonical, 'weight', 'metric')).toBeCloseTo(kg, 3)
    }
    for (const cm of [49.1, 62.5, 75.8]) {
      const canonical = toCanonical(cm, 'length', 'metric')
      expect(fromCanonical(canonical, 'length', 'metric')).toBeCloseTo(cm, 1)
    }
  })

  it('round-trips an imperial value within the precision of the field', () => {
    for (const inches of [19.5, 24.1, 30.7]) {
      const canonical = toCanonical(inches, 'length', 'imperial')
      expect(fromCanonical(canonical, 'length', 'imperial')).toBeCloseTo(inches, 1)
    }
  })
})

describe('WHO units', () => {
  it('converts canonical storage to the kilograms and centimetres the tables use', () => {
    expect(toWhoUnits(3346, 'weight')).toBeCloseTo(3.346, 6)
    expect(toWhoUnits(491, 'length')).toBeCloseTo(49.1, 6)
    expect(toWhoUnits(350, 'head')).toBeCloseTo(35, 6)
  })

  it('inverts back to canonical', () => {
    expect(fromWhoUnits(3.3464, 'weight')).toBe(3346)
    expect(fromWhoUnits(49.1477, 'length')).toBe(491)
  })
})

describe('unitFor', () => {
  it('names the unit a parent expects for their system', () => {
    expect(unitFor('weight', 'metric')).toBe('kg')
    expect(unitFor('weight', 'imperial')).toBe('lb')
    expect(unitFor('length', 'metric')).toBe('cm')
    expect(unitFor('head', 'imperial')).toBe('in')
  })
})
