import type { DayWheel as DayWheelData } from '@/domain/patterns'
import { useTranslator } from '@/i18n/context'
import { formatDuration, formatShortDate } from '@/i18n/format'
import { polarPoint, ringArcPath } from './chartScale'

interface DayWheelProps {
  wheel: DayWheelData
}

/** SVG user units. The wheel scales to its container; these are proportions. */
const SIZE = 240
const CENTRE = { x: SIZE / 2, y: SIZE / 2 }
const SLEEP_RADIUS = 84
const MARK_INNER = 96
const MARK_OUTER = 110
const TRACK_RADIUS = (MARK_INNER + MARK_OUTER) / 2
const LABEL_RADIUS = 66

/** Midnight, 6am, noon, 6pm — the four points that orient a clock face. */
const HOUR_LABELS = [
  { fraction: 0, label: '0' },
  { fraction: 0.25, label: '6' },
  { fraction: 0.5, label: '12' },
  { fraction: 0.75, label: '18' },
]

/**
 * A day as a 24-hour clock face: midnight at the top, running clockwise.
 *
 * The shape is the argument for it. A day of a newborn's sleep is a dozen
 * fragments, and a straight timeline makes comparing morning with evening a matter
 * of scrolling; on a ring, the shape of the day is one glance. Night sleep sits as
 * one long arc at the top and the daytime fragments fan out below it.
 *
 * Plain SVG, like the growth chart. A polar chart library would be the largest
 * dependency in the project for arcs and tick marks.
 */
export function DayWheel({ wheel }: DayWheelProps) {
  const t = useTranslator()

  const description = t.t('patterns.dayWheelLabel', {
    date: formatShortDate(t.locale, wheel.dayStart),
  })

  return (
    <svg
      className="wheel"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={description}
    >
      {/* The ring itself: one hairline, the same weight as every rule on the page. */}
      <circle
        className="wheel-ring"
        cx={CENTRE.x}
        cy={CENTRE.y}
        r={SLEEP_RADIUS}
        fill="none"
      />

      {/*
        * A second, fainter track for the rim marks to sit on. Without it a feed
        * mark is a tick floating in space, and the "now" tick reads as a scratch on
        * the screen rather than a position on a dial.
        */}
      <circle
        className="wheel-track"
        cx={CENTRE.x}
        cy={CENTRE.y}
        r={TRACK_RADIUS}
        fill="none"
      />

      {HOUR_LABELS.map(({ fraction, label }) => {
        const outer = polarPoint(CENTRE, SLEEP_RADIUS + 6, fraction)
        const inner = polarPoint(CENTRE, SLEEP_RADIUS - 6, fraction)
        const text = polarPoint(CENTRE, LABEL_RADIUS, fraction)
        return (
          <g key={label}>
            <line
              className="wheel-hour"
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
            />
            <text
              className="wheel-hour-label num"
              x={text.x}
              y={text.y}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {t.number(Number(label))}
            </text>
          </g>
        )
      })}

      {wheel.arcs.map((arc, index) => (
        <path
          key={`${arc.startFraction}-${index}`}
          className="wheel-sleep"
          data-night={arc.night}
          fill="none"
          d={ringArcPath(CENTRE, SLEEP_RADIUS, arc.startFraction, arc.endFraction)}
        />
      ))}

      {wheel.marks.map((mark) => {
        const inner = polarPoint(CENTRE, MARK_INNER, mark.fraction)
        const outer = polarPoint(
          CENTRE,
          mark.kind === 'feed' ? MARK_OUTER : MARK_OUTER - 4,
          mark.fraction,
        )
        return (
          <line
            key={mark.id}
            className="wheel-mark"
            data-kind={mark.kind}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
          />
        )
      })}

      {/*
        * Now is a tick just outside the rim, not a hand across the face. Drawn from
        * the centre it was the loudest mark on the screen and read as a scratch
        * through the day rather than a position in it.
        */}
      {wheel.nowFraction !== null && (
        <line
          className="wheel-now"
          x1={polarPoint(CENTRE, MARK_INNER - 4, wheel.nowFraction).x}
          y1={polarPoint(CENTRE, MARK_INNER - 4, wheel.nowFraction).y}
          x2={polarPoint(CENTRE, MARK_OUTER + 4, wheel.nowFraction).x}
          y2={polarPoint(CENTRE, MARK_OUTER + 4, wheel.nowFraction).y}
        />
      )}

      {/*
        * The hole in the middle carries the day it encircles. A day with no sleep
        * logged says so in words: a dash above the word "asleep" read as a figure
        * that had gone missing rather than a day nobody wrote a nap down on.
        */}
      {wheel.sleepMs > 0 ? (
        <>
          <text
            className="wheel-total num"
            x={CENTRE.x}
            y={CENTRE.y - 6}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {formatDuration(t, wheel.sleepMs)}
          </text>
          <text
            className="wheel-total-label"
            x={CENTRE.x}
            y={CENTRE.y + 12}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {t.t('patterns.wheelAsleep')}
          </text>
        </>
      ) : (
        <text
          className="wheel-total-label"
          x={CENTRE.x}
          y={CENTRE.y - 4}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {t.t('patterns.wheelNoSleep')}
        </text>
      )}
      <text
        className="wheel-total-label"
        x={CENTRE.x}
        y={CENTRE.y + (wheel.sleepMs > 0 ? 28 : 14)}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {t.plural('patterns.wheelFeeds', wheel.feeds)}
        {' · '}
        {t.plural('patterns.wheelDiapers', wheel.diapers)}
      </text>
    </svg>
  )
}
