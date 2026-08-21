import { formatClock } from '@/domain/time'
import type {
  BabyEvent,
  DiaperKind,
  MeasureSystem,
  Timestamp,
  VolumeUnit,
} from '@/domain/types'
import {
  formatDuration,
  formatMeasure,
  formatTemperature,
  formatVolume,
  measureName,
  temperatureSiteName,
} from '@/i18n/format'
import type { MessageKey, Translator } from '@/i18n/locales'

export type Category =
  | 'feed'
  | 'sleep'
  | 'diaper'
  | 'growth'
  | 'pumping'
  | 'health'

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

export interface DescribeContext {
  volumeUnit: VolumeUnit
  measureSystem: MeasureSystem
  now: Timestamp
  /** Passed in rather than read from context, so this stays a plain function. */
  t: Translator
}

/**
 * Turns an event into the two lines a timeline row shows.
 *
 * Kept pure and apart from the components so the exact wording is testable — this
 * copy is read hundreds of times a week and small ambiguities get irritating fast.
 * Every string comes from the catalogue.
 */
export function describeEvent(
  event: BabyEvent,
  { volumeUnit, measureSystem, now, t }: DescribeContext,
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
        detail: formatVolume(t, event.amountMl, volumeUnit),
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

    case 'pumping': {
      const total = event.leftMl + event.rightMl
      const split =
        event.leftMl > 0 && event.rightMl > 0
          ? t.t('pumping.bothSides', {
              left: formatVolume(t, event.leftMl, volumeUnit),
              right: formatVolume(t, event.rightMl, volumeUnit),
            })
          : t.t(event.leftMl > 0 ? 'pumping.leftOnly' : 'pumping.rightOnly')
      return {
        category: 'pumping',
        title: t.t('event.pumping'),
        detail: `${formatVolume(t, total, volumeUnit)} · ${split}`,
        live: false,
      }
    }

    case 'temperature':
      return {
        category: 'health',
        title: t.t('event.temperature'),
        detail: `${formatTemperature(t, event.celsiusHundredths, measureSystem)} · ${temperatureSiteName(t, event.site)}`,
        live: false,
      }

    case 'medication':
      return {
        category: 'health',
        title: event.name,
        detail: event.dose,
        live: false,
      }

    case 'growth':
      return {
        category: 'growth',
        title: measureName(t, event.measure),
        // Deliberately just the measurement. The percentile belongs on the growth
        // screen next to its disclaimer, not scrolling past in a day's timeline.
        detail: formatMeasure(t, event.value, event.measure, measureSystem),
        live: false,
      }
  }
}
