import { Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import { ErrorBoundary, NotFound, Status } from './components'
import { Icon, type IconName } from './icons'
import { useOnline } from './usePolling'
import AddFoodPage from './pages/AddFoodPage'
import CaloriesPage from './pages/CaloriesPage'
import ExercisePage from './pages/ExercisePage'
import ExercisesPage from './pages/ExercisesPage'
import HabitsPage from './pages/HabitsPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import LoggerPage from './pages/LoggerPage'
import PlanDayPage from './pages/PlanDayPage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'
import TimeOutPage from './pages/TimeOutPage'
import WorkoutDetailPage from './pages/WorkoutDetailPage'
import WorkoutsPage from './pages/WorkoutsPage'
import { PrivacyPage, SupportPage, TermsPage } from './pages/LegalPages'
import Welcome from './Welcome'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/workouts', label: 'Workouts', icon: 'dumbbell' },
  { to: '/calories', label: 'Calories', icon: 'food' },
  { to: '/timeout', label: 'Time Out', icon: 'hourglass' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
]

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
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
  return (
    // Keyed by page so moving to another page clears a crash.
    <ErrorBoundary key={pathname}>
      {/* New for each page (the boundary is keyed by it), so every page change plays the enter animation. */}
      <div className="page-enter space-y-4">
        <Suspense fallback={<Status loading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/workouts/active" element={<LoggerPage />} />
            <Route path="/workouts/history" element={<HistoryPage />} />
            <Route path="/workouts/history/:id" element={<WorkoutDetailPage />} />
            <Route path="/workouts/exercises" element={<ExercisesPage />} />
            <Route path="/workouts/exercises/:id" element={<ExercisePage />} />
            <Route path="/workouts/plan/:day" element={<PlanDayPage />} />
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
        </Suspense>
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
            <Icon name={tab.icon} />
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
