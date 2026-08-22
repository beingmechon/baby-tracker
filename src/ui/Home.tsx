import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  completeTimer,
  elapsedMs,
  idleTimer,
  isRunning,
  loadTimer,
  saveTimer,
  switchSide,
  toggleTimer,
  type NursingTimerState,
} from '@/app/nursingTimer'
import type { Settings } from '@/app/settings'
import type { MessageKey } from '@/i18n/locales'
import type { BabyStore } from '@/app/useBabyStore'
import type { ReminderStore } from '@/app/useReminders'
import { useNow } from '@/app/useNow'
import { findLastFeed, findLastNursingSide, suggestNextSide } from '@/domain/feeds'
import { MEASURE_KINDS, latestMeasurements } from '@/domain/growth'
import { nextVisit } from '@/domain/illness'
import { cleanTogetherIds, logTargets } from '@/domain/together'
import { predictNextNap } from '@/domain/patterns'
import { SNOOZE_MS } from '@/domain/reminders'
import { isToday, selectEventsForDay } from '@/domain/select'
import { summarizeDay } from '@/domain/summary'
import {
  addDays,
  describeAge,
  formatClock,
  formatStopwatch,
  localDateKey,
  startOfLocalDay,
} from '@/domain/time'
import type { BabyEvent, BreastSide, DiaperKind, Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  formatAge,
  formatDuration,
  formatMeasure,
  formatSpan,
  formatVolume,
  measureName,
} from '@/i18n/format'
import { BabySwitcherSheet } from './BabySwitcherSheet'
import { BottleSheet } from './BottleSheet'
import { DaySummary } from './DaySummary'
import { EventEditSheet } from './EventEditSheet'
import { GrowthSheet } from './GrowthSheet'
import { NursingSheet } from './NursingSheet'
import { PumpingSheet } from './PumpingSheet'
import { ReminderList } from './ReminderList'
import { RuleLabel } from './RuleLabel'
import { StatusHeadline } from './StatusHeadline'
import { Timeline } from './Timeline'
import {
  BellIcon,
  BottleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GrowthIcon,
  HealthIcon,
  NursingIcon,
  PumpIcon,
  RepeatIcon,
  SettingsIcon,
  SleepIcon,
  DiaryIcon,
  HandoverIcon,
  WheelIcon,
} from './icons'

interface HomeProps {
  store: BabyStore
  settings: Settings
  reminders: ReminderStore
  onOpenSettings: () => void
  onOpenGrowth: () => void
  onOpenReminders: () => void
  onOpenStash: () => void
  onOpenHealth: () => void
  onOpenIllness: () => void
  onOpenPatterns: () => void
  onOpenHandover: () => void
  onSwitchBaby: (babyId: string) => void
}

const QUICK_DIAPERS = [
  { kind: 'wet', label: 'action.diaper.wet', toast: 'toast.diaperLogged.wet' },
  { kind: 'dirty', label: 'action.diaper.dirty', toast: 'toast.diaperLogged.dirty' },
  { kind: 'mixed', label: 'action.diaper.mixed', toast: 'toast.diaperLogged.mixed' },
] as const satisfies readonly {
  kind: DiaperKind
  label: MessageKey
  toast: MessageKey
}[]

export function Home({
  store,
  settings,
  reminders,
  onOpenSettings,
  onOpenGrowth,
  onOpenReminders,
  onOpenStash,
  onOpenHealth,
  onOpenIllness,
  onOpenPatterns,
  onOpenHandover,
  onSwitchBaby,
}: HomeProps) {
  const t = useTranslator()
  const { activeBaby, events, sleepInProgress } = store

  const [nursingTimer, setNursingTimer] = useState<NursingTimerState | null>(null)
  const [openSheet, setOpenSheet] = useState<
    'nursing' | 'bottle' | 'growth' | 'babies' | 'pumping' | null
  >(null)
  const [editing, setEditing] = useState<BabyEvent | null>(null)
  const [dayAnchor, setDayAnchor] = useState<Timestamp>(() => startOfLocalDay(Date.now()))
  const [toast, setToast] = useState<string | null>(null)

  // A running clock needs a second-by-second tick; otherwise a lazy 20s is plenty
  // and spares the battery.
  const nursingRunning = nursingTimer !== null && isRunning(nursingTimer)
  const now = useNow(sleepInProgress !== null || nursingRunning ? 1000 : 20_000)

  const activeBabyId = activeBaby?.id ?? null

  // Restore a nursing timer left running when the app was last closed, and swap
  // to the right one when the baby changes.
  useEffect(() => {
    setNursingTimer(activeBabyId === null ? null : loadTimer(activeBabyId))
  }, [activeBabyId])

  /**
   * Persists at the moment of change rather than in an effect on the timer.
   *
   * An effect would fire once more after the baby changed but before the reload
   * had replaced the state, writing one baby's running timer under the other
   * baby's key. Saving here means the write always uses the baby that was open
   * when the user touched the timer.
   */
  const updateTimer = useCallback(
    (next: NursingTimerState | null) => {
      setNursingTimer(next)
      if (activeBabyId !== null) saveTimer(activeBabyId, next)
    },
    [activeBabyId],
  )

  useEffect(() => {
    if (toast === null) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const lastSide = useMemo(() => findLastNursingSide(events), [events])
  const lastFeed = useMemo(() => findLastFeed(events), [events])

  const lastMeasurements = useMemo(() => latestMeasurements(events), [events])

  const napPrediction = useMemo(
    () => predictNextNap(events, now, settings.nightWindow),
    [events, now, settings.nightWindow],
  )

  const appointment = useMemo(() => nextVisit(events, now), [events, now])

  // The other babies a feed or a diaper will also be written for, by name.
  const alsoLoggingFor = useMemo(() => {
    const group = cleanTogetherIds(
      settings.togetherIds,
      store.babies.map((baby) => baby.id),
    )
    return logTargets(activeBaby?.id ?? null, group, 'diaper')
      .slice(1)
      .map((id) => store.babies.find((baby) => baby.id === id)?.name ?? '')
      .filter((name) => name !== '')
  }, [settings.togetherIds, store.babies, activeBaby])

  const dayEvents = useMemo(
    () => selectEventsForDay(events, dayAnchor, now),
    [events, dayAnchor, now],
  )
  const summary = useMemo(
    () => summarizeDay(events, dayAnchor, now),
    [events, dayAnchor, now],
  )

  const viewingToday = isToday(dayAnchor, now)

  if (activeBaby === null) return null

  /**
   * Point-in-time logs are stamped now, even while browsing an earlier day — the
   * alternative silently backdates entries, which is worse than jumping back.
   */
  function logAt(): Timestamp {
    return Date.now()
  }

  function returnToToday() {
    if (!viewingToday) setDayAnchor(startOfLocalDay(Date.now()))
  }

  async function quickDiaper(kind: DiaperKind, toastKey: MessageKey) {
    await store.logDiaper({ kind, startedAt: logAt() })
    setToast(t.t(toastKey))
    returnToToday()
  }

  async function toggleSleep() {
    if (sleepInProgress !== null) {
      await store.endSleep(sleepInProgress.id, Date.now())
      setToast(t.t('toast.sleepEnded'))
      return
    }
    await store.startSleep(Date.now())
    setToast(t.t('toast.sleepStarted'))
  }

  function openNursing() {
    updateTimer(nursingTimer ?? idleTimer(suggestNextSide(lastSide)))
    setOpenSheet('nursing')
  }

  async function saveNursing() {
    if (nursingTimer === null) return
    const completed = completeTimer(nursingTimer, Date.now())
    if (completed !== null) {
      await store.logNursing(completed)
      setToast(t.t('toast.feedSaved'))
    }
    updateTimer(null)
    setOpenSheet(null)
    returnToToday()
  }

  async function handleSwitchSide() {
    if (nursingTimer === null) return
    const { completed, next } = switchSide(nursingTimer, Date.now())
    if (completed !== null) {
      await store.logNursing(completed)
      setToast(
        t.t('toast.sideSaved', {
          side: t.t(
            completed.side === 'left' ? 'nursing.side.left' : 'nursing.side.right',
          ),
        }),
      )
    }
    updateTimer(next)
  }

  async function repeatLast() {
    await store.repeatLastFeed(logAt())
    setToast(t.t('toast.feedRepeated'))
    returnToToday()
  }

  const nursingElapsed = nursingTimer === null ? 0 : elapsedMs(nursingTimer, now)
  const age = formatAge(t, describeAge(activeBaby.birthDate, now))

  const repeatDetail =
    lastFeed === null
      ? null
      : lastFeed.type === 'bottle'
        ? formatVolume(t, lastFeed.amountMl, settings.volumeUnit)
        : t.t(lastFeed.side === 'left' ? 'nursing.side.left' : 'nursing.side.right')

  return (
    <>
      <header className="appbar">
        {/* The name is the switcher. With one baby it still opens — that is how a
            second one gets added — so there is no state where the control
            disappears and the parent has to hunt through settings. */}
        <button
          type="button"
          className="appbar-identity appbar-switcher"
          onClick={() => setOpenSheet('babies')}
        >
          <span className="appbar-name">{activeBaby.name}</span>
          {age !== null && <span className="appbar-age">{age}</span>}
          <span className="sr-only">{t.t('babies.switch')}</span>
        </button>
        <button type="button" className="icon-button" onClick={onOpenSettings}>
          <SettingsIcon />
          <span className="sr-only">{t.t('action.settings')}</span>
        </button>
      </header>

      <main className="page">
        {store.error !== null && (
          <p className="banner" data-tone="error" role="alert">
            {store.error}
          </p>
        )}

        <StatusHeadline
          events={events}
          sleepInProgress={sleepInProgress}
          birthDate={activeBaby.birthDate}
          now={now}
          showGuidance={settings.showWakeWindowGuidance}
        />

        {napPrediction !== null && (
          <button
            type="button"
            className="prediction"
            onClick={onOpenPatterns}
          >
            <span className="prediction-label">{t.t('patterns.nextNapLabel')}</span>
            <span className="prediction-value num">
              {t.t('patterns.nextNap', {
                time: formatClock(napPrediction.expectedAt, t.locale),
              })}
            </span>
          </button>
        )}

        <section className="section" aria-label={t.t('section.log')}>
          <RuleLabel>{t.t('section.log')}</RuleLabel>
          {/* Said before the buttons, not after: a parent about to tap needs to
              know the tap lands twice. */}
          {alsoLoggingFor.length > 0 && (
            <p className="field-note">
              {t.t('log.together', {
                names: [activeBaby.name, ...alsoLoggingFor].join(' · '),
              })}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="action action-primary"
              onClick={() => void toggleSleep()}
            >
              <SleepIcon size={20} className="action-icon" />
              <span>
                {t.t(sleepInProgress === null ? 'action.startSleep' : 'action.wakeUp')}
              </span>
            </button>

            <div className="action-row">
              <button type="button" className="action" onClick={openNursing}>
                <NursingIcon size={18} className="action-icon" />
                <span>
                  {t.t('action.nursing')}
                  {nursingElapsed > 0 && (
                    <>
                      {' '}
                      <span className="num">{formatStopwatch(nursingElapsed)}</span>
                    </>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="action"
                onClick={() => setOpenSheet('bottle')}
              >
                <BottleIcon size={18} className="action-icon" />
                <span>{t.t('action.bottle')}</span>
              </button>
            </div>

            {/* No icons here: three identical diaper glyphs would carry no
                information the labels don't already carry — Tufte's 1+1=3. */}
            <div className="action-row-3" role="group" aria-label={t.t('summary.diapers')}>
              {QUICK_DIAPERS.map(({ kind, label, toast }) => (
                <button
                  key={kind}
                  type="button"
                  className="action"
                  onClick={() => void quickDiaper(kind, toast)}
                >
                  <span>{t.t(label)}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="action"
              onClick={() => setOpenSheet('pumping')}
            >
              <PumpIcon size={18} className="action-icon" />
              <span>{t.t('pumping.log')}</span>
            </button>

            {repeatDetail !== null && (
              <button
                type="button"
                className="action-repeat"
                onClick={() => void repeatLast()}
              >
                <RepeatIcon size={16} />
                <span>{t.t('action.repeatFeed', { detail: repeatDetail })}</span>
              </button>
            )}
          </div>
        </section>

        <section className="section" aria-label={t.t('section.reminders')}>
          <RuleLabel
            actions={
              <button type="button" className="icon-button" onClick={onOpenReminders}>
                <ChevronRightIcon size={18} />
                <span className="sr-only">{t.t('reminders.title')}</span>
              </button>
            }
          >
            {t.t('section.reminders')}
          </RuleLabel>
          {reminders.statuses.length === 0 ? (
            <button
              type="button"
              className="action-repeat"
              onClick={onOpenReminders}
            >
              <BellIcon size={16} />
              <span>{t.t('reminders.add')}</span>
            </button>
          ) : (
            <ReminderList
              // No row-tapping here: on the home screen a stray tap should never
              // open an editor. Managing them is one deliberate tap away.
              statuses={reminders.statuses}
              onSnooze={(reminder) => {
                void reminders.snooze(reminder.id, Date.now()).then(() =>
                  setToast(
                    t.t('toast.reminderSnoozed', {
                      duration: formatDuration(t, SNOOZE_MS),
                    }),
                  ),
                )
              }}
              onDone={(reminder) => {
                void reminders.markDone(reminder.id, Date.now()).then(() =>
                  setToast(
                    t.t('toast.reminderDone', {
                      duration: formatDuration(t, reminder.intervalMs),
                    }),
                  ),
                )
              }}
            />
          )}
        </section>

        <section className="section" aria-label={t.t('section.today')}>
          <RuleLabel
            actions={
              <>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setDayAnchor((day) => addDays(day, -1))}
                >
                  <ChevronLeftIcon size={18} />
                  <span className="sr-only">{t.t('action.previousDay')}</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setDayAnchor((day) => addDays(day, 1))}
                  disabled={viewingToday}
                >
                  <ChevronRightIcon size={18} />
                  <span className="sr-only">{t.t('action.nextDay')}</span>
                </button>
              </>
            }
          >
            {viewingToday ? t.t('section.today') : localDateKey(dayAnchor)}
          </RuleLabel>

          <DaySummary summary={summary} unit={settings.volumeUnit} />
        </section>

        <section className="section" aria-label={t.t('section.growth')}>
          <RuleLabel
            actions={
              <button type="button" className="icon-button" onClick={onOpenGrowth}>
                <ChevronRightIcon size={18} />
                <span className="sr-only">{t.t('growth.title')}</span>
              </button>
            }
          >
            {t.t('section.growth')}
          </RuleLabel>
          {Object.keys(lastMeasurements).length === 0 ? (
            <button
              type="button"
              className="action-repeat"
              onClick={() => setOpenSheet('growth')}
            >
              <GrowthIcon size={16} />
              <span>{t.t('growth.add')}</span>
            </button>
          ) : (
            <dl className="ledger">
              {MEASURE_KINDS.filter(
                (measure) => lastMeasurements[measure] !== undefined,
              ).map(
                (measure) => (
                  <div className="ledger-row" key={measure}>
                    <dt className="ledger-term">{measureName(t, measure)}</dt>
                    <dd className="ledger-value">
                      {formatMeasure(
                        t,
                        lastMeasurements[measure] as number,
                        measure,
                        settings.measureSystem,
                      )}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          )}
        </section>

        <section className="section" aria-label={t.t('section.stash')}>
          <RuleLabel
            actions={
              <button type="button" className="icon-button" onClick={onOpenStash}>
                <ChevronRightIcon size={18} />
                <span className="sr-only">{t.t('stash.title')}</span>
              </button>
            }
          >
            {t.t('section.stash')}
          </RuleLabel>
          <button type="button" className="action-repeat" onClick={onOpenStash}>
            <PumpIcon size={16} />
            <span>{t.t('stash.title')}</span>
          </button>
        </section>

        <section className="section" aria-label={t.t('section.patterns')}>
          <RuleLabel
            actions={
              <button type="button" className="icon-button" onClick={onOpenPatterns}>
                <ChevronRightIcon size={18} />
                <span className="sr-only">{t.t('patterns.title')}</span>
              </button>
            }
          >
            {t.t('section.patterns')}
          </RuleLabel>
          <button type="button" className="action-repeat" onClick={onOpenPatterns}>
            <WheelIcon size={16} />
            <span>{t.t('patterns.dayWheel')}</span>
          </button>
        </section>

        {/* Its own section rather than a row under Patterns: handing over is a
            thing a parent comes to the app to do, not a chart to look at. */}
        <section className="section" aria-label={t.t('handover.title')}>
          <RuleLabel
            actions={
              <button type="button" className="icon-button" onClick={onOpenHandover}>
                <ChevronRightIcon size={18} />
                <span className="sr-only">{t.t('handover.title')}</span>
              </button>
            }
          >
            {t.t('handover.title')}
          </RuleLabel>
          <button type="button" className="action-repeat" onClick={onOpenHandover}>
            <HandoverIcon size={16} />
            <span>{t.t('handover.subtitle')}</span>
          </button>
        </section>

        <section className="section" aria-label={t.t('section.health')}>
          <RuleLabel
            actions={
              <button type="button" className="icon-button" onClick={onOpenHealth}>
                <ChevronRightIcon size={18} />
                <span className="sr-only">{t.t('health.title')}</span>
              </button>
            }
          >
            {t.t('section.health')}
          </RuleLabel>
          <button type="button" className="action-repeat" onClick={onOpenHealth}>
            <HealthIcon size={16} />
            <span>{t.t('health.title')}</span>
          </button>
          <button type="button" className="action-repeat" onClick={onOpenIllness}>
            <DiaryIcon size={16} />
            <span>{t.t('health.symptomsAndVisits')}</span>
          </button>
          {/* The one thing about an appointment worth seeing without opening
              anything: that it is coming, and when. */}
          {appointment !== null && (
            <p className="field-note">
              {appointment.reason}
              {' · '}
              {t.t('visit.in', {
                duration: formatSpan(t, appointment.startedAt - now),
              })}
            </p>
          )}
        </section>

        <section className="section" aria-label={t.t('section.timeline')}>
          <RuleLabel>{t.t('section.timeline')}</RuleLabel>
          <Timeline
            events={dayEvents}
            unit={settings.volumeUnit}
            measureSystem={settings.measureSystem}
            now={now}
            onSelect={setEditing}
          />
        </section>
      </main>

      {openSheet === 'nursing' && nursingTimer !== null && (
        <NursingSheet
          timer={nursingTimer}
          now={now}
          lastSide={lastSide}
          onToggle={() =>
            updateTimer(
              nursingTimer === null ? null : toggleTimer(nursingTimer, Date.now()),
            )
          }
          onSwitchSide={() => void handleSwitchSide()}
          onSelectSide={(side: BreastSide) => updateTimer(idleTimer(side))}
          onSave={() => void saveNursing()}
          onDiscard={() => {
            updateTimer(null)
            setOpenSheet(null)
          }}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {openSheet === 'bottle' && (
        <BottleSheet
          unit={settings.volumeUnit}
          lastContents={lastFeed?.type === 'bottle' ? lastFeed.contents : null}
          lastAmountMl={lastFeed?.type === 'bottle' ? lastFeed.amountMl : null}
          onSave={async ({ contents, amountMl }) => {
            await store.logBottle({ contents, amountMl, startedAt: logAt() })
            setToast(t.t('toast.bottleSaved'))
            setOpenSheet(null)
            returnToToday()
          }}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {openSheet === 'growth' && (
        <GrowthSheet
          system={settings.measureSystem}
          initialMeasure="weight"
          lastValues={lastMeasurements}
          onSave={async ({ measure, value }) => {
            await store.logGrowth({ measure, value, startedAt: logAt() })
            setToast(t.t('toast.growthSaved'))
            setOpenSheet(null)
            returnToToday()
          }}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {openSheet === 'pumping' && (
        <PumpingSheet
          unit={settings.volumeUnit}
          now={now}
          onSave={async (input) => {
            await store.logPumping({ ...input, startedAt: logAt() })
            setToast(t.t('toast.pumpingSaved'))
            setOpenSheet(null)
            returnToToday()
          }}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {openSheet === 'babies' && (
        <BabySwitcherSheet
          babies={store.babies}
          activeBabyId={activeBaby.id}
          now={now}
          onSwitch={(baby) => {
            setOpenSheet(null)
            if (baby.id === activeBaby.id) return
            onSwitchBaby(baby.id)
            setToast(t.t('toast.babySwitched', { name: baby.name }))
          }}
          onAdd={async (input) => {
            const baby = await store.createBaby(input)
            setOpenSheet(null)
            onSwitchBaby(baby.id)
            setToast(t.t('toast.babyAdded', { name: baby.name }))
          }}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {editing !== null && (
        <EventEditSheet
          event={editing}
          unit={settings.volumeUnit}
          measureSystem={settings.measureSystem}
          onSave={async (patch) => {
            await store.updateEvent(editing.id, patch)
            setEditing(null)
            setToast(t.t('toast.entryUpdated'))
          }}
          onDelete={async () => {
            await store.deleteEvent(editing.id)
            setEditing(null)
            setToast(t.t('toast.entryDeleted'))
          }}
          onClose={() => setEditing(null)}
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
