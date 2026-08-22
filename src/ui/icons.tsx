/**
 * A tiny hand-rolled icon set. Inline SVG rather than an icon font or package:
 * it keeps the bundle small enough to precache comfortably for offline use, and
 * every glyph here needs to stay legible at the large sizes this UI uses.
 */

interface IconProps {
  size?: number
  className?: string
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function NursingIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M12 20.5s-7.5-4.6-7.5-10a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5.4-7.5 10-7.5 10Z" />
    </svg>
  )
}

export function BottleIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M10 2.5h4" />
      <path d="M10.5 4.5h3l.6 2.2a3 3 0 0 0 .8 1.4l.7.7a3 3 0 0 1 .9 2.1v8.6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-8.6a3 3 0 0 1 .9-2.1l.7-.7a3 3 0 0 0 .8-1.4Z" />
      <path d="M8 13h8" />
      <path d="M8 16.5h8" />
    </svg>
  )
}

export function SleepIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

export function DiaperIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M4 5.5h16v4a10.5 10.5 0 0 1-4.2 8.4L12 21l-3.8-3.1A10.5 10.5 0 0 1 4 9.5Z" />
      <path d="M4 9.5c2.7 1.3 5.4 2 8 2s5.3-.7 8-2" />
    </svg>
  )
}

/** A clock face with one filled quadrant: the day, round the ring. */
export function WheelIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" strokeWidth="3" />
      <path d="M12 8v4l2.5 2" />
    </svg>
  )
}

/** A thermometer: the health screen covers temperature and medicine. */
export function HealthIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M13.5 13.6V5a1.75 1.75 0 0 0-3.5 0v8.6a3.5 3.5 0 1 0 3.5 0Z" />
      <path d="M16.5 7.5h3M16.5 10.5h2" />
    </svg>
  )
}

/** A bottle under a funnel: expressing into a container, not a machine. */
export function PumpIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M7 3.5h10l-3 5h-4Z" />
      <path d="M12 8.5v2.5" />
      <path d="M8.5 11h7a1.5 1.5 0 0 1 1.5 1.5v6A2 2 0 0 1 15 20.5H9a2 2 0 0 1-2-2v-6A1.5 1.5 0 0 1 8.5 11Z" />
    </svg>
  )
}

export function BellIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z" />
      <path d="M10.2 18.5a2 2 0 0 0 3.6 0" />
    </svg>
  )
}

/** A rising line over an axis: growth as a curve, not a scale or a ruler. */
export function GrowthIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M7 16.5c2.6 0 3.4-3.2 5-6.2 1.1-2 2.6-3.3 5-3.3" />
    </svg>
  )
}

export function SettingsIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  )
}

export function BackIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function CloseIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M14.5 5.5l-6 6.5 6 6.5" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M9.5 5.5l6 6.5-6 6.5" />
    </svg>
  )
}

export function RepeatIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M4 9.5A5.5 5.5 0 0 1 9.5 4h9" />
      <path d="M15.5 1.5 18.5 4l-3 2.5" />
      <path d="M20 14.5A5.5 5.5 0 0 1 14.5 20h-9" />
      <path d="M8.5 17.5 5.5 20l3 2.5" />
    </svg>
  )
}

export function CheckIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

export function ShieldIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M12 2.5 20 5.5v6c0 5-3.4 8.9-8 10.5-4.6-1.6-8-5.5-8-10.5v-6Z" />
    </svg>
  )
}

export function CopyIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
    </svg>
  )
}

export function PrintIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M7 9V3.5h10V9" />
      <path d="M7 17H4.5V9h15v8H17" />
      <rect x="7" y="14" width="10" height="6.5" rx="1" />
    </svg>
  )
}

export function HandoverIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M3 13.5c1.8-1.4 3.4-1.4 5 0l2.5 2.2" />
      <path d="M21 13.5c-1.8-1.4-3.4-1.4-5 0l-2.5 2.2" />
      <path d="M12 4.5v5" />
      <path d="M9.5 7 12 4.5 14.5 7" />
    </svg>
  )
}

export function DiaryIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6Z" />
      <path d="M6 3.5A1.5 1.5 0 0 0 4.5 5v14A1.5 1.5 0 0 0 6 20.5" />
      <path d="M9 8.5h7" />
      <path d="M9 12h7" />
      <path d="M9 15.5h4" />
    </svg>
  )
}

export function FoodIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M6 3.5v7a2.5 2.5 0 0 0 5 0v-7" />
      <path d="M8.5 13v7.5" />
      <path d="M17.5 3.5c2 1.6 2.6 4.2 1.6 6.4-.6 1.3-1.6 2-1.6 2v8.6" />
    </svg>
  )
}

export function ActivityIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M12 8.5v6" />
      <path d="M7.5 11h9" />
      <path d="M9.5 20.5 12 14.5l2.5 6" />
    </svg>
  )
}

export function StarIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9-4.3-4.1 5.9-.8Z" />
    </svg>
  )
}
