import { Component, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiError } from './api'
import { useOnline, useTitle } from './usePolling'

/** Full-width main action ("Finish"). Works on <button> and <Link>. */
export const primaryButton =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 font-semibold text-white transition active:opacity-80 disabled:opacity-40 dark:bg-white dark:text-neutral-900'
/** Text action in the tint color ("Edit", "+ Add set"). */
export const linkButton = 'flex min-h-11 items-center px-2 font-semibold text-blue-600 active:opacity-60 disabled:opacity-40 dark:text-blue-400'
/** Compact action beside others ("Repeat", "Delete"). */
export const secondaryButton =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold shadow-sm active:opacity-70 disabled:opacity-40 dark:bg-neutral-900'
/** Destructive action ("Discard workout"). */
export const dangerButton =
  'flex min-h-12 w-full items-center justify-center rounded-xl font-semibold text-red-600 active:opacity-60 disabled:opacity-40 dark:text-red-400'
/** Text and number fields. text-base (16px) stops iOS Safari from zooming in on focus. */
export const field =
  'min-h-11 w-full rounded-lg bg-neutral-100 px-3 text-base outline-none focus:ring-2 focus:ring-blue-600 dark:bg-neutral-800 dark:focus:ring-blue-400'

/** Forge's mark (public/favicon.svg). */
export function AppLogo() {
  return <img src="/favicon.svg" alt="" className="size-8" />
}

export function Card({ children, to }: { children: ReactNode; to?: string }) {
  const className = 'block rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-900'
  return to ? (
    <Link to={to} className={`${className} transition hover:shadow-md active:scale-[0.99]`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  )
}

/** A titled group of cards or rows (Settings, the exercise list). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-neutral-500 uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** "PR": a set that beat every earlier workout. */
export function PrBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
      PR<span className="sr-only"> (personal record)</span>
    </span>
  )
}

/** An error box with a way out, or `rows` placeholder cards while loading. */
export function Status({ error, loading, rows = 3 }: { error?: Error; loading?: boolean; rows?: number }) {
  const online = useOnline()
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
        {/* Offline, a reload would only show the browser's error page; data refreshes by itself once back online. */}
        <p>{online ? friendlyError(error) : "You're offline. Forge will refresh when you're back online."}</p>
        {online && (
          <button onClick={() => location.reload()} className="shrink-0 rounded-lg bg-red-900/10 px-3 py-2 font-semibold dark:bg-white/10">
            Try again
          </button>
        )}
      </div>
    )
  }
  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-neutral-200 motion-safe:animate-pulse dark:bg-neutral-800" />
        ))}
      </div>
    )
  }
  return null
}

function friendlyError(error: Error): string {
  const status = error instanceof ApiError ? error.status : undefined
  if (status === 0) return error.message // timed out or no connection: api.ts wrote it for people
  if (status === 429) return 'Too many requests right now. Please wait a moment and try again.'
  if (status === 404) return "We couldn't find that. It may have been deleted."
  return "Couldn't load this right now. Please try again."
}

/** Search box. The keyboard's Search key (Enter) calls `onSubmit`, e.g. to pick the top result. */
export function SearchInput({ value, onChange, placeholder, onSubmit }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onSubmit?: () => void
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      className="flex items-center gap-2 rounded-xl bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-600 dark:bg-neutral-900 dark:focus-within:ring-blue-400"
    >
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-neutral-400 stroke-2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-neutral-400"
      />
    </form>
  )
}

/** Catches a crash anywhere below it and offers a way out instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  // Going to another page clears it: App keys this boundary by page.
  render() {
    return this.state.crashed ? (
      <NotFound title="Something went wrong" message="Forge hit an unexpected problem. Your workout in progress is still saved on this phone." />
    ) : (
      this.props.children
    )
  }
}

/** A missing page or workout: says so plainly and offers a way on (Workout, or `back` like "All workouts"). */
export function NotFound({
  title = 'Page not found',
  message = "This page doesn't exist. It may have moved.",
  back,
}: {
  title?: string
  message?: string
  back?: { to: string; label: string }
}) {
  useTitle(title)
  return (
    <div className="space-y-4 pt-8 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-neutral-500">{message}</p>
      <Link to={back?.to ?? '/'} className={primaryButton}>
        {back?.label ?? 'Go to Workout'}
      </Link>
    </div>
  )
}
