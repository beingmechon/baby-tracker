import type { Handover } from '@/domain/handover'
import { formatClock } from '@/domain/time'
import type { MeasureSystem, VolumeUnit } from '@/domain/types'
import type { Translator } from '@/i18n/locales'
import {
  formatDuration,
  formatTemperature,
  formatVolume,
} from '@/i18n/format'

export interface HandoverTextOptions {
  t: Translator
  babyName: string
  volumeUnit: VolumeUnit
  measureSystem: MeasureSystem
}

/**
 * The handover as plain text, for pasting into a message.
 *
 * Plain text on purpose. This gets sent to a partner on WhatsApp or written on the
 * nursery's whiteboard, and every line has to survive being read on a phone with no
 * formatting at all. No emoji, no markdown, no table: just lines a person can read
 * out loud.
 *
 * Built from the same translator the screen uses, so a handover written in Tamil
 * reads in Tamil. That is also why this lives in `ui/` and not in `domain/` — the
 * domain layer holds no language.
 */
export function handoverText(data: Handover, options: HandoverTextOptions): string {
  const { t, babyName, volumeUnit, measureSystem } = options
  const { summary } = data
  const heading = t.t('handover.textHeading', {
    name: babyName,
    from: formatClock(data.since, t.locale),
    to: formatClock(data.now, t.locale),
  })
  // Built as three blocks joined by one blank line each, rather than by pushing
  // separators as we go: a message with a double gap in it reads as broken when it
  // lands in someone's chat, and interleaving content with separators is exactly
  // how that happens.
  const lines: string[] = []

  if (summary.feeds.count > 0) {
    const parts = [t.plural('handover.feedCount', summary.feeds.count)]
    if (summary.feeds.bottleMl > 0) {
      parts.push(formatVolume(t, summary.feeds.bottleMl, volumeUnit))
    }
    if (summary.feeds.nursingMs > 0) {
      parts.push(formatDuration(t, summary.feeds.nursingMs))
    }
    lines.push(parts.join(' · '))
  }

  if (summary.sleep.sessions > 0) {
    lines.push(
      `${t.plural('handover.sleepCount', summary.sleep.sessions)} · ${formatDuration(
        t,
        summary.sleep.totalMs,
      )}`,
    )
  }

  if (summary.diapers.total > 0) {
    lines.push(t.plural('handover.diaperCount', summary.diapers.total))
  }

  if (summary.pumping.sessions > 0) {
    lines.push(
      `${t.plural('handover.pumpingCount', summary.pumping.sessions)} · ${formatVolume(
        t,
        summary.pumping.ml,
        volumeUnit,
      )}`,
    )
  }

  for (const dose of summary.medications) {
    lines.push(
      t.t('handover.textMedication', {
        name: dose.name,
        dose: dose.dose === '' ? '—' : dose.dose,
        time: formatClock(dose.at, t.locale),
      }),
    )
  }

  for (const reading of summary.temperatures) {
    lines.push(
      t.t('handover.textTemperature', {
        value: formatTemperature(t, reading.celsiusHundredths, measureSystem),
        time: formatClock(reading.at, t.locale),
      }),
    )
  }

  // The "right now" block. Whoever reads this next needs it more than the counts.
  const nowLines: string[] = []
  if (data.asleepSince !== null) {
    nowLines.push(
      t.t('handover.textAsleep', { time: formatClock(data.asleepSince, t.locale) }),
    )
  } else if (data.lastSleep?.endedAt != null) {
    nowLines.push(
      t.t('handover.textWoke', {
        time: formatClock(data.lastSleep.endedAt, t.locale),
      }),
    )
  }
  if (data.lastFeed !== null) {
    nowLines.push(
      t.t('handover.textLastFeed', {
        time: formatClock(data.lastFeed.startedAt, t.locale),
      }),
    )
  }
  if (data.lastDiaper !== null) {
    nowLines.push(
      t.t('handover.textLastDiaper', {
        time: formatClock(data.lastDiaper.startedAt, t.locale),
      }),
    )
  }

  // Said even when the times below are useful: "nothing in this window" and "last
  // fed at 09:15" are both facts the next person needs.
  if (lines.length === 0) lines.push(t.t('handover.textNothing'))

  return [heading, lines.join('\n'), nowLines.join('\n')]
    .filter((block) => block !== '')
    .join('\n\n')
}
