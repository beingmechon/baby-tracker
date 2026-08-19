import type { MeasureKind, MeasureSystem } from './types'

/**
 * Unit conversion for growth measurements.
 *
 * Canonical storage is grams and millimetres — see `GrowthEvent.value`. Every
 * conversion here is exact by definition (the pound and inch are *defined* in
 * terms of the kilogram and metre), so a value entered in pounds and read back
 * in pounds returns the same number.
 */

/** International avoirdupois pound, exact by definition since 1959. */
export const G_PER_LB = 453.59237
export const G_PER_OZ = G_PER_LB / 16
export const MM_PER_IN = 25.4

/** The unit a measurement is entered and displayed in, per system. */
export function unitFor(measure: MeasureKind, system: MeasureSystem): string {
  if (measure === 'weight') return system === 'imperial' ? 'lb' : 'kg'
  return system === 'imperial' ? 'in' : 'cm'
}

/**
 * Splits grams into whole pounds and remaining ounces, which is how weight is
 * spoken in the US and UK — "14 lb 3 oz", never "14.19 lb".
 */
export function gramsToPoundsOunces(grams: number): { pounds: number; ounces: number } {
  const totalOunces = Math.round(grams / G_PER_OZ)
  return {
    pounds: Math.floor(totalOunces / 16),
    // Rounding to whole ounces first is what keeps 15.6oz from displaying as
    // "0 lb 16 oz" instead of "1 lb 0 oz".
    ounces: totalOunces % 16,
  }
}

export function poundsOuncesToGrams(pounds: number, ounces: number): number {
  return Math.round((pounds * 16 + ounces) * G_PER_OZ)
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_IN
}

export function inchesToMm(inches: number): number {
  return Math.round(inches * MM_PER_IN)
}

/**
 * Converts what the user typed into canonical storage. Weight in metric is kg,
 * in imperial decimal pounds (the two-field lb/oz form calls
 * `poundsOuncesToGrams` directly); length is cm or inches.
 */
export function toCanonical(
  amount: number,
  measure: MeasureKind,
  system: MeasureSystem,
): number {
  if (measure === 'weight') {
    return Math.round(system === 'imperial' ? amount * G_PER_LB : amount * 1000)
  }
  return system === 'imperial' ? inchesToMm(amount) : Math.round(amount * 10)
}

/** Canonical value as a number in the display unit, rounded for an input field. */
export function fromCanonical(
  value: number,
  measure: MeasureKind,
  system: MeasureSystem,
): number {
  if (measure === 'weight') {
    return system === 'imperial'
      ? Math.round((value / G_PER_LB) * 100) / 100
      : Math.round((value / 1000) * 1000) / 1000
  }
  return system === 'imperial'
    ? Math.round(mmToInches(value) * 10) / 10
    : Math.round(value) / 10
}

/** Canonical grams/mm expressed in the units the WHO tables use: kg and cm. */
export function toWhoUnits(value: number, measure: MeasureKind): number {
  return measure === 'weight' ? value / 1000 : value / 10
}

/** The inverse: a WHO kg or cm figure back into canonical storage. */
export function fromWhoUnits(value: number, measure: MeasureKind): number {
  return measure === 'weight' ? Math.round(value * 1000) : Math.round(value * 10)
}

/**
 * Sensible `step` for a number input. A baby scale reads to 10g and a tape to a
 * millimetre, so the step matches the instrument rather than the unit.
 */
export function inputStep(measure: MeasureKind, system: MeasureSystem): string {
  if (measure === 'weight') return system === 'imperial' ? '0.25' : '0.01'
  return system === 'imperial' ? '0.1' : '0.1'
}
