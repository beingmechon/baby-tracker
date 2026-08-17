import type { Summary } from '@/domain/summary'
import type { VolumeUnit } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { formatDuration, formatVolume } from '@/i18n/format'

interface DaySummaryProps {
  summary: Summary
  unit: VolumeUnit
}

/**
 * The day's three numbers, set as a ledger rather than three boxed tiles.
 *
 * Deliberately unruled: baseline alignment and the right-aligned tabular numeral
 * column already separate the rows, and adding a rule on top of a separation that
 * already works is Tufte's 1+1=3 (ch07, Critical). The timeline below *does* use
 * rules, because with many rows a rule genuinely helps the eye track across.
 */
export function DaySummary({ summary, unit }: DaySummaryProps) {
  const t = useTranslator()
  const { feeds, sleep, diapers } = summary

  const feedDetail = [
    feeds.nursingMs > 0
      ? t.t('summary.nursingTotal', { duration: formatDuration(t, feeds.nursingMs) })
      : null,
    feeds.bottleMl > 0 ? formatVolume(t, feeds.bottleMl, unit) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  const dirty = diapers.dirty + diapers.mixed
  const diaperDetail = [
    diapers.wet > 0 ? t.plural('summary.diapersWet', diapers.wet) : null,
    dirty > 0 ? t.plural('summary.diapersDirty', dirty) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  const rows = [
    { term: t.t('summary.feeds'), value: t.number(feeds.count), detail: feedDetail },
    {
      term: t.t('summary.sleep'),
      value: sleep.totalMs > 0 ? formatDuration(t, sleep.totalMs) : t.t('summary.none'),
      detail:
        sleep.longestMs > 0
          ? t.t('summary.longestStretch', {
              duration: formatDuration(t, sleep.longestMs),
            })
          : '',
    },
    { term: t.t('summary.diapers'), value: t.number(diapers.total), detail: diaperDetail },
  ]

  return (
    <dl className="ledger">
      {rows.map(({ term, value, detail }) => (
        <div className="ledger-row" key={term}>
          <dt className="ledger-term">{term}</dt>
          <dd className="ledger-value">{value}</dd>
          {detail !== '' && <dd className="ledger-detail">{detail}</dd>}
        </div>
      ))}
    </dl>
  )
}
