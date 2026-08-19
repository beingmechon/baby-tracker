import { describe, expect, it } from 'vitest'
import { linearScale, niceTicks, padRange, polylinePath } from './chartScale'

describe('linearScale', () => {
  it('maps the domain onto the range', () => {
    const scale = linearScale([0, 10], [0, 100])
    expect(scale(0)).toBe(0)
    expect(scale(5)).toBe(50)
    expect(scale(10)).toBe(100)
  })

  it('handles an inverted range, which is how SVG y axes work', () => {
    const scale = linearScale([0, 10], [180, 20])
    expect(scale(0)).toBe(180)
    expect(scale(10)).toBe(20)
    expect(scale(5)).toBe(100)
  })

  it('does not divide by zero on a single data point', () => {
    // The first measurement a parent ever logs produces exactly this domain.
    const scale = linearScale([4, 4], [0, 100])
    expect(scale(4)).toBe(0)
    expect(Number.isNaN(scale(4))).toBe(false)
  })
})

describe('niceTicks', () => {
  it('places ticks on round multiples, not on the data bounds', () => {
    expect(niceTicks(4.35, 7.69, 4)).toEqual([5, 6, 7])
  })

  it('uses the 1-2-5 progression', () => {
    expect(niceTicks(0, 60, 4)).toEqual([0, 20, 40, 60])
    // A rough step of 6 rounds up to 10, not down to 5: fewer, rounder ticks
    // read better on a phone than more precise ones.
    expect(niceTicks(0, 24, 4)).toEqual([0, 10, 20])
    expect(niceTicks(0, 12, 4)).toEqual([0, 5, 10])
  })

  it('does not produce float noise in labels', () => {
    for (const tick of niceTicks(0, 1, 4)) {
      expect(String(tick).length).toBeLessThan(6)
    }
  })

  it('keeps a tick that lands exactly on the maximum', () => {
    expect(niceTicks(0, 10, 5)).toContain(10)
  })

  it('degenerates safely', () => {
    expect(niceTicks(5, 5)).toEqual([5])
    expect(niceTicks(NaN, 5)).toEqual([])
  })
})

describe('padRange', () => {
  it('keeps data off the frame', () => {
    const [min, max] = padRange(0, 100, 0.1)
    expect(min).toBe(-10)
    expect(max).toBe(110)
  })

  it('gives a single value a visible band', () => {
    const [min, max] = padRange(4500, 4500)
    expect(max).toBeGreaterThan(min)
  })
})

describe('polylinePath', () => {
  it('starts with a move and continues with lines', () => {
    expect(
      polylinePath([
        { x: 0, y: 10 },
        { x: 5, y: 20 },
      ]),
    ).toBe('M0.0 10.0 L5.0 20.0')
  })

  it('is empty for no points, so an empty series draws nothing', () => {
    expect(polylinePath([])).toBe('')
  })
})
