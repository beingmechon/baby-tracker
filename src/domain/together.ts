import type { EventType, Id } from './types'

/**
 * Logging for more than one baby at once — twins mode.
 *
 * Twin parents are the most sleep-deprived users this app has and the least served
 * by every tracker on the market: logging the same diaper change twice, from two
 * screens, at 4am, is the kind of friction that makes a parent stop logging
 * altogether.
 *
 * The model is a *group*, not a direction. "These babies are logged together" is
 * symmetric, so it reads the same whichever twin is on screen — an
 * "also log for..." setting attached to one baby would mean something different
 * depending on which one you happened to have open, which is exactly the confusion
 * to avoid at 4am.
 *
 * What it deliberately does not do is guess. A group of one is off. A baby who is
 * not in the group is unaffected even while the group exists, which is what makes
 * the feature safe to leave switched on when a third, older child is also tracked.
 */

/**
 * The event types that fan out to the group, and the rule behind the list.
 *
 * **A shared action fans out; a record about one body never does.**
 *
 * "I changed both" and "I fed both" are one action a parent took, and typing them
 * twice at 4am is the friction this feature exists to remove. A weight, a
 * temperature, a symptom or a dose of medicine is a fact about one child — and
 * duplicating a dose would put a record in a second child's medical log saying they
 * received a drug they did not receive, which is the most consequential mistake this
 * app could make. Pumping stays out too: that is the parent's output, and copying it
 * would double-count the milk in the stash.
 *
 * Sleep is excluded for a different reason. A running timer belongs to one baby, and
 * twins do not wake at the same minute — ending one sleep would have to either
 * invent a wake time for the other or leave their timer running forever. Both are
 * worse than logging the second nap with one extra tap.
 */
const FANS_OUT: ReadonlySet<EventType> = new Set<EventType>([
  'nursing',
  'bottle',
  'diaper',
])

export function fansOut(type: EventType): boolean {
  return FANS_OUT.has(type)
}

/**
 * Every baby an event should be written for.
 *
 * The active baby always gets it, and always exactly once. The group only widens
 * that when the active baby is a member: opening a sibling who is not in the group
 * writes only for them, so a family with twins and a toddler works without turning
 * the setting on and off.
 */
export function logTargets(
  activeId: Id | null,
  togetherIds: readonly Id[],
  type?: EventType,
): Id[] {
  if (activeId === null) return []
  if (type !== undefined && !fansOut(type)) return [activeId]
  if (!togetherIds.includes(activeId)) return [activeId]
  // Active first, so the baby on screen is written before their sibling and a
  // failure part-way through cannot leave the *other* baby with the only copy.
  return [activeId, ...togetherIds.filter((id) => id !== activeId)]
}

/** Whether logging will fan out from this baby. Drives the note on the log screen. */
export function logsTogether(activeId: Id | null, togetherIds: readonly Id[]): boolean {
  return logTargets(activeId, togetherIds).length > 1
}

/**
 * The group, with anything stale removed.
 *
 * A deleted baby leaves their id behind in settings — localStorage knows nothing
 * about the database — and a group of one is not a group. Cleaning on read rather
 * than on delete keeps the two stores from having to know about each other.
 */
export function cleanTogetherIds(
  togetherIds: readonly Id[],
  existingIds: readonly Id[],
): Id[] {
  const kept = [...new Set(togetherIds)].filter((id) => existingIds.includes(id))
  return kept.length < 2 ? [] : kept
}
