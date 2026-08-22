import { describe, expect, it } from 'vitest'
import {
  linearScale,
  niceTicks,
  padRange,
  polarPoint,
  polylinePath,
  ringArcPath,
} from './chartScale'

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

describe('polarPoint', () => {
  const centre = { x: 100, y: 100 }

  it('starts at the top and runs clockwise, like a clock face', () => {
    // Midnight at twelve o'clock is what makes the day wheel readable.
    const midnight = polarPoint(centre, 50, 0)
    expect(midnight.x).toBeCloseTo(100, 6)
    expect(midnight.y).toBeCloseTo(50, 6)

    const sixAm = polarPoint(centre, 50, 0.25)
    expect(sixAm.x).toBeCloseTo(150, 6)
    expect(sixAm.y).toBeCloseTo(100, 6)

    const noon = polarPoint(centre, 50, 0.5)
    expect(noon.y).toBeCloseTo(150, 6)
  })

  it('comes back to the start after a full turn', () => {
    const start = polarPoint(centre, 50, 0)
    const round = polarPoint(centre, 50, 1)
    expect(round.x).toBeCloseTo(start.x, 6)
    expect(round.y).toBeCloseTo(start.y, 6)
  })
})

describe('ringArcPath', () => {
  const centre = { x: 100, y: 100 }

  it('draws a single arc for an ordinary span', () => {
    const path = ringArcPath(centre, 50, 0.25, 0.5)
    expect(path.startsWith('M')).toBe(true)
    // Under half a turn, so the small-arc flag.
    expect(path).toContain('A50 50 0 0 1')
  })

  it('sets the large-arc flag past a half turn', () => {
    expect(ringArcPath(centre, 50, 0, 0.75)).toContain('A50 50 0 1 1')
  })

  it('draws a whole day as two arcs rather than nothing', () => {
    // One `A` from a point back to itself has zero length and renders nothing,
    // which would show a baby who slept all day as one who never slept.
    const path = ringArcPath(centre, 50, 0, 1)
    expect(path.match(/A/g)).toHaveLength(2)
  })

  it('draws nothing for an empty or inverted span', () => {
    expect(ringArcPath(centre, 50, 0.5, 0.5)).toBe('')
    expect(ringArcPath(centre, 50, 0.6, 0.4)).toBe('')
  })
})
