// Days as "YYYY-MM-DD" in your own time zone: the food log, weigh-ins, and the weekly plan all count by local day.

const pad = (n: number) => String(n).padStart(2, '0')

/** The local day `date` falls on: "2026-10-10". */
export const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** The local time of day `date` falls at, as a time field holds it: "18:05". */
export const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** The moment a local day and time ("18:05") stand for. Invalid Date when either is empty. */
export const parseDateTime = (day: string, time: string) => new Date(`${day}T${time}`) // no "Z": local time

/** Local midnight of a "YYYY-MM-DD" day. */
export function parseDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** The day `days` after (or, negative, before) `day`. Safe across daylight saving: it moves by calendar days. */
export function addDays(day: string, days: number): string {
  const date = parseDate(day)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

/** The first day of `day`'s month, or of the month `months` after (or, negative, before) it: "2026-10-01". */
export function monthStart(day: string, months = 0): string {
  const date = parseDate(day)
  return localDate(new Date(date.getFullYear(), date.getMonth() + months, 1))
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (day: string) => parseDate(day).getDay()

/** The local day a workout counts toward: the day it started. */
export const workoutDay = (workout: { startedAt: string }) => localDate(new Date(workout.startedAt))

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The week Monday first, like most training plans: [1, 2, 3, 4, 5, 6, 0]. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0]

/** "Today", "Yesterday", "Tomorrow", or "Sat, Oct 10". */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Today'
  if (day === addDays(today, -1)) return 'Yesterday'
  if (day === addDays(today, 1)) return 'Tomorrow'
  return parseDate(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
