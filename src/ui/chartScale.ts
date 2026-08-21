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

export interface Point {
  x: number
  y: number
}

/**
 * A point on a circle, from a fraction of the way round.
 *
 * Zero is at the top and it runs clockwise, because the day wheel is read like a
 * clock: midnight at twelve, noon at six. SVG's own angles start at three o'clock
 * and run the other way, so the quarter-turn offset lives here once rather than at
 * every call site.
 */
export function polarPoint(
  centre: Point,
  radius: number,
  fraction: number,
): Point {
  const angle = fraction * 2 * Math.PI - Math.PI / 2
  return {
    x: centre.x + radius * Math.cos(angle),
    y: centre.y + radius * Math.sin(angle),
  }
}

/**
 * A stroked arc along a ring, for one sleep on the day wheel.
 *
 * A span covering the whole circle is drawn as two half arcs: a single `A` command
 * from a point back to itself has zero length and renders nothing, which would make
 * a baby who slept all day show as a baby who never slept.
 */
export function ringArcPath(
  centre: Point,
  radius: number,
  startFraction: number,
  endFraction: number,
): string {
  const span = Math.min(1, Math.max(0, endFraction - startFraction))
  if (span <= 0) return ''

  const start = polarPoint(centre, radius, startFraction)
  const format = (point: Point): string => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`

  if (span >= 1) {
    const half = polarPoint(centre, radius, startFraction + 0.5)
    return `M${format(start)} A${radius} ${radius} 0 1 1 ${format(half)} A${radius} ${radius} 0 1 1 ${format(start)}`
  }

  const end = polarPoint(centre, radius, endFraction)
  const largeArc = span > 0.5 ? 1 : 0
  return `M${format(start)} A${radius} ${radius} 0 ${largeArc} 1 ${format(end)}`
}
