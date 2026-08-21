/**
 * Local notifications for reminders.
 *
 * There is no push service and no server here — that is the whole premise of the
 * project — so these are *local* notifications only, raised by the running page.
 *
 * What that means in practice, stated plainly because the UI has to say it too:
 * a reminder alerts while the app is open in a tab or as an installed app in the
 * background. It cannot wake a phone that has closed the app entirely. Web push
 * needs a server holding a subscription endpoint, and the one browser API that
 * would have solved this without a server — Notification Triggers — was withdrawn
 * before it shipped. Promising otherwise would be the kind of thing this project
 * exists not to do, so the reminders screen says exactly this.
 *
 * On opening the app, anything that came due while it was closed is shown as
 * overdue, which is the honest fallback.
 *
 * The Android shell changes this — and only this. There the due times are handed to
 * the OS alarm scheduler, which fires them whether the app is running or dead. See
 * `domain/scheduling.ts` for what gets handed over and `app/native.ts` for the
 * handover itself. Nothing is sent anywhere to make it work: the alarm is held by
 * the phone.
 */
import { isNativeApp, nativeNotificationsGranted, requestNativeNotifications } from './native'

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as 'default' | 'granted' | 'denied'
}

/**
 * Asks for permission. Only ever called from a button the user pressed: a prompt
 * on load is the single most disliked pattern on the web, and browsers now punish
 * it by blocking the request outright.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (notificationState() === 'unsupported') return 'unsupported'
  try {
    return (await Notification.requestPermission()) as 'granted' | 'denied' | 'default'
  } catch {
    // Older Safari rejects rather than resolving when called outside a gesture.
    return notificationState()
  }
}

/**
 * The permission state, asking the right platform.
 *
 * In the Android shell the browser `Notification` API is present but irrelevant:
 * what governs whether a reminder arrives is Android's own POST_NOTIFICATIONS
 * grant, and reading the wrong one would have the screen offer to enable
 * notifications that are already on, or claim they are on when they are not.
 *
 * Async because the native answer is. On the web it resolves immediately.
 */
export async function resolveNotificationState(): Promise<NotificationPermissionState> {
  if (isNativeApp()) {
    return (await nativeNotificationsGranted()) ? 'granted' : 'default'
  }
  return notificationState()
}

/** Asks whichever platform is actually in charge. Only ever from a real tap. */
export async function askForNotifications(): Promise<NotificationPermissionState> {
  if (isNativeApp()) {
    return (await requestNativeNotifications()) ? 'granted' : 'denied'
  }
  return requestNotificationPermission()
}

export interface AlertContent {
  title: string
  body: string
  /** Collapses repeats of the same reminder into one notification. */
  tag: string
}

/**
 * Shows one notification, preferring the service worker registration.
 *
 * The registration route is what makes a notification survive the page being
 * backgrounded, and on Android it is the only route that works at all — the
 * `Notification` constructor throws there. Falling back to the constructor keeps
 * desktop working when the service worker has not activated yet, such as on the
 * very first load.
 */
export async function showLocalNotification({
  title,
  body,
  tag,
}: AlertContent): Promise<boolean> {
  if (notificationState() !== 'granted') return false

  const options: NotificationOptions = {
    body,
    tag,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Reminders are quiet by design: this is a sleeping baby's household.
    silent: false,
  }

  try {
    const registration = await navigator.serviceWorker?.ready
    if (registration !== undefined) {
      await registration.showNotification(title, options)
      return true
    }
  } catch {
    // Fall through to the constructor.
  }

  try {
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}
