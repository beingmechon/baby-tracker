import { formatDuration } from '@/domain/time'
import type { Summary } from '@/domain/summary'
import type { VolumeUnit } from '@/domain/types'
import { formatVolume } from '@/domain/units'

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
  const { feeds, sleep, diapers } = summary

  const feedDetail = [
    feeds.nursingMs > 0 ? `${formatDuration(feeds.nursingMs)} nursing` : null,
    feeds.bottleMl > 0 ? formatVolume(feeds.bottleMl, unit) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  const diaperDetail = [
    diapers.wet > 0 ? `${diapers.wet} wet` : null,
    diapers.dirty + diapers.mixed > 0 ? `${diapers.dirty + diapers.mixed} dirty` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')

  const rows = [
    { term: 'Feeds', value: String(feeds.count), detail: feedDetail },
    {
      term: 'Sleep',
      value: sleep.totalMs > 0 ? formatDuration(sleep.totalMs) : '—',
      detail:
        sleep.longestMs > 0
          ? `longest stretch ${formatDuration(sleep.longestMs)}`
          : '',
    },
    { term: 'Diapers', value: String(diapers.total), detail: diaperDetail },
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
