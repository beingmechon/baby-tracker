import { DAY_MS } from './time'
import type { Id, Timestamp } from './types'

/**
 * The milk stash: what is in the fridge and the freezer, how old it is, and which
 * container to reach for first.
 *
 * Not an event. A stash entry has mutable state — it gets partly used, topped up
 * by nothing, and eventually thrown away — so it lives in its own store rather
 * than in the append-oriented event log.
 */

export type StashLocation = 'fridge' | 'freezer'

export interface StashEntry {
  id: Id
  babyId: Id
  /** Millilitres remaining. An entry is deleted rather than kept at zero. */
  amountMl: number
  location: StashLocation
  /**
   * When the milk was *expressed*, not when it was logged.
   *
   * This is the whole basis of the age shown, and the two can differ by hours —
   * milk gets logged when there is a free hand, not when the pump stops.
   */
  expressedAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export const STASH_LOCATIONS: readonly StashLocation[] = ['fridge', 'freezer']

/**
 * How long milk keeps, per the CDC's published storage guidance for freshly
 * expressed milk: up to 4 days in a fridge, and best used within 6 months of
 * freezing (they accept up to 12).
 *
 * These are the CDC's figures, not this project's advice, and the screen says so
 * and points the reader at their own local guidance. They exist here so the app
 * can sort by urgency and mark what is past the figure — which is a description
 * of a date, not a recommendation about a baby.
 */
export const STORAGE_GUIDELINE_MS: Record<StashLocation, number> = {
  fridge: 4 * DAY_MS,
  freezer: 180 * DAY_MS,
}

/** Fraction of the guideline left at which an entry is worth flagging. */
const RUNNING_OUT_FRACTION = 0.25

export type StashState = 'fresh' | 'useSoon' | 'pastGuideline'

export interface StashStatus {
  entry: StashEntry
  ageMs: number
  guidelineMs: number
  /** Time left against the guideline; negative once past it. */
  remainingMs: number
  state: StashState
}

export function stashStatus(entry: StashEntry, now: Timestamp): StashStatus {
  const guidelineMs = STORAGE_GUIDELINE_MS[entry.location]
  const ageMs = Math.max(0, now - entry.expressedAt)
  const remainingMs = guidelineMs - ageMs

  return {
    entry,
    ageMs,
    guidelineMs,
    remainingMs,
    state:
      remainingMs <= 0
        ? 'pastGuideline'
        : remainingMs <= guidelineMs * RUNNING_OUT_FRACTION
          ? 'useSoon'
          : 'fresh',
  }
}

/**
 * The order to take milk out in, and the reason this feature is worth having.
 *
 * Sorted by how little time each container has left *against its own guideline*,
 * not by age. That is what lets a fridge bottle with hours left outrank a frozen
 * bag several months older: they are on a four-day and a six-month clock
 * respectively, so raw age would compare the wrong things and quietly waste the
 * fridge.
 */
export function stashOrder(
  entries: readonly StashEntry[],
  now: Timestamp,
): StashStatus[] {
  return entries
    .map((entry) => stashStatus(entry, now))
    .sort((a, b) => {
      // Least time left against its own guideline comes first, which compares a
      // fridge bottle and a frozen bag on equal terms.
      if (a.remainingMs !== b.remainingMs) return a.remainingMs - b.remainingMs
      return a.entry.expressedAt - b.entry.expressedAt
    })
}

export interface StashTotals {
  fridgeMl: number
  freezerMl: number
  totalMl: number
  /** Entries at or past their storage guideline. */
  pastGuideline: number
}

export function stashTotals(
  entries: readonly StashEntry[],
  now: Timestamp,
): StashTotals {
  let fridgeMl = 0
  let freezerMl = 0
  let pastGuideline = 0

  for (const entry of entries) {
    if (entry.location === 'fridge') fridgeMl += entry.amountMl
    else freezerMl += entry.amountMl
    if (stashStatus(entry, now).state === 'pastGuideline') pastGuideline += 1
  }

  return { fridgeMl, freezerMl, totalMl: fridgeMl + freezerMl, pastGuideline }
}

/**
 * Taking milk out of an entry. Returns the remaining amount, or null when the
 * entry is used up and should be removed.
 *
 * Named `take` rather than `use` on purpose: a `useSomething` export reads as a
 * React hook to both the linter and the next person to open the file.
 *
 * Using more than is there empties it rather than going negative: the amounts are
 * a parent's estimate of what is in a bag, and a negative stash is never the
 * right answer to a mis-tap.
 */
export function takeFromEntry(entry: StashEntry, usedMl: number): number | null {
  const remaining = entry.amountMl - Math.max(0, usedMl)
  return remaining > 0 ? remaining : null
}

/** A stash amount has to be a real volume. */
export function isValidStashAmount(amountMl: number): boolean {
  return Number.isFinite(amountMl) && amountMl > 0
}
