/**
 * The seam between the web app and the Android shell.
 *
 * Two rules govern this file.
 *
 * First, **the web build must not grow because a native shell exists.** Nothing
 * Capacitor-related is imported statically; the platform is detected from the global
 * the shell injects, and the plugin is pulled in with a dynamic `import()` that Vite
 * splits into a chunk the browser never requests. A parent on a phone browser should
 * not download an Android bridge.
 *
 * Second, **native is an enhancement, never a requirement.** Every function here has
 * a defined answer when there is no shell, and the app behaves exactly as it did
 * before when running on the web.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof globalThis === 'undefined') return undefined
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
}

/** True only inside the Android shell. False in every browser, including installed. */
export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true
}

export function nativePlatform(): string {
  return capacitor()?.getPlatform?.() ?? 'web'
}

/**
 * The subset of the LocalNotifications plugin this app uses.
 *
 * Declared rather than imported so the type does not drag the module into the web
 * build. Four calls out of a large plugin surface: ask, check, schedule, cancel.
 */
interface ScheduleRequest {
  notifications: {
    id: number
    title: string
    body: string
    schedule: { at: Date; allowWhileIdle: boolean }
  }[]
}

interface LocalNotificationsPlugin {
  requestPermissions: () => Promise<{ display: string }>
  checkPermissions: () => Promise<{ display: string }>
  schedule: (options: ScheduleRequest) => Promise<unknown>
  getPending: () => Promise<{ notifications: { id: number }[] }>
  cancel: (options: { notifications: { id: number }[] }) => Promise<void>
}

let cached: LocalNotificationsPlugin | null | undefined

/**
 * Loads the plugin, once, and only on a device.
 *
 * `undefined` means "not tried yet"; `null` means tried and unavailable, so a
 * failed load is not retried on every reminder tick.
 */
async function plugin(): Promise<LocalNotificationsPlugin | null> {
  if (cached !== undefined) return cached
  if (!isNativeApp()) {
    cached = null
    return null
  }
  try {
    const module = await import('@capacitor/local-notifications')
    cached = module.LocalNotifications as unknown as LocalNotificationsPlugin
  } catch {
    // A shell without the plugin is not a state we ship, but it must not throw.
    cached = null
  }
  return cached
}

export async function nativeNotificationsGranted(): Promise<boolean> {
  const notifications = await plugin()
  if (notifications === null) return false
  try {
    return (await notifications.checkPermissions()).display === 'granted'
  } catch {
    return false
  }
}

export async function requestNativeNotifications(): Promise<boolean> {
  const notifications = await plugin()
  if (notifications === null) return false
  try {
    return (await notifications.requestPermissions()).display === 'granted'
  } catch {
    return false
  }
}

export interface NativeAlert {
  nativeId: number
  at: number
  title: string
  body: string
}

/**
 * Replaces the pending alarms with exactly this set.
 *
 * Cancel-then-schedule rather than diffing: the set is three or four alarms, the
 * plugin has no update call, and a stale alarm firing for a feed that already
 * happened is worse than a redundant write. Returns false when there is no shell,
 * so the caller can tell whether the OS took the job.
 */
export async function scheduleNativeAlerts(alerts: NativeAlert[]): Promise<boolean> {
  const notifications = await plugin()
  if (notifications === null) return false

  try {
    const pending = await notifications.getPending()
    if (pending.notifications.length > 0) {
      await notifications.cancel({ notifications: pending.notifications })
    }
    if (alerts.length > 0) {
      await notifications.schedule({
        notifications: alerts.map((alert) => ({
          id: alert.nativeId,
          title: alert.title,
          body: alert.body,
          schedule: {
            at: new Date(alert.at),
            // Fires even in Doze. A feed reminder that waits for the phone to be
            // picked up is a feed reminder that did nothing.
            allowWhileIdle: true,
          },
        })),
      })
    }
    return true
  } catch {
    return false
  }
}
