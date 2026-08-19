import { useState } from 'react'
import type { NewStashEntry } from '@/data/repository'
import { STASH_LOCATIONS, type StashLocation } from '@/domain/stash'
import type { Timestamp, VolumeUnit } from '@/domain/types'
import { toMl } from '@/domain/units'
import { useTranslator } from '@/i18n/context'
import type { MessageKey } from '@/i18n/locales'
import {
  fromDateTimeInputs,
  toDateInputValue,
  toTimeInputValue,
} from './datetimeInput'
import { Sheet } from './Sheet'

interface StashSheetProps {
  unit: VolumeUnit
  now: Timestamp
  onSave: (entry: NewStashEntry) => Promise<void>
  onClose: () => void
}

const LOCATION_LABELS: Record<StashLocation, MessageKey> = {
  fridge: 'stash.location.fridge',
  freezer: 'stash.location.freezer',
}

/**
 * Adding milk to the stash.
 *
 * The time expressed is editable and defaults to now, because milk is logged when
 * a hand is free and the storage clock started when the pump stopped. Getting that
 * wrong by a few hours is the difference between "use today" and "past it".
 */
export function StashSheet({ unit, now, onSave, onClose }: StashSheetProps) {
  const t = useTranslator()
  const [amount, setAmount] = useState('')
  const [location, setLocation] = useState<StashLocation>('fridge')
  const [date, setDate] = useState(() => toDateInputValue(now))
  const [time, setTime] = useState(() => toTimeInputValue(now))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    const parsed = Number.parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t.t('error.enterStashAmount'))
      return
    }
    const expressedAt = fromDateTimeInputs(date, time)
    if (expressedAt === null) {
      setError(t.t('error.invalidStart'))
      return
    }
    setSaving(true)
    try {
      await onSave({ amountMl: toMl(parsed, unit), location, expressedAt })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('stash.add')} onClose={onClose}>
      <div className="field">
        <label className="field-label" htmlFor="stash-amount">
          {t.t('stash.amount', { unit })}
        </label>
        <input
          id="stash-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step={unit === 'oz' ? '0.5' : '5'}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="field">
        <span className="field-label" id="stash-location-label">
          {t.t('stash.location')}
        </span>
        <div className="segmented" role="group" aria-labelledby="stash-location-label">
          {STASH_LOCATIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={location === option}
              onClick={() => setLocation(option)}
            >
              {t.t(LOCATION_LABELS[option])}
            </button>
          ))}
        </div>
      </div>

      <div className="button-row">
        <div className="field">
          <label className="field-label" htmlFor="stash-date">
            {t.t('stash.expressedDate')}
          </label>
          <input
            id="stash-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="stash-time">
            {t.t('stash.expressedTime')}
          </label>
          <input
            id="stash-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
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
        onClick={() => void save()}
        disabled={saving}
      >
        {t.t('stash.save')}
      </button>
    </Sheet>
  )
}
