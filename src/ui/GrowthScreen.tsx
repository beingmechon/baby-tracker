import { useMemo, useState } from 'react'
import type { Settings } from '@/app/settings'
import type { BabyStore } from '@/app/useBabyStore'
import {
  MEASURE_KINDS,
  ageInMonthsExact,
  growthChange,
  growthSeries,
  latestMeasurements,
  monthsBetween,
  percentileFor,
} from '@/domain/growth'
import { describeAge, startOfLocalDay } from '@/domain/time'
import type { BabyEvent, MeasureKind, Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  formatAge,
  formatMeasure,
  formatMeasureDelta,
  formatPercentile,
  formatShortDate,
  measureName,
  measureShortName,
} from '@/i18n/format'
import { EventEditSheet } from './EventEditSheet'
import { GrowthChart } from './GrowthChart'
import { GrowthSheet } from './GrowthSheet'
import { RuleLabel } from './RuleLabel'
import { BackIcon } from './icons'

interface GrowthScreenProps {
  store: BabyStore
  settings: Settings
  now: Timestamp
  onBack: () => void
}


/** Local midnight on an ISO birth date, for plotting ages. */
function birthTimestampOf(birthDate: string | null): number | null {
  if (birthDate === null) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : startOfLocalDay(parsed.getTime())
}

/**
 * The growth screen: one measurement at a time, as a ledger and a curve.
 *
 * The percentile is stated plainly and then immediately qualified. That ordering
 * is deliberate — a parent who has just weighed their baby wants the number, and
 * hiding it behind a disclaimer only sends them to a worse source for it.
 */
export function GrowthScreen({ store, settings, now, onBack }: GrowthScreenProps) {
  const t = useTranslator()
  const { activeBaby, events } = store
  const [measure, setMeasure] = useState<MeasureKind>('weight')
  // The sheets live here rather than in the shell so that logging opens on
  // whichever measurement is being looked at.
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<BabyEvent | null>(null)
  const system = settings.measureSystem

  const series = useMemo(() => growthSeries(events, measure), [events, measure])
  const change = useMemo(() => growthChange(events, measure), [events, measure])

  if (activeBaby === null) return null

  const birthTimestamp = birthTimestampOf(activeBaby.birthDate)
  const latest = series[series.length - 1] ?? null

  /**
   * Percentiles are computed at the age the measurement was *taken*, not today's
   * age. Re-reading a three-month-old weigh-in against a six-month reference
   * would show a healthy baby sliding down the chart for no reason.
   */
  const percentile =
    latest === null || activeBaby.sex === null || birthTimestamp === null
      ? null
      : percentileFor({
          measure,
          sex: activeBaby.sex,
          ageMonths: monthsBetween(birthTimestamp, latest.startedAt),
          value: latest.value,
        })

  const needsProfile = activeBaby.sex === null || activeBaby.birthDate === null
  const referenceExists = measure !== 'head'
  const ageNow = ageInMonthsExact(activeBaby.birthDate, now)

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('growth.title')}</span>
          {ageNow !== null && (
            <span className="appbar-age">
              {formatAge(t, describeAge(activeBaby.birthDate, now))}
            </span>
          )}
        </div>
      </header>

      <main className="page">
        <div className="field">
          <span className="field-label" id="growth-screen-measure">
            {t.t('growth.measure')}
          </span>
          <div className="segmented" role="group" aria-labelledby="growth-screen-measure">
            {MEASURE_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={measure === option}
                onClick={() => setMeasure(option)}
              >
                {measureShortName(t, option)}
              </button>
            ))}
          </div>
        </div>

        {latest === null ? (
          <section className="section">
            <RuleLabel>{measureName(t, measure)}</RuleLabel>
            <p className="empty">{t.t('growth.empty')}</p>
            <p className="field-note">{t.t('growth.emptyHint')}</p>
          </section>
        ) : (
          <section className="section">
            <RuleLabel>{measureName(t, measure)}</RuleLabel>
            <p className="growth-headline num">
              {formatMeasure(t, latest.value, measure, system)}
            </p>
            <dl className="ledger">
              <div className="ledger-row">
                <dt className="ledger-term">{t.t('growth.latest')}</dt>
                <dd className="ledger-note">
                  {t.t('growth.measuredOn', {
                    date: formatShortDate(t.locale, latest.startedAt),
                  })}
                </dd>
              </div>
              {change !== null && (
                <div className="ledger-row">
                  <dt className="ledger-term">
                    {t.t('growth.change', {
                      change: formatMeasureDelta(t, change.delta, measure, system),
                      date: formatShortDate(t.locale, change.from),
                    })}
                  </dt>
                  <dd className="ledger-note num">
                    {t.t('growth.perWeek', {
                      amount: formatMeasureDelta(t, change.perWeek, measure, system),
                    })}
                  </dd>
                </div>
              )}
              <div className="ledger-row">
                <dt className="ledger-term">{t.t('growth.percentileLabel')}</dt>
                <dd className="ledger-note">
                  {percentile !== null
                    ? formatPercentile(t, percentile.percentile)
                    : needsProfile
                      ? t.t('growth.percentileUnavailable')
                      : t.t('growth.percentileNoData')}
                </dd>
              </div>
            </dl>
          </section>
        )}

        <section className="section">
          <RuleLabel>{t.t('growth.chart')}</RuleLabel>
          <GrowthChart
            measure={measure}
            system={system}
            series={series}
            birthTimestamp={birthTimestamp}
            sex={activeBaby.sex}
          />
          <p className="field-note">
            {referenceExists ? t.t('growth.referenceNote') : t.t('growth.chartNoReference')}
          </p>
        </section>

        {series.length > 0 && (
          <section className="section">
            <RuleLabel>{t.t('growth.history')}</RuleLabel>
            <div className="timeline">
              {[...series].reverse().map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="timeline-row"
                  onClick={() => setEditing(event)}
                >
                  <span className="timeline-time">
                    {formatShortDate(t.locale, event.startedAt)}
                  </span>
                  <span
                    className="timeline-mark"
                    data-category="growth"
                    aria-hidden="true"
                  />
                  <span className="timeline-body">
                    <span className="timeline-title num">
                      {formatMeasure(t, event.value, measure, system)}
                    </span>
                    {birthTimestamp !== null && (
                      <span className="timeline-detail">
                        {' · '}
                        {t.t('growth.atAge', {
                          age:
                            formatAge(
                              t,
                              describeAge(activeBaby.birthDate, event.startedAt),
                            ) ?? '',
                        })}
                      </span>
                    )}
                  </span>
                  <span className="sr-only">{t.t('event.editHint')}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <button
          type="button"
          className="button"
          data-variant="primary"
          onClick={() => setLogging(true)}
        >
          {t.t('growth.add')}
        </button>
      </main>

      {logging && (
        <GrowthSheet
          system={system}
          initialMeasure={measure}
          lastValues={latestMeasurements(events)}
          onSave={async (input) => {
            await store.logGrowth({ ...input, startedAt: Date.now() })
            setLogging(false)
          }}
          onClose={() => setLogging(false)}
        />
      )}

      {editing !== null && (
        <EventEditSheet
          event={editing}
          unit={settings.volumeUnit}
          measureSystem={system}
          onSave={async (patch) => {
            await store.updateEvent(editing.id, patch)
            setEditing(null)
          }}
          onDelete={async () => {
            await store.deleteEvent(editing.id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
