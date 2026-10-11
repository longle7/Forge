import type { Profile } from './api'
import { plural } from './workouts'

/** What today looks like, as far as Time Out's goals go. */
export interface TodaySoFar {
  planName: string | undefined // today's planned workout, if any
  restDay: boolean // you have a weekly plan, and today isn't in it
  workedOut: boolean
  meals: number // breakfast, lunch, dinner, and snacks with something logged
  weighedIn: boolean
  habitsDue?: number // habits scheduled today
  habitsDone?: number
}

export interface UnlockGoal {
  id: 'workout' | 'meals' | 'weighIn' | 'habits'
  label: string
  met: boolean
}

type Rules = Pick<Profile, 'unlockAfterWorkout' | 'unlockAfterMeals' | 'unlockAfterWeighIn' | 'unlockAfterHabits'>

/**
 * Today's Time Out goals: what has to be done before your chosen apps unlock. A rest day counts as a done workout;
 * with no weekly plan at all, any workout counts.
 */
export function unlockGoals(rules: Rules, today: TodaySoFar): UnlockGoal[] {
  const goals: UnlockGoal[] = []
  if (rules.unlockAfterWorkout) {
    goals.push(
      today.restDay
        ? { id: 'workout', label: 'Rest day: no workout needed', met: true }
        : { id: 'workout', label: today.planName ? `Finish ${today.planName}` : 'Work out', met: today.workedOut },
    )
  }
  if (rules.unlockAfterMeals > 0) {
    const n = rules.unlockAfterMeals
    goals.push({ id: 'meals', label: `Log ${plural(n, 'meal')} (${Math.min(today.meals, n)} of ${n})`, met: today.meals >= n })
  }
  if (rules.unlockAfterWeighIn) goals.push({ id: 'weighIn', label: 'Weigh in', met: today.weighedIn })
  if (rules.unlockAfterHabits) {
    const [done, due] = [today.habitsDone ?? 0, today.habitsDue ?? 0]
    goals.push(due === 0 ? { id: 'habits', label: 'No habits due today', met: true } : { id: 'habits', label: `Finish today's habits (${done} of ${due})`, met: done >= due })
  }
  return goals
}

/** Unlocked when every goal is met (with no goals, nothing is locked). */
export const isUnlocked = (goals: UnlockGoal[]) => goals.every((g) => g.met)
