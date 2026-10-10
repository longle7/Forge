// The last good answer for each request (your workouts, the exercise list), kept on this device only, so Forge has
// something to show when it opens with no signal.
const PREFIX = 'forge.cache.'

export function remembered<T>(key: string): { data: T; updatedAt: Date } | undefined {
  try {
    const entry = JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null') as { data: T; at: number } | null
    return entry ? { data: entry.data, updatedAt: new Date(entry.at) } : undefined
  } catch {
    return undefined // blocked or corrupted storage: nothing remembered
  }
}

export function remember(key: string, data: unknown) {
  if (data === undefined) return
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, at: Date.now() }))
  } catch {
    // storage full or blocked: the app still works, just without last-known data offline
  }
}

/** After switching to another restore code: what's remembered belongs to the old one. */
export function forgetRemembered() {
  try {
    for (const k of Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))) localStorage.removeItem(k)
  } catch {
    // storage blocked: nothing stored
  }
}
