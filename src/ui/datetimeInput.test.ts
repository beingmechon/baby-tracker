import { describe, expect, it } from 'vitest'
import { at } from '@/test/factories'
import {
  fromDateTimeInputs,
  minutesInputToMs,
  msToMinutesInput,
  toDateInputValue,
  toTimeInputValue,
} from './datetimeInput'

describe('input formatting', () => {
  it('renders a timestamp as date and time input values', () => {
    const ts = at(2026, 3, 7, 9, 5)
    expect(toDateInputValue(ts)).toBe('2026-03-07')
    expect(toTimeInputValue(ts)).toBe('09:05')
  })

  it('pads midnight rather than emitting 0:0', () => {
    expect(toTimeInputValue(at(2026, 3, 7, 0, 0))).toBe('00:00')
  })
})

describe('fromDateTimeInputs', () => {
  it('round-trips a timestamp through both inputs', () => {
    const ts = at(2026, 3, 7, 14, 45)
    expect(fromDateTimeInputs(toDateInputValue(ts), toTimeInputValue(ts))).toBe(ts)
  })

  it('accepts a time that includes seconds', () => {
    expect(fromDateTimeInputs('2026-03-07', '14:45:30')).toBe(
      at(2026, 3, 7, 14, 45) + 30_000,
    )
  })

  it('returns null for an empty or partial value', () => {
    expect(fromDateTimeInputs('', '14:45')).toBeNull()
    expect(fromDateTimeInputs('2026-03-07', '')).toBeNull()
    expect(fromDateTimeInputs('2026-3-7', '14:45')).toBeNull()
    expect(fromDateTimeInputs('2026-03-07', '4:45')).toBeNull()
  })

  it('rejects an out-of-range time', () => {
    expect(fromDateTimeInputs('2026-03-07', '25:00')).toBeNull()
    expect(fromDateTimeInputs('2026-03-07', '12:99')).toBeNull()
  })

  it('rejects a date that does not exist instead of rolling it over', () => {
    expect(fromDateTimeInputs('2026-02-31', '12:00')).toBeNull()
    expect(fromDateTimeInputs('2026-13-01', '12:00')).toBeNull()
  })
})

describe('duration inputs', () => {
  it('round-trips minutes', () => {
    expect(msToMinutesInput(15 * 60_000)).toBe('15')
    expect(minutesInputToMs('15')).toBe(15 * 60_000)
  })

  it('rounds a fractional minute to the nearest millisecond value', () => {
    expect(minutesInputToMs('2.5')).toBe(150_000)
  })

  it('rejects a negative or non-numeric duration', () => {
    expect(minutesInputToMs('-3')).toBeNull()
    expect(minutesInputToMs('abc')).toBeNull()
    expect(minutesInputToMs('')).toBeNull()
  })
})
