import { useMemo, useState } from 'react'
import type { Settings } from '@/app/settings'
import type { BabyStore } from '@/app/useBabyStore'
import {
  describeTemperature,
  latestTemperature,
  medicationNames,
  medicationSummaries,
} from '@/domain/health'
import { formatClock } from '@/domain/time'
import type { TemperatureEvent, Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  formatAgo,
  formatShortDate,
  formatTemperature,
  formatTemperatureBand,
  temperatureSiteName,
} from '@/i18n/format'
import { MedicationSheet } from './MedicationSheet'
import { RuleLabel } from './RuleLabel'
import { TemperatureSheet } from './TemperatureSheet'
import { BackIcon, CheckIcon } from './icons'

interface HealthScreenProps {
  store: BabyStore
  settings: Settings
  now: Timestamp
  onBack: () => void
}

/**
 * Temperature and medication in one place.
 *
 * The most careful copy in the app lives here. Every line either states a figure
 * and where it came from, or reports what guidance says — never what to do. The
 * one exception is the under-three-months note, which reports that guidance is to
 * contact a doctor without waiting, because leaving that unsaid to sound less
 * medical would be the more harmful choice.
 */
export function HealthScreen({ store, settings, now, onBack }: HealthScreenProps) {
  const t = useTranslator()
  const { activeBaby, events } = store
  const [sheet, setSheet] = useState<'temperature' | 'medication' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const readings = useMemo(
    () =>
      events.filter((event): event is TemperatureEvent => event.type === 'temperature'),
    [events],
  )
  const medications = useMemo(() => medicationSummaries(events), [events])
  const knownNames = useMemo(() => medicationNames(events), [events])
  const latest = useMemo(() => latestTemperature(events), [events])

  if (activeBaby === null) return null

  const reading = latest === null ? null : describeTemperature(latest, activeBaby.birthDate)
  const system = settings.measureSystem

  function announce(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('health.title')}</span>
        </div>
      </header>

      <main className="page">
        <section className="section">
          <RuleLabel>{t.t('temperature.title')}</RuleLabel>

          {reading === null ? (
            <p className="empty">{t.t('temperature.empty')}</p>
          ) : (
            <>
              <p className="health-headline num">
                {formatTemperature(t, reading.event.celsiusHundredths, system)}
              </p>
              <p className="health-band" data-band={reading.band}>
                {formatTemperatureBand(t, reading, system)}
              </p>
              <p className="field-note">
                {temperatureSiteName(t, reading.event.site)}
                {' · '}
                {formatAgo(t, reading.event.startedAt, now)}
              </p>
              {reading.youngInfant && (
                <p className="banner" data-tone="error" role="status">
                  {t.t('temperature.youngInfant')}
                </p>
              )}
            </>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setSheet('temperature')}
          >
            {t.t('temperature.log')}
          </button>

          {readings.length > 1 && (
            <div className="timeline">
              {[...readings]
                .sort((a, b) => b.startedAt - a.startedAt)
                .slice(0, 8)
                .map((event) => (
                  <div className="timeline-row" key={event.id}>
                    <span className="timeline-time">
                      {formatShortDate(t.locale, event.startedAt)}
                    </span>
                    <span
                      className="timeline-mark"
                      data-category="health"
                      aria-hidden="true"
                    />
                    <span className="timeline-body">
                      <span className="timeline-title num">
                        {formatTemperature(t, event.celsiusHundredths, system)}
                      </span>
                      <span className="timeline-detail">
                        {' · '}
                        {temperatureSiteName(t, event.site)}
                        {' · '}
                        {formatClock(event.startedAt, t.locale)}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          )}

          <p className="field-note">{t.t('temperature.siteNote')}</p>
        </section>

        <section className="section">
          <RuleLabel>{t.t('medication.title')}</RuleLabel>

          {medications.length === 0 ? (
            <>
              <p className="empty">{t.t('medication.empty')}</p>
              <p className="field-note">{t.t('medication.emptyHint')}</p>
            </>
          ) : (
            <div className="reminders">
              {medications.map((summary) => (
                <div className="reminder-row" key={summary.name}>
                  <div className="reminder-identity">
                    <span className="reminder-name">{summary.name}</span>
                    <span className="reminder-state num">
                      {summary.lastDose === ''
                        ? t.t('medication.lastGiven', {
                            duration: formatAgo(t, summary.lastGivenAt, now),
                          })
                        : `${summary.lastDose} · ${t.t('medication.lastGiven', {
                            duration: formatAgo(t, summary.lastGivenAt, now),
                          })}`}
                    </span>
                    <span className="reminder-state">
                      {t.plural('medication.timesGiven', summary.timesGiven)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setSheet('medication')}
          >
            {t.t('medication.log')}
          </button>

          {/* What this feature is and is not. It records; it does not check. */}
          <p className="field-note">{t.t('medication.note')}</p>
        </section>
      </main>

      {sheet === 'temperature' && (
        <TemperatureSheet
          system={system}
          lastSite={latest?.site ?? null}
          onSave={async (input) => {
            await store.logTemperature({ ...input, startedAt: Date.now() })
            setSheet(null)
            announce(t.t('toast.temperatureSaved'))
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'medication' && (
        <MedicationSheet
          knownNames={knownNames}
          onSave={async (input) => {
            await store.logMedication({ ...input, startedAt: Date.now() })
            setSheet(null)
            announce(t.t('toast.medicationSaved'))
          }}
          onClose={() => setSheet(null)}
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
