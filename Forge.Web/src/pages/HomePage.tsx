import { useState } from 'react'
import { Link } from 'react-router'
import { activityPath, foodLogPath, getActivity, getExercises, getFoodLog, getHabits, getPlan, getProfile, getWeighIns, getWorkouts } from '../api'
import { Card, Group, Page, primaryButton, Rings, SectionTitle, Status, WorkoutRow } from '../components'
import { dayLabel, localDate, workoutDay } from '../dates'
import { RING } from '../colors'
import { Icon } from '../icons'
import { HabitsCard } from '../HabitsCard'
import { dayBudget, exerciseCalories, formatKcal, remaining, totals, weekChange, weightOn } from '../nutrition'
import { RecoveryCard } from '../RecoveryCard'
import { isUnlocked, todaySoFar, unlockGoals } from '../timeout'
import { failure, useNow, usePolling } from '../usePolling'
import { WeighInSheet } from '../WeighInSheet'
import { formatWeight, personalRecords } from '../workouts'
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
  const exercises = usePolling(getExercises, '/exercises')
  const activity = usePolling(() => getActivity(today, today), activityPath(today, today))
  const [weighing, setWeighing] = useState(false)
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const retry = () => {
    profile.reload()
    workouts.reload()
  }

  const goals = profile.data
  const day = todaySoFar({ plan: plan.data, workouts: workouts.data, food: food.data, weighIns: weighIns.data, habits: habits.data }, today)
  const { planName, restDay, workedOut: done } = day
  const eaten = totals(food.data ?? []).calories
  const weight = weightOn(weighIns.data, today, goals?.startWeight ?? 0)
  const exercise = (workouts.data ?? []).filter((w) => workoutDay(w) === today).reduce((sum, w) => sum + exerciseCalories(w, weight, names), 0)
  const dayGoal = goals && dayBudget({ profile: goals, restDay, weightLb: weight, year: now.getFullYear(), activeKcal: activity.data?.[0]?.kcal, workoutEstimate: exercise })
  const budget = dayGoal ? dayGoal.goal + dayGoal.exercise : 0
  const left = dayGoal && remaining(dayGoal.goal, eaten, dayGoal.exercise)
  const latestWeighIn = weighIns.data?.at(-1)
  const change = weekChange(weighIns.data)
  const last = workouts.data?.[0]
  const prs = last ? (personalRecords(workouts.data!).get(last.id)?.size ?? 0) : 0

  const moveDetail = planName ? `${planName}${done ? ' done' : ' to do'}` : restDay ? 'Rest day' : done ? 'Workout done' : 'No workout yet'
  const unlock = goals ? unlockGoals(goals, day) : []
  const met = unlock.filter((g) => g.met).length
  const rings = [
    { label: 'Move', value: done || restDay ? 1 : 0, color: RING.move, detail: moveDetail, to: '/workouts' },
    { label: 'Eat', value: budget ? eaten / budget : 0, color: RING.eat, detail: goals ? `${formatKcal(eaten)} of ${formatKcal(budget)} kcal` : 'Set your goals', to: '/calories' },
    {
      label: 'Unlock',
      value: unlock.length ? met / unlock.length : 0,
      color: RING.unlock,
      to: '/timeout',
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
      {/* Can't reach Forge with nothing saved on the phone: say so, rather than look like a brand-new account. */}
      {/* First visit (nothing remembered yet): hold the Welcome card's place while the profile loads. */}
      <Status error={failure(profile) ?? failure(workouts)} loading={profile.data === undefined} rows={1} onRetry={retry} />
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
          <ul className="min-w-0 flex-1 space-y-1">
            {rings.map((ring) => (
              <li key={ring.label}>
                <Link to={ring.to} className="-mx-2 block rounded-lg px-2 py-0.5 active:bg-fill">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    <span className="size-2.5 rounded-full" style={{ background: ring.color }} aria-hidden />
                    {ring.label}
                  </span>
                  <span className="block truncate pl-[18px] text-[15px] text-muted">{ring.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <TodayWorkoutCard quiet={goals === null} />
      <HabitsCard />
      <RecoveryCard />

      <div className="grid grid-cols-2 gap-3">
        <Card to="/calories">
          <p className="text-[13px] font-semibold text-muted uppercase">Calories</p>
          {typeof left === 'number' ? (
            <>
              <p className="mt-1 text-[28px] leading-tight font-bold">{formatKcal(Math.abs(left))}</p>
              <p className={`text-[15px] ${left < 0 ? 'text-amber-ink' : 'text-muted'}`}>{left < 0 ? 'over today' : 'left today'}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-[28px] leading-tight font-bold">{formatKcal(eaten)}</p>
              <p className="text-[15px] text-muted">eaten today</p>
            </>
          )}
        </Card>
        {/* The whole tile logs your weight; the + only says so. */}
        <Card onClick={() => setWeighing(true)}>
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-semibold text-muted uppercase">Weight</p>
            <Icon name="plus" className="size-5 text-coral-ink" />
          </div>
          <p className="mt-3 text-[28px] leading-tight font-bold">{latestWeighIn ? formatWeight(latestWeighIn.weight) : '–'}</p>
          <p className="text-[15px] text-muted">{latestWeighIn ? `lb · ${dayLabel(latestWeighIn.date, today)}` : 'Tap to log'}</p>
          {change !== undefined && (
            <p className="text-[13px] text-muted">
              {change > 0 ? '+' : change < 0 ? '−' : '±'}
              {formatWeight(Math.abs(change))} lb in a week
            </p>
          )}
          {latestWeighIn && goals?.goalWeight && <p className="text-[13px] text-muted">{toGo(latestWeighIn.weight, goals.goalWeight)}</p>}
        </Card>
      </div>

      {last && (
        <>
          <SectionTitle title="Recent" />
          <Group>
            <WorkoutRow workout={last} prs={prs} />
          </Group>
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

/** "8 lb to go", or "At your goal" within half a pound. */
const toGo = (weight: number, goal: number) => (Math.abs(goal - weight) < 0.5 ? 'At your goal' : `${formatWeight(Math.round(Math.abs(goal - weight) * 10) / 10)} lb to go`)
