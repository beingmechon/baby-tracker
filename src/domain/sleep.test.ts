import { describe, expect, it } from 'vitest'
import { at, diaper, sleep } from '@/test/factories'
import { HOUR_MS, MINUTE_MS } from './time'
import {
  DEFAULT_NIGHT_WINDOW,
  classifySleep,
  findSleepInProgress,
  isNightHour,
  sleepDuration,
  typicalWakeWindowMs,
  wakeWindowMs,
} from './sleep'

describe('isNightHour', () => {
  it('treats the window as wrapping midnight', () => {
    expect(isNightHour(at(2026, 1, 15, 20, 0), DEFAULT_NIGHT_WINDOW)).toBe(true)
    expect(isNightHour(at(2026, 1, 15, 2, 0), DEFAULT_NIGHT_WINDOW)).toBe(true)
    expect(isNightHour(at(2026, 1, 15, 13, 0), DEFAULT_NIGHT_WINDOW)).toBe(false)
  })

  it('includes the start hour and excludes the end hour', () => {
    expect(isNightHour(at(2026, 1, 15, 19, 0), DEFAULT_NIGHT_WINDOW)).toBe(true)
    expect(isNightHour(at(2026, 1, 15, 6, 0), DEFAULT_NIGHT_WINDOW)).toBe(false)
  })

  it('respects a custom window', () => {
    const late = { startHour: 22, endHour: 5 }
    expect(isNightHour(at(2026, 1, 15, 20, 0), late)).toBe(false)
    expect(isNightHour(at(2026, 1, 15, 23, 0), late)).toBe(true)
  })
})

describe('classifySleep', () => {
  it('classifies by when the sleep started, not when it ends', () => {
    // Starts at 8pm and runs to 3am: night sleep.
    expect(classifySleep(at(2026, 1, 15, 20, 0))).toBe('night')
    // A long afternoon sleep is still a nap.
    expect(classifySleep(at(2026, 1, 15, 14, 0))).toBe('nap')
  })

  it('treats an early-morning sleep as night', () => {
    expect(classifySleep(at(2026, 1, 15, 4, 30))).toBe('night')
  })
})

describe('sleepDuration', () => {
  const now = at(2026, 1, 15, 15, 0)

  it('uses the recorded end when the sleep is finished', () => {
    const finished = sleep(at(2026, 1, 15, 13, 0), at(2026, 1, 15, 14, 0))
    expect(sleepDuration(finished, now)).toBe(HOUR_MS)
  })

  it('counts up to now while the sleep is running', () => {
    const running = sleep(at(2026, 1, 15, 14, 0), null)
    expect(sleepDuration(running, now)).toBe(HOUR_MS)
  })
})

describe('findSleepInProgress', () => {
  it('finds the running sleep among other events', () => {
    const running = sleep(at(2026, 1, 15, 14, 0), null)
    const events = [
      sleep(at(2026, 1, 15, 9, 0), at(2026, 1, 15, 10, 0)),
      diaper(at(2026, 1, 15, 11, 0), 'wet'),
      running,
    ]
    expect(findSleepInProgress(events)?.id).toBe(running.id)
  })

  it('is null when every sleep has ended', () => {
    const events = [sleep(at(2026, 1, 15, 9, 0), at(2026, 1, 15, 10, 0))]
    expect(findSleepInProgress(events)).toBeNull()
  })
})

describe('wakeWindowMs', () => {
  const now = at(2026, 1, 15, 12, 0)

  it('measures from the end of the most recent completed sleep', () => {
    const events = [
      sleep(at(2026, 1, 15, 7, 0), at(2026, 1, 15, 8, 0)),
      sleep(at(2026, 1, 15, 10, 0), at(2026, 1, 15, 11, 0)),
    ]
    expect(wakeWindowMs(events, now)).toBe(HOUR_MS)
  })

  it('ignores event ordering in the list', () => {
    const events = [
      sleep(at(2026, 1, 15, 10, 0), at(2026, 1, 15, 11, 0)),
      sleep(at(2026, 1, 15, 7, 0), at(2026, 1, 15, 8, 0)),
    ]
    expect(wakeWindowMs(events, now)).toBe(HOUR_MS)
  })

  it('is null while the baby is asleep — there is no wake window yet', () => {
    const events = [
      sleep(at(2026, 1, 15, 7, 0), at(2026, 1, 15, 8, 0)),
      sleep(at(2026, 1, 15, 11, 30), null),
    ]
    expect(wakeWindowMs(events, now)).toBeNull()
  })

  it('is null with no sleep history at all', () => {
    expect(wakeWindowMs([diaper(at(2026, 1, 15, 9, 0), 'wet')], now)).toBeNull()
  })
})

describe('typicalWakeWindowMs', () => {
  it('grows with age', () => {
    const newborn = typicalWakeWindowMs(10)
    const older = typicalWakeWindowMs(200)
    expect(newborn).toBe(75 * MINUTE_MS)
    expect(older).toBeGreaterThan(newborn as number)
  })

  it('is null when age is unknown, so the UI simply omits guidance', () => {
    expect(typicalWakeWindowMs(null)).toBeNull()
  })
})
