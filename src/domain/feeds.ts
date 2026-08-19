import type { BabyEvent, BreastSide, FeedEvent, Timestamp } from './types'
import { isFeed } from './types'

/** The most recent feed of any kind, or null. Powers "last fed 2h 10m ago". */
export function findLastFeed(events: readonly BabyEvent[]): FeedEvent | null {
  let latest: FeedEvent | null = null
  for (const event of events) {
    if (!isFeed(event)) continue
    if (latest === null || event.startedAt > latest.startedAt) latest = event
  }
  return latest
}

/** The side used at the last nursing session, so the app can remember it. */
export function findLastNursingSide(
  events: readonly BabyEvent[],
): BreastSide | null {
  let latest: Timestamp | null = null
  let side: BreastSide | null = null
  for (const event of events) {
    if (event.type !== 'nursing') continue
    if (latest === null || event.startedAt > latest) {
      latest = event.startedAt
      side = event.side
    }
  }
  return side
}

/**
 * Which side to offer first. Feeds usually alternate, so the opposite of the
 * last side is the better default; with no history at all, left is arbitrary
 * but harmless.
 */
export function suggestNextSide(lastSide: BreastSide | null): BreastSide {
  if (lastSide === null) return 'left'
  return lastSide === 'left' ? 'right' : 'left'
}

/**
 * Time since the last feed began. Deliberately measured from the *start* of
 * the feed: feeding intervals are conventionally start-to-start.
 */
export function sinceLastFeedMs(
  events: readonly BabyEvent[],
  now: Timestamp,
): number | null {
  const last = findLastFeed(events)
  if (last === null) return null
  return Math.max(0, now - last.startedAt)
}
