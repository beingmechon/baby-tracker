import { useState } from 'react'
import type { NewReminder } from '@/data/repository'
import { REMINDER_KINDS, type Reminder, type ReminderKind } from '@/domain/reminders'
import { HOUR_MS, MINUTE_MS } from '@/domain/time'
import { useTranslator } from '@/i18n/context'
import { formatDuration } from '@/i18n/format'
import type { MessageKey } from '@/i18n/locales'
import { Sheet } from './Sheet'

interface ReminderSheetProps {
  /** null when adding rather than editing. */
  existing: Reminder | null
  onSave: (reminder: NewReminder) => Promise<void>
  onDelete: (() => Promise<void>) | null
  onClose: () => void
}

const KIND_LABELS: Record<ReminderKind, MessageKey> = {
  feed: 'reminders.kind.feed',
  diaper: 'reminders.kind.diaper',
  pumping: 'reminders.kind.pumping',
  custom: 'reminders.kind.custom',
}

/**
 * The intervals worth offering, in milliseconds.
 *
 * A free-text minutes field would be more flexible and much worse: these are the
 * intervals a paediatrician or a pump schedule actually names, and picking from a
 * list is one tap instead of a keyboard.
 */
const INTERVALS = [
  30 * MINUTE_MS,
  45 * MINUTE_MS,
  HOUR_MS,
  90 * MINUTE_MS,
  2 * HOUR_MS,
  Math.round(2.5 * HOUR_MS),
  3 * HOUR_MS,
  Math.round(3.5 * HOUR_MS),
  4 * HOUR_MS,
  5 * HOUR_MS,
  6 * HOUR_MS,
  8 * HOUR_MS,
  12 * HOUR_MS,
  24 * HOUR_MS,
]

/** What each kind defaults to, so the common case needs no adjustment. */
const DEFAULT_INTERVAL: Record<ReminderKind, number> = {
  feed: 3 * HOUR_MS,
  diaper: 3 * HOUR_MS,
  pumping: 3 * HOUR_MS,
  custom: 24 * HOUR_MS,
}

export function ReminderSheet({
  existing,
  onSave,
  onDelete,
  onClose,
}: ReminderSheetProps) {
  const t = useTranslator()
  const [kind, setKind] = useState<ReminderKind>(existing?.kind ?? 'feed')
  const [label, setLabel] = useState(existing?.label ?? '')
  const [intervalMs, setIntervalMs] = useState(
    existing?.intervalMs ?? DEFAULT_INTERVAL.feed,
  )
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // An interval the parent chose by hand in an older version, or restored from a
  // backup, would otherwise vanish from the list and silently change on save.
  const options = INTERVALS.includes(intervalMs)
    ? INTERVALS
    : [...INTERVALS, intervalMs].sort((a, b) => a - b)

  async function save() {
    if (saving) return
    const trimmed = label.trim()
    if (kind === 'custom' && trimmed.length === 0) {
      setError(t.t('error.enterLabel'))
      return
    }
    setSaving(true)
    try {
      await onSave({
        kind,
        label: trimmed,
        intervalMs,
        enabled: existing?.enabled ?? true,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={t.t(existing === null ? 'reminders.add' : 'reminders.edit')}
      onClose={onClose}
    >
      <div className="field">
        <label className="field-label" htmlFor="reminder-kind">
          {t.t('reminders.kind')}
        </label>
        <select
          id="reminder-kind"
          value={kind}
          onChange={(event) => {
            const next = event.target.value as ReminderKind
            setKind(next)
            setError(null)
            // Only move the interval if it is still the previous default, so an
            // interval the parent chose deliberately is never overwritten.
            if (intervalMs === DEFAULT_INTERVAL[kind]) setIntervalMs(DEFAULT_INTERVAL[next])
          }}
        >
          {REMINDER_KINDS.map((option) => (
            <option key={option} value={option}>
              {t.t(KIND_LABELS[option])}
            </option>
          ))}
        </select>
      </div>

      {kind === 'custom' && (
        <div className="field">
          <label className="field-label" htmlFor="reminder-label">
            {t.t('reminders.label')}
          </label>
          <input
            id="reminder-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t.t('reminders.labelPlaceholder')}
          />
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="reminder-interval">
          {t.t('reminders.interval')}
        </label>
        <select
          id="reminder-interval"
          value={intervalMs}
          onChange={(event) => setIntervalMs(Number(event.target.value))}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {formatDuration(t, value)}
            </option>
          ))}
        </select>
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
        {t.t('reminders.save')}
      </button>

      {onDelete !== null &&
        (confirmingDelete ? (
          <div className="button-row">
            <button
              type="button"
              className="button"
              data-variant="secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              {t.t('edit.keep')}
            </button>
            <button
              type="button"
              className="button"
              data-variant="danger"
              onClick={() => void onDelete()}
            >
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
            {t.t('reminders.delete')}
          </button>
        ))}
    </Sheet>
  )
}
