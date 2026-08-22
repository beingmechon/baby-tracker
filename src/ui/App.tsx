import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadSettings,
  resolveLocale,
  saveSettings,
  type Settings,
} from '@/app/settings'
import { useTranslator } from '@/i18n/context'
import { I18nProvider } from '@/i18n/I18nProvider'
import { applyTheme, resolveTheme } from '@/app/theme'
import { useBabyStore } from '@/app/useBabyStore'
import { useNow } from '@/app/useNow'
import { useReminders } from '@/app/useReminders'
import { useStash } from '@/app/useStash'
import { showLocalNotification } from '@/app/notifications'
import { isNativeApp, scheduleNativeAlerts } from '@/app/native'
import { plannedAlerts, samePlan, type PlannedAlert } from '@/domain/scheduling'
import type { ReminderStatus } from '@/domain/reminders'
import { reminderName } from '@/i18n/format'
import { GrowthScreen } from './GrowthScreen'
import { ActivityScreen } from './ActivityScreen'
import { FoodScreen } from './FoodScreen'
import { MilestonesScreen } from './MilestonesScreen'
import { HealthScreen } from './HealthScreen'
import { IllnessScreen } from './IllnessScreen'
import { HandoverScreen } from './HandoverScreen'
import { PatternsScreen } from './PatternsScreen'
import { Home } from './Home'
import { Onboarding } from './Onboarding'
import { RemindersScreen } from './RemindersScreen'
import { StashScreen } from './StashScreen'
import { SettingsScreen } from './SettingsScreen'

/** Tracks the OS light/dark preference so `auto` can follow it. */
function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (query === undefined) return
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return prefersDark
}

/**
 * The shell owns settings and provides the translator, so everything below it —
 * including the storage-error screen — can be localized.
 */
export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return (
    <I18nProvider locale={resolveLocale(settings)}>
      <AppContent settings={settings} updateSettings={updateSettings} />
    </I18nProvider>
  )
}

function AppContent({
  settings,
  updateSettings,
}: {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}) {
  const t = useTranslator()
  const [screen, setScreen] = useState<
    | 'home'
    | 'growth'
    | 'reminders'
    | 'stash'
    | 'health'
    | 'patterns'
    | 'handover'
    | 'illness'
    | 'food'
    | 'activity'
    | 'milestones'
    | 'settings'
  >('home')
  const prefersDark = usePrefersDark()

  // Drives theme switching and the reminder check. Twenty seconds rather than a
  // minute purely for the reminders: a full minute of lag between a reminder
  // falling due and the screen saying so is noticeable, where twenty seconds on
  // something scheduled in hours is not. The home screen keeps its own faster
  // clock for running timers.
  const now = useNow(20_000)

  const store = useBabyStore(
    settings.activeBabyId,
    settings.nightWindow,
    settings.togetherIds,
  )

  /**
   * Raising the notification for a due reminder. Held in a ref-stable callback so
   * the alerting effect does not re-run on every render of the shell.
   */
  const alert = useCallback(
    async ({ reminder }: ReminderStatus) => {
      // In the Android shell the OS already holds an alarm for this moment, and it
      // fires whether the app is open, backgrounded or dead. Raising a second
      // notification from the page would put two of the same thing in the shade.
      if (isNativeApp()) return
      await showLocalNotification({
        title: reminderName(t, reminder.kind, reminder.label),
        body: t.t('reminders.due'),
        // Keyed by id, so re-alerting the same reminder replaces its notification
        // rather than stacking a second one in the shade.
        tag: `reminder-${reminder.id}`,
      })
    },
    [t],
  )

  const reminders = useReminders(store.activeBaby?.id ?? null, store.events, now, alert)
  const stash = useStash(store.activeBaby?.id ?? null, now)

  useEffect(() => {
    applyTheme(
      resolveTheme(settings.themeMode, now, settings.nightWindow, prefersDark),
    )
  }, [settings.themeMode, settings.nightWindow, now, prefersDark])

  /**
   * Hands the upcoming reminders to Android's alarm scheduler.
   *
   * This is the one thing the shell exists for: an alarm the OS holds fires when the
   * app is closed, which no browser API can do. On the web the effect is a no-op —
   * `scheduleNativeAlerts` answers false and nothing is loaded.
   *
   * The last plan is remembered so an unchanged one is not re-issued. The clock
   * ticks every twenty seconds; rewriting the same three alarms three times a
   * minute for months is exactly what shows up in a battery report.
   */
  const scheduled = useRef<PlannedAlert[]>([])
  useEffect(() => {
    if (!isNativeApp()) return
    const plan = plannedAlerts(reminders.statuses, now)
    if (samePlan(plan, scheduled.current)) return
    scheduled.current = plan

    void scheduleNativeAlerts(
      plan.map((planItem) => {
        const status = reminders.statuses.find(
          (candidate) => candidate.reminder.id === planItem.reminderId,
        )
        return {
          nativeId: planItem.nativeId,
          at: planItem.at,
          title:
            status === undefined
              ? t.t('app.name')
              : reminderName(t, status.reminder.kind, status.reminder.label),
          body: t.t('reminders.due'),
        }
      }),
    )
  }, [reminders.statuses, now, t])

  // Remember which baby is open, so the app returns to the right one.
  useEffect(() => {
    if (store.activeBaby !== null && store.activeBaby.id !== settings.activeBabyId) {
      updateSettings({ activeBabyId: store.activeBaby.id })
    }
  }, [store.activeBaby, settings.activeBabyId, updateSettings])

  if (store.status === 'loading') {
    // Deliberately blank rather than a spinner: a local read takes a few
    // milliseconds, and a flashed spinner reads as slower than none at all.
    return <div className="app" aria-busy="true" />
  }

  if (store.status === 'error') {
    return (
      <div className="app">
        <main className="page">
          <p className="banner" data-tone="error" role="alert">
            {store.error ?? t.t('error.storageBlocked')}
          </p>
          <p className="field-note">{t.t('error.storageBlockedNote')}</p>
          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => void store.reload()}
          >
            {t.t('error.tryAgain')}
          </button>
        </main>
      </div>
    )
  }

  if (store.activeBaby === null) {
    return (
      <div className="app">
        <Onboarding
          onCreate={async (input) => {
            const baby = await store.createBaby(input)
            updateSettings({ activeBabyId: baby.id })
          }}
        />
      </div>
    )
  }

  if (screen === 'settings') {
    return (
      <div className="app">
        <SettingsScreen
          store={store}
          settings={settings}
          onChange={updateSettings}
          onBack={() => setScreen('home')}
        />
      </div>
    )
  }

  if (screen === 'reminders') {
    return (
      <div className="app">
        <RemindersScreen reminders={reminders} onBack={() => setScreen('home')} />
      </div>
    )
  }

  if (screen === 'patterns') {
    return (
      <div className="app">
        <PatternsScreen
          store={store}
          settings={settings}
          now={now}
          onBack={() => setScreen('home')}
        />
      </div>
    )
  }

  if (screen === 'handover') {
    return (
      <div className="app">
        <HandoverScreen
          store={store}
          settings={settings}
          now={now}
          onBack={() => setScreen('home')}
        />
      </div>
    )
  }

  if (screen === 'milestones') {
    return (
      <div className="app">
        <MilestonesScreen store={store} onBack={() => setScreen('home')} />
      </div>
    )
  }

  if (screen === 'activity') {
    return (
      <div className="app">
        <ActivityScreen
          store={store}
          settings={settings}
          now={now}
          onBack={() => setScreen('home')}
        />
      </div>
    )
  }

  if (screen === 'food') {
    return (
      <div className="app">
        <FoodScreen store={store} now={now} onBack={() => setScreen('home')} />
      </div>
    )
  }

  if (screen === 'illness') {
    return (
      <div className="app">
        <IllnessScreen store={store} now={now} onBack={() => setScreen('home')} />
      </div>
    )
  }

  if (screen === 'health') {
    return (
      <div className="app">
        <HealthScreen
          store={store}
          settings={settings}
          now={now}
          onBack={() => setScreen('home')}
        />
      </div>
    )
  }

  if (screen === 'stash') {
    return (
      <div className="app">
        <StashScreen
          stash={stash}
          settings={settings}
          now={now}
          onBack={() => setScreen('home')}
        />
      </div>
    )
  }

  if (screen === 'growth') {
    return (
      <div className="app">
        <GrowthScreen
          store={store}
          settings={settings}
          now={now}
          onBack={() => setScreen('home')}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <Home
        store={store}
        settings={settings}
        reminders={reminders}
        onOpenSettings={() => setScreen('settings')}
        onOpenGrowth={() => setScreen('growth')}
        onOpenReminders={() => setScreen('reminders')}
        onOpenStash={() => setScreen('stash')}
        onOpenHealth={() => setScreen('health')}
        onOpenPatterns={() => setScreen('patterns')}
        onOpenHandover={() => setScreen('handover')}
        onOpenIllness={() => setScreen('illness')}
        onOpenFood={() => setScreen('food')}
        onOpenActivity={() => setScreen('activity')}
        onOpenMilestones={() => setScreen('milestones')}
        onSwitchBaby={(babyId) => updateSettings({ activeBabyId: babyId })}
      />
    </div>
  )
}
