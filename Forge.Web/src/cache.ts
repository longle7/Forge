// The last good answer for each request (your workouts, the exercise list), kept on this device only, so Forge has
// something to show when it opens with no signal.
const PREFIX = 'forge.cache.'

/** localStorage that never throws: blocked storage reads as nothing stored. */
export function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Saves `value` (null removes it). Storage full or blocked: skipped, so it lasts only while the page stays open. */
export function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // storage full or blocked
  }
}

/** `read`, parsed as JSON. Corrupted storage reads as nothing stored. */
export function readJson<T>(key: string): T | undefined {
  try {
    return JSON.parse(read(key) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}

export function remembered<T>(key: string): { data: T; updatedAt: Date } | undefined {
  const entry = readJson<{ data: T; at: number }>(PREFIX + key)
  return entry ? { data: entry.data, updatedAt: new Date(entry.at) } : undefined
}

export function remember(key: string, data: unknown) {
  if (data !== undefined) write(PREFIX + key, JSON.stringify({ data, at: Date.now() }))
}

/** After signing in or out: what's remembered may belong to another account. */
export function forgetRemembered() {
  try {
    for (const k of Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))) localStorage.removeItem(k)
  } catch {
    // storage blocked: nothing stored
  }
}
