import { useEffect, useState } from 'react'
import type { Timestamp } from '@/domain/types'

/**
 * A ticking clock for anything that renders elapsed time.
 *
 * Also re-reads the clock when the tab becomes visible again: phones freeze
 * timers in backgrounded tabs, and coming back to a stopwatch that is minutes
 * behind reality would make the app feel broken.
 */
export function useNow(intervalMs = 30_000): Timestamp {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, intervalMs)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
