import { useState } from 'react'
import { MEASURE_KINDS } from '@/domain/growth'
import type {
  BabyEvent,
  BottleContents,
  BreastSide,
  DiaperKind,
  MeasureKind,
  MeasureSystem,
  SleepKind,
  VolumeUnit,
} from '@/domain/types'
import { fromMl, toMl } from '@/domain/units'
import { useTranslator } from '@/i18n/context'
import { measureShortName } from '@/i18n/format'
import type { MessageKey } from '@/i18n/locales'
import { MeasureValueInput } from './MeasureValueInput'
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
  measureSystem: MeasureSystem
  onSave: (patch: Partial<BabyEvent>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

const DIAPER_KINDS = [
  { kind: 'wet', label: 'action.diaper.wet' },
  { kind: 'dirty', label: 'action.diaper.dirty' },
  { kind: 'mixed', label: 'action.diaper.mixed' },
  { kind: 'dry', label: 'action.diaper.dry' },
] as const satisfies readonly { kind: DiaperKind; label: MessageKey }[]


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
  measureSystem,
  onSave,
  onDelete,
  onClose,
}: EventEditSheetProps) {
  const t = useTranslator()
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
  const [measure, setMeasure] = useState<MeasureKind>(
    event.type === 'growth' ? event.measure : 'weight',
  )
  const [measureValue, setMeasureValue] = useState<number | null>(
    event.type === 'growth' ? event.value : null,
  )

  async function save() {
    if (saving) return
    setError(null)

    const startedAt = fromDateTimeInputs(date, time)
    if (startedAt === null) {
      setError(t.t('error.invalidStart'))
      return
    }

    const patch: Partial<BabyEvent> = { startedAt }
    const trimmedNote = note.trim()
    patch.note = trimmedNote.length > 0 ? trimmedNote : undefined

    switch (event.type) {
      case 'nursing': {
        const durationMs = minutesInputToMs(durationMinutes)
        if (durationMs === null) {
          setError(t.t('error.enterDuration'))
          return
        }
        Object.assign(patch, { side, durationMs })
        break
      }
      case 'bottle': {
        const parsed = Number.parseFloat(amount)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setError(t.t('error.enterAmount'))
          return
        }
        Object.assign(patch, { contents, amountMl: toMl(parsed, unit) })
        break
      }
      case 'sleep': {
        // A blank end time means the sleep is still running.
        const endedAt = endTime === '' ? null : fromDateTimeInputs(endDate, endTime)
        if (endTime !== '' && endedAt === null) {
          setError(t.t('error.invalidWake'))
          return
        }
        if (endedAt !== null && endedAt < startedAt) {
          setError(t.t('error.wakeBeforeStart'))
          return
        }
        Object.assign(patch, { kind: sleepKind, endedAt })
        break
      }
      case 'diaper':
        Object.assign(patch, { kind: diaperKind })
        break
      case 'growth': {
        if (measureValue === null) {
          setError(t.t('error.enterValue'))
          return
        }
        Object.assign(patch, { measure, value: measureValue })
        break
      }
    }

    setSaving(true)
    try {
      await onSave(patch)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('edit.title')} onClose={onClose}>
      <div className="button-row">
        <div className="field">
          <label className="field-label" htmlFor="event-date">
            {t.t('edit.date')}
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
            {t.t('edit.time')}
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
              {t.t('nursing.side')}
            </span>
            <div className="segmented" role="group" aria-labelledby="edit-side-label">
              <button
                type="button"
                aria-pressed={side === 'left'}
                onClick={() => setSide('left')}
              >
                {t.t('nursing.side.left')}
              </button>
              <button
                type="button"
                aria-pressed={side === 'right'}
                onClick={() => setSide('right')}
              >
                {t.t('nursing.side.right')}
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-duration">
              {t.t('edit.duration')}
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
              {t.t('bottle.contents')}
            </span>
            <div className="segmented" role="group" aria-labelledby="edit-contents-label">
              <button
                type="button"
                aria-pressed={contents === 'breast_milk'}
                onClick={() => setContents('breast_milk')}
              >
                {t.t('bottle.contents.breastMilk')}
              </button>
              <button
                type="button"
                aria-pressed={contents === 'formula'}
                onClick={() => setContents('formula')}
              >
                {t.t('bottle.contents.formula')}
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-amount">
              {t.t('bottle.amount', { unit })}
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
              {t.t('edit.kind')}
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
                {t.t('event.sleep.nap')}
              </button>
              <button
                type="button"
                aria-pressed={sleepKind === 'night'}
                onClick={() => setSleepKind('night')}
              >
                {t.t('event.sleep.night')}
              </button>
            </div>
          </div>
          <div className="button-row">
            <div className="field">
              <label className="field-label" htmlFor="edit-end-date">
                {t.t('edit.wokeDate')}
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
                {t.t('edit.wokeTime')}
              </label>
              <input
                id="edit-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <p className="field-note">{t.t('edit.stillRunning')}</p>
        </>
      )}

      {event.type === 'growth' && (
        <>
          <div className="field">
            <span className="field-label" id="edit-measure-label">
              {t.t('growth.measure')}
            </span>
            <div className="segmented" role="group" aria-labelledby="edit-measure-label">
              {MEASURE_KINDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={measure === option}
                  onClick={() => {
                    setMeasure(option)
                    setMeasureValue(null)
                  }}
                >
                  {measureShortName(t, option)}
                </button>
              ))}
            </div>
          </div>
          <MeasureValueInput
            key={measure}
            measure={measure}
            system={measureSystem}
            idPrefix="edit-measure"
            initialValue={event.measure === measure ? event.value : null}
            onChange={setMeasureValue}
          />
        </>
      )}

      {event.type === 'diaper' && (
        <div className="field">
          <span className="field-label" id="edit-diaper-label">
            {t.t('edit.kind')}
          </span>
          <div className="segmented" role="group" aria-labelledby="edit-diaper-label">
            {DIAPER_KINDS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                aria-pressed={diaperKind === kind}
                onClick={() => setDiaperKind(kind)}
              >
                {t.t(label)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="edit-note">
          {t.t('edit.note')}
        </label>
        <textarea
          id="edit-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.t('edit.notePlaceholder')}
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
        {t.t(saving ? 'edit.saving' : 'edit.save')}
      </button>

      {confirmingDelete ? (
        <div className="button-row">
          <button
            type="button"
            className="button"
            data-variant="secondary"
            onClick={() => setConfirmingDelete(false)}
          >
            {t.t('edit.keep')}
          </button>
          <button type="button" className="button" data-variant="danger" onClick={onDelete}>
            {t.t('edit.confirmDelete')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button"
          data-variant="ghost"
          onClick={() => setConfirmingDelete(true)}
        >
          {t.t('edit.delete')}
        </button>
      )}
    </Sheet>
  )
}
