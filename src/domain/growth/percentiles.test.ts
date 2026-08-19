import { describe, expect, it } from 'vitest'
import {
  CHART_CURVES,
  ageInMonthsExact,
  lmsAt,
  percentileFor,
  percentileFromZ,
  referenceCurve,
  referenceMaxAgeMonths,
  referenceTable,
  valueAtZ,
  zScore,
} from './percentiles'
import { WHO_WEIGHT_FOR_AGE } from './whoReference'

/**
 * The reference values below are the WHO's own published figures, not this
 * code's output. Weight-for-age percentile rows for boys at birth and at 12
 * months are widely tabulated, and matching them to a tenth of a kilogram is
 * what makes the LMS implementation trustworthy rather than merely consistent.
 */
describe('zScore against published WHO figures', () => {
  it('puts the published median at z = 0', () => {
    // WHO: median weight for a newborn boy is 3.3464 kg.
    const lms = lmsAt(WHO_WEIGHT_FOR_AGE.male, 0)
    expect(lms).not.toBeNull()
    expect(zScore(3.3464, lms!)).toBeCloseTo(0, 6)
  })

  it('reproduces the published -2SD and +2SD weights for a newborn boy', () => {
    const lms = lmsAt(WHO_WEIGHT_FOR_AGE.male, 0)!
    // WHO tables: 2.5 kg at -2SD, 4.4 kg at +2SD (both to one decimal).
    expect(valueAtZ(-2, lms)).toBeCloseTo(2.5, 1)
    expect(valueAtZ(2, lms)).toBeCloseTo(4.4, 1)
  })

  it('reproduces the published -2SD and +2SD weights for a 12-month girl', () => {
    const lms = lmsAt(WHO_WEIGHT_FOR_AGE.female, 12)!
    // WHO tables: 7.0 kg at -2SD, 11.5 kg at +2SD.
    expect(valueAtZ(-2, lms)).toBeCloseTo(7.0, 1)
    expect(valueAtZ(2, lms)).toBeCloseTo(11.5, 1)
  })

  it('is symmetric: valueAtZ and zScore invert each other', () => {
    const lms = lmsAt(WHO_WEIGHT_FOR_AGE.male, 7)!
    for (const z of [-3, -1.5, -0.4, 0, 0.4, 1.5, 3]) {
      expect(zScore(valueAtZ(z, lms), lms)).toBeCloseTo(z, 9)
    }
  })

  it('returns NaN for an impossible measurement rather than a number', () => {
    const lms = lmsAt(WHO_WEIGHT_FOR_AGE.male, 0)!
    expect(zScore(0, lms)).toBeNaN()
    expect(zScore(-1, lms)).toBeNaN()
  })
})

describe('percentileFromZ', () => {
  it('maps the standard normal landmarks', () => {
    expect(percentileFromZ(0)).toBeCloseTo(50, 6)
    expect(percentileFromZ(-1)).toBeCloseTo(15.866, 3)
    expect(percentileFromZ(1)).toBeCloseTo(84.134, 3)
    expect(percentileFromZ(-1.8808)).toBeCloseTo(3, 2)
    expect(percentileFromZ(1.8808)).toBeCloseTo(97, 2)
    expect(percentileFromZ(-1.96)).toBeCloseTo(2.5, 2)
  })

  it('is monotonic and bounded', () => {
    let previous = -1
    for (let z = -5; z <= 5; z += 0.25) {
      const percentile = percentileFromZ(z)
      expect(percentile).toBeGreaterThan(previous)
      expect(percentile).toBeGreaterThanOrEqual(0)
      expect(percentile).toBeLessThanOrEqual(100)
      previous = percentile
    }
  })

  it('agrees with the curves the chart draws', () => {
    for (const curve of CHART_CURVES) {
      expect(percentileFromZ(curve.z)).toBeCloseTo(curve.percentile, 1)
    }
  })
})

describe('lmsAt', () => {
  it('interpolates between two monthly rows', () => {
    const at3 = lmsAt(WHO_WEIGHT_FOR_AGE.male, 3)!
    const at4 = lmsAt(WHO_WEIGHT_FOR_AGE.male, 4)!
    const half = lmsAt(WHO_WEIGHT_FOR_AGE.male, 3.5)!
    expect(half.m).toBeCloseTo((at3.m + at4.m) / 2, 9)
  })

  it('refuses to extrapolate past the end of the table', () => {
    expect(lmsAt(WHO_WEIGHT_FOR_AGE.male, -0.5)).toBeNull()
    expect(lmsAt(WHO_WEIGHT_FOR_AGE.male, 61)).toBeNull()
  })

  it('returns null for an empty table rather than throwing', () => {
    expect(lmsAt([], 3)).toBeNull()
  })
})

describe('percentileFor', () => {
  it('reports a median-weight baby as roughly the 50th percentile', () => {
    // 3346 g is the median for a newborn boy, stored in canonical grams.
    const result = percentileFor({
      measure: 'weight',
      sex: 'male',
      ageMonths: 0,
      value: 3346,
    })
    expect(result).not.toBeNull()
    expect(result!.percentile).toBeCloseTo(50, 1)
  })

  it('converts canonical millimetres for length', () => {
    // WHO median length for a newborn girl is 49.1477 cm. Canonical storage is
    // whole millimetres, so 491 mm sits a fraction under the median — and at
    // birth a millimetre of length is worth about two percentile points. That
    // precision limit is inherent to integer storage and is why this asserts a
    // band rather than exactly 50.
    const result = percentileFor({
      measure: 'length',
      sex: 'female',
      ageMonths: 0,
      value: 491,
    })
    expect(result!.percentile).toBeGreaterThan(47)
    expect(result!.percentile).toBeLessThan(51)
  })

  it('distinguishes boys from girls at the same weight', () => {
    const boy = percentileFor({ measure: 'weight', sex: 'male', ageMonths: 6, value: 8000 })
    const girl = percentileFor({
      measure: 'weight',
      sex: 'female',
      ageMonths: 6,
      value: 8000,
    })
    // Girls are lighter on average, so the same weight sits higher for a girl.
    expect(girl!.percentile).toBeGreaterThan(boy!.percentile)
  })

  it('returns null for head circumference, which ships no reference', () => {
    expect(referenceTable('head', 'male')).toBeNull()
    expect(
      percentileFor({ measure: 'head', sex: 'male', ageMonths: 2, value: 400 }),
    ).toBeNull()
  })

  it('returns null past the end of a reference rather than guessing', () => {
    // Length-for-age stops at 24 months in the shipped tables.
    expect(referenceMaxAgeMonths('length', 'male')).toBe(24)
    expect(
      percentileFor({ measure: 'length', sex: 'male', ageMonths: 30, value: 900 }),
    ).toBeNull()
    expect(referenceMaxAgeMonths('weight', 'male')).toBe(60)
    expect(
      percentileFor({ measure: 'weight', sex: 'male', ageMonths: 72, value: 20000 }),
    ).toBeNull()
  })
})

describe('referenceCurve', () => {
  it('returns canonical units so it plots on the same axis as measurements', () => {
    const median = referenceCurve('weight', 'male', 0, 12)
    // Grams, not kilograms: a newborn boy's median is ~3346 g.
    expect(median[0]!.value).toBeCloseTo(3346, 0)
    expect(median[0]!.ageMonths).toBe(0)
    expect(median[median.length - 1]!.ageMonths).toBe(12)
  })

  it('samples finely enough that a three-month window reads as a curve', () => {
    const median = referenceCurve('weight', 'male', 0, 3)
    expect(median.length).toBeGreaterThan(20)
    // Monotonic: babies gain weight, and any sampling artefact would show here.
    for (let i = 1; i < median.length; i += 1) {
      expect(median[i]!.value).toBeGreaterThan(median[i - 1]!.value)
    }
  })

  it('stops at the end of the reference even when asked for more', () => {
    const beyond = referenceCurve('length', 'female', 0, 40)
    expect(beyond[beyond.length - 1]!.ageMonths).toBe(24)
  })

  it('orders the percentile curves without crossing', () => {
    const [low, mid, high] = CHART_CURVES.map((curve) =>
      referenceCurve('weight', 'female', curve.z, 24),
    )
    for (let i = 0; i < low!.length; i += 1) {
      expect(low![i]!.value).toBeLessThan(mid![i]!.value)
      expect(mid![i]!.value).toBeLessThan(high![i]!.value)
    }
  })

  it('is empty where no reference exists', () => {
    expect(referenceCurve('head', 'female', 0, 24)).toEqual([])
  })
})

describe('ageInMonthsExact', () => {
  it('is fractional, unlike the calendar-month age used for prose', () => {
    const now = new Date(2026, 1, 1).getTime()
    // 2026-01-17 to 2026-02-01 is 15 days.
    expect(ageInMonthsExact('2026-01-17', now)).toBeCloseTo(15 / 30.4375, 9)
  })

  it('is null without a birth date, because age is the whole basis of a percentile', () => {
    expect(ageInMonthsExact(null, Date.now())).toBeNull()
    expect(ageInMonthsExact('not-a-date', Date.now())).toBeNull()
  })
})
