import { useMemo, useState } from 'react'
import type { Settings } from '@/app/settings'
import type { BabyStore } from '@/app/useBabyStore'
import {
  HANDOVER_WINDOWS,
  handover,
  handoverWindowStart,
  isEmptyHandover,
  type HandoverWindow,
} from '@/domain/handover'
import { formatClock } from '@/domain/time'
import type { Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  formatDuration,
  formatTemperature,
  formatVolume,
} from '@/i18n/format'
import type { MessageKey } from '@/i18n/locales'
import { RuleLabel } from './RuleLabel'
import { handoverText } from './handoverText'
import { BackIcon, CheckIcon, CopyIcon, PrintIcon } from './icons'

interface HandoverScreenProps {
  store: BabyStore
  settings: Settings
  now: Timestamp
  onBack: () => void
}

const WINDOW_LABELS: Record<HandoverWindow, MessageKey> = {
  '4h': 'handover.window.4h',
  '8h': 'handover.window.8h',
  '12h': 'handover.window.12h',
  today: 'handover.window.today',
}

/**
 * The handover: what to tell whoever has the baby next.
 *
 * Two halves, and the order matters. "Right now" comes first — when they last ate
 * and whether they are asleep is what the next person needs in the doorway. The
 * counts come second, because "3 feeds" is context, not an instruction.
 *
 * The whole thing can be copied as plain text, because handovers actually happen
 * over a message, and printed, because nurseries and childminders ask for paper.
 * Neither sends anything anywhere: copying puts text on the clipboard, printing
 * goes to the device's own print dialog.
 */
export function HandoverScreen({ store, settings, now, onBack }: HandoverScreenProps) {
  const t = useTranslator()
  const { activeBaby, events } = store
  const [window_, setWindow] = useState<HandoverWindow>('today')
  const [toast, setToast] = useState<string | null>(null)

  const since = handoverWindowStart(window_, now)
  const data = useMemo(() => handover(events, since, now), [events, since, now])

  const text = useMemo(
    () =>
      activeBaby === null
        ? ''
        : handoverText(data, {
            t,
            babyName: activeBaby.name,
            volumeUnit: settings.volumeUnit,
            measureSystem: settings.measureSystem,
          }),
    [data, activeBaby, settings.volumeUnit, settings.measureSystem, t],
  )

  if (activeBaby === null) return null

  const { summary } = data
  const empty = isEmptyHandover(data)

  function announce(message: string) {
    setToast(message)
    globalThis.setTimeout(() => setToast(null), 2600)
  }

  async function copy() {
    // Clipboard access is refused outright in some contexts (no permission, not a
    // secure origin, an older browser). The text is on screen either way, so the
    // failure path tells the parent to select it rather than pretending it worked.
    try {
      await navigator.clipboard.writeText(text)
      announce(t.t('handover.copied'))
    } catch {
      announce(t.t('handover.copyFailed'))
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
          <span className="appbar-name">{t.t('handover.title')}</span>
          <span className="appbar-age">{t.t('handover.subtitle')}</span>
        </div>
      </header>

      <main className="page">
        <section className="section">
          <RuleLabel>{t.t('handover.window')}</RuleLabel>
          <div className="segmented" role="group" aria-label={t.t('handover.window')}>
            {HANDOVER_WINDOWS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={window_ === option}
                onClick={() => setWindow(option)}
              >
                {t.t(WINDOW_LABELS[option])}
              </button>
            ))}
          </div>
          <p className="field-note">
            {t.t('handover.since', { time: formatClock(since, t.locale) })}
          </p>
        </section>

        {/* First, because it is what someone in a doorway actually needs. */}
        <section className="section">
          <RuleLabel>{t.t('handover.rightNow')}</RuleLabel>
          <dl className="handover-facts">
            <div className="handover-fact">
              <dt>{t.t('handover.sleep')}</dt>
              <dd className="num">
                {data.asleepSince !== null
                  ? t.t('handover.asleep', {
                      time: formatClock(data.asleepSince, t.locale),
                    })
                  : data.lastSleep?.endedAt != null
                    ? t.t('handover.awakeSince', {
                        time: formatClock(data.lastSleep.endedAt, t.locale),
                      })
                    : t.t('handover.neverSlept')}
              </dd>
            </div>
            <div className="handover-fact">
              <dt>{t.t('handover.feeds')}</dt>
              <dd className="num">
                {data.lastFeed === null
                  ? t.t('handover.lastFeedNever')
                  : t.t('handover.lastFeed', {
                      time: formatClock(data.lastFeed.startedAt, t.locale),
                    })}
              </dd>
            </div>
            <div className="handover-fact">
              <dt>{t.t('handover.diapers')}</dt>
              <dd className="num">
                {data.lastDiaper === null
                  ? t.t('handover.lastDiaperNever')
                  : t.t('handover.lastDiaper', {
                      time: formatClock(data.lastDiaper.startedAt, t.locale),
                    })}
              </dd>
            </div>
          </dl>
        </section>

        <section className="section">
          <RuleLabel>{t.t('handover.inThisWindow')}</RuleLabel>

          {empty ? (
            <>
              <p className="empty">{t.t('handover.empty')}</p>
              <p className="field-note">{t.t('handover.emptyHint')}</p>
            </>
          ) : (
            <dl className="handover-facts">
              {summary.feeds.count > 0 && (
                <div className="handover-fact">
                  <dt>{t.t('handover.feeds')}</dt>
                  <dd className="num">
                    {t.plural('handover.feedCount', summary.feeds.count)}
                    {summary.feeds.bottleMl > 0 &&
                      ` · ${formatVolume(t, summary.feeds.bottleMl, settings.volumeUnit)}`}
                    {summary.feeds.nursingMs > 0 &&
                      ` · ${formatDuration(t, summary.feeds.nursingMs)}`}
                  </dd>
                </div>
              )}
              {summary.sleep.sessions > 0 && (
                <div className="handover-fact">
                  <dt>{t.t('handover.sleep')}</dt>
                  <dd className="num">
                    {t.plural('handover.sleepCount', summary.sleep.sessions)}
                    {` · ${formatDuration(t, summary.sleep.totalMs)}`}
                  </dd>
                </div>
              )}
              {summary.diapers.total > 0 && (
                <div className="handover-fact">
                  <dt>{t.t('handover.diapers')}</dt>
                  <dd className="num">
                    {t.plural('handover.diaperCount', summary.diapers.total)}
                  </dd>
                </div>
              )}
              {summary.pumping.sessions > 0 && (
                <div className="handover-fact">
                  <dt>{t.t('handover.pumping')}</dt>
                  <dd className="num">
                    {t.plural('handover.pumpingCount', summary.pumping.sessions)}
                    {` · ${formatVolume(t, summary.pumping.ml, settings.volumeUnit)}`}
                  </dd>
                </div>
              )}
              {summary.medications.length > 0 && (
                <div className="handover-fact">
                  <dt>{t.t('handover.medications')}</dt>
                  <dd className="num">
                    {summary.medications.map((dose) => (
                      <span className="handover-line" key={`${dose.name}-${dose.at}`}>
                        {t.t('handover.textMedication', {
                          name: dose.name,
                          dose: dose.dose === '' ? '—' : dose.dose,
                          time: formatClock(dose.at, t.locale),
                        })}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {summary.temperatures.length > 0 && (
                <div className="handover-fact">
                  <dt>{t.t('handover.temperatures')}</dt>
                  <dd className="num">
                    {summary.temperatures.map((reading) => (
                      <span className="handover-line" key={reading.at}>
                        {formatTemperature(
                          t,
                          reading.celsiusHundredths,
                          settings.measureSystem,
                        )}
                        {' · '}
                        {formatClock(reading.at, t.locale)}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section className="section">
          <RuleLabel>{t.t('handover.preview')}</RuleLabel>
          {/* Shown, not hidden behind the copy button: a parent should be able to
              read what they are about to send, and select it by hand if the
              clipboard is unavailable. */}
          <pre className="handover-text">{text}</pre>

          <button type="button" className="button" data-variant="primary" onClick={copy}>
            <CopyIcon size={18} />
            {t.t('handover.copy')}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => globalThis.print()}
          >
            <PrintIcon size={18} />
            {t.t('handover.print')}
          </button>

          <p className="field-note">{t.t('handover.note')}</p>
        </section>
      </main>

      {toast !== null && (
        <div className="toast" role="status" aria-live="polite">
          <CheckIcon size={16} />
          <span>{toast}</span>
        </div>
      )}
    </>
  )
}
