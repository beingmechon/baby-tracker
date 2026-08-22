import { DAY_MS } from './time'
import type {
  BabyEvent,
  DoctorVisitEvent,
  SymptomEvent,
  SymptomImpression,
  Timestamp,
} from './types'

/**
 * The symptom diary and doctor visits.
 *
 * This file records and orders. It does not assess, score, triage or advise, and
 * nothing here reads meaning into what a parent wrote down — see the house rules in
 * CONTRIBUTING.md. A "moderate" cough is moderate because a parent said so, and the
 * only thing the app does with that word is show it back to them and print it.
 *
 * What it *does* do is answer the question every doctor opens with and no
 * sleep-deprived parent can answer: when did this start, and how has it gone since.
 */

/**
 * How long a gap ends an episode.
 *
 * Two days without logging a cough almost always means the cough stopped, not that
 * nobody wrote it down; and the alternative — one endless "cough" episode running
 * from birth — makes "when did it start" useless, which is the whole point.
 */
export const EPISODE_GAP_MS = 2 * DAY_MS

/** How much history a printed visit sheet carries. Two weeks is what gets asked. */
export const VISIT_HISTORY_DAYS = 14

/** The grouping key for a symptom name. Shared, so no two screens disagree. */
export function symptomKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export interface SymptomEpisode {
  /** The name as most recently spelled by the parent. */
  name: string
  entries: SymptomEvent[]
  startedAt: Timestamp
  lastNotedAt: Timestamp
  /** The worst impression recorded in the episode, as the parent judged it. */
  worst: SymptomImpression
  /** True while it is still inside the gap window, so it may still be going. */
  ongoing: boolean
}

const IMPRESSION_ORDER: Record<SymptomImpression, number> = {
  mild: 0,
  moderate: 1,
  severe: 2,
}

/**
 * Symptoms grouped into episodes, most recent first.
 *
 * One episode per run of entries about the same thing. "Cough, three days,
 * getting worse" is what a doctor wants; twelve separate cough lines is what the
 * log holds.
 */
export function symptomEpisodes(
  events: readonly BabyEvent[],
  now: Timestamp,
  gapMs = EPISODE_GAP_MS,
): SymptomEpisode[] {
  const byKey = new Map<string, SymptomEvent[]>()

  for (const event of events) {
    if (event.type !== 'symptom') continue
    const key = symptomKey(event.name)
    if (key.length === 0) continue
    const list = byKey.get(key)
    if (list === undefined) byKey.set(key, [event])
    else list.push(event)
  }

  const episodes: SymptomEpisode[] = []

  for (const entries of byKey.values()) {
    const ascending = [...entries].sort((a, b) => a.startedAt - b.startedAt)
    let run: SymptomEvent[] = []

    const flush = () => {
      if (run.length === 0) return
      const first = run[0] as SymptomEvent
      const last = run[run.length - 1] as SymptomEvent
      episodes.push({
        // The most recent spelling wins, as it does for medication names: correct
        // it once and it is corrected everywhere.
        name: last.name.trim(),
        entries: run,
        startedAt: first.startedAt,
        lastNotedAt: last.startedAt,
        worst: run.reduce<SymptomImpression>(
          (worst, entry) =>
            IMPRESSION_ORDER[entry.impression] > IMPRESSION_ORDER[worst]
              ? entry.impression
              : worst,
          'mild',
        ),
        ongoing: now - last.startedAt <= gapMs,
      })
      run = []
    }

    for (const entry of ascending) {
      const previous = run[run.length - 1]
      if (previous !== undefined && entry.startedAt - previous.startedAt > gapMs) {
        flush()
      }
      run.push(entry)
    }
    flush()
  }

  return episodes.sort((a, b) => b.lastNotedAt - a.lastNotedAt)
}

/**
 * Visits split into what is coming and what has been, each in reading order.
 *
 * Upcoming runs soonest-first because the next appointment is the one being
 * prepared for; past runs newest-first because that is where you look for what was
 * said last time.
 */
export function splitVisits(
  events: readonly BabyEvent[],
  now: Timestamp,
): { upcoming: DoctorVisitEvent[]; past: DoctorVisitEvent[] } {
  const visits = events.filter(
    (event): event is DoctorVisitEvent => event.type === 'visit',
  )
  return {
    upcoming: visits
      .filter((visit) => visit.startedAt > now)
      .sort((a, b) => a.startedAt - b.startedAt),
    past: visits
      .filter((visit) => visit.startedAt <= now)
      .sort((a, b) => b.startedAt - a.startedAt),
  }
}

/** The next appointment, or null. Drives the one line the home screen shows. */
export function nextVisit(
  events: readonly BabyEvent[],
  now: Timestamp,
): DoctorVisitEvent | null {
  return splitVisits(events, now).upcoming[0] ?? null
}

/** Every distinct symptom name logged, newest first, for suggesting the next one. */
export function symptomNames(events: readonly BabyEvent[], now: Timestamp): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const episode of symptomEpisodes(events, now)) {
    const key = symptomKey(episode.name)
    if (seen.has(key)) continue
    seen.add(key)
    names.push(episode.name)
  }
  return names
}

/**
 * The symptom entries a printed visit sheet should carry.
 *
 * Bounded to the recent past, oldest first: a sheet handed across a desk is read
 * top to bottom as a story, not scrolled like a feed.
 */
export function symptomsForVisit(
  events: readonly BabyEvent[],
  now: Timestamp,
  days = VISIT_HISTORY_DAYS,
): SymptomEvent[] {
  const since = now - days * DAY_MS
  return events
    .filter(
      (event): event is SymptomEvent =>
        event.type === 'symptom' && event.startedAt >= since && event.startedAt <= now,
    )
    .sort((a, b) => a.startedAt - b.startedAt)
}

/** How far through the questions a visit got. */
export function questionProgress(visit: DoctorVisitEvent): {
  asked: number
  total: number
} {
  return {
    asked: visit.questions.filter((question) => question.asked).length,
    total: visit.questions.length,
  }
}
