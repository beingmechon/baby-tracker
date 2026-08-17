import { formatDuration } from '@/domain/time'
import type { Summary } from '@/domain/summary'
import type { VolumeUnit } from '@/domain/types'
import { formatVolume } from '@/domain/units'
import { BottleIcon, DiaperIcon, SleepIcon } from './icons'

interface DaySummaryProps {
  summary: Summary
  unit: VolumeUnit
}

/** Today at a glance: the three numbers a paediatrician asks about first. */
export function DaySummary({ summary, unit }: DaySummaryProps) {
  const { feeds, sleep, diapers } = summary

  const feedDetail = [
    feeds.nursingMs > 0 ? formatDuration(feeds.nursingMs) : null,
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

  return (
    <div className="summary">
      <div className="summary-tile" data-category="feed">
        <span className="summary-tile-label">
          <BottleIcon size={14} />
          Feeds
        </span>
        <span className="summary-tile-value">{feeds.count}</span>
        <span className="summary-tile-detail">{feedDetail || '—'}</span>
      </div>

      <div className="summary-tile" data-category="sleep">
        <span className="summary-tile-label">
          <SleepIcon size={14} />
          Sleep
        </span>
        <span className="summary-tile-value">
          {sleep.totalMs > 0 ? formatDuration(sleep.totalMs) : '—'}
        </span>
        <span className="summary-tile-detail">
          {sleep.longestMs > 0 ? `longest ${formatDuration(sleep.longestMs)}` : '—'}
        </span>
      </div>

      <div className="summary-tile" data-category="diaper">
        <span className="summary-tile-label">
          <DiaperIcon size={14} />
          Diapers
        </span>
        <span className="summary-tile-value">{diapers.total}</span>
        <span className="summary-tile-detail">{diaperDetail || '—'}</span>
      </div>
    </div>
  )
}
