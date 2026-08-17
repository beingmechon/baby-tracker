import { sinceLastFeedMs } from '@/domain/feeds'
import { sleepDuration, typicalWakeWindowMs, wakeWindowMs } from '@/domain/sleep'
import { ageInDays, formatClock, formatDuration, formatStopwatch } from '@/domain/time'
import type { BabyEvent, SleepEvent, Timestamp } from '@/domain/types'

interface StatusHeadlineProps {
  events: BabyEvent[]
  sleepInProgress: SleepEvent | null
  birthDate: string | null
  now: Timestamp
  showGuidance: boolean
}

/**
 * The dominant typographic element of the home screen.
 *
 * The dealt composition (Swiss Modular) makes "the typographic headline seated on
 * the grid" the dominant element, and in this app that headline is the answer to
 * the question you opened the app to ask: is she asleep, and for how long?
 *
 * A running sleep is one of the design's two expressive moments — the numeral
 * takes the top step of the type scale and the accent colour. Everything else on
 * the screen holds the calm structure register.
 */
export function StatusHeadline({
  events,
  sleepInProgress,
  birthDate,
  now,
  showGuidance,
}: StatusHeadlineProps) {
  const asleep = sleepInProgress !== null
  const sinceFeed = sinceLastFeedMs(events, now)
  const awakeFor = wakeWindowMs(events, now)
  const typical = showGuidance ? typicalWakeWindowMs(ageInDays(birthDate, now)) : null

  const label = asleep ? 'Asleep' : awakeFor === null ? 'No sleep logged' : 'Awake'

  // A running sleep counts in seconds, so it reads as live; a wake window is
  // coarser because nobody needs their baby's awake time to the second.
  const value = asleep
    ? formatStopwatch(sleepDuration(sleepInProgress, now))
    : awakeFor === null
      ? '—'
      : formatDuration(awakeFor)

  return (
    <section className="headline" data-running={asleep} aria-label="Current status">
      <span className="headline-label">{label}</span>
      <span
        className="headline-value"
        role={asleep ? 'timer' : undefined}
        aria-live="off"
      >
        {value}
      </span>
      <span className="headline-meta">
        {asleep && <>since {formatClock(sleepInProgress.startedAt)} · </>}
        {sinceFeed === null ? (
          'nothing logged yet'
        ) : (
          <>
            last feed <span className="num">{formatDuration(sinceFeed)}</span> ago
          </>
        )}
        {!asleep && typical !== null && (
          <> · typical wake window is about {formatDuration(typical)}</>
        )}
      </span>
    </section>
  )
}
