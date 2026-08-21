import { describe, expect, it } from 'vitest'
import { MINUTE_MS } from '@/domain/time'
import {
  BABY_ID,
  at,
  bottle,
  diaper,
  growth,
  nursing,
  pumping,
  sleep,
  symptom,
  visit,
} from '@/test/factories'
import { escapeCsvField, toCsv } from './csv'
import type { ExportBundle } from './repository'

function bundle(events: ExportBundle['events']): ExportBundle {
  return {
    format: 'baby-tracker-export',
    version: 1,
    exportedAt: at(2026, 1, 15, 18, 0),
    babies: [
      { id: BABY_ID, name: 'Mira', birthDate: '2026-01-01', sex: 'female', createdAt: 0 },
    ],
    events,
  }
}

describe('escapeCsvField', () => {
  it('quotes every field and doubles inner quotes', () => {
    expect(escapeCsvField('plain')).toBe('"plain"')
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""')
  })

  it('preserves commas and newlines inside a quoted field', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('defuses a formula so a shared export cannot execute in a spreadsheet', () => {
    expect(escapeCsvField('=1+1')).toBe(`"'=1+1"`)
    expect(escapeCsvField('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(escapeCsvField('-2')).toBe(`"'-2"`)
  })
})

describe('toCsv', () => {
  it('writes a header row', () => {
    const csv = toCsv(bundle([]))
    expect(csv.split('\n')[0]).toBe(
      'baby,date,time,type,detail,duration_minutes,amount_ml,amount_oz,' +
        'value_metric,unit_metric,value_imperial,unit_imperial,note',
    )
  })

  it('gives every row exactly as many cells as the header', () => {
    // A row one cell short shifts every later column, which a spreadsheet shows
    // as plausible-looking nonsense rather than an error. Cheap to guard.
    const csv = toCsv(
      bundle([
        nursing(at(2026, 1, 15, 9, 0), 15 * MINUTE_MS),
        bottle(at(2026, 1, 15, 10, 0), 120),
        sleep(at(2026, 1, 15, 11, 0), at(2026, 1, 15, 12, 0)),
        diaper(at(2026, 1, 15, 13, 0), 'wet'),
        growth(at(2026, 1, 15, 14, 0), 'weight', 4500),
        pumping(at(2026, 1, 15, 15, 0), 60, 80),
      ]),
    )
    const rows = csv.trim().split('\n')
    const columns = rows[0]!.split(',').length
    for (const row of rows.slice(1)) {
      expect(row.split(',')).toHaveLength(columns)
    }
  })

  it('orders events oldest first regardless of input order', () => {
    const csv = toCsv(
      bundle([
        diaper(at(2026, 1, 15, 16, 0), 'wet'),
        diaper(at(2026, 1, 15, 8, 0), 'dirty'),
      ]),
    )
    const rows = csv.trim().split('\n').slice(1)
    expect(rows[0]).toContain('08:00')
    expect(rows[1]).toContain('16:00')
  })

  it('records nursing with its side and duration in minutes', () => {
    const csv = toCsv(bundle([nursing(at(2026, 1, 15, 9, 0), 15 * MINUTE_MS, 'right')]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toContain('"nursing"')
    expect(row).toContain('"right"')
    expect(row).toContain('"15"')
  })

  it('records a bottle in both ml and oz so no conversion is needed', () => {
    const csv = toCsv(bundle([bottle(at(2026, 1, 15, 13, 0), 120, 'breast_milk')]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toContain('"breast milk"')
    expect(row).toContain('"120"')
    expect(row).toContain('"4.1"')
  })

  it('leaves the duration blank for a sleep still in progress', () => {
    const csv = toCsv(bundle([sleep(at(2026, 1, 15, 13, 0), null, 'nap')]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toBe(
      '"Mira","2026-01-15","13:00","sleep","nap","","","","","","","",""',
    )
  })

  it('records a measurement in both systems', () => {
    const csv = toCsv(bundle([growth(at(2026, 1, 15, 9, 0), 'weight', 4500)]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toContain('"growth"')
    expect(row).toContain('"weight"')
    expect(row).toContain('"4.5","kg"')
    expect(row).toContain('"9.92","lb"')
  })

  it('records a length in centimetres and inches', () => {
    const csv = toCsv(bundle([growth(at(2026, 1, 15, 9, 0), 'length', 625)]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toContain('"62.5","cm"')
    expect(row).toContain('"24.61","in"')
  })

  it('records a pumping session with its total and its split', () => {
    const csv = toCsv(bundle([pumping(at(2026, 1, 15, 9, 0), 60, 80)]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toContain('"pumping"')
    // The total lands in the same columns as a bottle, so a spreadsheet can sum
    // feeds and output without special-casing the row type.
    expect(row).toContain('"140"')
    expect(row).toContain('"left 60 / right 80"')
  })

  it('records a symptom with the parent’s own impression beside it', () => {
    const csv = toCsv(bundle([symptom(at(2026, 1, 15, 9, 0), 'Cough', 'moderate')]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toContain('"symptom"')
    expect(row).toContain('"Cough: moderate"')
  })

  it('records a visit with its questions in the note column', () => {
    const appointment = visit(
      at(2026, 1, 15, 9, 0),
      '8-week check',
      [
        { text: 'Is the cough worth worrying about?', asked: true },
        { text: 'Vitamin D?', asked: false },
      ],
      'Dr Rao',
    )
    const csv = toCsv(bundle([appointment]))
    const row = csv.trim().split('\n')[1] ?? ''
    expect(row).toContain('"visit"')
    expect(row).toContain('"8-week check — Dr Rao"')
    expect(row).toContain('questions 1/2')
    expect(row).toContain('Is the cough worth worrying about?; Vitamin D?')
  })

  it('exports an event with no note at all', () => {
    // A regression guard with teeth: `note` is optional on every event, and a
    // row builder that assumed a string crashed the entire export — one missing
    // note took the whole CSV down, not just its own row.
    const bare = symptom(at(2026, 1, 15, 9, 0), 'Rash')
    delete (bare as { note?: string }).note
    expect(() => toCsv(bundle([bare]))).not.toThrow()
  })

  it('labels an event whose baby is missing rather than dropping the row', () => {
    const withOrphan: ExportBundle = { ...bundle([]), babies: [] }
    withOrphan.events = [diaper(at(2026, 1, 15, 9, 0), 'wet')]
    expect(toCsv(withOrphan)).toContain('"unknown"')
  })

  it('ends with a newline', () => {
    expect(toCsv(bundle([diaper(at(2026, 1, 15, 9, 0), 'wet')]))).toMatch(/\n$/)
  })
})
