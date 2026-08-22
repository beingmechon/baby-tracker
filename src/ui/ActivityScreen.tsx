import { useMemo, useState } from 'react'
import type { Settings } from '@/app/settings'
import type { BabyStore } from '@/app/useBabyStore'
import {
  ACTIVITY_KINDS,
  accidentFreeStreak,
  activityMsForDay,
  activityTotalsForDay,
  pottyTotalsForDay,
  recentActivities,
} from '@/domain/activity'
import { MINUTE_MS, formatClock } from '@/domain/time'
import type { ActivityKind, PottyPlace, PottyResult, Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  activityName,
  formatDuration,
  formatShortDate,
  pottyPlaceName,
  pottyResultName,
} from '@/i18n/format'
import { RuleLabel } from './RuleLabel'
import { Sheet } from './Sheet'
import { BackIcon, CheckIcon } from './icons'

interface ActivityScreenProps {
  store: BabyStore
  settings: Settings
  now: Timestamp
  onBack: () => void
}

const POTTY_RESULTS: readonly PottyResult[] = [
  'pee',
  'poo',
  'both',
  'nothing',
  'accident',
]
const POTTY_PLACES: readonly PottyPlace[] = ['potty', 'toilet']

/**
 * Activities and the potty, on one screen.
 *
 * They look unrelated and are the same shape: a small thing that happened, counted
 * over a day. They share a screen because they bracket the same stretch of
 * childhood — tummy time from the first weeks, the potty from about two — and
 * neither earns a screen of its own.
 *
 * Tummy time is the only activity with a target, and the target is the parent's own
 * number. The potty figures are a record and not a scoreboard, which the screen says
 * out loud: a parent counting accidents at the end of a hard day should not find an
 * app grading them on it.
 */
export function ActivityScreen({ store, settings, now, onBack }: ActivityScreenProps) {
  const t = useTranslator()
  const { events } = store
  const [sheet, setSheet] = useState<'activity' | 'potty' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [kind, setKind] = useState<ActivityKind>('tummy')
  const [minutes, setMinutes] = useState('')
  const [result, setResult] = useState<PottyResult>('pee')
  const [place, setPlace] = useState<PottyPlace>('potty')

  const totals = useMemo(() => activityTotalsForDay(events, now), [events, now])
  const tummyMs = useMemo(() => activityMsForDay(events, 'tummy', now), [events, now])
  const potty = useMemo(() => pottyTotalsForDay(events, now), [events, now])
  const streak = useMemo(() => accidentFreeStreak(events, now), [events, now])
  const recent = useMemo(() => recentActivities(events, now), [events, now])

  const goalMs = settings.tummyGoalMinutes * MINUTE_MS
  const pottyLogged = potty.hits + potty.accidents + potty.sits > 0

  function announce(message: string) {
    setToast(message)
    globalThis.setTimeout(() => setToast(null), 2200)
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('section.activity')}</span>
        </div>
      </header>

      <main className="page">
        <section className="section">
          <RuleLabel>{t.t('activity.tummyToday')}</RuleLabel>
          <p className="activity-headline num">{formatDuration(t, tummyMs)}</p>
          <p className="activity-goal">
            {goalMs === 0
              ? t.t('activity.tummyNoGoal')
              : tummyMs >= goalMs
                ? t.t('activity.tummyGoalMet')
                : t.t('activity.tummyGoalLeft', {
                    duration: formatDuration(t, goalMs - tummyMs),
                  })}
          </p>
          {/* The goal is a number a person typed, and the screen says whose it is. */}
          {goalMs > 0 && <p className="field-note">{t.t('activity.tummyGoalNote')}</p>}
        </section>

        <section className="section">
          <RuleLabel>{t.t('activity.today')}</RuleLabel>

          {totals.length === 0 ? (
            <>
              <p className="empty">{t.t('activity.empty')}</p>
              <p className="field-note">{t.t('activity.emptyHint')}</p>
            </>
          ) : (
            <dl className="handover-facts">
              {totals.map((total) => (
                <div className="handover-fact" key={total.kind}>
                  <dt>{activityName(t, total.kind)}</dt>
                  <dd className="num">
                    {t.plural('activity.count', total.times)}
                    {total.totalMs > 0 && ` · ${formatDuration(t, total.totalMs)}`}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setSheet('activity')}
          >
            {t.t('activity.log')}
          </button>
        </section>

        <section className="section">
          <RuleLabel>{t.t('potty.title')}</RuleLabel>

          {!pottyLogged ? (
            <>
              <p className="empty">{t.t('potty.empty')}</p>
              <p className="field-note">{t.t('potty.emptyHint')}</p>
            </>
          ) : (
            <>
              <dl className="handover-facts">
                <div className="handover-fact">
                  <dt>{t.t('potty.today')}</dt>
                  <dd className="num">
                    {[
                      t.plural('potty.hits', potty.hits),
                      potty.accidents > 0
                        ? t.plural('potty.misses', potty.accidents)
                        : '',
                      potty.sits > 0 ? t.plural('potty.sits', potty.sits) : '',
                    ]
                      .filter((part) => part !== '')
                      .join(' · ')}
                  </dd>
                </div>
                <div className="handover-fact">
                  <dt>{t.t('potty.streak')}</dt>
                  <dd className="num">
                    {streak.best === 0
                      ? t.t('potty.noStreak')
                      : t.plural('potty.streakDays', streak.best)}
                  </dd>
                </div>
              </dl>
              {/* Said every time the numbers appear. */}
              <p className="field-note">{t.t('potty.note')}</p>
            </>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setSheet('potty')}
          >
            {t.t('potty.log')}
          </button>
        </section>

        {recent.length > 0 && (
          <section className="section">
            <RuleLabel>{t.t('activity.week')}</RuleLabel>
            <div className="timeline">
              {recent.slice(0, 12).map((event) => (
                <div className="timeline-row" key={event.id}>
                  <span className="timeline-time">
                    {formatShortDate(t.locale, event.startedAt)}
                  </span>
                  <span
                    className="timeline-mark"
                    data-category="activity"
                    aria-hidden="true"
                  />
                  <span className="timeline-body">
                    <span className="timeline-title">
                      {activityName(t, event.kind)}
                    </span>
                    <span className="timeline-detail">
                      {' · '}
                      {formatClock(event.startedAt, t.locale)}
                      {event.durationMs > 0 &&
                        ` · ${formatDuration(t, event.durationMs)}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {sheet === 'activity' && (
        <Sheet title={t.t('activity.title')} onClose={() => setSheet(null)}>
          <div className="field">
            <span className="field-label" id="activity-kind-label">
              {t.t('activity.kind')}
            </span>
            <div
              className="stack-choices"
              role="group"
              aria-labelledby="activity-kind-label"
            >
              {ACTIVITY_KINDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="choice"
                  aria-pressed={kind === option}
                  onClick={() => setKind(option)}
                >
                  {activityName(t, option)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="activity-minutes">
              {t.t('activity.minutes')}
            </label>
            <input
              id="activity-minutes"
              type="number"
              inputMode="numeric"
              min={0}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
            <p className="field-note">{t.t('activity.minutesNote')}</p>
          </div>

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => {
              // A blank or unparseable box means nobody timed it, which is zero
              // rather than an error: refusing the save would lose the entry.
              const parsed = Number.parseFloat(minutes)
              const durationMs =
                Number.isFinite(parsed) && parsed > 0
                  ? Math.round(parsed * MINUTE_MS)
                  : 0
              void store
                .logActivity({ kind, durationMs, startedAt: Date.now() })
                .then(() => {
                  setSheet(null)
                  setMinutes('')
                  announce(t.t('toast.activitySaved'))
                })
            }}
          >
            {t.t('activity.save')}
          </button>
        </Sheet>
      )}

      {sheet === 'potty' && (
        <Sheet title={t.t('potty.title')} onClose={() => setSheet(null)}>
          <div className="field">
            <span className="field-label" id="potty-result-label">
              {t.t('potty.result')}
            </span>
            <div
              className="stack-choices"
              role="group"
              aria-labelledby="potty-result-label"
            >
              {POTTY_RESULTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="choice"
                  aria-pressed={result === option}
                  onClick={() => setResult(option)}
                >
                  {pottyResultName(t, option)}
                </button>
              ))}
            </div>
          </div>

          {/* Hidden for an accident: where they were sitting is not the point, and
              "Accident · on the potty" reads as a contradiction. */}
          {result !== 'accident' && (
            <div className="field">
              <span className="field-label" id="potty-place-label">
                {t.t('potty.place')}
              </span>
              <div className="segmented" role="group" aria-labelledby="potty-place-label">
                {POTTY_PLACES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={place === option}
                    onClick={() => setPlace(option)}
                  >
                    {pottyPlaceName(t, option)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => {
              void store
                .logPotty({ result, place, startedAt: Date.now() })
                .then(() => {
                  setSheet(null)
                  announce(t.t('toast.pottySaved'))
                })
            }}
          >
            {t.t('potty.save')}
          </button>
        </Sheet>
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
