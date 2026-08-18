import { G_PER_LB, mmToInches } from '@/domain/measure'
import { formatClock24, localDateKey } from '@/domain/time'
import type { Baby, BabyEvent, GrowthEvent } from '@/domain/types'
import { mlToOz } from '@/domain/units'
import type { ExportBundle } from './repository'

/**
 * One flat row per event, which is what a spreadsheet — or a paediatrician
 * glancing at a printout — actually wants. Unit columns are duplicated (ml and
 * oz, minutes) so the file is readable without any conversion.
 *
 * Times are 24-hour and locale-independent on purpose: an export is read by
 * spreadsheets and by people in other countries, and "1:00" is ambiguous in a
 * way "13:00" is not.
 */
const COLUMNS = [
  'baby',
  'date',
  'time',
  'type',
  'detail',
  'duration_minutes',
  'amount_ml',
  'amount_oz',
  'value_metric',
  'unit_metric',
  'value_imperial',
  'unit_imperial',
  'note',
] as const

/**
 * Quotes a CSV field, and defuses spreadsheet formula injection.
 *
 * A note beginning with `=` or `+` is executed as a formula by Excel and Sheets
 * on open. These exports are meant to be handed to a doctor, so a leading
 * apostrophe forces the cell to be read as text.
 */
export function escapeCsvField(value: string): string {
  const needsFormulaGuard = /^[=+\-@\t\r]/.test(value)
  const guarded = needsFormulaGuard ? `'${value}` : value
  return `"${guarded.replace(/"/g, '""')}"`
}

function minutes(ms: number): string {
  return (Math.round((ms / 60_000) * 10) / 10).toString()
}

function round(value: number, places: number): string {
  const factor = 10 ** places
  return (Math.round(value * factor) / factor).toString()
}

/**
 * A measurement in both systems, as plain numbers a spreadsheet can chart
 * directly. Imperial weight is decimal pounds rather than the spoken
 * "14 lb 3 oz": a cell that has to be parsed back into a number is no use in a
 * formula, and the app shows the spoken form on screen where it belongs.
 */
function growthColumns(event: GrowthEvent): [string, string, string, string] {
  if (event.measure === 'weight') {
    return [round(event.value / 1000, 3), 'kg', round(event.value / G_PER_LB, 2), 'lb']
  }
  return [round(event.value / 10, 1), 'cm', round(mmToInches(event.value), 2), 'in']
}

function rowFor(event: BabyEvent, babyName: string): string[] {
  const base = [babyName, localDateKey(event.startedAt), formatClock24(event.startedAt)]
  const note = event.note ?? ''

  switch (event.type) {
    case 'nursing':
      return [
        ...base,
        'nursing',
        event.side,
        minutes(event.durationMs),
        '',
        '',
        '',
        '',
        '',
        '',
        note,
      ]
    case 'bottle':
      return [
        ...base,
        'bottle',
        event.contents === 'breast_milk' ? 'breast milk' : 'formula',
        '',
        Math.round(event.amountMl).toString(),
        round(mlToOz(event.amountMl), 1),
        '',
        '',
        '',
        '',
        note,
      ]
    case 'sleep': {
      const duration =
        event.endedAt === null ? '' : minutes(event.endedAt - event.startedAt)
      return [...base, 'sleep', event.kind, duration, '', '', '', '', '', '', note]
    }
    case 'diaper':
      return [...base, 'diaper', event.kind, '', '', '', '', '', '', '', note]
    case 'growth':
      return [
        ...base,
        'growth',
        event.measure,
        '',
        '',
        '',
        ...growthColumns(event),
        note,
      ]
  }
}

/** Renders an export bundle as CSV, oldest event first. */
export function toCsv(bundle: ExportBundle): string {
  const names = new Map<string, string>(bundle.babies.map((b: Baby) => [b.id, b.name]))
  const ordered = [...bundle.events].sort((a, b) => a.startedAt - b.startedAt)

  const lines = [COLUMNS.join(',')]
  for (const event of ordered) {
    const name = names.get(event.babyId) ?? 'unknown'
    lines.push(rowFor(event, name).map(escapeCsvField).join(','))
  }
  // A trailing newline keeps `wc -l` and POSIX tools happy.
  return `${lines.join('\n')}\n`
}
