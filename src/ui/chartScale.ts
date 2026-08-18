/**
 * The arithmetic behind the growth chart: mapping data to SVG coordinates, and
 * choosing axis ticks a person would have chosen.
 *
 * Separate and pure because an off-by-one in a scale is invisible in review and
 * obvious in a test, and because the chart component should read as layout.
 */

export interface Scale {
  (value: number): number
  domain: readonly [number, number]
  range: readonly [number, number]
}

/**
 * A linear map from data space to pixel space. A zero-width domain maps
 * everything to the start of the range rather than dividing by zero — which
 * happens the moment a parent logs their very first measurement.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  const scale = ((value: number) =>
    span === 0 ? r0 : r0 + ((value - d0) / span) * (r1 - r0)) as Scale
  scale.domain = domain
  scale.range = range
  return scale
}

/** The 1-2-5 progression people actually use for axis steps. */
function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalised = rough / magnitude
  if (normalised <= 1) return magnitude
  if (normalised <= 2) return 2 * magnitude
  if (normalised <= 5) return 5 * magnitude
  return 10 * magnitude
}

/**
 * Round tick values covering `[min, max]`, at most `count`-ish of them.
 *
 * Ticks are placed on multiples of the step rather than at the data bounds, so
 * the axis reads 4, 6, 8 rather than 4.35, 6.02, 7.69.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) return [min]
  const step = niceStep((max - min) / Math.max(1, count))
  const first = Math.ceil(min / step) * step
  const ticks: number[] = []
  // The epsilon absorbs the float error that otherwise drops the last tick when
  // it lands exactly on the maximum.
  for (let value = first; value <= max + step * 1e-9; value += step) {
    // Re-rounding kills the accumulated error that turns 0.30000000000000004
    // into a visible axis label.
    ticks.push(Math.round(value / step) * step)
  }
  return ticks
}

/** An SVG `points`/`d` polyline body from already-projected coordinates. */
export function polylinePath(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')
}

/** Pads a numeric range outward by a fraction, so nothing sits on the frame. */
export function padRange(
  min: number,
  max: number,
  fraction = 0.06,
): [number, number] {
  if (min === max) {
    // A single data point still needs a visible band around it.
    const padding = Math.abs(min) * fraction || 1
    return [min - padding, max + padding]
  }
  const padding = (max - min) * fraction
  return [min - padding, max + padding]
}
