import { useState } from 'react'
import type { NewReminder } from '@/data/repository'
import {
  REMINDER_KINDS,
  firstDuePatch,
  isValidInterval,
  nextOccurrenceOf,
  type FirstDue,
  type FirstDueAnchor,
  type Reminder,
  type ReminderKind,
} from '@/domain/reminders'
import { HOUR_MS, MINUTE_MS } from '@/domain/time'
import { useTranslator } from '@/i18n/context'
import { formatDuration } from '@/i18n/format'
import type { MessageKey } from '@/i18n/locales'
import { Sheet } from './Sheet'
import {
  fromTimeInput,
  minutesInputToMs,
  msToMinutesInput,
  toTimeInputValue,
} from './datetimeInput'

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
 * The list comes first because these are the intervals a paediatrician or a pump
 * schedule actually names, and picking one is a tap instead of a keyboard. But a
 * list is not the whole world — a dose every 100 minutes is a real prescription —
 * so `CUSTOM` at the end opens a minutes field for the schedules nobody anticipated.
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

/** The sentinel the interval select uses for "let me type it". Not an interval. */
const CUSTOM = 'custom'

/**
 * When the first alert should land, which is a separate question from how often.
 *
 * It exists because the interval alone cannot say "at six every evening", and
 * because a reminder added at 2am should not have to wait for a feed to be logged
 * before it means anything. `keep` appears only when editing: changing an interval
 * must not silently discard a reminder's history of being marked done.
 */
type FirstDueChoice = FirstDue | 'keep'

const CHOICE_LABELS: Record<Exclude<FirstDueChoice, 'log'>, MessageKey> = {
  keep: 'reminders.firstDue.keep',
  now: 'reminders.firstDue.now',
  at: 'reminders.firstDue.at',
}

/**
 * What "after the last one" means for each kind.
 *
 * Spelled out per kind rather than composed from the kind's name: "an interval after
 * the last Diaper change" reads like a machine wrote it, and for a custom reminder
 * there is no event to be after at all — which is why `custom` has no `log` option.
 */
const LOG_LABELS: Partial<Record<ReminderKind, MessageKey>> = {
  feed: 'reminders.firstDue.lastFeed',
  diaper: 'reminders.firstDue.lastChange',
  pumping: 'reminders.firstDue.lastPumping',
}

/** The next whole hour: a default that is unambiguous and never already past. */
function nextHour(now: number): string {
  const hour = new Date(now)
  hour.setHours(hour.getHours() + 1, 0, 0, 0)
  return toTimeInputValue(hour.getTime())
}

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
  // The interval field is a list until the parent asks for a keyboard. An interval
  // already off the list — typed here before, or restored from a backup — opens the
  // field on its own, so it can be seen and changed rather than merely preserved.
  const [typingInterval, setTypingInterval] = useState(
    existing !== null && !INTERVALS.includes(existing.intervalMs),
  )
  const [intervalMinutes, setIntervalMinutes] = useState(() =>
    msToMinutesInput(existing?.intervalMs ?? DEFAULT_INTERVAL.feed),
  )
  const [firstDue, setFirstDue] = useState<FirstDueChoice>(
    existing === null ? 'log' : 'keep',
  )
  const [dueTime, setDueTime] = useState(() => nextHour(Date.now()))
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = INTERVALS.includes(intervalMs)
    ? INTERVALS
    : [...INTERVALS, intervalMs].sort((a, b) => a - b)

  // 'log' means "an interval after the last one of these", and a custom reminder has
  // no "these": nothing in the log corresponds to remembering vitamin D drops.
  const choices: FirstDueChoice[] = [
    ...(existing === null ? [] : (['keep'] as FirstDueChoice[])),
    ...(kind === 'custom' ? [] : (['log'] as FirstDueChoice[])),
    'now',
    'at',
  ]
  const choice: FirstDueChoice = choices.includes(firstDue) ? firstDue : 'now'

  async function save() {
    if (saving) return
    const trimmed = label.trim()
    if (kind === 'custom' && trimmed.length === 0) {
      setError(t.t('error.enterLabel'))
      return
    }

    const interval = typingInterval ? minutesInputToMs(intervalMinutes) : intervalMs
    if (interval === null || !isValidInterval(interval)) {
      setError(t.t('error.enterInterval'))
      return
    }

    // Only the chosen time is parsed here; turning it into "the next 6pm" belongs to
    // the domain, which is also where the anchor arithmetic is tested.
    let anchor: FirstDueAnchor | null = null
    if (choice !== 'keep') {
      let atTime: number | null = null
      if (choice === 'at') {
        const parts = fromTimeInput(dueTime)
        if (parts === null) {
          setError(t.t('error.invalidTime'))
          return
        }
        atTime = nextOccurrenceOf(parts.hour, parts.minute, Date.now())
      }
      anchor = firstDuePatch(choice, interval, Date.now(), atTime)
    }

    setSaving(true)
    try {
      await onSave({
        kind,
        label: trimmed,
        intervalMs: interval,
        enabled: existing?.enabled ?? true,
        ...anchor,
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
          value={typingInterval ? CUSTOM : intervalMs}
          onChange={(event) => {
            setError(null)
            if (event.target.value === CUSTOM) {
              // Carry the interval across, so the field opens on what was showing
              // rather than empty.
              setIntervalMinutes(msToMinutesInput(intervalMs))
              setTypingInterval(true)
              return
            }
            setTypingInterval(false)
            setIntervalMs(Number(event.target.value))
          }}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {formatDuration(t, value)}
            </option>
          ))}
          <option value={CUSTOM}>{t.t('reminders.intervalCustom')}</option>
        </select>
      </div>

      {typingInterval && (
        <div className="field">
          <label className="field-label" htmlFor="reminder-minutes">
            {t.t('reminders.intervalMinutes')}
          </label>
          <input
            id="reminder-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={intervalMinutes}
            onChange={(event) => {
              setIntervalMinutes(event.target.value)
              setError(null)
            }}
          />
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="reminder-first-due">
          {t.t('reminders.firstDue')}
        </label>
        <select
          id="reminder-first-due"
          value={choice}
          onChange={(event) => {
            setFirstDue(event.target.value as FirstDueChoice)
            setError(null)
          }}
        >
          {choices.map((option) => (
            <option key={option} value={option}>
              {t.t(
                option === 'log'
                  ? (LOG_LABELS[kind] ?? 'reminders.firstDue.now')
                  : CHOICE_LABELS[option],
              )}
            </option>
          ))}
        </select>
      </div>

      {choice === 'at' && (
        <>
          <div className="field">
            <label className="field-label" htmlFor="reminder-due-time">
              {t.t('reminders.firstDueTime')}
            </label>
            <input
              id="reminder-due-time"
              type="time"
              value={dueTime}
              onChange={(event) => {
                setDueTime(event.target.value)
                setError(null)
              }}
            />
          </div>
          {/* The limitation, said where it applies rather than nowhere: for these
              kinds a later logged event moves the reminder, because a reminder to
              feed that ignores the feeds would be worse than an inexact clock. */}
          {kind !== 'custom' && (
            <p className="field-note">{t.t('reminders.firstDueDrift')}</p>
          )}
        </>
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
