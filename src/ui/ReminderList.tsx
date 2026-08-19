import type { Reminder, ReminderStatus } from '@/domain/reminders'
import { useTranslator } from '@/i18n/context'
import { formatDuration, formatReminderState, reminderName } from '@/i18n/format'

interface ReminderListProps {
  statuses: readonly ReminderStatus[]
  /** Omitted on the home screen, where tapping a row would be a trap. */
  onEdit?: (reminder: Reminder) => void
  /** Omitted on the home screen: turning a reminder off is a settings decision. */
  onToggle?: (reminder: Reminder, enabled: boolean) => void
  onSnooze: (reminder: Reminder) => void
  onDone: (reminder: Reminder) => void
}

/**
 * Reminders as ruled rows, the same timetable form as the timeline.
 *
 * Snooze and Done appear only on a reminder that is actually due. Showing them
 * always would put two permanent buttons on every row for the sake of an action
 * that is meaningless most of the time.
 */
export function ReminderList({
  statuses,
  onEdit,
  onToggle,
  onSnooze,
  onDone,
}: ReminderListProps) {
  const t = useTranslator()

  return (
    <div className="reminders">
      {statuses.map((status) => {
        const { reminder, state } = status
        const name = reminderName(t, reminder.kind, reminder.label)
        return (
          <div className="reminder-row" key={reminder.id} data-state={state}>
            <div className="reminder-identity">
              {onEdit === undefined ? (
                <span className="reminder-name">{name}</span>
              ) : (
                <button
                  type="button"
                  className="reminder-name-button"
                  onClick={() => onEdit(reminder)}
                >
                  <span className="reminder-name">{name}</span>
                  <span className="sr-only">{t.t('reminders.edit')}</span>
                </button>
              )}
              <span className="reminder-state num">
                {formatReminderState(t, status)}
                {state !== 'off' && (
                  <span className="reminder-every">
                    {' · '}
                    {t.t('reminders.interval').toLocaleLowerCase(t.locale)}{' '}
                    {formatDuration(t, reminder.intervalMs)}
                  </span>
                )}
              </span>
            </div>

            {onToggle !== undefined && (
              <input
                type="checkbox"
                className="reminder-toggle"
                checked={reminder.enabled}
                onChange={(event) => onToggle(reminder, event.target.checked)}
                aria-label={`${name} · ${t.t('reminders.enabled')}`}
              />
            )}

            {state === 'due' && (
              <div className="reminder-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => onSnooze(reminder)}
                >
                  {t.t('reminders.snooze')}
                </button>
                <button
                  type="button"
                  className="chip"
                  data-emphasis="primary"
                  onClick={() => onDone(reminder)}
                >
                  {t.t('reminders.done')}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
