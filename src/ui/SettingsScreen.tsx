import { useRef, useState } from 'react'
import type { Settings, ThemeMode } from '@/app/settings'
import type { BabyStore } from '@/app/useBabyStore'
import { toCsv } from '@/data/csv'
import { downloadTextFile, exportFilename, readTextFile } from '@/data/download'
import { localDateKey } from '@/domain/time'
import type { MeasureSystem, Sex, VolumeUnit } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { LOCALES, findLocale, type LocaleCode, type MessageKey } from '@/i18n/locales'
import { RuleLabel } from './RuleLabel'
import { BackIcon, CheckIcon, ShieldIcon } from './icons'

interface SettingsScreenProps {
  store: BabyStore
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onBack: () => void
}

const THEMES = [
  { value: 'auto', label: 'settings.theme.auto' },
  { value: 'day', label: 'settings.theme.day' },
  { value: 'dark', label: 'settings.theme.dark' },
  { value: 'night', label: 'settings.theme.night' },
] as const satisfies readonly { value: ThemeMode; label: MessageKey }[]

const VOLUME_UNITS = [
  { value: 'ml', label: 'settings.volumeUnit.ml' },
  { value: 'oz', label: 'settings.volumeUnit.oz' },
] as const satisfies readonly { value: VolumeUnit; label: MessageKey }[]

const MEASURE_SYSTEMS = [
  { value: 'metric', label: 'settings.measureUnit.metric' },
  { value: 'imperial', label: 'settings.measureUnit.imperial' },
] as const satisfies readonly { value: MeasureSystem; label: MessageKey }[]

/** null is a real option, not an absence: recording it is the parent's choice. */
const SEXES = [
  { value: null, label: 'settings.sex.unset' },
  { value: 'male', label: 'settings.sex.male' },
  { value: 'female', label: 'settings.sex.female' },
] as const satisfies readonly { value: Sex | null; label: MessageKey }[]

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export function SettingsScreen({
  store,
  settings,
  onChange,
  onBack,
}: SettingsScreenProps) {
  const t = useTranslator()
  const { activeBaby } = store
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingWipe, setConfirmingWipe] = useState(false)
  const [name, setName] = useState(activeBaby?.name ?? '')
  const [birthDate, setBirthDate] = useState(activeBaby?.birthDate ?? '')
  const [sex, setSex] = useState<Sex | null>(activeBaby?.sex ?? null)

  /** An hour label in the reader's locale, so es shows 21:00 rather than 9:00 pm. */
  function hourLabel(hour: number): string {
    const sample = new Date(2026, 0, 1, hour, 0)
    return new Intl.DateTimeFormat(t.locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(sample)
  }

  const activeLocale = settings.locale ?? t.locale
  const localeDefinition = findLocale(activeLocale)

  async function exportJson() {
    try {
      const bundle = await store.exportAll()
      downloadTextFile(
        exportFilename('json'),
        JSON.stringify(bundle, null, 2),
        'application/json',
      )
      setMessage(t.t('toast.exportedJson'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.exportFailed'))
    }
  }

  async function exportCsv() {
    try {
      const bundle = await store.exportAll()
      downloadTextFile(exportFilename('csv'), toCsv(bundle), 'text/csv')
      setMessage(t.t('toast.exportedCsv'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.exportFailed'))
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
        t.t('toast.imported', {
          events: t.number(result.eventsImported),
          babies: t.number(result.babiesImported),
          skipped:
            skipped > 0 ? t.t('toast.importedSkipped', { count: t.number(skipped) }) : '',
        }),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.importFailed'))
    }
  }

  async function saveBaby() {
    if (activeBaby === null) return
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError(t.t('error.nameRequired'))
      return
    }
    try {
      await store.updateBaby(activeBaby.id, {
        name: trimmed,
        birthDate: birthDate === '' ? null : birthDate,
        sex,
      })
      setMessage(t.t('toast.detailsSaved'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
    }
  }

  async function wipeEverything() {
    try {
      await store.clearAll()
      // Settings hold the active baby id, which no longer exists.
      onChange({ activeBabyId: null })
      setConfirmingWipe(false)
      setMessage(t.t('toast.dataDeleted'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotDelete'))
    }
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('settings.title')}</span>
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
            <RuleLabel>{t.t('settings.baby')}</RuleLabel>
            <div className="settings-group">
              <div className="field">
                <label className="field-label" htmlFor="settings-name">
                  {t.t('settings.name')}
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
                  {t.t('settings.birthDate')}
                </label>
                <input
                  id="settings-birthdate"
                  type="date"
                  value={birthDate}
                  max={localDateKey(Date.now())}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
              <div className="field">
                <span className="field-label" id="settings-sex-label">
                  {t.t('settings.sex')}
                </span>
                <div
                  className="segmented"
                  role="group"
                  aria-labelledby="settings-sex-label"
                >
                  {SEXES.map(({ value, label }) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={sex === value}
                      onClick={() => setSex(value)}
                    >
                      {t.t(label)}
                    </button>
                  ))}
                </div>
                <p className="field-note">{t.t('settings.sexNote')}</p>
              </div>
              <button
                type="button"
                className="button"
                data-variant="secondary"
                onClick={() => void saveBaby()}
              >
                {t.t('settings.saveDetails')}
              </button>
            </div>
          </section>
        )}

        <section className="section">
          <RuleLabel>{t.t('settings.display')}</RuleLabel>
          <div className="settings-group">
            <div className="field">
              <label className="field-label" htmlFor="settings-language">
                {t.t('settings.language')}
              </label>
              <select
                id="settings-language"
                value={activeLocale}
                onChange={(e) => onChange({ locale: e.target.value as LocaleCode })}
              >
                {LOCALES.filter(
                  // The pseudo-locale is a testing tool; it stays out of
                  // production builds so nobody selects it by accident.
                  (locale) => locale.development !== true || import.meta.env.DEV,
                ).map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.name}
                  </option>
                ))}
              </select>
              {localeDefinition?.reviewed === false && (
                <p className="field-note">{t.t('settings.languageNeedsReview')}</p>
              )}
            </div>

            <div className="field">
              <span className="field-label" id="settings-unit-label">
                {t.t('settings.volumeUnit')}
              </span>
              <div className="segmented" role="group" aria-labelledby="settings-unit-label">
                {VOLUME_UNITS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={settings.volumeUnit === value}
                    onClick={() => onChange({ volumeUnit: value })}
                  >
                    {t.t(label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label" id="settings-measure-label">
                {t.t('settings.measureUnit')}
              </span>
              <div
                className="segmented"
                role="group"
                aria-labelledby="settings-measure-label"
              >
                {MEASURE_SYSTEMS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={settings.measureSystem === value}
                    onClick={() => onChange({ measureSystem: value })}
                  >
                    {t.t(label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label" id="settings-theme-label">
                {t.t('settings.theme')}
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
                    {t.t(label)}
                  </button>
                ))}
              </div>
              <p className="field-note">{t.t('settings.themeNote')}</p>
            </div>

            <div className="button-row">
              <div className="field">
                <label className="field-label" htmlFor="settings-night-start">
                  {t.t('settings.nightStarts')}
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
                  {t.t('settings.nightEnds')}
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
            <p className="field-note">{t.t('settings.nightNote')}</p>

            <div className="switch-row">
              <span className="switch-row-label">{t.t('settings.wakeGuidance')}</span>
              <input
                type="checkbox"
                checked={settings.showWakeWindowGuidance}
                onChange={(e) => onChange({ showWakeWindowGuidance: e.target.checked })}
                aria-label={t.t('settings.wakeGuidance')}
              />
            </div>
            <p className="field-note">{t.t('settings.wakeGuidanceNote')}</p>
          </div>
        </section>

        <section className="section">
          <RuleLabel>{t.t('settings.data')}</RuleLabel>
          <div className="settings-group">
            <p className="field-note">
              <ShieldIcon size={16} /> {t.t('settings.dataNote')}
            </p>
            <div className="button-row">
              <button
                type="button"
                className="button"
                data-variant="secondary"
                onClick={() => void exportJson()}
              >
                {t.t('settings.exportJson')}
              </button>
              <button
                type="button"
                className="button"
                data-variant="secondary"
                onClick={() => void exportCsv()}
              >
                {t.t('settings.exportCsv')}
              </button>
            </div>
            <p className="field-note">{t.t('settings.exportNote')}</p>

            <button
              type="button"
              className="button"
              data-variant="secondary"
              onClick={() => fileInput.current?.click()}
            >
              {t.t('settings.import')}
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
                  {t.t('settings.deleteWarning')}
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button"
                    data-variant="secondary"
                    onClick={() => setConfirmingWipe(false)}
                  >
                    {t.t('settings.cancel')}
                  </button>
                  <button
                    type="button"
                    className="button"
                    data-variant="danger"
                    onClick={() => void wipeEverything()}
                  >
                    {t.t('settings.confirmDeleteAll')}
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
                {t.t('settings.deleteAll')}
              </button>
            )}
          </div>
        </section>

        <section className="section">
          <RuleLabel>{t.t('settings.about')}</RuleLabel>
          <div className="settings-group">
            <p className="field-note">{t.t('settings.aboutNote')}</p>
            <p className="field-note">
              <strong>{t.t('settings.notMedical')}</strong> {t.t('settings.medicalNote')}
            </p>
            <a
              className="link-button"
              href="https://github.com/beingmechon/baby-tracker"
              target="_blank"
              rel="noreferrer"
            >
              {t.t('settings.sourceCode')}
            </a>
          </div>
        </section>

        <p className="footer-note">
          {t.t('settings.footer', { version: __APP_VERSION__ })}
        </p>
      </main>
    </>
  )
}
