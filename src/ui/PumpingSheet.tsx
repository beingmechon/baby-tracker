import { useState } from 'react'
import { formatStopwatch } from '@/domain/time'
import type { Timestamp, VolumeUnit } from '@/domain/types'
import { toMl } from '@/domain/units'
import { useTranslator } from '@/i18n/context'
import { formatVolume } from '@/i18n/format'
import { Sheet } from './Sheet'

interface PumpingSheetProps {
  unit: VolumeUnit
  /** Ticks while the sheet is open, so the session clock moves. */
  now: Timestamp
  onSave: (input: {
    leftMl: number
    rightMl: number
    durationMs: number
  }) => Promise<void>
  onClose: () => void
}

/**
 * Logging a pumping session: one clock, two amounts.
 *
 * Unlike nursing there is no per-side timing, because a double pump runs both at
 * once — timing them separately would be a control with nothing behind it. The
 * two amounts stay separate though: a persistent difference between sides is
 * something parents watch, and one total would throw it away.
 */
export function PumpingSheet({ unit, now, onSave, onClose }: PumpingSheetProps) {
  const t = useTranslator()
  const [startedAt, setStartedAt] = useState<Timestamp | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const running = startedAt !== null
  const shown = running ? elapsedMs + (now - startedAt) : elapsedMs

  const leftMl = left === '' ? 0 : toMl(Number.parseFloat(left), unit)
  const rightMl = right === '' ? 0 : toMl(Number.parseFloat(right), unit)
  const total = (Number.isFinite(leftMl) ? leftMl : 0) + (Number.isFinite(rightMl) ? rightMl : 0)
  const valid = total > 0

  async function save() {
    if (saving) return
    if (!valid) {
      setError(t.t('error.enterOutput'))
      return
    }
    setSaving(true)
    try {
      await onSave({
        leftMl: Number.isFinite(leftMl) ? leftMl : 0,
        rightMl: Number.isFinite(rightMl) ? rightMl : 0,
        durationMs: Math.round(shown),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('pumping.title')} onClose={onClose}>
      <div className="stopwatch">
        <span className="stopwatch-time num">{formatStopwatch(shown)}</span>
        <button
          type="button"
          className="button"
          data-variant="secondary"
          onClick={() => {
            if (running) {
              setElapsedMs(shown)
              setStartedAt(null)
            } else {
              setStartedAt(Date.now())
            }
          }}
        >
          {t.t(running ? 'nursing.pause' : elapsedMs > 0 ? 'nursing.resume' : 'nursing.start')}
        </button>
      </div>

      <div className="button-row">
        <div className="field">
          <label className="field-label" htmlFor="pumping-left">
            {t.t('pumping.left', { unit })}
          </label>
          <input
            id="pumping-left"
            type="number"
            inputMode="decimal"
            min="0"
            step={unit === 'oz' ? '0.5' : '5'}
            value={left}
            onChange={(event) => setLeft(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pumping-right">
            {t.t('pumping.right', { unit })}
          </label>
          <input
            id="pumping-right"
            type="number"
            inputMode="decimal"
            min="0"
            step={unit === 'oz' ? '0.5' : '5'}
            value={right}
            onChange={(event) => setRight(event.target.value)}
          />
        </div>
      </div>

      {total > 0 && (
        <p className="field-note num">
          {t.t('pumping.total', { amount: formatVolume(t, total, unit) })}
        </p>
      )}

      {error !== null && (
        <p className="banner" data-tone="error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="button"
        data-variant="primary"
        onClick={() => void save()}
        disabled={!valid || saving}
      >
        {t.t('pumping.save')}
      </button>
    </Sheet>
  )
}
