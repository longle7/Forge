import type { PlanDay, Workout } from './api'
import { weekday, workoutDay } from './dates'

/** The plan for a day: its weekday's planned workout, or undefined on a rest day. */
export const planFor = (plan: PlanDay[] | undefined, day: string) => plan?.find((p) => p.dayOfWeek === weekday(day))

/** You have a weekly plan, and `day` isn't in it. */
export const isRestDay = (plan: PlanDay[] | undefined, day: string) => !!plan?.length && !planFor(plan, day)

/** Whether you finished a workout on `day`. */
export const workedOut = (workouts: Workout[] | undefined, day: string) => (workouts ?? []).some((w) => workoutDay(w) === day)
