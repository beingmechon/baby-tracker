import type { VolumeUnit } from './types'

/** US fluid ounce. Baby bottles are marked in US oz, not imperial. */
export const ML_PER_OZ = 29.5735

export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ
}

export function ozToMl(oz: number): number {
  return oz * ML_PER_OZ
}

/**
 * Round-trips a volume through the user's chosen unit for display.
 * ml shows whole numbers, oz shows one decimal — matching how bottles are
 * actually marked, so nobody reads "3.38 oz" at 3am.
 */
export function formatVolume(ml: number, unit: VolumeUnit): string {
  if (unit === 'oz') {
    const oz = mlToOz(ml)
    // Drop a trailing ".0" so a clean 4 oz reads as "4 oz".
    const rounded = Math.round(oz * 10) / 10
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} oz`
  }
  return `${Math.round(ml)} ml`
}

/** Converts a number the user typed in `unit` into canonical millilitres. */
export function toMl(amount: number, unit: VolumeUnit): number {
  return unit === 'oz' ? ozToMl(amount) : amount
}

/** Converts canonical millilitres into the user's unit for an input field. */
export function fromMl(ml: number, unit: VolumeUnit): number {
  return unit === 'oz' ? Math.round(mlToOz(ml) * 10) / 10 : Math.round(ml)
}

/**
 * The amounts offered as one-tap buttons, in the user's own unit, so the
 * common case never requires the keyboard.
 */
export function quickAmounts(unit: VolumeUnit): number[] {
  return unit === 'oz' ? [1, 2, 3, 4, 5, 6] : [30, 60, 90, 120, 150, 180]
}
