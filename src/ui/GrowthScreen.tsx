import { useMemo, useState } from 'react'
import type { Settings } from '@/app/settings'
import type { BabyStore } from '@/app/useBabyStore'
import {
  MEASURE_KINDS,
  ageInMonthsExact,
  birthMeasurement,
  changeSinceBirth,
  growthChange,
  growthSeries,
  latestMeasurements,
  monthsBetween,
  percentileFor,
} from '@/domain/growth'
import { birthTimestamp, describeAge } from '@/domain/time'
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
import { BackIcon, CheckIcon } from './icons'

interface GrowthScreenProps {
  store: BabyStore
  settings: Settings
  now: Timestamp
  onBack: () => void
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
  // 'now' is an ordinary measurement; 'birth' writes at the birth date instead.
  const [logging, setLogging] = useState<'now' | 'birth' | null>(null)
  // Saving from this screen confirmed nothing, while the same action from the home
  // screen did — so a measurement typed here looked like it had been swallowed.
  const [toast, setToast] = useState<string | null>(null)
  const [editing, setEditing] = useState<BabyEvent | null>(null)
  const system = settings.measureSystem

  const series = useMemo(() => growthSeries(events, measure), [events, measure])
  const change = useMemo(() => growthChange(events, measure), [events, measure])
  const birthDate = activeBaby?.birthDate ?? null
  const birthAt = useMemo(() => birthTimestamp(birthDate), [birthDate])
  const atBirth = useMemo(
    () => birthMeasurement(events, measure, birthDate),
    [events, measure, birthDate],
  )
  const sinceBirth = useMemo(
    () => changeSinceBirth(events, measure, birthDate),
    [events, measure, birthDate],
  )

  if (activeBaby === null) return null


  const latest = series[series.length - 1] ?? null

  /**
   * Percentiles are computed at the age the measurement was *taken*, not today's
   * age. Re-reading a three-month-old weigh-in against a six-month reference
   * would show a healthy baby sliding down the chart for no reason.
   */
  const percentile =
    latest === null || activeBaby.sex === null || birthAt === null
      ? null
      : percentileFor({
          measure,
          sex: activeBaby.sex,
          ageMonths: monthsBetween(birthAt, latest.startedAt),
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
              {/* Suppressed when the previous reading *is* the birth measurement:
                  "+2.4 kg since Jun 20" and "+2.4 kg since birth" are then the
                  same sentence twice. */}
              {sinceBirth !== null && sinceBirth.from.startedAt !== change?.from && (
                <div className="ledger-row">
                  <dt className="ledger-term">
                    {t.t('growth.sinceBirth', {
                      change: formatMeasureDelta(t, sinceBirth.delta, measure, system),
                    })}
                  </dt>
                  <dd className="ledger-note num">
                    {formatMeasure(t, sinceBirth.from.value, measure, system)}
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
            birthTimestamp={birthAt}
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
                    {/* The birth row says "at birth". Running it through the age
                        formatter produced "at born today", a phrase inside a
                        phrase — the same fault as "just now ago" in v0.4. */}
                    {birthAt !== null && (
                      <span className="timeline-detail">
                        {' · '}
                        {event.id === atBirth?.id
                          ? t.t('growth.atBirthLabel')
                          : t.t('growth.atAge', {
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
          onClick={() => setLogging('now')}
        >
          {t.t('growth.add')}
        </button>

        {/*
          * Offered only when it is both possible and missing: there has to be a
          * birth date to date the entry, and no point asking for something already
          * recorded. It is the comparison every appointment asks about — "back to
          * birth weight yet?" — and the one a chart of two dots cannot show.
          */}
        {birthAt !== null && atBirth === null && (
          <>
            <button
              type="button"
              className="button"
              onClick={() => setLogging('birth')}
            >
              {t.t('growth.addBirth')}
            </button>
            <p className="field-note">{t.t('growth.addBirthNote')}</p>
          </>
        )}
      </main>

      {logging !== null && (
        <GrowthSheet
          system={system}
          initialMeasure={measure}
          // A birth entry starts blank: prefilling it with today's weight would
          // invite saving the wrong number against the wrong date.
          lastValues={logging === 'birth' ? {} : latestMeasurements(events)}
          atBirth={logging === 'birth'}
          onSave={async (input) => {
            await store.logGrowth({
              ...input,
              startedAt: logging === 'birth' && birthAt !== null ? birthAt : Date.now(),
            })
            setLogging(null)
            setToast(t.t('toast.growthSaved'))
            globalThis.setTimeout(() => setToast(null), 2200)
          }}
          onClose={() => setLogging(null)}
        />
      )}

      {toast !== null && (
        <div className="toast" role="status" aria-live="polite">
          <CheckIcon size={16} />
          <span>{toast}</span>
        </div>
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
