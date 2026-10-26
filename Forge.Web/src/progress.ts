import type { DayTotals, PlanDay, Workout } from './api'
import { addDays, localDate, parseDate, weekday, workoutDay } from './dates'
import { planFor } from './plan'
import { isLift, oneRepMax } from './workouts'

/** The day the plan started counting: when its first weekday was planned. Undefined with no plan. */
export const planStart = (plan: PlanDay[]) => (plan.length ? localDate(new Date(Math.min(...plan.map((p) => Date.parse(p.createdAt))))) : undefined)

/**
 * Every planned day from `from` (or the plan's start, if later) through today, and whether you trained that day.
 * Today counts only once it's done: it isn't missed yet.
 * ponytail: past weeks are judged by today's weekly plan; keep plan history if changing plans should rewrite less.
 */
export function plannedDays(plan: PlanDay[], workouts: Workout[], from: string, today: string): { day: string; done: boolean }[] {
  const start = planStart(plan)
  if (!start) return []
  const trained = new Set(workouts.map(workoutDay))
  const days: { day: string; done: boolean }[] = []
  for (let day = from > start ? from : start; day <= today; day = addDays(day, 1)) {
    if (!planFor(plan, day)) continue
    const done = trained.has(day)
    if (day === today && !done) continue
    days.push({ day, done })
  }
  return days
}

/** The share (0–1) of planned days you trained on; undefined when none were planned yet. */
export const adherence = (days: { done: boolean }[]) => (days.length ? days.filter((d) => d.done).length / days.length : undefined)

/** Planned days in a row you trained on, counting back from today. Rest days don't break it. */
export function streak(plan: PlanDay[], workouts: Workout[], today: string): number {
  const days = plannedDays(plan, workouts, '0000-01-01', today)
  let count = 0
  for (let i = days.length - 1; i >= 0 && days[i].done; i--) count++
  return count
}

export type DayStatus = 'done' | 'missed' | 'planned' | 'rest' | 'extra' | 'none'

/**
 * The last `weeks` weeks, Monday first, each day's status: done (trained on a planned day), missed (a planned day that
 * passed without a workout), planned (today or ahead), rest, extra (trained on a rest day), or none (before the plan).
 */
export function weekStatuses(plan: PlanDay[], workouts: Workout[], today: string, weeks = 4): { day: string; status: DayStatus }[][] {
  const start = planStart(plan)
  const trained = new Set(workouts.map(workoutDay))
  const monday = addDays(today, -((weekday(today) + 6) % 7) - 7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(monday, w * 7 + d)
      const planned = planFor(plan, day)
      const status: DayStatus =
        !start || day < start ? 'none'
        : planned && trained.has(day) ? 'done'
        : planned && day >= today ? 'planned'
        : planned ? 'missed'
        : trained.has(day) ? 'extra'
        : 'rest'
      return { day, status }
    }),
  )
}

/** The exercises you've trained most often with weight (by number of workouts), most first. */
export function topLifts(workouts: Workout[], count = 3): number[] {
  const seen = new Map<number, number>()
  for (const workout of workouts) {
    for (const id of new Set(workout.sets.filter(isLift).map((s) => s.exerciseId))) seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  return [...seen].sort((a, b) => b[1] - a[1]).slice(0, count).map(([id]) => id)
}

/** An exercise's best estimated 1RM in each workout from `from` on, oldest first. */
export function strengthSeries(workouts: Workout[], exerciseId: number, from: string): { day: string; value: number }[] {
  return workouts
    .filter((w) => workoutDay(w) >= from)
    .map((w) => ({ day: workoutDay(w), value: Math.max(0, ...w.sets.filter((s) => s.exerciseId === exerciseId && isLift(s)).map((s) => oneRepMax(s.weight, s.reps))) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

export type Bucket = 'day' | 'week' | 'month'

/**
 * Calories per day, or averaged per week or month (over the days something was logged), from `from` through `to`.
 * A period with nothing logged has no value: an empty bar, not a zero.
 */
export function calorieBars(days: DayTotals[], from: string, to: string, bucket: Bucket): { start: string; value: number | undefined }[] {
  const byDay = new Map(days.map((d) => [d.date, d.calories]))
  const bars: { start: string; values: number[] }[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const key = bucket === 'day' ? day : bucket === 'week' ? addDays(day, -((weekday(day) + 6) % 7)) : `${day.slice(0, 7)}-01`
    if (bars.at(-1)?.start !== key) bars.push({ start: key, values: [] })
    const value = byDay.get(day)
    if (value !== undefined) bars.at(-1)!.values.push(value)
  }
  return bars.map((b) => ({ start: b.start < from ? from : b.start, value: b.values.length ? b.values.reduce((s, v) => s + v, 0) / b.values.length : undefined }))
}

/** Round axis values from just below min to just above max, about `steps` apart: 0–2,400 → [0, 1000, 2000, 3000]. */
export function niceTicks(min: number, max: number, steps = 3): number[] {
  if (max - min < 1e-9) {
    min -= 1
    max += 1
  }
  const rough = (max - min) / steps
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!
  const ticks: number[] = []
  for (let t = Math.floor(min / step) * step; ; t += step) {
    ticks.push(Number(t.toFixed(6)))
    if (t >= max - 1e-9) break
  }
  return ticks
}

/** "Oct 10", or "Oct" for a month. */
export const shortDate = (day: string, bucket: Bucket = 'day') =>
  parseDate(day).toLocaleDateString(undefined, bucket === 'month' ? { month: 'short' } : { month: 'short', day: 'numeric' })
