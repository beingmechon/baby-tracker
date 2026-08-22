import type { BabyEvent, MilestoneEvent, Timestamp } from './types'

/**
 * Milestones — the page in the back of a baby book.
 *
 * Deliberately *not* a developmental checklist. The CDC publishes one and it is
 * worth having eventually, but a paraphrased milestone list shown to a parent who is
 * already worried is worse than no list at all, so that stays on the roadmap marked
 * as needing exact transcription. What this is instead is "first smile, first tooth,
 * first steps" — the list every baby book has had for a century, which nobody needs
 * to be qualified to write and which is what most parents actually want.
 *
 * The suggestions below are prompts, not a schedule. There are no ages attached to
 * any of them on purpose: the moment an app says "first steps — 12 months" it has
 * started telling a parent whether their child is late.
 */

/**
 * Offered as one-tap suggestions when adding a milestone.
 *
 * Roughly chronological so the list reads sensibly, but never labelled with an age.
 * Free text is always available; these exist to save typing at the moment somebody
 * is holding a baby with one hand.
 */
export const MILESTONE_SUGGESTIONS: readonly string[] = [
  'First smile',
  'Held their head up',
  'Rolled over',
  'First laugh',
  'Sat up',
  'First tooth',
  'First solid food',
  'Crawled',
  'Pulled to standing',
  'First word',
  'First steps',
  'First haircut',
]

export function milestoneEvents(events: readonly BabyEvent[]): MilestoneEvent[] {
  return events
    .filter((event): event is MilestoneEvent => event.type === 'milestone')
    .sort((a, b) => b.startedAt - a.startedAt)
}

/** Just the ones with a photograph, newest first — the journal. */
export function photoMilestones(events: readonly BabyEvent[]): MilestoneEvent[] {
  return milestoneEvents(events).filter((event) => event.photoId !== null)
}

/**
 * The suggestions not yet recorded, so the chips stop offering what is already done.
 *
 * Matched case-insensitively against what was actually typed, because a parent who
 * wrote "first tooth" in lower case has recorded the same milestone.
 */
export function remainingSuggestions(
  events: readonly BabyEvent[],
  suggestions: readonly string[] = MILESTONE_SUGGESTIONS,
): string[] {
  const recorded = new Set(
    milestoneEvents(events).map((event) => event.name.trim().toLocaleLowerCase()),
  )
  return suggestions.filter(
    (suggestion) => !recorded.has(suggestion.toLocaleLowerCase()),
  )
}

/** Every photo id referenced by a milestone, for finding orphaned bytes. */
export function referencedPhotoIds(events: readonly BabyEvent[]): Set<string> {
  const ids = new Set<string>()
  for (const event of milestoneEvents(events)) {
    if (event.photoId !== null) ids.add(event.photoId)
  }
  return ids
}

/**
 * The most recent milestone, for the one line the home screen shows.
 *
 * Excludes anything dated in the future: a milestone is something that happened, and
 * a mistyped year should not sit at the top of the list forever.
 */
export function latestMilestone(
  events: readonly BabyEvent[],
  now: Timestamp,
): MilestoneEvent | null {
  return milestoneEvents(events).find((event) => event.startedAt <= now) ?? null
}
