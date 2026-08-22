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

let loaded: LocalNotificationsPlugin | undefined

/**
 * Loads the plugin on demand, on a device only.
 *
 * Only a *successful* load is remembered. An earlier version cached the failure
 * too, which meant a single call made before the native bridge finished injecting
 * itself — or one transient import error — turned notifications off for the rest of
 * the session with no way back.
 */
async function plugin(): Promise<LocalNotificationsPlugin | null> {
  if (loaded !== undefined) return loaded
  if (!isNativeApp()) return null
  try {
    const module = await import('@capacitor/local-notifications')
    loaded = module.LocalNotifications as unknown as LocalNotificationsPlugin
    return loaded
  } catch {
    // A shell without the plugin is not a state we ship, but it must not throw,
    // and it must not be remembered as permanent.
    return null
  }
}

/**
 * The four states this app distinguishes, which is one more than a boolean.
 *
 * The distinction that matters is `denied` versus `default`. Android will not show
 * the permission dialog again once it has been refused, so an app that reports a
 * refusal as "not asked yet" leaves the parent tapping a button that cannot do
 * anything — which is precisely the bug this replaced. `prompt-with-rationale` is
 * Android's "they said no once, you may explain yourself": still askable, so still
 * `default`.
 */
export type NativePermission = 'granted' | 'denied' | 'default'

export function mapNativePermission(display: string): NativePermission {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  // 'prompt', 'prompt-with-rationale', and anything a future plugin version adds.
  return 'default'
}

/** What the OS currently thinks, or null when there is no shell to ask. */
export async function nativeNotificationState(): Promise<NativePermission | null> {
  const notifications = await plugin()
  if (notifications === null) return null
  try {
    return mapNativePermission((await notifications.checkPermissions()).display)
  } catch {
    return null
  }
}

/** Asks. Only ever from a real tap, and only when the state is still askable. */
export async function requestNativeNotifications(): Promise<NativePermission | null> {
  const notifications = await plugin()
  if (notifications === null) return null
  try {
    return mapNativePermission((await notifications.requestPermissions()).display)
  } catch {
    return null
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
