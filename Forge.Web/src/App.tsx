import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AppLogo, ErrorBoundary, NotFound, Status } from './components'
import { useOnline } from './usePolling'
import ExercisePage from './pages/ExercisePage'
import ExercisesPage from './pages/ExercisesPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import WorkoutDetailPage from './pages/WorkoutDetailPage'
import WorkoutPage from './pages/WorkoutPage'

const TABS = ['/', '/history', '/exercises']

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      {/* Bottom padding keeps the last item clear of the tab bar and the iPhone home indicator. */}
      {/* Focusable (but not tabbable) so navigation can move focus here; see Header. */}
      <main tabIndex={-1} className="mx-auto max-w-xl space-y-4 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none">
        <Pages />
      </main>
      <TabBar />
    </BrowserRouter>
  )
}

function Pages() {
  const { pathname } = useLocation()
  return (
    // Keyed by page so moving to another page clears a crash.
    <ErrorBoundary key={pathname}>
      {/* New for each page (the boundary is keyed by it), so every page change plays the enter animation. */}
      <div className="page-enter space-y-4">
        <Suspense fallback={<Status loading />}>
          <Routes>
            <Route path="/" element={<WorkoutPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:id" element={<WorkoutDetailPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/exercises/:id" element={<ExercisePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}

// Tab pages show the logo; deeper pages get a Back button (an installed app has no browser back button).
function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const online = useOnline()
  const firstPage = useRef(true)

  // BrowserRouter keeps the old scroll position between pages; start each page at the top. After navigating,
  // move focus to the new page so VoiceOver reads it rather than staying on the link that just disappeared.
  useEffect(() => {
    window.scrollTo(0, 0)
    if (firstPage.current) {
      firstPage.current = false
      return
    }
    document.querySelector('main')?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <header className="sticky top-0 z-10 bg-neutral-900 pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex min-h-14 max-w-xl items-center justify-between gap-3 px-4">
        {TABS.includes(location.pathname) ? (
          <>
            <Link to="/" className="flex items-center gap-2.5">
              <AppLogo />
              <span className="text-xl font-bold tracking-tight">Forge</span>
            </Link>
            <Link to="/settings" aria-label="Settings" className="-mr-2 grid size-11 place-items-center rounded-full active:bg-white/10">
              <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </Link>
          </>
        ) : (
          <button
            // Opened from a link or bookmark there's no history to go back to, so go to Workout.
            onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
            className="-ml-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-lg font-semibold active:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-[2.5]" aria-hidden>
              <path d="m15 5-7 7 7 7" />
            </svg>
            Back
          </button>
        )}
      </div>
      {/* In the header so it stays in view on every page while offline (a common moment in a gym basement). */}
      {!online && (
        <p role="status" className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-neutral-900">
          You're offline. Your workout in progress is kept on this phone.
        </p>
      )}
    </header>
  )
}

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
      <div className="mx-auto grid max-w-xl grid-cols-3">
        <Tab to="/" label="Workout" icon={<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />} />
        <Tab
          to="/history"
          label="History"
          icon={
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </>
          }
        />
        <Tab to="/exercises" label="Exercises" icon={<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />} />
      </div>
    </nav>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`
      }
    >
      <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
        {icon}
      </svg>
      {label}
    </NavLink>
  )
}
