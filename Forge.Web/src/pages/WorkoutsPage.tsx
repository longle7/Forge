import { Link, useNavigate } from 'react-router'
import { getExercises, getPlan, getWorkouts, isCardio } from '../api'
import { Card, Group, Page, plainButton, primaryButton, Row, SectionTitle, Status, tintedButton, WorkoutRow } from '../components'
import { addDays, DAY_NAMES, localDate, WEEK, weekday } from '../dates'
import { emptyDraft, loadDraft, planDraft, repeatDraft, saveDraft, type Draft } from '../draft'
import { Icon } from '../icons'
import { planFor, workedOut } from '../plan'
import { failure, useNow, usePolling } from '../usePolling'
import { formatDay, formatTime, personalRecords, plural } from '../workouts'

/** The Workouts tab: today's workout, this week's plan, recent history, the exercise list, and your maxes. */
export default function WorkoutsPage() {
  const today = localDate(useNow(60_000))
  const workouts = usePolling(getWorkouts, '/workouts')
  const plan = usePolling(getPlan, '/plan')
  const records = personalRecords(workouts.data ?? [])
  const recent = workouts.data?.slice(0, 3) ?? []
  const monday = addDays(today, -((weekday(today) + 6) % 7))

  return (
    <Page title="Workouts">
      <TodayWorkoutCard />

      <SectionTitle title="This Week" />
      <Group footer="Your plan repeats every week. Tap a day to plan it.">
        {WEEK.map((day, i) => {
          const date = addDays(monday, i)
          const planned = plan.data?.find((p) => p.dayOfWeek === day)
          const done = workedOut(workouts.data, date)
          return (
            <Row key={day} to={`/workouts/plan/${day}`} detail={done ? <Icon name="check" className="size-5 text-green-ink" /> : undefined}>
              <span className={`block ${date === today ? 'font-bold text-coral-ink' : 'font-medium'}`}>
                {DAY_NAMES[day]}
                {date === today && <span className="sr-only"> (today)</span>}
              </span>
              <span className="block text-[15px] text-muted">{planned ? `${planned.name} · ${plural(planned.exercises.length, 'exercise')}` : 'Rest'}</span>
            </Row>
          )
        })}
      </Group>

      <SectionTitle title="History" link={workouts.data?.length ? { to: '/workouts/history', label: 'See All' } : undefined} />
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} rows={2} onRetry={workouts.reload} />
      {workouts.data?.length === 0 && <p className="px-1 text-muted">Finished workouts show up here.</p>}
      {recent.length > 0 && (
        <Group>
          {recent.map((w) => (
            <WorkoutRow key={w.id} workout={w} prs={records.get(w.id)?.size ?? 0} />
          ))}
        </Group>
      )}

      <Group>
        <Row to="/workouts/exercises" icon="list">
          Exercises
        </Row>
        <Row to="/workouts/maxes" icon="trophy">
          Maxes
        </Row>
      </Group>
    </Page>
  )
}

/**
 * Today's workout, on Home and the Workouts tab: Continue the one in progress; start today's planned workout (or
 * see that it's done, or that it's a rest day); or, with no plan yet, start one (empty, or a repeat of the last).
 * The workout itself opens at /workouts/active.
 */
export function TodayWorkoutCard({ quiet = false }: { quiet?: boolean }) {
  const navigate = useNavigate()
  const today = localDate(useNow(60_000))
  const workouts = usePolling(getWorkouts, '/workouts')
  const plan = usePolling(getPlan, '/plan')
  const exercises = usePolling(getExercises, '/exercises')
  const draft = loadDraft()
  const planned = planFor(plan.data, today)
  const done = workedOut(workouts.data, today)
  const last = workouts.data?.[0]
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const cardio = new Set(exercises.data?.filter(isCardio).map((e) => e.id))

  const start = (next: Draft) => {
    saveDraft(next)
    navigate('/workouts/active')
  }
  const eyebrow = (text: string) => <p className="text-[13px] font-semibold tracking-wide text-coral-ink uppercase">{text}</p>

  if (draft) {
    return (
      <Card>
        {eyebrow(draft.editing ? 'Editing' : 'In progress')}
        <p className="mt-0.5 text-[22px] font-bold">{draft.name}</p>
        <p className="text-[15px] text-muted">
          {draft.editing ? formatDay(draft.startedAt) : `Started ${formatTime(draft.startedAt)}`} ·{' '}
          {plural(draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0), 'set')} done
        </p>
        <button onClick={() => navigate('/workouts/active')} className={`mt-4 ${primaryButton}`}>
          <Icon name="play" className="size-5 fill-current" />
          Continue
        </button>
      </Card>
    )
  }

  if (planned && done) {
    return (
      <Card>
        {eyebrow("Today's plan")}
        <p className="mt-0.5 flex items-center gap-2 text-[22px] font-bold">
          {planned.name} <Icon name="check" className="size-6 text-green-ink" />
        </p>
        <p className="text-[15px] text-muted">Done for today. Nice work.</p>
        <button onClick={() => start(emptyDraft())} className={`mt-3 -ml-1 ${plainButton}`}>
          Start another workout
        </button>
      </Card>
    )
  }

  if (planned) {
    return (
      <Card>
        {eyebrow("Today's plan")}
        <p className="mt-0.5 text-[22px] font-bold">{planned.name}</p>
        <p className="text-[15px] text-muted">
          {planned.exercises.map((e) => `${names.get(e.exerciseId) ?? 'Exercise'}${cardio.has(e.exerciseId) ? '' : ` ${e.sets}×${e.reps}`}`).join(' · ')}
        </p>
        <button onClick={() => start(planDraft(planned, cardio))} className={`mt-4 ${primaryButton}`}>
          <Icon name="play" className="size-5 fill-current" />
          Start {planned.name}
        </button>
      </Card>
    )
  }

  if (plan.data?.length) {
    const next = [1, 2, 3, 4, 5, 6].map((n) => addDays(today, n)).find((day) => planFor(plan.data, day)) ?? today
    const nextPlan = planFor(plan.data, next)
    return (
      <Card>
        {eyebrow('Today')}
        <p className="mt-0.5 flex items-center gap-2 text-[22px] font-bold">
          Rest day <Icon name="moon" className="size-5 text-muted" />
        </p>
        <p className="text-[15px] text-muted">
          Recovery is part of the plan.{nextPlan && ` Next up: ${nextPlan.name}, ${DAY_NAMES[weekday(next)]}.`}
        </p>
        <button onClick={() => start(emptyDraft())} className={`mt-3 -ml-1 ${plainButton}`}>
          Start a workout anyway
        </button>
      </Card>
    )
  }

  return (
    <Card>
      {eyebrow('Today')}
      <p className="mt-0.5 text-[22px] font-bold">Ready when you are</p>
      {/* quiet: another card on the page has the main action (Home's Get Started), so this one steps back. */}
      <button onClick={() => start(emptyDraft())} className={`mt-4 ${quiet ? `w-full ${tintedButton}` : primaryButton}`}>
        <Icon name="play" className="size-5 fill-current" />
        Start Workout
      </button>
      {last && (
        <button onClick={() => start(repeatDraft(last))} className={`mt-2 w-full ${tintedButton}`}>
          <Icon name="repeat" className="size-5" />
          Repeat {last.name}
        </button>
      )}
      <Link to={`/workouts/plan/${weekday(today)}`} className={`mt-2 -ml-1 ${plainButton}`}>
        <Icon name="calendar" className="size-5" />
        Plan your week
      </Link>
    </Card>
  )
}
