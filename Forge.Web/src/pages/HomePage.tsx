import { useState } from 'react'
import { Link } from 'react-router'
import { foodLogPath, getExercises, getFoodLog, getHabits, getPlan, getProfile, getWeighIns, getWorkouts } from '../api'
import { Card, Page, PrBadge, primaryButton, Rings, SectionTitle, Status } from '../components'
import { dayLabel, localDate, workoutDay } from '../dates'
import { RING } from '../colors'
import { Icon } from '../icons'
import { HabitsCard } from '../HabitsCard'
import { dayGoals, exerciseCalories, formatKcal, remaining, totals, weekChange, weightOn } from '../nutrition'
import { isUnlocked, todaySoFar, unlockGoals } from '../timeout'
import { failure, useNow, usePolling } from '../usePolling'
import { WeighInSheet } from '../WeighInSheet'
import { formatDay, formatDuration, formatWeight, groupSets, personalRecords, plural, workoutLength, workoutTotals } from '../workouts'
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
  const [weighing, setWeighing] = useState(false)
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))

  const goals = profile.data
  const day = todaySoFar({ plan: plan.data, workouts: workouts.data, food: food.data, weighIns: weighIns.data, habits: habits.data }, today)
  const { planName, restDay, workedOut: done } = day
  const eaten = totals(food.data ?? []).calories
  const weight = weightOn(weighIns.data, today, goals?.startWeight ?? 0)
  const exercise = (workouts.data ?? []).filter((w) => workoutDay(w) === today).reduce((sum, w) => sum + exerciseCalories(w, weight, names), 0)
  const dayGoal = goals && dayGoals(goals, restDay)
  const budget = dayGoal ? dayGoal.calories + exercise : 0
  const left = dayGoal && remaining(dayGoal.calories, eaten, exercise)
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
      <Status error={failure(profile) ?? failure(workouts)} loading={profile.data === undefined} rows={1} />
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
        <Card>
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-semibold text-muted uppercase">Weight</p>
            <button onClick={() => setWeighing(true)} aria-label="Log weight" className="-mt-2 -mr-2 grid size-10 place-items-center rounded-full text-coral-ink active:bg-fill">
              <Icon name="plus" className="size-5" />
            </button>
          </div>
          <p className="text-[28px] leading-tight font-bold">{latestWeighIn ? formatWeight(latestWeighIn.weight) : '–'}</p>
          <p className="text-[15px] text-muted">{latestWeighIn ? `lb · ${dayLabel(latestWeighIn.date, today)}` : 'Tap + to log'}</p>
          {change !== undefined && (
            <p className="text-[13px] text-muted">
              {change > 0 ? '+' : change < 0 ? '−' : '±'}
              {formatWeight(Math.abs(change))} lb in a week
            </p>
          )}
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
              {[formatDay(last.startedAt), formatDuration(workoutLength(last)), plural(groupSets(last.sets).length, 'exercise'), workoutTotals(last)].filter(Boolean).join(' · ')}
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
