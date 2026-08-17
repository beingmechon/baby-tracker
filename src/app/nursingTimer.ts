import type { BreastSide, Timestamp } from '@/domain/types'

/**
 * The nursing stopwatch, as plain data.
 *
 * Kept out of React state entirely so it can be unit-tested and, more
 * importantly, *persisted*: a feed can easily outlast the phone locking or the
 * tab being evicted, and losing a running timer at 3am is unforgivable. The UI
 * reads `elapsedMs(state, now)` and never accumulates time itself.
 */
export interface NursingTimerState {
  side: BreastSide
  /** When the current run began, or null while paused. */
  runningSince: Timestamp | null
  /** Time banked by earlier runs in this session, across pauses. */
  accumulatedMs: number
  /** When the session began — becomes the event's `startedAt`. */
  sessionStartedAt: Timestamp | null
}

export interface CompletedSegment {
  side: BreastSide
  startedAt: Timestamp
  durationMs: number
}

export function idleTimer(side: BreastSide): NursingTimerState {
  return { side, runningSince: null, accumulatedMs: 0, sessionStartedAt: null }
}

export function isRunning(state: NursingTimerState): boolean {
  return state.runningSince !== null
}

/** True once there is something worth saving. */
export function hasElapsed(state: NursingTimerState, now: Timestamp): boolean {
  return elapsedMs(state, now) > 0
}

export function elapsedMs(state: NursingTimerState, now: Timestamp): number {
  const current = state.runningSince === null ? 0 : Math.max(0, now - state.runningSince)
  return state.accumulatedMs + current
}

export function startTimer(side: BreastSide, now: Timestamp): NursingTimerState {
  return { side, runningSince: now, accumulatedMs: 0, sessionStartedAt: now }
}

export function pauseTimer(state: NursingTimerState, now: Timestamp): NursingTimerState {
  if (state.runningSince === null) return state
  return {
    ...state,
    accumulatedMs: elapsedMs(state, now),
    runningSince: null,
  }
}

export function resumeTimer(state: NursingTimerState, now: Timestamp): NursingTimerState {
  if (state.runningSince !== null) return state
  return {
    ...state,
    runningSince: now,
    sessionStartedAt: state.sessionStartedAt ?? now,
  }
}

export function toggleTimer(state: NursingTimerState, now: Timestamp): NursingTimerState {
  return isRunning(state) ? pauseTimer(state, now) : resumeTimer(state, now)
}

/**
 * Ends the session and returns what should be saved, or null if no time was
 * recorded — so a mis-tap does not create a zero-length feed.
 */
export function completeTimer(
  state: NursingTimerState,
  now: Timestamp,
): CompletedSegment | null {
  const durationMs = elapsedMs(state, now)
  if (durationMs <= 0 || state.sessionStartedAt === null) return null
  return { side: state.side, startedAt: state.sessionStartedAt, durationMs }
}

/**
 * Switching sides mid-feed: the time on the first side is a complete session in
 * its own right, and the timer restarts from zero on the other side. Babies feed
 * this way, and per-side totals are only meaningful if each side is its own
 * entry.
 */
export function switchSide(
  state: NursingTimerState,
  now: Timestamp,
): { completed: CompletedSegment | null; next: NursingTimerState } {
  const other: BreastSide = state.side === 'left' ? 'right' : 'left'
  const completed = completeTimer(state, now)
  // The new side starts running only if the old one was; switching while paused
  // keeps you paused.
  const next: NursingTimerState = isRunning(state)
    ? startTimer(other, now)
    : idleTimer(other)
  return { completed, next }
}

const STORAGE_KEY = 'baby-tracker:nursing-timer'

/** Persists the running timer so locking the phone cannot lose a feed. */
export function saveTimer(state: NursingTimerState | null): void {
  try {
    if (state === null || state.sessionStartedAt === null) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Losing persistence is bad but not worth a crash; the in-memory timer runs on.
  }
}

export function loadTimer(): NursingTimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const value = parsed as Record<string, unknown>

    const side: BreastSide = value.side === 'right' ? 'right' : 'left'
    const accumulatedMs =
      typeof value.accumulatedMs === 'number' && Number.isFinite(value.accumulatedMs)
        ? Math.max(0, value.accumulatedMs)
        : 0
    const runningSince =
      typeof value.runningSince === 'number' && Number.isFinite(value.runningSince)
        ? value.runningSince
        : null
    const sessionStartedAt =
      typeof value.sessionStartedAt === 'number' &&
      Number.isFinite(value.sessionStartedAt)
        ? value.sessionStartedAt
        : null

    if (sessionStartedAt === null) return null
    return { side, runningSince, accumulatedMs, sessionStartedAt }
  } catch {
    return null
  }
}
