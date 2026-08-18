import { formatClock } from '@/domain/time'
import type { BabyEvent, DiaperKind, Timestamp, VolumeUnit } from '@/domain/types'
import { formatDuration, formatVolume } from '@/i18n/format'
import type { MessageKey, Translator } from '@/i18n/locales'

export type Category = 'feed' | 'sleep' | 'diaper' | 'growth'

export interface EventDescription {
  category: Category
  title: string
  detail: string
  /** True while a sleep is still running, so the row can show a live marker. */
  live: boolean
}

const DIAPER_TITLES: Record<DiaperKind, MessageKey> = {
  wet: 'event.diaper.wet',
  dirty: 'event.diaper.dirty',
  mixed: 'event.diaper.mixed',
  dry: 'event.diaper.dry',
}

/**
 * Turns an event into the two lines a timeline row shows.
 *
 * Kept pure and apart from the components so the exact wording is testable — this
 * copy is read hundreds of times a week and small ambiguities get irritating fast.
 * Every string comes from the catalogue; the translator is passed in rather than
 * read from context so this stays a plain function.
 */
export function describeEvent(
  event: BabyEvent,
  unit: VolumeUnit,
  now: Timestamp,
  t: Translator,
): EventDescription {
  switch (event.type) {
    case 'nursing':
      return {
        category: 'feed',
        title: t.t(event.side === 'left' ? 'event.nursed.left' : 'event.nursed.right'),
        detail: formatDuration(t, event.durationMs),
        live: false,
      }

    case 'bottle':
      return {
        category: 'feed',
        title: t.t(
          event.contents === 'breast_milk'
            ? 'event.bottle.breastMilk'
            : 'event.bottle.formula',
        ),
        detail: formatVolume(t, event.amountMl, unit),
        live: false,
      }

    case 'sleep': {
      const running = event.endedAt === null
      const duration = formatDuration(t, (event.endedAt ?? now) - event.startedAt)
      return {
        category: 'sleep',
        title: t.t(event.kind === 'night' ? 'event.sleep.night' : 'event.sleep.nap'),
        detail: running
          ? t.t('event.sleepRunning', {
              time: formatClock(event.startedAt, t.locale),
              duration,
            })
          : t.t('event.sleepEnded', {
              duration,
              time: formatClock(event.endedAt as Timestamp, t.locale),
            }),
        live: running,
      }
    }

    case 'diaper':
      return {
        category: 'diaper',
        title: t.t(DIAPER_TITLES[event.kind]),
        detail: '',
        live: false,
      }
  }
}
