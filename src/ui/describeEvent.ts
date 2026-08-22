import { formatClock } from '@/domain/time'
import type {
  BabyEvent,
  DiaperKind,
  MeasureSystem,
  Timestamp,
  VolumeUnit,
} from '@/domain/types'
import {
  activityName,
  formatDuration,
  formatMeasure,
  formatTemperature,
  formatVolume,
  foodAcceptanceName,
  measureName,
  pottyPlaceName,
  pottyResultName,
  symptomImpressionName,
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
  // Solids get their own tint rather than sharing the milk one: "did she eat?" and
  // "did she drink?" are different questions once weaning starts.
  | 'food'
  | 'activity'
  | 'potty'
  | 'milestone'

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

    case 'symptom':
      return {
        category: 'health',
        title: event.name,
        detail: symptomImpressionName(t, event.impression),
        live: false,
      }

    case 'food':
      return {
        category: 'food',
        title: event.name,
        detail: [
          foodAcceptanceName(t, event.acceptance),
          event.reaction ? t.t('food.reactionShort') : '',
        ]
          .filter((part) => part !== '')
          .join(' · '),
        live: false,
      }

    case 'activity':
      return {
        category: 'activity',
        title: activityName(t, event.kind),
        detail: event.durationMs > 0 ? formatDuration(t, event.durationMs) : '',
        live: false,
      }

    case 'potty':
      return {
        category: 'potty',
        title: pottyResultName(t, event.result),
        // The place is omitted for an accident: "Accident · on the potty" reads as
        // a contradiction, and where they were sitting is not the point.
        detail: event.result === 'accident' ? '' : pottyPlaceName(t, event.place),
        live: false,
      }

    case 'milestone':
      return {
        category: 'milestone',
        title: event.name,
        detail: '',
        live: false,
      }

    case 'visit':
      return {
        category: 'health',
        title: event.reason,
        // The clinic if it was named, otherwise how far through the questions the
        // parent got — the two things worth seeing without opening the entry.
        detail:
          event.who !== ''
            ? event.who
            : event.questions.length === 0
              ? ''
              : t.t('visit.questionsProgress', {
                  asked: t.number(
                    event.questions.filter((question) => question.asked).length,
                  ),
                  total: t.number(event.questions.length),
                }),
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
