import { useCallback, useEffect, useState } from 'react'
import { loadSettings, saveSettings, type Settings } from '@/app/settings'
import { applyTheme, resolveTheme } from '@/app/theme'
import { useBabyStore } from '@/app/useBabyStore'
import { useNow } from '@/app/useNow'
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

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [screen, setScreen] = useState<'home' | 'settings'>('home')
  const prefersDark = usePrefersDark()

  // A minute is fine for theme switching; the home screen keeps its own faster
  // clock for running timers.
  const now = useNow(60_000)

  const store = useBabyStore(settings.activeBabyId, settings.nightWindow)

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

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
            {store.error ?? 'Could not open your data on this device.'}
          </p>
          <p className="settings-note">
            This usually means the browser is blocking local storage — private
            browsing mode is the most common cause. Your data has not been lost.
          </p>
          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => void store.reload()}
          >
            Try again
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

  return (
    <div className="app">
      {screen === 'settings' ? (
        <SettingsScreen
          store={store}
          settings={settings}
          onChange={updateSettings}
          onBack={() => setScreen('home')}
        />
      ) : (
        <Home
          store={store}
          settings={settings}
          onOpenSettings={() => setScreen('settings')}
        />
      )}
    </div>
  )
}
