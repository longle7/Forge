import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'

const REST_ID = 1

/**
 * In the iPhone app: a notification when the rest timer ends (`at`, ms since epoch), so it reaches you even with the
 * phone locked; undefined cancels it. The first one asks for permission. On the website it does nothing: the page
 * chimes instead, while it's open.
 */
export async function notifyRestEnd(at: number | undefined) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
    if (!at || at <= Date.now()) return
    if ((await LocalNotifications.requestPermissions()).display !== 'granted') return
    await LocalNotifications.schedule({ notifications: [{ id: REST_ID, title: 'Rest is up', body: 'Time for your next set.', schedule: { at: new Date(at) } }] })
  } catch {
    // no notification: the timer on screen still counts down
  }
}

/**
 * In the iPhone app: a touch you can feel. `tap` for a light one (a set checked off, a switch), `success` when
 * something is done (a save, a PR), `warning` when it needs you (rest is up). On the website it does nothing.
 */
export async function haptic(kind: 'tap' | 'success' | 'warning') {
  if (!Capacitor.isNativePlatform()) return
  try {
    if (kind === 'tap') await Haptics.impact({ style: ImpactStyle.Light })
    else await Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Warning })
  } catch {
    // no haptics on this phone: nothing depends on them
  }
}
