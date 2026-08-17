import { localDateKey } from '@/domain/time'
import type { Timestamp } from '@/domain/types'

/**
 * Conversions between timestamps and the values `<input type="date">` and
 * `<input type="time">` expect. Both inputs speak local wall-clock time, which
 * is exactly what a parent correcting "actually that nap started at 1:15" means.
 */

export function toDateInputValue(ts: Timestamp): string {
  return localDateKey(ts)
}

export function toTimeInputValue(ts: Timestamp): string {
  const d = new Date(ts)
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`
}

/**
 * Combines the two inputs back into a timestamp, or null if either is empty or
 * malformed — browsers can hand back a blank value, and a partially typed time
 * must not silently become midnight.
 */
export function fromDateTimeInputs(date: string, time: string): Timestamp | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  // Some browsers include seconds in the time value.
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (dateMatch === null || timeMatch === null) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  const second = Number(timeMatch[3] ?? '0')

  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour > 23 || minute > 59 || second > 59) return null

  const result = new Date(year, month - 1, day, hour, minute, second, 0)
  // Rejects a rolled-over date such as 2026-02-31.
  if (result.getMonth() !== month - 1 || result.getDate() !== day) return null
  return result.getTime()
}

/** Minutes as a string for a duration field, and back. */
export function msToMinutesInput(ms: number): string {
  return String(Math.round(ms / 60_000))
}

export function minutesInputToMs(value: string): number | null {
  const minutes = Number.parseFloat(value)
  if (!Number.isFinite(minutes) || minutes < 0) return null
  return Math.round(minutes * 60_000)
}
