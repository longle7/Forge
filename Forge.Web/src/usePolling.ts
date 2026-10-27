import { useEffect, useState, useSyncExternalStore } from 'react'
import { remember, remembered } from './cache'

// Requests in flight by key: a page and its cards that ask for the same thing as they open share one request. Only
// one started moments ago is joined, so a page opened right after a save never gets data from before it.
const SHARE_MS = 250
const inFlight = new Map<string, { request: Promise<unknown>; at: number }>()
export const shared = <T,>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const recent = inFlight.get(key)
  if (recent && Date.now() - recent.at < SHARE_MS) return recent.request as Promise<T>
  const entry = { request: fetcher(), at: Date.now() }
  inFlight.set(key, entry)
  entry.request.finally(() => inFlight.get(key) === entry && inFlight.delete(key)).catch(() => {})
  return entry.request as Promise<T>
}

/** Dispatch on window to make every page fetch again: `window.dispatchEvent(new Event(REFRESH))`. */
export const REFRESH = 'forge:refresh'

interface PollState<T> {
  data: T | undefined
  error: Error | undefined
  updatedAt: Date | undefined
}

/**
 * Calls `fetcher` when mounted, when `key` changes, and when the device comes back online.
 * `key` names what's fetched and is where it's remembered, so it must be unique per request: use its API path.
 * Keeps the last good data when a refresh fails. The last good data is also kept on the device and shown at once on
 * the next visit, even offline; `updatedAt` says how old it is. `reload()` fetches again now, e.g. right after a
 * change was saved.
 */
export function usePolling<T>(fetcher: () => Promise<T>, key: string): PollState<T> & { reload: () => void } {
  const start = (k: string) => ({ key: k, error: undefined, ...(remembered<T>(k) || { data: undefined, updatedAt: undefined }) })
  const [state, setState] = useState<PollState<T> & { key: string }>(() => start(key))
  const [reloads, setReloads] = useState(0)
  const reload = () => setReloads((n) => n + 1)
  // A new key starts from what's remembered for it, not the previous key's data.
  if (state.key !== key) setState(start(key))

  useEffect(() => {
    let cancelled = false
    // `fresh`: a reload after a save skips joining a request that started before it.
    const load = (fresh = false) =>
      (fresh ? fetcher() : shared(key, fetcher)).then(
        (data) => {
          if (cancelled) return
          setState({ key, data, error: undefined, updatedAt: new Date() })
          remember(key, data)
        },
        (error: Error) => !cancelled && setState((s) => ({ ...s, key, error })),
      )
    load(reloads > 0)
    // Back online (e.g. out of the gym's basement): refetch everything, including one-off loads that failed while offline.
    // REFRESH: something changed the data behind the page's back (an Apple Health sync).
    const onOnline = () => load()
    window.addEventListener('online', onOnline)
    window.addEventListener(REFRESH, onOnline)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener(REFRESH, onOnline)
    }
    // fetcher is recreated every render, so `key` (not fetcher) identifies what is being fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloads])

  // Don't show the previous key's data while the new key loads.
  return state.key === key ? { ...state, reload } : { data: undefined, error: undefined, updatedAt: undefined, reload }
}

/** The error worth a red box: only when there's nothing to show. With last-known data, pages say how old it is instead. */
export const failure = <T,>(poll: PollState<T>) => (poll.data === undefined ? poll.error : undefined)

/**
 * Whether `poll` has answered since the page opened. Until then its data may be from an earlier visit, so something
 * just saved (a workout, an exercise) isn't "not found" yet, only not loaded.
 */
export function useSettled<T>(poll: PollState<T>): boolean {
  const [openedAt] = useState(Date.now)
  return (poll.updatedAt?.getTime() ?? 0) >= openedAt || poll.error !== undefined
}

/**
 * A button's save or delete: `run(action)` sets `busy` while it runs and `error` to its message if it fails.
 * `setError` shows a message of your own, like a missing field.
 */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(undefined)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

/** Current time, updated every `intervalMs` (for countdowns). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Whether the device has a network connection, updated as it comes and goes. */
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine)

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** The browser tab / history title: "History · Forge" (VoiceOver announces it on navigation). */
export function useTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Forge` : 'Forge'
  }, [title])
}
