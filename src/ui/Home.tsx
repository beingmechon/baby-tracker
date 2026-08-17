import { useEffect, useMemo, useState } from 'react'
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
import type { BabyStore } from '@/app/useBabyStore'
import { useNow } from '@/app/useNow'
import { findLastFeed, findLastNursingSide, suggestNextSide } from '@/domain/feeds'
import { isToday, selectEventsForDay } from '@/domain/select'
import { summarizeDay } from '@/domain/summary'
import {
  addDays,
  formatAge,
  formatStopwatch,
  localDateKey,
  startOfLocalDay,
} from '@/domain/time'
import type { BabyEvent, BreastSide, DiaperKind, Timestamp } from '@/domain/types'
import { formatVolume } from '@/domain/units'
import { BottleSheet } from './BottleSheet'
import { DaySummary } from './DaySummary'
import { EventEditSheet } from './EventEditSheet'
import { NursingSheet } from './NursingSheet'
import { RuleLabel } from './RuleLabel'
import { StatusHeadline } from './StatusHeadline'
import { Timeline } from './Timeline'
import {
  BottleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  NursingIcon,
  RepeatIcon,
  SettingsIcon,
  SleepIcon,
} from './icons'

interface HomeProps {
  store: BabyStore
  settings: Settings
  onOpenSettings: () => void
}

const QUICK_DIAPERS: { kind: DiaperKind; label: string }[] = [
  { kind: 'wet', label: 'Wet' },
  { kind: 'dirty', label: 'Dirty' },
  { kind: 'mixed', label: 'Mixed' },
]

export function Home({ store, settings, onOpenSettings }: HomeProps) {
  const { activeBaby, events, sleepInProgress } = store

  const [nursingTimer, setNursingTimer] = useState<NursingTimerState | null>(null)
  const [openSheet, setOpenSheet] = useState<'nursing' | 'bottle' | null>(null)
  const [editing, setEditing] = useState<BabyEvent | null>(null)
  const [dayAnchor, setDayAnchor] = useState<Timestamp>(() => startOfLocalDay(Date.now()))
  const [toast, setToast] = useState<string | null>(null)

  // A running clock needs a second-by-second tick; otherwise a lazy 20s is plenty
  // and spares the battery.
  const nursingRunning = nursingTimer !== null && isRunning(nursingTimer)
  const now = useNow(sleepInProgress !== null || nursingRunning ? 1000 : 20_000)

  // Restore a nursing timer left running when the app was last closed.
  useEffect(() => {
    setNursingTimer(loadTimer())
  }, [])

  useEffect(() => {
    saveTimer(nursingTimer)
  }, [nursingTimer])

  useEffect(() => {
    if (toast === null) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const lastSide = useMemo(() => findLastNursingSide(events), [events])
  const lastFeed = useMemo(() => findLastFeed(events), [events])

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

  async function quickDiaper(kind: DiaperKind) {
    await store.logDiaper({ kind, startedAt: logAt() })
    setToast(`${kind[0]?.toUpperCase()}${kind.slice(1)} diaper logged`)
    returnToToday()
  }

  async function toggleSleep() {
    if (sleepInProgress !== null) {
      await store.endSleep(sleepInProgress.id, Date.now())
      setToast('Sleep ended')
      return
    }
    await store.startSleep(Date.now())
    setToast('Sleep started')
  }

  function openNursing() {
    setNursingTimer((current) => current ?? idleTimer(suggestNextSide(lastSide)))
    setOpenSheet('nursing')
  }

  async function saveNursing() {
    if (nursingTimer === null) return
    const completed = completeTimer(nursingTimer, Date.now())
    if (completed !== null) {
      await store.logNursing(completed)
      setToast('Feed saved')
    }
    setNursingTimer(null)
    setOpenSheet(null)
    returnToToday()
  }

  async function handleSwitchSide() {
    if (nursingTimer === null) return
    const { completed, next } = switchSide(nursingTimer, Date.now())
    if (completed !== null) {
      await store.logNursing(completed)
      setToast(`${completed.side === 'left' ? 'Left' : 'Right'} side saved`)
    }
    setNursingTimer(next)
  }

  async function repeatLast() {
    await store.repeatLastFeed(logAt())
    setToast('Last feed repeated')
    returnToToday()
  }

  const nursingElapsed = nursingTimer === null ? 0 : elapsedMs(nursingTimer, now)
  const age = formatAge(activeBaby.birthDate, now)

  const repeatLabel =
    lastFeed === null
      ? null
      : lastFeed.type === 'bottle'
        ? `Repeat last feed · ${formatVolume(lastFeed.amountMl, settings.volumeUnit)}`
        : `Repeat last feed · ${lastFeed.side} side`

  return (
    <>
      <header className="appbar">
        <div className="appbar-identity">
          <span className="appbar-name">{activeBaby.name}</span>
          {age !== null && <span className="appbar-age">{age}</span>}
        </div>
        <button type="button" className="icon-button" onClick={onOpenSettings}>
          <SettingsIcon />
          <span className="sr-only">Settings</span>
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

        <section className="section" aria-label="Log an entry">
          <RuleLabel>Log</RuleLabel>
          <div className="actions">
            <button
              type="button"
              className="action action-primary"
              onClick={() => void toggleSleep()}
            >
              <SleepIcon size={20} className="action-icon" />
              <span>{sleepInProgress === null ? 'Start sleep' : 'Wake up'}</span>
            </button>

            <div className="action-row">
              <button type="button" className="action" onClick={openNursing}>
                <NursingIcon size={18} className="action-icon" />
                <span>
                  Nursing
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
                <span>Bottle</span>
              </button>
            </div>

            {/* No icons here: three identical diaper glyphs would carry no
                information the labels don't already carry — Tufte's 1+1=3. */}
            <div className="action-row-3" role="group" aria-label="Log a diaper">
              {QUICK_DIAPERS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  className="action"
                  onClick={() => void quickDiaper(kind)}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {repeatLabel !== null && (
              <button
                type="button"
                className="action-repeat"
                onClick={() => void repeatLast()}
              >
                <RepeatIcon size={16} />
                <span>{repeatLabel}</span>
              </button>
            )}
          </div>
        </section>

        <section className="section" aria-label="Daily summary">
          <RuleLabel
            actions={
              <>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setDayAnchor((day) => addDays(day, -1))}
                >
                  <ChevronLeftIcon size={18} />
                  <span className="sr-only">Previous day</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setDayAnchor((day) => addDays(day, 1))}
                  disabled={viewingToday}
                >
                  <ChevronRightIcon size={18} />
                  <span className="sr-only">Next day</span>
                </button>
              </>
            }
          >
            {viewingToday ? 'Today' : localDateKey(dayAnchor)}
          </RuleLabel>

          <DaySummary summary={summary} unit={settings.volumeUnit} />
        </section>

        <section className="section" aria-label="Timeline">
          <RuleLabel>Timeline</RuleLabel>
          <Timeline
            events={dayEvents}
            unit={settings.volumeUnit}
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
            setNursingTimer((current) =>
              current === null ? null : toggleTimer(current, Date.now()),
            )
          }
          onSwitchSide={() => void handleSwitchSide()}
          onSelectSide={(side: BreastSide) => setNursingTimer(idleTimer(side))}
          onSave={() => void saveNursing()}
          onDiscard={() => {
            setNursingTimer(null)
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
            setToast('Bottle saved')
            setOpenSheet(null)
            returnToToday()
          }}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {editing !== null && (
        <EventEditSheet
          event={editing}
          unit={settings.volumeUnit}
          onSave={async (patch) => {
            await store.updateEvent(editing.id, patch)
            setEditing(null)
            setToast('Entry updated')
          }}
          onDelete={async () => {
            await store.deleteEvent(editing.id)
            setEditing(null)
            setToast('Entry deleted')
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
