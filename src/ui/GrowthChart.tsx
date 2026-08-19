import { useMemo } from 'react'
import { CHART_CURVES, monthsBetween, referenceCurve } from '@/domain/growth'
import { fromCanonical } from '@/domain/measure'
import type { GrowthEvent, MeasureKind, MeasureSystem, Sex } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { measureName } from '@/i18n/format'
import type { Translator } from '@/i18n/locales'
import { linearScale, niceTicks, padRange, polylinePath } from './chartScale'

interface GrowthChartProps {
  measure: MeasureKind
  system: MeasureSystem
  /** Oldest first. */
  series: readonly GrowthEvent[]
  /** Local midnight on the birth date; null when it is not recorded. */
  birthTimestamp: number | null
  sex: Sex | null
}

/** SVG user units. The chart scales to its container; these are proportions. */
const WIDTH = 320
const HEIGHT = 190
const PAD = { top: 8, right: 30, bottom: 22, left: 36 }
const PLOT = {
  left: PAD.left,
  right: WIDTH - PAD.right,
  top: PAD.top,
  bottom: HEIGHT - PAD.bottom,
}

/**
 * A growth curve against the WHO reference.
 *
 * This is the feature other trackers put behind a subscription, so it is worth
 * being careful about: the reference curves are the WHO's own published figures,
 * the axes are labelled, and the same numbers appear as text below the chart so
 * a screen reader and a printout lose nothing.
 *
 * Drawn as plain SVG. A charting library would be the largest dependency in the
 * project by an order of magnitude, for a line and three curves.
 */
export function GrowthChart({
  measure,
  system,
  series,
  birthTimestamp,
  sex,
}: GrowthChartProps) {
  const t = useTranslator()

  const plotted = useMemo(() => {
    if (birthTimestamp === null) return []
    return series.map((event) => ({
      ageMonths: monthsBetween(birthTimestamp, event.startedAt),
      value: event.value,
      event,
    }))
  }, [series, birthTimestamp])

  const geometry = useMemo(() => {
    const oldest = plotted.reduce((max, point) => Math.max(max, point.ageMonths), 0)
    // Always show a few months of context, and a month of headroom past the
    // latest reading so the newest point is not jammed against the frame.
    const maxMonths = Math.max(3, Math.ceil(oldest) + 1)

    const curves =
      sex === null
        ? []
        : CHART_CURVES.map((curve) => ({
            ...curve,
            points: referenceCurve(measure, sex, curve.z, maxMonths),
          })).filter((curve) => curve.points.length > 0)

    const values = [
      ...plotted.map((point) => point.value),
      ...curves.flatMap((curve) => curve.points.map((point) => point.value)),
    ]
    if (values.length === 0) return null

    const [low, high] = padRange(Math.min(...values), Math.max(...values))
    const x = linearScale([0, maxMonths], [PLOT.left, PLOT.right])
    const y = linearScale([low, high], [PLOT.bottom, PLOT.top])
    return { curves, maxMonths, x, y, low, high }
  }, [plotted, measure, sex])

  if (birthTimestamp === null) {
    return <p className="field-note">{t.t('growth.chartNeedsBirthDate')}</p>
  }
  if (geometry === null) {
    return <p className="empty">{t.t('growth.empty')}</p>
  }

  const { curves, maxMonths, x, y, low, high } = geometry
  const valueTicks = niceTicks(low, high, 3)
  const monthTicks = niceTicks(0, maxMonths, 4)

  const [outerLow, median, outerHigh] = CHART_CURVES
  const description =
    curves.length === 0
      ? t.t('growth.chartNoReference')
      : t.t('growth.chartDescription', {
          measure: measureName(t, measure),
          low: t.ordinal(outerLow.percentile),
          mid: t.ordinal(median.percentile),
          high: t.ordinal(outerHigh.percentile),
          months: t.number(maxMonths),
        })

  return (
    <figure className="chart">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={description}
      >
        {/* Axes as hairlines, in keeping with the rest of the page: two rules,
            no box, no grid. */}
        <line
          className="chart-axis"
          x1={PLOT.left}
          y1={PLOT.top}
          x2={PLOT.left}
          y2={PLOT.bottom}
        />
        <line
          className="chart-axis"
          x1={PLOT.left}
          y1={PLOT.bottom}
          x2={PLOT.right}
          y2={PLOT.bottom}
        />

        {valueTicks.map((tick) => (
          <text
            key={`v${tick}`}
            className="chart-tick num"
            x={PLOT.left - 4}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {shortValue(t, tick, measure, system)}
          </text>
        ))}

        {monthTicks.map((tick) => (
          <text
            key={`m${tick}`}
            className="chart-tick num"
            x={x(tick)}
            y={PLOT.bottom + 12}
            textAnchor="middle"
          >
            {t.number(tick)}
          </text>
        ))}

        {curves.map((curve) => (
          <g key={curve.percentile}>
            <path
              className="chart-reference"
              data-emphasis={curve.z === 0 ? 'median' : 'outer'}
              d={polylinePath(
                curve.points.map((point) => ({
                  x: x(point.ageMonths),
                  y: y(point.value),
                })),
              )}
            />
            <text
              className="chart-curve-label num"
              x={PLOT.right + 3}
              y={y(curve.points[curve.points.length - 1]!.value)}
              dominantBaseline="middle"
            >
              {t.ordinal(curve.percentile)}
            </text>
          </g>
        ))}

        {/* The parent's own readings, last so they sit above the reference. */}
        <path
          className="chart-series"
          d={polylinePath(
            plotted.map((point) => ({ x: x(point.ageMonths), y: y(point.value) })),
          )}
        />
        {plotted.map((point) => (
          <circle
            key={point.event.id}
            className="chart-point"
            cx={x(point.ageMonths)}
            cy={y(point.value)}
            r={2.5}
          />
        ))}
      </svg>
      <figcaption className="chart-caption">{t.t('growth.axisAge')}</figcaption>
    </figure>
  )
}

/**
 * An axis label short enough to fit: `6.4`, not `6.4 kg`. The unit is stated
 * once in the section heading rather than repeated down the axis.
 */
function shortValue(
  t: Translator,
  value: number,
  measure: MeasureKind,
  system: MeasureSystem,
): string {
  return t.number(fromCanonical(value, measure, system), {
    maximumFractionDigits: 1,
  })
}
