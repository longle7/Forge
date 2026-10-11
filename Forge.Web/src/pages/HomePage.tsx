import { useState } from 'react'
import { Link } from 'react-router'
import { foodLogPath, getFoodLog, getHabits, getPlan, getProfile, getWeighIns, getWorkouts } from '../api'
import { Card, Page, PrBadge, primaryButton, Rings, SectionTitle } from '../components'
import { dayLabel, localDate, workoutDay } from '../dates'
import { RING } from '../colors'
import { Icon } from '../icons'
import { today as habitsToday } from '../habits'
import { HabitsCard } from '../HabitsCard'
import { exerciseCalories, formatKcal, remaining, totals, weightOn } from '../nutrition'
import { planFor, workedOut } from '../plan'
import { isUnlocked, unlockGoals } from '../timeout'
import { useNow, usePolling } from '../usePolling'
import { WeighInSheet } from '../WeighInSheet'
import { formatDay, formatDuration, formatWeight, groupSets, personalRecords, plural, volume } from '../workouts'
import { TodayWorkoutCard } from './WorkoutsPage'

/** Home: today at a glance: your rings, today's workout, calories left, your weight, and your latest workout. */
export default function HomePage() {
  const now = useNow(60_000)
  const today = localDate(now)
  const profile = usePolling(getProfile, '/profile')
  const workouts = usePolling(getWorkouts, '/workouts')
  const plan = usePolling(getPlan, '/plan')
  const food = usePolling(() => getFoodLog(today), foodLogPath(today))
  const weighIns = usePolling(getWeighIns, '/weigh-ins')
  const habits = usePolling(getHabits, '/habits')
  const [weighing, setWeighing] = useState(false)

  const goals = profile.data
  const planned = planFor(plan.data, today)
  const restDay = !planned && (plan.data?.length ?? 0) > 0
  const done = workedOut(workouts.data, today)
  const eaten = totals(food.data ?? []).calories
  const weight = weightOn(weighIns.data, today, goals?.startWeight ?? 0)
  const exercise = (workouts.data ?? []).filter((w) => workoutDay(w) === today).reduce((sum, w) => sum + exerciseCalories(w, weight), 0)
  const budget = goals ? goals.calorieGoal + exercise : 0
  const latestWeighIn = weighIns.data?.at(-1)
  const last = workouts.data?.[0]
  const prs = last ? (personalRecords(workouts.data!).get(last.id)?.size ?? 0) : 0

  const moveDetail = planned ? `${planned.name}${done ? ' done' : ' to do'}` : restDay ? 'Rest day' : done ? 'Workout done' : 'No workout yet'
  const unlock = goals
    ? unlockGoals(goals, {
        planName: planned?.name,
        restDay,
        workedOut: done,
        meals: new Set((food.data ?? []).map((e) => e.meal)).size,
        weighedIn: latestWeighIn?.date === today,
        habitsDue: habitsToday(habits.data, today).due.length,
        habitsDone: habitsToday(habits.data, today).done,
      })
    : []
  const met = unlock.filter((g) => g.met).length
  const rings = [
    { label: 'Move', value: done || restDay ? 1 : 0, color: RING.move, detail: moveDetail },
    { label: 'Eat', value: budget ? eaten / budget : 0, color: RING.eat, detail: goals ? `${formatKcal(eaten)} of ${formatKcal(budget)} kcal` : 'Set your goals' },
    {
      label: 'Unlock',
      value: unlock.length ? met / unlock.length : 0,
      color: RING.unlock,
      detail: unlock.length === 0 ? 'Set goals in Time Out' : isUnlocked(unlock) ? 'Apps unlocked' : `Locked · ${met} of ${unlock.length} goals`,
    },
  ]

  return (
    <Page
      eyebrow={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      title={greeting(now)}
      action={
        <Link to="/settings" aria-label="Settings" className="mb-1 grid size-11 place-items-center rounded-full bg-surface text-coral-ink shadow-[0_1px_2px_rgb(42_31_26/0.06)]">
          <Icon name="person" />
        </Link>
      }
    >
      {goals === null && (
        <Card>
          <p className="text-[13px] font-semibold tracking-wide text-coral-ink uppercase">Welcome to Forge</p>
          <p className="mt-0.5 text-[22px] font-bold">Set up your goals</p>
          <p className="text-[15px] text-muted">A minute of details, and Forge works out your daily calories and macros.</p>
          <Link to="/setup" className={`mt-4 ${primaryButton}`}>
            Get Started
          </Link>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-5">
          <Rings rings={rings} size={112} />
          <ul className="min-w-0 flex-1 space-y-2">
            {rings.map((ring) => (
              <li key={ring.label}>
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: ring.color }} aria-hidden />
                  {ring.label}
                </span>
                <span className="block truncate pl-[18px] text-[15px] text-muted">{ring.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <TodayWorkoutCard />
      <HabitsCard />

      <div className="grid grid-cols-2 gap-3">
        <Card to="/calories">
          <p className="text-[13px] font-semibold text-muted uppercase">Calories</p>
          {goals ? (
            <>
              <p className="mt-1 text-[28px] leading-tight font-bold">{formatKcal(Math.abs(remaining(goals.calorieGoal, eaten, exercise)))}</p>
              <p className={`text-[15px] ${remaining(goals.calorieGoal, eaten, exercise) < 0 ? 'text-amber-ink' : 'text-muted'}`}>
                {remaining(goals.calorieGoal, eaten, exercise) < 0 ? 'over today' : 'left today'}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-[28px] leading-tight font-bold">{formatKcal(eaten)}</p>
              <p className="text-[15px] text-muted">eaten today</p>
            </>
          )}
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-semibold text-muted uppercase">Weight</p>
            <button onClick={() => setWeighing(true)} aria-label="Log weight" className="-mt-2 -mr-2 grid size-10 place-items-center rounded-full text-coral-ink active:bg-fill">
              <Icon name="plus" className="size-5" />
            </button>
          </div>
          <p className="text-[28px] leading-tight font-bold">{latestWeighIn ? formatWeight(latestWeighIn.weight) : '–'}</p>
          <p className="text-[15px] text-muted">{latestWeighIn ? `lb · ${dayLabel(latestWeighIn.date, today)}` : 'Tap + to log'}</p>
        </Card>
      </div>

      {last && (
        <>
          <SectionTitle title="Recent" />
          <Card to={`/workouts/history/${last.id}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{last.name}</p>
              {prs > 0 && <PrBadge />}
            </div>
            <p className="text-[15px] text-muted">
              {formatDay(last.startedAt)} · {formatDuration(Date.parse(last.finishedAt) - Date.parse(last.startedAt))} · {plural(groupSets(last.sets).length, 'exercise')} ·{' '}
              {formatWeight(volume(last))} lb
            </p>
          </Card>
        </>
      )}

      {weighing && (
        <WeighInSheet
          day={today}
          current={latestWeighIn?.date === today ? latestWeighIn.weight : undefined}
          onSaved={() => {
            setWeighing(false)
            weighIns.reload()
          }}
          onClose={() => setWeighing(false)}
        />
      )}
    </Page>
  )
}

/** "Good morning", "Good afternoon", or "Good evening". */
function greeting(now: Date): string {
  const hour = now.getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}
