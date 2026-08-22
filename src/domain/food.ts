import { DAY_MS } from './time'
import type { Allergen, BabyEvent, FoodEvent, Timestamp } from './types'

/**
 * Solids, and which of the nine major allergens have been offered.
 *
 * The question this exists to answer is one parents are asked at every appointment
 * from six months and cannot answer from memory: has she had egg? peanut? when?
 * Twelve scattered food entries do not answer it; nine rows do.
 *
 * Two rules, both about not overstepping.
 *
 * **The app never infers what is in a food.** Allergens are tagged by the parent
 * when they log. There is no food-composition database here and there will not be
 * one: guessing that hummus contains sesame happens to be right, and guessing that a
 * supermarket biscuit contains no egg is how an app tells a parent something
 * dangerous and untrue.
 *
 * **It reports, and does not grade.** A reaction is a flag the parent set, not a
 * severity this file computed, and "no reaction noted" is phrased as the absence of
 * a record rather than as tolerance. Whether a food is safe for a child is a
 * question for their doctor, and the screen says so.
 */

/**
 * The nine, in the order the screen lists them.
 *
 * Roughly the order they come up in practice rather than the order the statute
 * lists them: milk and egg first because they are in everything, the nuts next
 * because they are what parents worry about, shellfish and sesame last.
 */
export const ALLERGENS: readonly Allergen[] = [
  'milk',
  'egg',
  'peanut',
  'treeNut',
  'wheat',
  'soy',
  'fish',
  'shellfish',
  'sesame',
]

/** The grouping key for a food name. Shared, so no two screens disagree. */
export function foodKey(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function foodEvents(events: readonly BabyEvent[]): FoodEvent[] {
  return events
    .filter((event): event is FoodEvent => event.type === 'food')
    .sort((a, b) => b.startedAt - a.startedAt)
}

export interface FoodSummary {
  /** The name as most recently spelled by the parent. */
  name: string
  times: number
  firstOfferedAt: Timestamp
  lastOfferedAt: Timestamp
  /** True if any offering of this food was marked as producing a reaction. */
  reacted: boolean
  /** Every allergen the parent has ever tagged this food with. */
  allergens: Allergen[]
}

/**
 * Foods grouped by name, most recently offered first.
 *
 * Matched case- and space-insensitively, like medication names, so "Banana" and
 * "banana " are one food and the count of times offered is right.
 */
export function foodSummaries(events: readonly BabyEvent[]): FoodSummary[] {
  const byKey = new Map<string, FoodSummary>()

  // Oldest first so `firstOfferedAt` falls out of the iteration order and the most
  // recent spelling is the one left standing at the end.
  for (const event of [...foodEvents(events)].reverse()) {
    const key = foodKey(event.name)
    if (key.length === 0) continue

    const existing = byKey.get(key)
    if (existing === undefined) {
      byKey.set(key, {
        name: event.name.trim(),
        times: 1,
        firstOfferedAt: event.startedAt,
        lastOfferedAt: event.startedAt,
        reacted: event.reaction,
        allergens: [...event.allergens],
      })
      continue
    }

    existing.times += 1
    existing.name = event.name.trim()
    existing.lastOfferedAt = event.startedAt
    // Sticky: a food that once caused a reaction stays flagged even if later
    // offerings did not. Silently clearing that would be the worst kind of helpful.
    existing.reacted = existing.reacted || event.reaction
    for (const allergen of event.allergens) {
      if (!existing.allergens.includes(allergen)) existing.allergens.push(allergen)
    }
  }

  return [...byKey.values()].sort((a, b) => b.lastOfferedAt - a.lastOfferedAt)
}

export type AllergenState = 'notTried' | 'noReaction' | 'reacted'

export interface AllergenStatus {
  allergen: Allergen
  state: AllergenState
  /** How many separate offerings were tagged with it. */
  times: number
  firstOfferedAt: Timestamp | null
  lastOfferedAt: Timestamp | null
  /** The foods it was tagged on, most recent first, for "egg — in scrambled egg". */
  foods: string[]
}

/**
 * Where each of the nine stands, from what the parent has logged.
 *
 * `noReaction` is deliberately not called "tolerated". Tolerance is a clinical
 * conclusion drawn from a controlled introduction; what this app knows is that a
 * food was offered n times and nobody wrote down a reaction. Naming a threshold
 * above which the app declares a child tolerant would be inventing medicine, so it
 * reports the count and lets the parent and their doctor draw the conclusion.
 */
export function allergenStatuses(events: readonly BabyEvent[]): AllergenStatus[] {
  const tagged = foodEvents(events).filter((event) => event.allergens.length > 0)

  return ALLERGENS.map((allergen) => {
    const matching = tagged.filter((event) => event.allergens.includes(allergen))
    if (matching.length === 0) {
      return {
        allergen,
        state: 'notTried' as const,
        times: 0,
        firstOfferedAt: null,
        lastOfferedAt: null,
        foods: [],
      }
    }

    const names: string[] = []
    for (const event of matching) {
      const name = event.name.trim()
      if (name !== '' && !names.some((seen) => foodKey(seen) === foodKey(name))) {
        names.push(name)
      }
    }

    return {
      allergen,
      state: matching.some((event) => event.reaction)
        ? ('reacted' as const)
        : ('noReaction' as const),
      times: matching.length,
      // `matching` is newest first, so the oldest is at the end.
      firstOfferedAt: (matching[matching.length - 1] as FoodEvent).startedAt,
      lastOfferedAt: (matching[0] as FoodEvent).startedAt,
      foods: names,
    }
  })
}

/** How many of the nine have been offered at all. Drives the one-line summary. */
export function allergensOffered(events: readonly BabyEvent[]): number {
  return allergenStatuses(events).filter((status) => status.state !== 'notTried').length
}

/** Every distinct food name logged, newest first, for suggesting the next one. */
export function foodNames(events: readonly BabyEvent[]): string[] {
  return foodSummaries(events).map((summary) => summary.name)
}

/**
 * Foods offered in the last week, newest first.
 *
 * The window a parent is actually asked about — "what has she had this week?" — and
 * short enough that a reaction appearing days later still has its candidate list.
 */
export function recentFoods(
  events: readonly BabyEvent[],
  now: Timestamp,
  days = 7,
): FoodEvent[] {
  const since = now - days * DAY_MS
  return foodEvents(events).filter(
    (event) => event.startedAt >= since && event.startedAt <= now,
  )
}
