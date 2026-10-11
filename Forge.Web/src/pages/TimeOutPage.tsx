import { useState } from 'react'
import { Link } from 'react-router'
import { foodLogPath, getFoodLog, getHabits, getPlan, getProfile, getWeighIns, getWorkouts, saveProfile, type Profile } from '../api'
import { Card, Group, Notice, Page, primaryButton, Status, Stepper, Switch } from '../components'
import { localDate } from '../dates'
import { today as habitsToday } from '../habits'
import { Icon } from '../icons'
import { planFor, workedOut } from '../plan'
import { isUnlocked, unlockGoals, type TodaySoFar } from '../timeout'
import { failure, useNow, usePolling } from '../usePolling'

/**
 * The Time Out tab: the goals that unlock your chosen apps each day, and where today stands. Blocking itself needs
 * Apple's Screen Time, which only an iPhone app can use; the goals and status work now.
 */
export default function TimeOutPage() {
  const today = localDate(useNow(60_000))
  const profile = usePolling(getProfile, '/profile')
  const workouts = usePolling(getWorkouts, '/workouts')
  const plan = usePolling(getPlan, '/plan')
  const food = usePolling(() => getFoodLog(today), foodLogPath(today))
  const weighIns = usePolling(getWeighIns, '/weigh-ins')
  const habits = usePolling(getHabits, '/habits')
  // Changes show at once and save in the background; quick taps build on each other, not on the last saved copy.
  const [edits, setEdits] = useState<Partial<Profile>>({})
  const [message, setMessage] = useState<string>()

  if (profile.data === null) {
    return (
      <Page title="Time Out">
        <Card>
          <p className="font-semibold">Time Out works with your goals</p>
          <p className="text-[15px] text-muted">Set up your goals first, then choose what earns your scroll time each day.</p>
          <Link to="/setup" className={`mt-3 ${primaryButton}`}>
            Set Your Goals
          </Link>
        </Card>
      </Page>
    )
  }
  if (!profile.data) {
    return (
      <Page title="Time Out">
        <Status loading={!profile.error} error={failure(profile)} rows={3} />
      </Page>
    )
  }

  const rules = { ...profile.data, ...edits }
  const planned = planFor(plan.data, today)
  const day: TodaySoFar = {
    planName: planned?.name,
    restDay: !planned && (plan.data?.length ?? 0) > 0,
    workedOut: workedOut(workouts.data, today),
    meals: new Set((food.data ?? []).map((e) => e.meal)).size,
    weighedIn: (weighIns.data ?? []).some((w) => w.date === today),
    habitsDue: habitsToday(habits.data, today).due.length,
    habitsDone: habitsToday(habits.data, today).done,
  }
  const goals = unlockGoals(rules, day)
  const unlocked = isUnlocked(goals)

  const change = async (update: Partial<Profile>) => {
    setEdits((current) => ({ ...current, ...update }))
    setMessage(undefined)
    try {
      await saveProfile({ ...rules, ...update })
    } catch (e) {
      setMessage(`Couldn't save that: ${(e as Error).message}`)
      setEdits({})
      profile.reload()
    }
  }

  return (
    <Page title="Time Out">
      <Card>
        <div className="flex items-center gap-4">
          <span className={`grid size-14 shrink-0 place-items-center rounded-full ${unlocked ? 'bg-green/15 text-green-ink' : 'bg-coral/12 text-coral-ink'}`}>
            <Icon name={unlocked ? 'unlock' : 'lock'} className="size-7" />
          </span>
          <div>
            <p className="text-[22px] font-bold">{unlocked ? 'Unlocked' : 'Locked'}</p>
            <p className="text-[15px] text-muted">
              {goals.length === 0 ? 'Choose goals below to earn your scroll time.' : unlocked ? "Today's goals are done. Enjoy your scroll time." : 'Your chosen apps open once these are done.'}
            </p>
          </div>
        </div>
        {goals.length > 0 && (
          <ul className="mt-4 space-y-2">
            {goals.map((goal) => (
              <li key={goal.id} className="flex items-center gap-3">
                <span className={`grid size-6 place-items-center rounded-full ${goal.met ? 'bg-green-strong text-white' : 'border-2 border-line'}`}>
                  {goal.met && <Icon name="check" className="size-4 stroke-[3]" />}
                </span>
                <span className={goal.met ? 'text-muted line-through decoration-muted/50' : ''}>{goal.label}</span>
                <span className="sr-only">{goal.met ? '(done)' : '(not yet)'}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Group title="Unlock goals" footer="Each day, your chosen apps stay locked until these are done. A run or other cardio counts as a workout, and so does a rest day in your plan.">
        <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
          <span className="flex-1">Finish today's workout</span>
          <Switch checked={rules.unlockAfterWorkout} onChange={(on) => change({ unlockAfterWorkout: on })} label="Finish today's workout" />
        </div>
        <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
          <span className="flex-1">
            Log meals
            <span className="block text-[15px] text-muted">{rules.unlockAfterMeals ? `At least ${rules.unlockAfterMeals}` : 'Off'}</span>
          </span>
          <Stepper value={rules.unlockAfterMeals} onChange={(n) => change({ unlockAfterMeals: n })} min={0} max={4} label="meals to log" />
        </div>
        <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
          <span className="flex-1">Weigh in</span>
          <Switch checked={rules.unlockAfterWeighIn} onChange={(on) => change({ unlockAfterWeighIn: on })} label="Weigh in" />
        </div>
        <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
          <span className="flex-1">
            Finish today's habits
            <span className="block text-[15px] text-muted">Every habit due today</span>
          </span>
          <Switch checked={rules.unlockAfterHabits ?? false} onChange={(on) => change({ unlockAfterHabits: on })} label="Finish today's habits" />
        </div>
      </Group>
      {message && <Notice>{message}</Notice>}

      <Group
        title="Apps to lock"
        footer="Locking apps uses Apple's Screen Time, which only iPhone apps can use. In the Forge iPhone app you'll choose apps like Instagram here, and they'll stay locked until your goals are met."
      >
        <div className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-muted">
          <span className="grid size-8 place-items-center rounded-lg bg-fill">
            <Icon name="lock" className="size-5" />
          </span>
          <span className="flex-1">Choose apps</span>
          <span className="text-[15px]">In the iPhone app</span>
        </div>
      </Group>
    </Page>
  )
}
