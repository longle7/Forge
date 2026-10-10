import type { PlanDay, Workout } from './api'
import { weekday, workoutDay } from './dates'

/** The plan for a day: its weekday's planned workout, or undefined on a rest day. */
export const planFor = (plan: PlanDay[] | undefined, day: string) => plan?.find((p) => p.dayOfWeek === weekday(day))

/** Whether you finished a workout on `day`. */
export const workedOut = (workouts: Workout[] | undefined, day: string) => (workouts ?? []).some((w) => workoutDay(w) === day)
