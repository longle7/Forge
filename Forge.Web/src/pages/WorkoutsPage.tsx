import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { deleteRoutine, getExercises, getPlan, getRoutines, getWorkouts, isCardio, saveRoutine, type PlanDay, type Routine, type Workout } from '../api'
import { Card, dangerButton, field, Group, Notice, Page, plainButton, PrBadge, primaryButton, Row, SectionTitle, Sheet, Status, tintedButton } from '../components'
import { addDays, DAY_NAMES, localDate, weekday } from '../dates'
import { emptyDraft, loadDraft, planDraft, repeatDraft, routineDraft, saveDraft, useStartWorkout, type Draft } from '../draft'
import { Icon } from '../icons'
import { planFor, workedOut } from '../plan'
import { weekStatuses } from '../progress'
import { failure, useAction, useNow, usePolling } from '../usePolling'
import { exerciseNames, formatDay, formatDuration, formatTime, groupSets, personalRecords, plural, setsSummary, workoutLength, workoutTotals } from '../workouts'
import { DayDot, DOT_LABELS } from './ProgressPage'

/** The Workouts tab: today's workout, this week's plan, your routines, recent history, the exercise list, and your maxes. */
export default function WorkoutsPage() {
  const today = localDate(useNow(60_000))
  const workouts = usePolling(getWorkouts, '/workouts')
  const plan = usePolling(getPlan, '/plan')
  const records = personalRecords(workouts.data ?? [])
  const recent = workouts.data?.slice(0, 3) ?? []

  // "All routines" on the Today card (here or on Home) links to #routines. The key changes on every tap, even a second.
  const location = useLocation()
  useEffect(() => {
    if (location.hash === '#routines') document.getElementById('routines')?.scrollIntoView()
  }, [location.hash, location.key])

  return (
    <Page title="Workouts">
      <TodayWorkoutCard />

      <SectionTitle title="This Week" />
      <Group footer="Your plan repeats every week. Tap a day to plan it.">
        <WeekStrip plan={plan.data ?? []} workouts={workouts.data ?? []} today={today} />
      </Group>

      <Routines />

      <SectionTitle title="History" link={workouts.data?.length ? { to: '/workouts/history', label: 'See All' } : undefined} />
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} rows={2} />
      {workouts.data?.length === 0 && <p className="px-1 text-muted">Finished workouts show up here.</p>}
      {recent.length > 0 && (
        <Group>
          {recent.map((w) => (
            <Row key={w.id} to={`/workouts/history/${w.id}`} detail={(records.get(w.id)?.size ?? 0) > 0 ? <PrBadge /> : undefined}>
              <span className="block font-medium">{w.name}</span>
              <span className="block text-[15px] text-muted">
                {[formatDay(w.startedAt), formatDuration(workoutLength(w)), workoutTotals(w)].filter(Boolean).join(' · ')}
              </span>
            </Row>
          ))}
        </Group>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card to="/workouts/exercises" className="flex items-center gap-3 font-medium">
          <Icon name="list" className="size-6 text-coral-ink" />
          Exercises
        </Card>
        <Card to="/workouts/maxes" className="flex items-center gap-3 font-medium">
          <Icon name="trophy" className="size-6 text-coral-ink" />
          Maxes
        </Card>
      </div>
    </Page>
  )
}

/** This week, Monday first: each day's dot as on Progress, under its initial. A tap opens that day's plan. */
function WeekStrip({ plan, workouts, today }: { plan: PlanDay[]; workouts: Workout[]; today: string }) {
  const days = weekStatuses(plan, workouts, today, 1)[0].map(({ day, status }) => {
    const name = DAY_NAMES[weekday(day)]
    // "Monday (today), Push Day, trained". Before the plan began (or with none yet), a day says only its name.
    const label = [`${name}${day === today ? ' (today)' : ''}`, planFor(plan, day)?.name, status !== 'none' && DOT_LABELS[status]].filter(Boolean).join(', ')
    return { day, status, initial: name[0], label }
  })
  return (
    <div className="grid grid-cols-7 p-2">
      {days.map(({ day, status, initial, label }) => (
        <Link key={day} to={`/workouts/plan/${weekday(day)}`} aria-label={label} className="flex min-h-11 flex-col items-center gap-1 rounded-xl py-1 active:bg-fill">
          <span aria-hidden className={`text-[13px] ${day === today ? 'font-bold text-coral-ink' : 'text-muted'}`}>
            {initial}
          </span>
          <DayDot status={status} />
        </Link>
      ))}
    </div>
  )
}

/** Your routines, by name, each with its exercises. A tap opens one to start, rename, or delete. */
function Routines() {
  const routines = usePolling(getRoutines, '/routines')
  const exercises = usePolling(getExercises, '/exercises')
  const [openId, setOpenId] = useState<string>()
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const open = routines.data?.find((r) => r.id === openId)

  return (
    <section id="routines" className="scroll-mt-4 space-y-4">
      <SectionTitle title="Routines" />
      <Status loading={routines.data === undefined && !routines.error} error={failure(routines)} rows={1} />
      {routines.data?.length === 0 && <p className="px-1 text-muted">Save a finished workout as a routine (on its page) to start it again in one tap.</p>}
      {!!routines.data?.length && (
        <Group>
          {routines.data.map((routine) => (
            <button key={routine.id} onClick={() => setOpenId(routine.id)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{routine.name}</span>
                <span className="block truncate text-[15px] text-muted">{exerciseNames(routine.sets, names).join(' · ')}</span>
              </span>
              <Icon name="chevronRight" className="size-5 text-muted/60" />
            </button>
          ))}
        </Group>
      )}
      {open && <RoutineSheet routine={open} names={names} onChanged={routines.reload} onClose={() => setOpenId(undefined)} />}
    </section>
  )
}

/** A routine's exercises and sets, with Start, Rename, and Delete. */
function RoutineSheet({ routine, names, onChanged, onClose }: { routine: Routine; names: Map<number, string>; onChanged: () => void; onClose: () => void }) {
  const startWorkout = useStartWorkout()
  const [newName, setNewName] = useState<string>() // while renaming: the name being typed
  const { busy, error, setError, run } = useAction()
  const exercises = groupSets(routine.sets).map((group) => ({ name: names.get(group.exerciseId) ?? 'Exercise', sets: setsSummary(group.sets) }))

  const rename = async () => {
    if (!newName?.trim()) return setError('Give it a name, like Push A.')
    await run(async () => {
      await saveRoutine(routine.id, { name: newName.trim(), sets: routine.sets })
      onChanged()
      setNewName(undefined)
    })
  }
  const remove = async () => {
    if (!confirm(`Delete ${routine.name}? Workouts you did from it stay.`)) return
    await run(async () => {
      await deleteRoutine(routine.id)
      onChanged()
      onClose()
    })
  }

  return (
    <Sheet title={routine.name} onClose={onClose}>
      <Card>
        <ol className="space-y-2">
          {exercises.map((exercise, i) => (
            <li key={i}>
              <span className="block font-medium">{exercise.name}</span>
              <span className="block text-[15px] text-muted">{exercise.sets}</span>
            </li>
          ))}
        </ol>
      </Card>
      {error && <Notice>{error}</Notice>}
      <button onClick={() => setError(startWorkout(routineDraft(routine)))} className={primaryButton}>
        <Icon name="play" className="size-5 fill-current" />
        Start {routine.name}
      </button>
      {newName === undefined ? (
        <button onClick={() => setNewName(routine.name)} className={`w-full ${tintedButton}`}>
          Rename
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void rename()
          }}
          className="flex gap-2"
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Routine name" maxLength={50} className={field} />
          <button disabled={busy} className={tintedButton}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
      <button onClick={remove} disabled={busy} className={dangerButton}>
        Delete Routine
      </button>
    </Sheet>
  )
}

/**
 * Today's workout, on Home and the Workouts tab: Continue the one in progress; start today's planned workout (or
 * see that it's done, or that it's a rest day); or, with no plan yet, start one (empty, a repeat of the last, or one
 * of your first three routines).
 * The workout itself opens at /workouts/active.
 */
export function TodayWorkoutCard({ quiet = false }: { quiet?: boolean }) {
  const navigate = useNavigate()
  const today = localDate(useNow(60_000))
  const workouts = usePolling(getWorkouts, '/workouts')
  const plan = usePolling(getPlan, '/plan')
  const exercises = usePolling(getExercises, '/exercises')
  const routines = usePolling(getRoutines, '/routines')
  const draft = loadDraft()
  const planned = planFor(plan.data, today)
  const done = workedOut(workouts.data, today)
  const last = workouts.data?.[0]
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const cardio = new Set(exercises.data?.filter(isCardio).map((e) => e.id))
  const firstRoutines = routines.data?.slice(0, 3) ?? []

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
      {firstRoutines.map((routine) => (
        <button key={routine.id} onClick={() => start(routineDraft(routine))} className={`mt-2 w-full ${tintedButton}`}>
          <Icon name="play" className="size-5 fill-current" />
          Start {routine.name}
        </button>
      ))}
      {firstRoutines.length > 0 && (
        <Link to="/workouts#routines" className={`mt-2 -ml-1 ${plainButton}`}>
          <Icon name="list" className="size-5" />
          All routines
        </Link>
      )}
      <Link to={`/workouts/plan/${weekday(today)}`} className={`mt-2 -ml-1 ${plainButton}`}>
        <Icon name="calendar" className="size-5" />
        Plan your week
      </Link>
    </Card>
  )
}
