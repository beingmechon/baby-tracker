import { formatClock } from '@/domain/time'
import type { BabyEvent, Timestamp, VolumeUnit } from '@/domain/types'
import { describeEvent } from './describeEvent'
import { BottleIcon, DiaperIcon, NursingIcon, SleepIcon } from './icons'

interface TimelineProps {
  events: BabyEvent[]
  unit: VolumeUnit
  now: Timestamp
  onSelect: (event: BabyEvent) => void
}

function iconFor(event: BabyEvent) {
  switch (event.type) {
    case 'nursing':
      return <NursingIcon size={18} />
    case 'bottle':
      return <BottleIcon size={18} />
    case 'sleep':
      return <SleepIcon size={18} />
    case 'diaper':
      return <DiaperIcon size={18} />
  }
}

/**
 * The unified timeline: every kind of event in one scrollable feed, newest
 * first. Each row is a button, because any entry may need correcting.
 */
export function Timeline({ events, unit, now, onSelect }: TimelineProps) {
  if (events.length === 0) {
    return <p className="empty">Nothing logged yet on this day.</p>
  }

  return (
    <div className="timeline">
      {events.map((event) => {
        const { category, title, detail, live } = describeEvent(event, unit, now)
        return (
          <button
            key={event.id}
            type="button"
            className="timeline-row"
            onClick={() => onSelect(event)}
          >
            <span className="timeline-time">{formatClock(event.startedAt)}</span>
            <span className="timeline-badge" data-category={category}>
              {iconFor(event)}
            </span>
            <span className="timeline-body">
              <span className="timeline-title">{title}</span>
              {detail !== '' && <span className="timeline-detail"> · {detail}</span>}
              {live && <span className="timeline-live"> · now</span>}
              {event.note !== undefined && (
                <span className="timeline-note">{event.note}</span>
              )}
            </span>
            <span className="sr-only">Edit this entry</span>
          </button>
        )
      })}
    </div>
  )
}
