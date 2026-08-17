import { describe, expect, it } from 'vitest'
import { formatVolume, fromMl, mlToOz, ozToMl, quickAmounts, toMl } from './units'

describe('volume conversion', () => {
  it('round-trips ml through oz without drift', () => {
    expect(mlToOz(ozToMl(4))).toBeCloseTo(4, 10)
    expect(ozToMl(mlToOz(120))).toBeCloseTo(120, 10)
  })

  it('converts a typed amount into canonical ml', () => {
    expect(toMl(120, 'ml')).toBe(120)
    expect(toMl(4, 'oz')).toBeCloseTo(118.294, 3)
  })

  it('converts canonical ml back for an input field', () => {
    expect(fromMl(120, 'ml')).toBe(120)
    expect(fromMl(118.294, 'oz')).toBe(4)
  })
})

describe('formatVolume', () => {
  it('shows ml as whole numbers', () => {
    expect(formatVolume(120.4, 'ml')).toBe('120 ml')
    expect(formatVolume(0, 'ml')).toBe('0 ml')
  })

  it('shows oz to one decimal', () => {
    expect(formatVolume(100, 'oz')).toBe('3.4 oz')
  })

  it('drops a trailing .0 so a clean bottle reads plainly', () => {
    expect(formatVolume(ozToMl(4), 'oz')).toBe('4 oz')
  })
})

describe('quickAmounts', () => {
  it('offers amounts in the unit the user actually reads', () => {
    expect(quickAmounts('ml')).toContain(120)
    expect(quickAmounts('oz')).toContain(4)
  })
})
