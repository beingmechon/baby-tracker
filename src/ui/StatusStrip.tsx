import { sinceLastFeedMs } from '@/domain/feeds'
import { sleepDuration, typicalWakeWindowMs, wakeWindowMs } from '@/domain/sleep'
import { ageInDays, formatClock, formatDuration } from '@/domain/time'
import type { BabyEvent, SleepEvent, Timestamp } from '@/domain/types'

interface StatusStripProps {
  events: BabyEvent[]
  sleepInProgress: SleepEvent | null
  birthDate: string | null
  now: Timestamp
  showGuidance: boolean
}

/**
 * The two questions a parent opens the app to answer: when did she last eat,
 * and how long has she been awake.
 *
 * The wake-window guidance is informational only. It shades the card when the
 * baby has been awake longer than is typical for their age — a nudge, never a
 * diagnosis, and never a number presented as a rule.
 */
export function StatusStrip({
  events,
  sleepInProgress,
  birthDate,
  now,
  showGuidance,
}: StatusStripProps) {
  const sinceFeed = sinceLastFeedMs(events, now)
  const awakeFor = wakeWindowMs(events, now)
  const typical = showGuidance ? typicalWakeWindowMs(ageInDays(birthDate, now)) : null
  const overTypical = typical !== null && awakeFor !== null && awakeFor > typical

  return (
    <div className="status">
      <div className="status-card">
        <span className="status-label">Last feed</span>
        <span className="status-value">
          {sinceFeed === null ? '—' : formatDuration(sinceFeed)}
        </span>
        <span className="status-note">
          {sinceFeed === null ? 'nothing logged yet' : 'ago'}
        </span>
      </div>

      {sleepInProgress !== null ? (
        <div className="status-card" data-tone="asleep">
          <span className="status-label">Asleep</span>
          <span className="status-value">
            {formatDuration(sleepDuration(sleepInProgress, now))}
          </span>
          <span className="status-note">
            since {formatClock(sleepInProgress.startedAt)}
          </span>
        </div>
      ) : (
        <div className="status-card" data-tone={overTypical ? 'over' : undefined}>
          <span className="status-label">Awake</span>
          <span className="status-value">
            {awakeFor === null ? '—' : formatDuration(awakeFor)}
          </span>
          <span className="status-note">
            {awakeFor === null
              ? 'no sleep logged yet'
              : typical === null
                ? 'since last sleep'
                : `typical is about ${formatDuration(typical)}`}
          </span>
        </div>
      )}
    </div>
  )
}
