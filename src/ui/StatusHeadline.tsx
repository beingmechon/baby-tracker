import { sinceLastFeedMs } from '@/domain/feeds'
import { sleepDuration, typicalWakeWindowMs, wakeWindowMs } from '@/domain/sleep'
import { ageInDays, formatClock, formatStopwatch } from '@/domain/time'
import type { BabyEvent, SleepEvent, Timestamp } from '@/domain/types'
import { formatDuration } from '@/i18n/format'
import { useTranslator } from '@/i18n/context'

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
 * takes the top step of the type scale and the accent colour.
 */
export function StatusHeadline({
  events,
  sleepInProgress,
  birthDate,
  now,
  showGuidance,
}: StatusHeadlineProps) {
  const t = useTranslator()
  const asleep = sleepInProgress !== null
  const sinceFeed = sinceLastFeedMs(events, now)
  const awakeFor = wakeWindowMs(events, now)
  const typical = showGuidance ? typicalWakeWindowMs(ageInDays(birthDate, now)) : null

  const label = asleep
    ? t.t('status.asleep')
    : awakeFor === null
      ? t.t('status.noSleepLogged')
      : t.t('status.awake')

  // A running sleep counts in seconds so it reads as live; a wake window is
  // coarser, because nobody needs their baby's awake time to the second.
  const value = asleep
    ? formatStopwatch(sleepDuration(sleepInProgress, now))
    : awakeFor === null
      ? t.t('summary.none')
      : formatDuration(t, awakeFor)

  return (
    <section className="headline" data-running={asleep} aria-label={label}>
      <span className="headline-label">{label}</span>
      <span className="headline-value" role={asleep ? 'timer' : undefined} aria-live="off">
        {value}
      </span>
      <span className="headline-meta">
        {asleep && (
          <>{t.t('status.since', { time: formatClock(sleepInProgress.startedAt, t.locale) })} · </>
        )}
        {sinceFeed === null
          ? t.t('status.nothingLogged')
          : t.t('status.lastFeed', { duration: formatDuration(t, sinceFeed) })}
        {!asleep && typical !== null && (
          <>
            {' · '}
            {t.t('status.typicalWakeWindow', { duration: formatDuration(t, typical) })}
          </>
        )}
      </span>
    </section>
  )
}
