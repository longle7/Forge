import { useEffect, useRef, useSyncExternalStore } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import { isSignedIn, onSignInChange } from './api'
import { ErrorBoundary, NotFound } from './components'
import { loadDraft } from './draft'
import { syncHealth } from './health'
import { Icon, type IconName } from './icons'
import { endWorkout, isLive } from './liveActivity'
import { useOnline } from './usePolling'
import AddFoodPage from './pages/AddFoodPage'
import CaloriesPage from './pages/CaloriesPage'
import ExercisePage from './pages/ExercisePage'
import ExercisesPage from './pages/ExercisesPage'
import MaxesPage from './pages/MaxesPage'
import HabitsPage from './pages/HabitsPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import LoggerPage from './pages/LoggerPage'
import PlanDayPage from './pages/PlanDayPage'
import ProgressPage from './pages/ProgressPage'
import RoutinePage from './pages/RoutinePage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'
import TimeOutPage from './pages/TimeOutPage'
import WorkoutDetailPage from './pages/WorkoutDetailPage'
import WorkoutsPage from './pages/WorkoutsPage'
import { PrivacyPage, SupportPage, TermsPage } from './pages/LegalPages'
import { LEGAL_PAGES } from './legal'
import Welcome from './Welcome'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/workouts', label: 'Workouts', icon: 'dumbbell' },
  { to: '/calories', label: 'Calories', icon: 'food' },
  { to: '/timeout', label: 'Time Out', icon: 'hourglass' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
]

export default function App() {
  // Apple Health: bring in new Watch workouts when the app opens or comes back (syncHealth keeps it to every 5 minutes).
  useEffect(() => {
    const sync = () => {
      if (!document.hidden && isSignedIn()) syncHealth().catch(() => {}) // offline or not allowed: next time
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  // A Live Activity left up when no workout is going (the app closed before it could end it) comes down at launch.
  useEffect(() => {
    if (!isLive(loadDraft())) void endWorkout()
  }, [])

  return (
    <BrowserRouter>
      <OfflineBanner />
      {/* Under the iPhone's clock and battery, what scrolls by is blurred, as in iOS apps. 0 px tall in a browser. */}
      <div className="fixed inset-x-0 top-0 z-10 h-[env(safe-area-inset-top)] bg-canvas/85 backdrop-blur-md" aria-hidden />
      {/* Bottom padding keeps the last item clear of the tab bar and the iPhone home indicator. */}
      {/* Focusable (but not tabbable) so navigation can move focus here; see ScrollAndFocus. */}
      <main tabIndex={-1} className="mx-auto max-w-xl space-y-4 px-4 pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none">
        <ScrollAndFocus />
        <Pages />
      </main>
      <TabBar />
      <Welcome />
    </BrowserRouter>
  )
}

function Pages() {
  const { pathname } = useLocation()
  // On the iPhone, nothing loads until you've signed in (Welcome asks), so nothing is fetched or saved for nobody.
  const signedIn = useSyncExternalStore(onSignInChange, isSignedIn)
  if (!signedIn && !LEGAL_PAGES.includes(pathname)) return null
  return (
    // Keyed by page so moving to another page clears a crash.
    <ErrorBoundary key={pathname}>
      {/* New for each page (the boundary is keyed by it), so every page change plays the enter animation. */}
      <div className="page-enter space-y-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workouts/active" element={<LoggerPage />} />
          <Route path="/workouts/history" element={<HistoryPage />} />
          <Route path="/workouts/history/:id" element={<WorkoutDetailPage />} />
          <Route path="/workouts/exercises" element={<ExercisesPage />} />
          <Route path="/workouts/maxes" element={<MaxesPage />} />
          <Route path="/workouts/exercises/:id" element={<ExercisePage />} />
          <Route path="/workouts/plan/:day" element={<PlanDayPage />} />
          <Route path="/workouts/routines/:id" element={<RoutinePage />} />
          <Route path="/calories" element={<CaloriesPage />} />
          <Route path="/calories/add" element={<AddFoodPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/timeout" element={<TimeOutPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}

// BrowserRouter keeps the old scroll position between pages; start each page at the top. After navigating, move focus
// to the new page so VoiceOver reads it rather than staying on the link that just disappeared.
function ScrollAndFocus() {
  const { pathname } = useLocation()
  const firstPage = useRef(true)
  useEffect(() => {
    window.scrollTo(0, 0)
    if (firstPage.current) {
      firstPage.current = false
      return
    }
    document.querySelector('main')?.focus({ preventScroll: true })
  }, [pathname])
  return null
}

/** Stays in view on every page while offline (a common moment in a gym basement). */
function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <p role="status" className="sticky top-0 z-20 bg-amber px-4 pt-[env(safe-area-inset-top)] pb-1.5 text-center text-sm font-semibold text-[#2a1f1a]">
      You're offline. Your workout in progress is kept on this phone.
    </p>
  )
}

function TabBar() {
  // Read again on every page change (the logger saves or clears the workout before it navigates): a workout left
  // open gets a dot on the Workouts tab.
  useLocation()
  const inProgress = !!loadDraft()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-coral-ink' : 'text-muted'}`
            }
          >
            <span className="relative">
              <Icon name={tab.icon} />
              {inProgress && tab.to === '/workouts' && <span className="absolute -top-0.5 -right-1.5 size-2.5 rounded-full border-2 border-surface bg-coral" />}
            </span>
            {tab.label}
            {inProgress && tab.to === '/workouts' && <span className="sr-only">, workout in progress</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
