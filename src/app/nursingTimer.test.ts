import { beforeEach, describe, expect, it } from 'vitest'
import { MINUTE_MS } from '@/domain/time'
import { at } from '@/test/factories'
import {
  completeTimer,
  loadTimer,
  saveTimer,
  elapsedMs,
  hasElapsed,
  idleTimer,
  isRunning,
  pauseTimer,
  resumeTimer,
  startTimer,
  switchSide,
  toggleTimer,
} from './nursingTimer'

const T0 = at(2026, 1, 15, 3, 0)

describe('idleTimer', () => {
  it('starts with nothing recorded', () => {
    const state = idleTimer('left')
    expect(isRunning(state)).toBe(false)
    expect(elapsedMs(state, T0)).toBe(0)
    expect(hasElapsed(state, T0)).toBe(false)
  })
})

describe('elapsedMs', () => {
  it('counts the live run', () => {
    const state = startTimer('left', T0)
    expect(elapsedMs(state, T0 + 5 * MINUTE_MS)).toBe(5 * MINUTE_MS)
  })

  it('freezes while paused', () => {
    const paused = pauseTimer(startTimer('left', T0), T0 + 5 * MINUTE_MS)
    expect(elapsedMs(paused, T0 + 30 * MINUTE_MS)).toBe(5 * MINUTE_MS)
  })

  it('banks time across a pause and resume', () => {
    let state = startTimer('left', T0)
    state = pauseTimer(state, T0 + 4 * MINUTE_MS)
    state = resumeTimer(state, T0 + 10 * MINUTE_MS)
    // 4 minutes banked, plus 3 minutes on the new run.
    expect(elapsedMs(state, T0 + 13 * MINUTE_MS)).toBe(7 * MINUTE_MS)
  })

  it('never goes negative if the clock jumps backwards', () => {
    const state = startTimer('left', T0)
    expect(elapsedMs(state, T0 - MINUTE_MS)).toBe(0)
  })
})

describe('pause and resume', () => {
  it('are no-ops when already in that state', () => {
    const running = startTimer('left', T0)
    expect(resumeTimer(running, T0 + MINUTE_MS)).toBe(running)

    const paused = pauseTimer(running, T0 + MINUTE_MS)
    expect(pauseTimer(paused, T0 + 2 * MINUTE_MS)).toBe(paused)
  })

  it('toggle flips between the two', () => {
    const running = startTimer('left', T0)
    const paused = toggleTimer(running, T0 + MINUTE_MS)
    expect(isRunning(paused)).toBe(false)
    expect(isRunning(toggleTimer(paused, T0 + 2 * MINUTE_MS))).toBe(true)
  })

  it('resuming an idle timer sets the session start', () => {
    const resumed = resumeTimer(idleTimer('left'), T0)
    expect(resumed.sessionStartedAt).toBe(T0)
  })
})

describe('completeTimer', () => {
  it('reports the side, session start and total duration', () => {
    let state = startTimer('right', T0)
    state = pauseTimer(state, T0 + 8 * MINUTE_MS)
    expect(completeTimer(state, T0 + 20 * MINUTE_MS)).toEqual({
      side: 'right',
      startedAt: T0,
      durationMs: 8 * MINUTE_MS,
    })
  })

  it('is null for an untouched timer, so a mis-tap saves nothing', () => {
    expect(completeTimer(idleTimer('left'), T0)).toBeNull()
  })

  it('dates the event from when the feed began, not when it was saved', () => {
    const state = startTimer('left', T0)
    expect(completeTimer(state, T0 + 15 * MINUTE_MS)?.startedAt).toBe(T0)
  })
})

describe('switchSide', () => {
  it('banks the first side as its own entry and restarts from zero', () => {
    const state = startTimer('left', T0)
    const { completed, next } = switchSide(state, T0 + 6 * MINUTE_MS)

    expect(completed).toEqual({
      side: 'left',
      startedAt: T0,
      durationMs: 6 * MINUTE_MS,
    })
    expect(next.side).toBe('right')
    expect(elapsedMs(next, T0 + 6 * MINUTE_MS)).toBe(0)
    expect(isRunning(next)).toBe(true)
  })

  it('stays paused when switching while paused', () => {
    let state = startTimer('left', T0)
    state = pauseTimer(state, T0 + 6 * MINUTE_MS)
    const { next } = switchSide(state, T0 + 7 * MINUTE_MS)
    expect(isRunning(next)).toBe(false)
    expect(next.side).toBe('right')
  })

  it('switching an untouched timer just changes side, saving nothing', () => {
    const { completed, next } = switchSide(idleTimer('left'), T0)
    expect(completed).toBeNull()
    expect(next.side).toBe('right')
  })

  it('alternates back on a second switch', () => {
    const first = switchSide(startTimer('left', T0), T0 + MINUTE_MS)
    const second = switchSide(first.next, T0 + 2 * MINUTE_MS)
    expect(second.next.side).toBe('left')
  })
})

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('restores a running timer, so locking the phone cannot lose a feed', () => {
    const running = startTimer('right', T0)
    saveTimer('baby-a', running)
    expect(loadTimer('baby-a')).toEqual(running)
  })

  it('keeps each baby’s timer separate', () => {
    // With twins, a timer running for one must not appear under the other — and
    // must certainly not be saved as the other one's feed.
    saveTimer('baby-a', startTimer('left', T0))
    saveTimer('baby-b', startTimer('right', T0 + MINUTE_MS))

    expect(loadTimer('baby-a')?.side).toBe('left')
    expect(loadTimer('baby-b')?.side).toBe('right')
  })

  it('returns null for a baby with no timer', () => {
    saveTimer('baby-a', startTimer('left', T0))
    expect(loadTimer('baby-b')).toBeNull()
  })

  it('clears only that baby’s timer', () => {
    saveTimer('baby-a', startTimer('left', T0))
    saveTimer('baby-b', startTimer('right', T0))
    saveTimer('baby-a', null)

    expect(loadTimer('baby-a')).toBeNull()
    expect(loadTimer('baby-b')).not.toBeNull()
  })

  it('saves nothing for a timer that was never started', () => {
    saveTimer('baby-a', idleTimer('left'))
    expect(loadTimer('baby-a')).toBeNull()
  })

  it('adopts a timer left running by the version before per-baby keys', () => {
    // Upgrading mid-feed must not lose the feed.
    const running = startTimer('left', T0)
    localStorage.setItem('baby-tracker:nursing-timer', JSON.stringify(running))

    expect(loadTimer('baby-a')).toEqual(running)
    // Adopted once, then the old key is gone, so a second baby cannot inherit it.
    expect(localStorage.getItem('baby-tracker:nursing-timer')).toBeNull()
    expect(loadTimer('baby-b')).toBeNull()
  })

  it('does not let the legacy timer overwrite one this baby already has', () => {
    saveTimer('baby-a', startTimer('right', T0 + MINUTE_MS))
    localStorage.setItem(
      'baby-tracker:nursing-timer',
      JSON.stringify(startTimer('left', T0)),
    )
    expect(loadTimer('baby-a')?.side).toBe('right')
  })

  it('ignores stored junk rather than throwing', () => {
    localStorage.setItem('baby-tracker:nursing-timer:baby-a', 'not json')
    expect(loadTimer('baby-a')).toBeNull()

    localStorage.setItem('baby-tracker:nursing-timer:baby-a', JSON.stringify({ side: 'x' }))
    expect(loadTimer('baby-a')).toBeNull()
  })
})
