import { formatClock, formatStopwatch } from '@/domain/time'
import type { BreastSide, Timestamp } from '@/domain/types'
import {
  elapsedMs,
  isRunning,
  type NursingTimerState,
} from '@/app/nursingTimer'
import { Sheet } from './Sheet'

interface NursingSheetProps {
  timer: NursingTimerState
  now: Timestamp
  lastSide: BreastSide | null
  onToggle: () => void
  onSwitchSide: () => void
  onSelectSide: (side: BreastSide) => void
  onSave: () => void
  onDiscard: () => void
  onClose: () => void
}

const SIDE_LABEL: Record<BreastSide, string> = { left: 'Left', right: 'Right' }

/**
 * The nursing stopwatch.
 *
 * Closing this sheet does not stop the timer — the state lives on the home
 * screen and is persisted, so you can put the phone down mid-feed, or close the
 * app entirely, and come back to a running clock.
 */
export function NursingSheet({
  timer,
  now,
  lastSide,
  onToggle,
  onSwitchSide,
  onSelectSide,
  onSave,
  onDiscard,
  onClose,
}: NursingSheetProps) {
  const running = isRunning(timer)
  const elapsed = elapsedMs(timer, now)
  const started = timer.sessionStartedAt !== null
  const other: BreastSide = timer.side === 'left' ? 'right' : 'left'

  return (
    <Sheet title="Nursing" onClose={onClose}>
      <div className="field">
        <span className="field-label" id="nursing-side-label">
          Side
        </span>
        <div className="segmented" role="group" aria-labelledby="nursing-side-label">
          {(['left', 'right'] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={timer.side === side}
              onClick={() => {
                if (timer.side === side) return
                // Mid-session, changing side banks the current side as its own
                // entry; before the timer starts it simply picks a side.
                if (started) onSwitchSide()
                else onSelectSide(side)
              }}
            >
              {SIDE_LABEL[side]}
              {lastSide === side && !started ? ' · last used' : ''}
            </button>
          ))}
        </div>
        {!started && lastSide !== null && lastSide !== timer.side && (
          <p className="settings-note">
            Last feed was on the {SIDE_LABEL[lastSide].toLowerCase()}, so the{' '}
            {SIDE_LABEL[timer.side].toLowerCase()} is suggested.
          </p>
        )}
      </div>

      <div className="stopwatch" data-running={running}>
        <span
          className="stopwatch-time"
          role="timer"
          aria-live="off"
          aria-label={`Elapsed ${formatStopwatch(elapsed)}`}
        >
          {formatStopwatch(elapsed)}
        </span>
        <span className="stopwatch-state">
          {running
            ? `Running · ${SIDE_LABEL[timer.side].toLowerCase()} side`
            : started
              ? 'Paused'
              : 'Ready'}
        </span>
        {timer.sessionStartedAt !== null && (
          <span className="settings-note">
            Started {formatClock(timer.sessionStartedAt)}
          </span>
        )}
      </div>

      <button
        type="button"
        className="button"
        data-variant={running ? 'secondary' : 'primary'}
        onClick={onToggle}
      >
        {running ? 'Pause' : started ? 'Resume' : 'Start'}
      </button>

      {started && (
        <button type="button" className="button" data-variant="secondary" onClick={onSwitchSide}>
          Switch to {SIDE_LABEL[other].toLowerCase()} side
        </button>
      )}

      <div className="button-row">
        <button
          type="button"
          className="button"
          data-variant="ghost"
          onClick={onDiscard}
          disabled={!started}
        >
          Discard
        </button>
        <button
          type="button"
          className="button"
          data-variant="primary"
          onClick={onSave}
          disabled={elapsed <= 0}
        >
          Save feed
        </button>
      </div>
    </Sheet>
  )
}
