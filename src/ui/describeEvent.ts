import { formatClock, formatDuration } from '@/domain/time'
import type { BabyEvent, DiaperKind, Timestamp, VolumeUnit } from '@/domain/types'
import { formatVolume } from '@/domain/units'

export type Category = 'feed' | 'sleep' | 'diaper'

export interface EventDescription {
  category: Category
  title: string
  detail: string
  /** True while a sleep is still running, so the row can show a live marker. */
  live: boolean
}

const DIAPER_TITLES: Record<DiaperKind, string> = {
  wet: 'Wet diaper',
  dirty: 'Dirty diaper',
  mixed: 'Mixed diaper',
  dry: 'Dry diaper',
}

/**
 * Turns an event into the two lines a timeline row shows. Kept pure and apart
 * from the components so the exact wording is testable — this copy is read
 * hundreds of times a week and small ambiguities get irritating fast.
 */
export function describeEvent(
  event: BabyEvent,
  unit: VolumeUnit,
  now: Timestamp,
): EventDescription {
  switch (event.type) {
    case 'nursing':
      return {
        category: 'feed',
        title: event.side === 'left' ? 'Nursed left' : 'Nursed right',
        detail: formatDuration(event.durationMs),
        live: false,
      }

    case 'bottle':
      return {
        category: 'feed',
        title: event.contents === 'breast_milk' ? 'Bottle, breast milk' : 'Bottle, formula',
        detail: formatVolume(event.amountMl, unit),
        live: false,
      }

    case 'sleep': {
      const running = event.endedAt === null
      const duration = formatDuration((event.endedAt ?? now) - event.startedAt)
      return {
        category: 'sleep',
        title: event.kind === 'night' ? 'Night sleep' : 'Nap',
        detail: running
          ? `since ${formatClock(event.startedAt)} · ${duration}`
          : `${duration} · woke ${formatClock(event.endedAt as Timestamp)}`,
        live: running,
      }
    }

    case 'diaper':
      return {
        category: 'diaper',
        title: DIAPER_TITLES[event.kind],
        detail: '',
        live: false,
      }
  }
}
