import { useEffect, useState } from 'react'
import {
  askForNotifications,
  resolveNotificationState,
  type NotificationPermissionState,
} from '@/app/notifications'
import type { ReminderStore } from '@/app/useReminders'
import { SNOOZE_MS, type Reminder } from '@/domain/reminders'
import { isNativeApp } from '@/app/native'
import { useTranslator } from '@/i18n/context'
import { formatDuration } from '@/i18n/format'
import type { MessageKey } from '@/i18n/locales'
import { ReminderList } from './ReminderList'
import { ReminderSheet } from './ReminderSheet'
import { RuleLabel } from './RuleLabel'
import { BackIcon, CheckIcon } from './icons'

interface RemindersScreenProps {
  reminders: ReminderStore
  onBack: () => void
}

const PERMISSION_NOTES: Record<NotificationPermissionState, MessageKey | null> = {
  granted: 'reminders.notificationsGranted',
  denied: 'reminders.notificationsDenied',
  unsupported: 'reminders.notificationsUnsupported',
  default: null,
}

/** Managing reminders, and the one place notification permission is requested. */
export function RemindersScreen({ reminders, onBack }: RemindersScreenProps) {
  const t = useTranslator()
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [adding, setAdding] = useState(false)
  const [permission, setPermission] = useState<NotificationPermissionState>('default')
  const [toast, setToast] = useState<string | null>(null)

  // Read after mount: the permission is a platform API, and reading it during
  // render would make this component non-deterministic under test. Async because
  // the Android answer is — on the web it resolves in the same tick.
  useEffect(() => {
    void resolveNotificationState().then(setPermission)
  }, [])

  useEffect(() => {
    if (toast === null) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const permissionNote = PERMISSION_NOTES[permission]

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('reminders.title')}</span>
        </div>
      </header>

      <main className="page">
        {reminders.error !== null && (
          <p className="banner" data-tone="error" role="alert">
            {reminders.error}
          </p>
        )}

        <section className="section">
          <RuleLabel>{t.t('reminders.title')}</RuleLabel>
          {reminders.statuses.length === 0 ? (
            <>
              <p className="empty">{t.t('reminders.empty')}</p>
              <p className="field-note">{t.t('reminders.emptyHint')}</p>
            </>
          ) : (
            <ReminderList
              statuses={reminders.statuses}
              onEdit={setEditing}
              onToggle={(reminder, enabled) => {
                void reminders.update(reminder.id, { enabled })
              }}
              // Awaited before the toast: a message saying it was snoozed when
              // the write failed is worse than no message.
              onSnooze={(reminder) => {
                void reminders.snooze(reminder.id, Date.now()).then(() =>
                  setToast(
                    t.t('toast.reminderSnoozed', {
                      duration: formatDuration(t, SNOOZE_MS),
                    }),
                  ),
                )
              }}
              onDone={(reminder) => {
                void reminders.markDone(reminder.id, Date.now()).then(() =>
                  setToast(
                    t.t('toast.reminderDone', {
                      duration: formatDuration(t, reminder.intervalMs),
                    }),
                  ),
                )
              }}
            />
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setAdding(true)}
          >
            {t.t('reminders.add')}
          </button>
        </section>

        <section className="section">
          <RuleLabel>{t.t('reminders.notifications')}</RuleLabel>
          <div className="settings-group">
            {permission === 'default' && (
              <button
                type="button"
                className="button"
                data-variant="secondary"
                onClick={() => void askForNotifications().then(setPermission)}
              >
                {t.t('reminders.notificationsAsk')}
              </button>
            )}
            {permissionNote !== null && (
              <p className="field-note">{t.t(permissionNote)}</p>
            )}
            {/* The honest limit of a serverless app, stated where it matters
                rather than buried in a readme nobody opens at 3am. */}
            {/* Two different truths, and the app must not tell the wrong one. On the
                web nothing can wake a closed app; in the Android shell the OS holds
                the alarm and it arrives regardless. */}
            <p className="field-note">
              {t.t(isNativeApp() ? 'reminders.limitationNative' : 'reminders.limitation')}
            </p>
          </div>
        </section>
      </main>

      {(adding || editing !== null) && (
        <ReminderSheet
          existing={editing}
          onSave={async (input) => {
            if (editing !== null) await reminders.update(editing.id, input)
            else await reminders.add(input)
            setAdding(false)
            setEditing(null)
            setToast(t.t('toast.reminderSaved'))
          }}
          onDelete={
            editing === null
              ? null
              : async () => {
                  await reminders.remove(editing.id)
                  setEditing(null)
                  setToast(t.t('toast.reminderDeleted'))
                }
          }
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      {toast !== null && (
        <div className="toast" role="status" aria-live="polite">
          <CheckIcon size={16} />
          <span>{toast}</span>
        </div>
      )}
    </>
  )
}
