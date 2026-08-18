import { formatClock, formatStopwatch } from '@/domain/time'
import { useTranslator } from '@/i18n/context'
import type { BreastSide, Timestamp } from '@/domain/types'
import {
  elapsedMs,
  isRunning,
  type NursingTimerState,
} from '@/app/nursingTimer'
import type { MessageKey } from '@/i18n/locales'
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

const SIDE_KEY = {
  left: 'nursing.side.left',
  right: 'nursing.side.right',
} as const satisfies Record<BreastSide, MessageKey>

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
  const t = useTranslator()
  const running = isRunning(timer)
  const elapsed = elapsedMs(timer, now)
  const started = timer.sessionStartedAt !== null
  const other: BreastSide = timer.side === 'left' ? 'right' : 'left'

  return (
    <Sheet title={t.t('nursing.title')} onClose={onClose}>
      <div className="field">
        <span className="field-label" id="nursing-side-label">
          {t.t('nursing.side')}
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
              {t.t(SIDE_KEY[side])}
              {lastSide === side && !started ? ` ${t.t('nursing.side.lastUsed')}` : ''}
            </button>
          ))}
        </div>
        {!started && lastSide !== null && lastSide !== timer.side && (
          <p className="field-note">
            {t.t('nursing.suggestion', {
              last: t.t(SIDE_KEY[lastSide]).toLowerCase(),
              suggested: t.t(SIDE_KEY[timer.side]).toLowerCase(),
            })}
          </p>
        )}
      </div>

      <div className="stopwatch" data-running={running}>
        <span
          className="stopwatch-time"
          role="timer"
          aria-live="off"
          aria-label={formatStopwatch(elapsed)}
        >
          {formatStopwatch(elapsed)}
        </span>
        <span className="stopwatch-state">
          {running
            ? t.t('nursing.running', { side: t.t(SIDE_KEY[timer.side]).toLowerCase() })
            : t.t(started ? 'nursing.paused' : 'nursing.ready')}
        </span>
        {timer.sessionStartedAt !== null && (
          <span className="field-note">
            {t.t('nursing.startedAt', {
              time: formatClock(timer.sessionStartedAt, t.locale),
            })}
          </span>
        )}
      </div>

      <button
        type="button"
        className="button"
        data-variant={running ? 'secondary' : 'primary'}
        onClick={onToggle}
      >
        {t.t(running ? 'nursing.pause' : started ? 'nursing.resume' : 'nursing.start')}
      </button>

      {started && (
        <button type="button" className="button" data-variant="secondary" onClick={onSwitchSide}>
          {t.t('nursing.switchSide', { side: t.t(SIDE_KEY[other]).toLowerCase() })}
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
          {t.t('nursing.discard')}
        </button>
        <button
          type="button"
          className="button"
          data-variant="primary"
          onClick={onSave}
          disabled={elapsed <= 0}
        >
          {t.t('nursing.save')}
        </button>
      </div>
    </Sheet>
  )
}
