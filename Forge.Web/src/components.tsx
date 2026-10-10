import { Component, useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from './api'
import { Icon, type IconName } from './icons'
import { useOnline, useTitle } from './usePolling'

// Buttons: one look per job, every one at least 44 px tall (Apple's minimum tap size).

/** The main action: the Sunrise gradient, deep enough for white text to pass WCAG AA. */
export const primaryButton =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-coral-deep to-pink-deep px-4 font-semibold text-white transition active:opacity-80 disabled:opacity-40'
/** A secondary action: coral text on a soft coral tint. */
export const tintedButton =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-coral/12 px-4 text-[15px] font-semibold text-coral-ink transition active:opacity-70 disabled:opacity-40'
/** A text action in the tint color ("Edit", "+ Add set"). */
export const plainButton = 'inline-flex min-h-11 items-center gap-1 px-1 text-coral-ink active:opacity-60 disabled:opacity-40'
/** A destructive action ("Delete workout"). */
export const dangerButton =
  'flex min-h-12 w-full items-center justify-center rounded-2xl bg-surface text-red-600 active:opacity-60 disabled:opacity-40 dark:text-red-400'
/** Text and number fields. 16 px or larger text stops iOS Safari from zooming in on focus. */
export const field =
  'min-h-11 w-full rounded-xl bg-fill px-3 text-[17px] text-ink outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-coral'

/**
 * Every screen: an iOS large title, with a back button above it on deeper screens. `eyebrow` is the small line over
 * the title (Home's date); `action` sits at the title's right (Home's Settings button).
 */
export function Page({ title, eyebrow, back, action, children }: {
  title: string
  eyebrow?: string
  back?: { to: string; label: string }
  action?: ReactNode
  children: ReactNode
}) {
  useTitle(title || undefined)
  return (
    <>
      {back && <NavBar back={back} />}
      <header className={`flex items-end justify-between gap-3 ${back ? '' : 'pt-4'}`}>
        <div className="min-w-0">
          {eyebrow && <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">{eyebrow}</p>}
          <h1 className="text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </>
  )
}

/** The bar above a deeper screen's title: Back, labeled with where it goes, like iOS. */
function NavBar({ back }: { back: { to: string; label: string } }) {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-canvas/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <button
        // Opened from a link or bookmark there's no history to go back to, so go to the parent screen.
        onClick={() => (location.key === 'default' ? navigate(back.to) : navigate(-1))}
        className="flex min-h-11 items-center text-coral-ink active:opacity-60"
      >
        <Icon name="chevronLeft" className="size-7" />
        {back.label}
      </button>
    </div>
  )
}

/** A white card on the cream canvas. With `to`, the whole card is a link. */
export function Card({ children, to, className = '' }: { children: ReactNode; to?: string; className?: string }) {
  const style = `block rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgb(42_31_26/0.06)] ${className}`
  return to ? (
    <Link to={to} className={`${style} transition active:scale-[0.99]`}>
      {children}
    </Link>
  ) : (
    <div className={style}>{children}</div>
  )
}

/** A bold section title between cards ("This Week"), with an optional link at its right ("See All"). */
export function SectionTitle({ title, link }: { title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-end justify-between px-1 pt-2">
      <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
      {link && (
        <Link to={link.to} className="text-coral-ink active:opacity-60">
          {link.label}
        </Link>
      )}
    </div>
  )
}

/** An inset grouped list, like iOS Settings: an optional small title, rows, and a footnote. */
export function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      {title && <h2 className="px-4 text-[13px] text-muted uppercase">{title}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</div>
      {footer && <p className="px-4 text-[13px] text-muted">{footer}</p>}
    </section>
  )
}

/** One row of a Group. With `to` it's a link with a chevron; `detail` is the gray text at its right. */
export function Row({ children, detail, to, icon }: { children: ReactNode; detail?: ReactNode; to?: string; icon?: IconName }) {
  const content = (
    <>
      {icon && (
        <span className="grid size-8 place-items-center rounded-lg bg-coral/12 text-coral-ink">
          <Icon name={icon} className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">{children}</span>
      {detail !== undefined && <span className="shrink-0 text-muted">{detail}</span>}
      {to && <Icon name="chevronRight" className="size-5 text-muted/60" />}
    </>
  )
  const style = 'flex min-h-11 items-center gap-3 px-4 py-2.5'
  return to ? (
    <Link to={to} className={`${style} active:bg-fill`}>
      {content}
    </Link>
  ) : (
    <div className={style}>{content}</div>
  )
}

/** A calm "nothing here yet": an icon, a title, and a line or two on what will appear. */
export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-coral/12 text-coral-ink">
        <Icon name={icon} className="size-7" />
      </span>
      <p className="text-[20px] font-semibold">{title}</p>
      <div className="text-muted">{children}</div>
    </div>
  )
}

/** Apple-style activity rings, outermost first. Each value runs 0 to 1; more than 1 stays a full ring. */
export function Rings({ rings, size = 128 }: { rings: { label: string; value: number; color: string }[]; size?: number }) {
  const stroke = 12
  const gap = 3
  const center = size / 2
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: size, height: size }}
      className="shrink-0"
      role="img"
      aria-label={rings.map((r) => `${r.label} ${Math.round(Math.min(1, r.value) * 100)}%`).join(', ')}
    >
      {rings.map((ring, i) => {
        const r = center - stroke / 2 - i * (stroke + gap)
        const circumference = 2 * Math.PI * r
        const progress = Math.max(0, Math.min(1, ring.value))
        return (
          <g key={ring.label} transform={`rotate(-90 ${center} ${center})`}>
            <circle cx={center} cy={center} r={r} fill="none" stroke={ring.color} strokeOpacity={0.18} strokeWidth={stroke} />
            {progress > 0 && (
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** A macro's progress toward its goal: "Protein 96 / 167 g" over a bar. */
export function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const progress = goal > 0 ? Math.min(1, value / goal) : 0
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted tabular-nums">
          {Math.round(value)} / {goal} g
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-fill">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress * 100}%`, background: color }} />
      </div>
    </div>
  )
}

/** − value + buttons, like iOS's stepper. */
export function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (value: number) => void; min: number; max: number; label: string }) {
  const button = 'grid size-9 place-items-center rounded-lg bg-fill text-[20px] leading-none text-coral-ink active:opacity-60 disabled:opacity-30'
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Less ${label}`} className={button}>
        −
      </button>
      <span className="min-w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`} className={button}>
        +
      </button>
    </div>
  )
}

/** iOS's segmented control: a few options, one chosen. */
export function Segmented<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-fill p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-9 rounded-lg px-2 text-[15px] font-semibold transition ${selected ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(42_31_26/0.12)]' : 'text-muted'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A bottom sheet: a native modal <dialog> sliding up from the bottom, with Cancel at its top left. It traps focus,
 * and Escape or Cancel calls `onClose`; the owner removes it from the page when it's done.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal() // StrictMode runs this twice in development
  }, [])
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={title}
      className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-xl rounded-t-3xl bg-canvas p-0 text-ink backdrop:bg-black/40"
    >
      <div className="space-y-4 px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => dialog.current?.close()} className={plainButton}>
            Cancel
          </button>
          <h2 className="font-semibold">{title}</h2>
          <span className="w-14" aria-hidden />
        </div>
        {children}
      </div>
    </dialog>
  )
}

/** "PR": a set that beat every earlier workout. */
export function PrBadge() {
  return (
    <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs font-bold text-amber-ink">
      PR<span className="sr-only"> (personal record)</span>
    </span>
  )
}

/** A message under a form or action: what happened, or what to do next. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-2xl bg-amber/15 px-4 py-3 text-[15px] text-ink">
      {children}
    </p>
  )
}

/** An error box with a way out, or `rows` placeholder cards while loading. */
export function Status({ error, loading, rows = 3 }: { error?: Error; loading?: boolean; rows?: number }) {
  const online = useOnline()
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 p-4 text-[15px] text-red-900 dark:bg-red-950 dark:text-red-100">
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
          <div key={i} className="h-16 rounded-2xl bg-fill motion-safe:animate-pulse" />
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
      className="flex items-center gap-2 rounded-xl bg-fill px-3 focus-within:ring-2 focus-within:ring-coral"
    >
      <Icon name="search" className="size-5 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="min-h-11 w-full bg-transparent text-[17px] outline-none placeholder:text-muted/70"
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

/** A missing page or workout: says so plainly and offers a way on (Home, or `back` like "All workouts"). */
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
    <div className="space-y-4 pt-12 text-center">
      <h1 className="text-[28px] font-bold">{title}</h1>
      <p className="text-muted">{message}</p>
      <Link to={back?.to ?? '/'} className={primaryButton}>
        {back?.label ?? 'Go Home'}
      </Link>
    </div>
  )
}
