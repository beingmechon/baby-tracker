import { useState } from 'react'
import type {
  BabyEvent,
  BottleContents,
  BreastSide,
  DiaperKind,
  SleepKind,
  VolumeUnit,
} from '@/domain/types'
import { fromMl, toMl } from '@/domain/units'
import {
  fromDateTimeInputs,
  minutesInputToMs,
  msToMinutesInput,
  toDateInputValue,
  toTimeInputValue,
} from './datetimeInput'
import { Sheet } from './Sheet'

interface EventEditSheetProps {
  event: BabyEvent
  unit: VolumeUnit
  onSave: (patch: Partial<BabyEvent>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

const DIAPER_KINDS: DiaperKind[] = ['wet', 'dirty', 'mixed', 'dry']

/**
 * Editing and deleting a logged event.
 *
 * Every field is editable, including the time: entries get logged late, or on
 * the wrong side, or twice. A tracker you cannot correct becomes a tracker you
 * stop trusting.
 */
export function EventEditSheet({
  event,
  unit,
  onSave,
  onDelete,
  onClose,
}: EventEditSheetProps) {
  const [date, setDate] = useState(toDateInputValue(event.startedAt))
  const [time, setTime] = useState(toTimeInputValue(event.startedAt))
  const [note, setNote] = useState(event.note ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Type-specific fields, initialised from whichever variant this event is.
  const [side, setSide] = useState<BreastSide>(
    event.type === 'nursing' ? event.side : 'left',
  )
  const [durationMinutes, setDurationMinutes] = useState(
    event.type === 'nursing' ? msToMinutesInput(event.durationMs) : '0',
  )
  const [contents, setContents] = useState<BottleContents>(
    event.type === 'bottle' ? event.contents : 'formula',
  )
  const [amount, setAmount] = useState(
    event.type === 'bottle' ? String(fromMl(event.amountMl, unit)) : '',
  )
  const [sleepKind, setSleepKind] = useState<SleepKind>(
    event.type === 'sleep' ? event.kind : 'nap',
  )
  const [endDate, setEndDate] = useState(
    event.type === 'sleep' && event.endedAt !== null
      ? toDateInputValue(event.endedAt)
      : toDateInputValue(event.startedAt),
  )
  const [endTime, setEndTime] = useState(
    event.type === 'sleep' && event.endedAt !== null ? toTimeInputValue(event.endedAt) : '',
  )
  const [diaperKind, setDiaperKind] = useState<DiaperKind>(
    event.type === 'diaper' ? event.kind : 'wet',
  )

  async function save() {
    if (saving) return
    setError(null)

    const startedAt = fromDateTimeInputs(date, time)
    if (startedAt === null) {
      setError('That start time is not valid.')
      return
    }

    const patch: Partial<BabyEvent> = { startedAt }
    const trimmedNote = note.trim()
    patch.note = trimmedNote.length > 0 ? trimmedNote : undefined

    switch (event.type) {
      case 'nursing': {
        const durationMs = minutesInputToMs(durationMinutes)
        if (durationMs === null) {
          setError('Enter the length of the feed in minutes.')
          return
        }
        Object.assign(patch, { side, durationMs })
        break
      }
      case 'bottle': {
        const parsed = Number.parseFloat(amount)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setError('Enter how much was in the bottle.')
          return
        }
        Object.assign(patch, { contents, amountMl: toMl(parsed, unit) })
        break
      }
      case 'sleep': {
        // A blank end time means the sleep is still running.
        const endedAt = endTime === '' ? null : fromDateTimeInputs(endDate, endTime)
        if (endTime !== '' && endedAt === null) {
          setError('That wake-up time is not valid.')
          return
        }
        if (endedAt !== null && endedAt < startedAt) {
          setError('The wake-up time is before the sleep started.')
          return
        }
        Object.assign(patch, { kind: sleepKind, endedAt })
        break
      }
      case 'diaper':
        Object.assign(patch, { kind: diaperKind })
        break
    }

    setSaving(true)
    try {
      await onSave(patch)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save')
      setSaving(false)
    }
  }

  return (
    <Sheet title="Edit entry" onClose={onClose}>
      <div className="button-row">
        <div className="field">
          <label className="field-label" htmlFor="event-date">
            Date
          </label>
          <input
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="event-time">
            Time
          </label>
          <input
            id="event-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      {event.type === 'nursing' && (
        <>
          <div className="field">
            <span className="field-label" id="edit-side-label">
              Side
            </span>
            <div className="segmented" role="group" aria-labelledby="edit-side-label">
              <button
                type="button"
                aria-pressed={side === 'left'}
                onClick={() => setSide('left')}
              >
                Left
              </button>
              <button
                type="button"
                aria-pressed={side === 'right'}
                onClick={() => setSide('right')}
              >
                Right
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-duration">
              Length (minutes)
            </label>
            <input
              id="edit-duration"
              type="number"
              inputMode="numeric"
              min="0"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
        </>
      )}

      {event.type === 'bottle' && (
        <>
          <div className="field">
            <span className="field-label" id="edit-contents-label">
              Contents
            </span>
            <div className="segmented" role="group" aria-labelledby="edit-contents-label">
              <button
                type="button"
                aria-pressed={contents === 'breast_milk'}
                onClick={() => setContents('breast_milk')}
              >
                Breast milk
              </button>
              <button
                type="button"
                aria-pressed={contents === 'formula'}
                onClick={() => setContents('formula')}
              >
                Formula
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-amount">
              Amount ({unit})
            </label>
            <input
              id="edit-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step={unit === 'oz' ? '0.5' : '5'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </>
      )}

      {event.type === 'sleep' && (
        <>
          <div className="field">
            <span className="field-label" id="edit-sleepkind-label">
              Kind
            </span>
            <div
              className="segmented"
              role="group"
              aria-labelledby="edit-sleepkind-label"
            >
              <button
                type="button"
                aria-pressed={sleepKind === 'nap'}
                onClick={() => setSleepKind('nap')}
              >
                Nap
              </button>
              <button
                type="button"
                aria-pressed={sleepKind === 'night'}
                onClick={() => setSleepKind('night')}
              >
                Night
              </button>
            </div>
          </div>
          <div className="button-row">
            <div className="field">
              <label className="field-label" htmlFor="edit-end-date">
                Woke — date
              </label>
              <input
                id="edit-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-end-time">
                Woke — time
              </label>
              <input
                id="edit-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <p className="settings-note">
            Leave the wake-up time blank to keep this sleep running.
          </p>
        </>
      )}

      {event.type === 'diaper' && (
        <div className="field">
          <span className="field-label" id="edit-diaper-label">
            Kind
          </span>
          <div className="segmented" role="group" aria-labelledby="edit-diaper-label">
            {DIAPER_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={diaperKind === kind}
                onClick={() => setDiaperKind(kind)}
              >
                {kind[0]?.toUpperCase()}
                {kind.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="edit-note">
          Note
        </label>
        <textarea
          id="edit-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything worth remembering"
        />
      </div>

      {error !== null && (
        <p className="banner" data-tone="error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="button"
        data-variant="primary"
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      {confirmingDelete ? (
        <div className="button-row">
          <button
            type="button"
            className="button"
            data-variant="secondary"
            onClick={() => setConfirmingDelete(false)}
          >
            Keep it
          </button>
          <button type="button" className="button" data-variant="danger" onClick={onDelete}>
            Delete for good
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button"
          data-variant="ghost"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete entry
        </button>
      )}
    </Sheet>
  )
}
