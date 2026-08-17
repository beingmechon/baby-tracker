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
      return <NursingIcon size={16} />
    case 'bottle':
      return <BottleIcon size={16} />
    case 'sleep':
      return <SleepIcon size={16} />
    case 'diaper':
      return <DiaperIcon size={16} />
  }
}

/**
 * Every kind of event in one ruled feed, newest first — a timetable rather than a
 * stack of cards. Three columns on a single module grid: the time (Fraunces,
 * tabular, so times align down the page), a tinted mark, and the entry.
 *
 * The mark is the only place categorical colour appears in the whole app: it
 * encodes a data row, and Data-Dense Professional's rule is that categorical
 * accents belong on data, never on chrome. The buttons above carry none.
 */
export function Timeline({ events, unit, now, onSelect }: TimelineProps) {
  if (events.length === 0) {
    // One of the design's two expressive moments: a ruled but unfilled page.
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
            <span className="timeline-mark" data-category={category} aria-hidden="true">
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
