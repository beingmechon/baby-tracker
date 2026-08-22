import { useState } from 'react'
import { TEMPERATURE_SITES, isValidTemperature, toHundredths } from '@/domain/health'
import type { MeasureSystem, TemperatureSite } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  temperatureSiteName,
  temperatureUnit,
  temperatureUnitSymbol,
} from '@/i18n/format'
import { Sheet } from './Sheet'

interface TemperatureSheetProps {
  system: MeasureSystem
  /** The site used last, so the common case needs no adjustment. */
  lastSite: TemperatureSite | null
  onSave: (input: {
    celsiusHundredths: number
    site: TemperatureSite
  }) => Promise<void>
  onClose: () => void
}

/** Logging a temperature reading, with where it was taken. */
export function TemperatureSheet({
  system,
  lastSite,
  onSave,
  onClose,
}: TemperatureSheetProps) {
  const t = useTranslator()
  const unit = temperatureUnit(system)
  const [reading, setReading] = useState('')
  const [site, setSite] = useState<TemperatureSite>(lastSite ?? 'armpit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    const parsed = Number.parseFloat(reading)
    const celsiusHundredths = Number.isFinite(parsed) ? toHundredths(parsed, unit) : NaN
    if (!isValidTemperature(celsiusHundredths)) {
      setError(t.t('error.enterTemperature'))
      return
    }
    setSaving(true)
    try {
      await onSave({ celsiusHundredths, site })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('temperature.title')} onClose={onClose}>
      <div className="field">
        <label className="field-label" htmlFor="temperature-value">
          {t.t('temperature.value', { unit: temperatureUnitSymbol(system) })}
        </label>
        <input
          id="temperature-value"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={reading}
          onChange={(event) => setReading(event.target.value)}
          placeholder={unit === 'f' ? '98.6' : '37.0'}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="temperature-site">
          {t.t('temperature.site')}
        </label>
        <select
          id="temperature-site"
          value={site}
          onChange={(event) => setSite(event.target.value as TemperatureSite)}
        >
          {TEMPERATURE_SITES.map((option) => (
            <option key={option} value={option}>
              {temperatureSiteName(t, option)}
            </option>
          ))}
        </select>
      </div>

      {/* Said here rather than only on the screen: the site changes the number,
          and a parent choosing one deserves to know that before saving. */}
      <p className="field-note">{t.t('temperature.siteNote')}</p>

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
        {t.t('temperature.save')}
      </button>
    </Sheet>
  )
}
