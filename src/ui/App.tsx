import { useCallback, useEffect, useState } from 'react'
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
import { GrowthScreen } from './GrowthScreen'
import { Home } from './Home'
import { Onboarding } from './Onboarding'
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
  const [screen, setScreen] = useState<'home' | 'growth' | 'settings'>('home')
  const prefersDark = usePrefersDark()

  // A minute is fine for theme switching; the home screen keeps its own faster
  // clock for running timers.
  const now = useNow(60_000)

  const store = useBabyStore(settings.activeBabyId, settings.nightWindow)

  useEffect(() => {
    applyTheme(
      resolveTheme(settings.themeMode, now, settings.nightWindow, prefersDark),
    )
  }, [settings.themeMode, settings.nightWindow, now, prefersDark])

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
        onOpenSettings={() => setScreen('settings')}
        onOpenGrowth={() => setScreen('growth')}
      />
    </div>
  )
}
