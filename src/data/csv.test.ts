import { describe, expect, it } from 'vitest'
import { MINUTE_MS } from '@/domain/time'
import { BABY_ID, at, bottle, diaper, nursing, sleep } from '@/test/factories'
import { escapeCsvField, toCsv } from './csv'
import type { ExportBundle } from './repository'

function bundle(events: ExportBundle['events']): ExportBundle {
  return {
    format: 'baby-tracker-export',
    version: 1,
    exportedAt: at(2026, 1, 15, 18, 0),
    babies: [
      { id: BABY_ID, name: 'Mira', birthDate: '2026-01-01', createdAt: 0 },
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
      'baby,date,time,type,detail,duration_minutes,amount_ml,amount_oz,note',
    )
  })

  it('orders events oldest first regardless of input order', () => {
    const csv = toCsv(
      bundle([
        diaper(at(2026, 1, 15, 16, 0), 'wet'),
        diaper(at(2026, 1, 15, 8, 0), 'dirty'),
      ]),
    )
    const rows = csv.trim().split('\n').slice(1)
    expect(rows[0]).toContain('8:00 am')
    expect(rows[1]).toContain('4:00 pm')
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
    expect(row).toBe('"Mira","2026-01-15","1:00 pm","sleep","nap","","","",""')
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
