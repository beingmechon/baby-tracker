import { useRef, useState } from 'react'
import type { Settings, ThemeMode } from '@/app/settings'
import type { BabyStore } from '@/app/useBabyStore'
import { toCsv } from '@/data/csv'
import { downloadTextFile, exportFilename, readTextFile } from '@/data/download'
import { localDateKey } from '@/domain/time'
import type { VolumeUnit } from '@/domain/types'
import { BackIcon, CheckIcon, ShieldIcon } from './icons'

interface SettingsScreenProps {
  store: BabyStore
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onBack: () => void
}

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'night', label: 'Night' },
]

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:00 ${suffix}`
}

export function SettingsScreen({
  store,
  settings,
  onChange,
  onBack,
}: SettingsScreenProps) {
  const { activeBaby } = store
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingWipe, setConfirmingWipe] = useState(false)
  const [name, setName] = useState(activeBaby?.name ?? '')
  const [birthDate, setBirthDate] = useState(activeBaby?.birthDate ?? '')

  async function exportJson() {
    try {
      const bundle = await store.exportAll()
      downloadTextFile(
        exportFilename('json'),
        JSON.stringify(bundle, null, 2),
        'application/json',
      )
      setMessage('Exported a full JSON backup.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed')
    }
  }

  async function exportCsv() {
    try {
      const bundle = await store.exportAll()
      downloadTextFile(exportFilename('csv'), toCsv(bundle), 'text/csv')
      setMessage('Exported a CSV for spreadsheets and doctor visits.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed')
    }
  }

  async function importJson(file: File) {
    setError(null)
    setMessage(null)
    try {
      const bundle: unknown = JSON.parse(await readTextFile(file))
      const result = await store.importBundle(bundle)
      const skipped = result.skipped.reduce((total, entry) => total + entry.count, 0)
      setMessage(
        `Imported ${result.eventsImported} entries for ${result.babiesImported} ${
          result.babiesImported === 1 ? 'baby' : 'babies'
        }${skipped > 0 ? `. Skipped ${skipped} unreadable record${skipped === 1 ? '' : 's'}.` : '.'}`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That file could not be imported')
    }
  }

  async function saveBaby() {
    if (activeBaby === null) return
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError('A name is required.')
      return
    }
    try {
      await store.updateBaby(activeBaby.id, {
        name: trimmed,
        birthDate: birthDate === '' ? null : birthDate,
      })
      setMessage('Details saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save')
    }
  }

  async function wipeEverything() {
    try {
      await store.clearAll()
      // Settings hold the active baby id, which no longer exists.
      onChange({ activeBabyId: null })
      setConfirmingWipe(false)
      setMessage('All data deleted from this device.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete')
    }
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">Back</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">Settings</span>
        </div>
      </header>

      <main className="page">
        {message !== null && (
          <p className="banner" data-tone="info" role="status">
            <CheckIcon size={18} />
            {message}
          </p>
        )}
        {error !== null && (
          <p className="banner" data-tone="error" role="alert">
            {error}
          </p>
        )}

        {activeBaby !== null && (
          <section className="section">
            <div className="section-heading">
              <h2>Baby</h2>
            </div>
            <div className="settings-group">
              <div className="field">
                <label className="field-label" htmlFor="settings-name">
                  Name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="settings-birthdate">
                  Date of birth
                </label>
                <input
                  id="settings-birthdate"
                  type="date"
                  value={birthDate}
                  max={localDateKey(Date.now())}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="button"
                data-variant="secondary"
                onClick={() => void saveBaby()}
              >
                Save details
              </button>
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-heading">
            <h2>Display</h2>
          </div>
          <div className="settings-group">
            <div className="field">
              <span className="field-label" id="settings-unit-label">
                Volume unit
              </span>
              <div className="segmented" role="group" aria-labelledby="settings-unit-label">
                {(['ml', 'oz'] as VolumeUnit[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={settings.volumeUnit === unit}
                    onClick={() => onChange({ volumeUnit: unit })}
                  >
                    {unit === 'ml' ? 'Millilitres' : 'Ounces'}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label" id="settings-theme-label">
                Theme
              </span>
              <div
                className="segmented"
                role="group"
                aria-labelledby="settings-theme-label"
              >
                {THEMES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={settings.themeMode === value}
                    onClick={() => onChange({ themeMode: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="settings-note">
                On auto, the app switches to a dim red-tinted night theme during
                your night hours, and follows your system light or dark setting
                the rest of the time.
              </p>
            </div>

            <div className="button-row">
              <div className="field">
                <label className="field-label" htmlFor="settings-night-start">
                  Night starts
                </label>
                <select
                  id="settings-night-start"
                  value={settings.nightWindow.startHour}
                  onChange={(e) =>
                    onChange({
                      nightWindow: {
                        ...settings.nightWindow,
                        startHour: Number(e.target.value),
                      },
                    })
                  }
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="settings-night-end">
                  Night ends
                </label>
                <select
                  id="settings-night-end"
                  value={settings.nightWindow.endHour}
                  onChange={(e) =>
                    onChange({
                      nightWindow: {
                        ...settings.nightWindow,
                        endHour: Number(e.target.value),
                      },
                    })
                  }
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="settings-note">
              These hours also decide whether a new sleep is logged as a nap or as
              night sleep.
            </p>

            <div className="switch-row">
              <span className="switch-row-label">Show wake-window guidance</span>
              <input
                type="checkbox"
                checked={settings.showWakeWindowGuidance}
                onChange={(e) => onChange({ showWakeWindowGuidance: e.target.checked })}
                aria-label="Show wake-window guidance"
                style={{ width: '1.5rem', height: '1.5rem' }}
              />
            </div>
            <p className="settings-note">
              Typical wake windows by age, shown for information only. Babies vary
              enormously — this is never advice.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>Your data</h2>
          </div>
          <div className="settings-group">
            <p className="settings-note">
              <ShieldIcon size={16} /> Everything is stored on this device only.
              There is no account, no server and no analytics. Exports are yours to
              keep.
            </p>
            <div className="button-row">
              <button
                type="button"
                className="button"
                data-variant="secondary"
                onClick={() => void exportJson()}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="button"
                data-variant="secondary"
                onClick={() => void exportCsv()}
              >
                Export CSV
              </button>
            </div>
            <p className="settings-note">
              JSON is a complete backup you can import again. CSV opens in any
              spreadsheet — useful to print for a doctor’s appointment.
            </p>

            <button
              type="button"
              className="button"
              data-variant="secondary"
              onClick={() => fileInput.current?.click()}
            >
              Import a JSON backup
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                // Reset so picking the same file twice fires a change event.
                e.target.value = ''
                if (file !== undefined) void importJson(file)
              }}
            />

            {confirmingWipe ? (
              <>
                <p className="banner" data-tone="error">
                  This permanently deletes every baby and every entry on this
                  device. If you have not exported a backup, it cannot be undone.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button"
                    data-variant="secondary"
                    onClick={() => setConfirmingWipe(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button"
                    data-variant="danger"
                    onClick={() => void wipeEverything()}
                  >
                    Delete everything
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="button"
                data-variant="danger"
                onClick={() => setConfirmingWipe(true)}
              >
                Delete all my data
              </button>
            )}
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>About</h2>
          </div>
          <div className="settings-group">
            <p className="settings-note">
              Baby Tracker is free and open source, licensed under the AGPL-3.0.
              Built for parents, by parents — contributions welcome.
            </p>
            <p className="settings-note">
              <strong>Not a medical device.</strong> This app records what you tell
              it and shows you your own data. It does not diagnose anything and is
              no substitute for your paediatrician. If you are worried about your
              baby, call a doctor.
            </p>
            <a
              className="button"
              data-variant="secondary"
              href="https://github.com/beingmechon/baby-tracker"
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              Source code and issues
            </a>
          </div>
        </section>

        <p className="footer-note">Baby Tracker v0.1 · works offline · no telemetry</p>
      </main>
    </>
  )
}
