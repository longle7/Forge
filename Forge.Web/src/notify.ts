import { Capacitor } from '@capacitor/core'
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
