import type { Habit } from './api'
import { addDays, localDate, weekday } from './dates'

export const EVERY_DAY = 127

/** Whether a habit is for that day: one of its weekdays, and not before it was made. */
export const scheduledOn = (habit: Habit, day: string) => (habit.days & (1 << weekday(day))) !== 0 && day >= localDate(new Date(habit.createdAt))

/** How many times it was done that day. */
export const countOn = (habit: Habit, day: string) => habit.checks.find((c) => c.date === day)?.count ?? 0

export const doneOn = (habit: Habit, day: string) => countOn(habit, day) >= habit.dailyTarget

/**
 * Scheduled days in a row it was done, counting back from today. Today only adds once it's done (it isn't missed
 * yet); days it isn't scheduled are skipped, never break it.
 */
export function habitStreak(habit: Habit, today: string): number {
  let count = 0
  const start = localDate(new Date(habit.createdAt))
  for (let day = today; day >= start; day = addDays(day, -1)) {
    if (!scheduledOn(habit, day)) continue
    if (doneOn(habit, day)) count++
    else if (day !== today) break
  }
  return count
}

/** The active habits for today, and how many are done. */
export function today(habits: Habit[] | undefined, day: string) {
  const due = (habits ?? []).filter((h) => !h.archived && scheduledOn(h, day))
  return { due, done: due.filter((h) => doneOn(h, day)).length }
}

/** Days it was done of the days it was scheduled, from `from` through `to` (today counts only once done). */
export function completion(habit: Habit, from: string, to: string): { done: number; scheduled: number } {
  let done = 0
  let scheduled = 0
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!scheduledOn(habit, day)) continue
    const hit = doneOn(habit, day)
    if (day === to && !hit) continue
    scheduled++
    if (hit) done++
  }
  return { done, scheduled }
}

/** "Every day", "Weekdays", "Weekends", or "Mon, Wed, Fri". */
export function daysLabel(days: number): string {
  if ((days & EVERY_DAY) === EVERY_DAY) return 'Every day'
  if (days === 0b0111110) return 'Weekdays'
  if (days === 0b1000001) return 'Weekends'
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].filter((_, i) => days & (1 << i)).join(', ')
}

/** Ideas for a first habit. */
export const SUGGESTIONS: { name: string; emoji: string; dailyTarget: number }[] = [
  { name: 'Water', emoji: '💧', dailyTarget: 8 },
  { name: '10k steps', emoji: '👟', dailyTarget: 1 },
  { name: 'Stretch', emoji: '🧘', dailyTarget: 1 },
  { name: 'Read', emoji: '📖', dailyTarget: 1 },
  { name: 'Sleep by 11', emoji: '🌙', dailyTarget: 1 },
  { name: 'Vitamins', emoji: '💊', dailyTarget: 1 },
]
