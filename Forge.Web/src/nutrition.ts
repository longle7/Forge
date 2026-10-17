import type { Activity, DayTotals, Goal, Nutrition, PlanDay, Profile, Sex, WeighIn, Workout } from './api'
import { addDays, parseDate } from './dates'
import { isRestDay } from './plan'
import { isCardioSet } from './workouts'

/**
 * How active you are outside workouts. Workouts aren't part of this: their calories are added back separately
 * (Goal − Food + Exercise), so counting them here too would count them twice.
 */
export const ACTIVITY: Record<Activity, { factor: number; label: string; detail: string }> = {
  sedentary: { factor: 1.2, label: 'Mostly sitting', detail: 'Desk job, not much walking' },
  light: { factor: 1.375, label: 'Lightly active', detail: 'On your feet part of the day' },
  active: { factor: 1.55, label: 'Active', detail: 'On your feet most of the day' },
  'very-active': { factor: 1.725, label: 'Very active', detail: 'A physical job' },
}

export interface GoalInputs {
  sex: Sex
  birthYear: number
  heightIn: number
  weight: number // pounds
  activity: Activity
  goal: Goal
  pace: number // pounds a week
}

const KG_PER_LB = 0.45359237

/** Calories your body burns a day at rest: Mifflin-St Jeor, the formula most dietitians use. */
export function restingCalories(sex: Sex, weightLb: number, heightIn: number, age: number): number {
  return 10 * weightLb * KG_PER_LB + 6.25 * heightIn * 2.54 - 5 * age + (sex === 'male' ? 5 : -161)
}

/** The lowest daily goal Forge suggests: below it, getting enough nutrition is hard without a doctor's help. */
const calorieFloor = (sex: Sex) => (sex === 'male' ? 1500 : 1200)

/**
 * Daily goals: maintenance (resting × activity), then ±500 kcal for each pound a week to lose or gain, rounded to 10
 * and never below a safe floor (1,500 kcal for men, 1,200 for women). Protein 0.9 g per pound (counted up to 220 lb,
 * so it stays reasonable at higher weights), fat 30% of calories, carbs the rest.
 */
export function calculateGoals(inputs: GoalInputs, year: number): Nutrition & { maintenance: number } {
  const age = year - inputs.birthYear
  const maintenance = Math.round(restingCalories(inputs.sex, inputs.weight, inputs.heightIn, age) * ACTIVITY[inputs.activity].factor)
  const change = inputs.goal === 'maintain' ? 0 : (inputs.goal === 'lose' ? -500 : 500) * inputs.pace
  const calories = Math.max(calorieFloor(inputs.sex), Math.round((maintenance + change) / 10) * 10)
  const protein = Math.round(Math.min(inputs.weight, 220) * 0.9)
  const fat = Math.round((calories * 0.3) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { maintenance, calories, protein, carbs, fat }
}

/** Cardio by name: its MET at a typical pace, and that pace in mph (Compendium of Physical Activities). */
const CARDIO = [
  { match: /run|jog/i, met: 9.8, mph: 6 },
  { match: /walk|hik/i, met: 3.5, mph: 3 },
  { match: /cycl|bik|spin/i, met: 7.5, mph: 12 },
  { match: /row/i, met: 7, mph: 7.5 },
  { match: /ellip/i, met: 5, mph: 5 },
]
const OTHER_CARDIO = { met: 6, mph: 5 }

/**
 * Calories a workout burned, estimated as MET × body weight in kg × hours.
 * - Cardio sets: the activity's MET, scaled with your speed when the set has a distance and a time (at most double);
 *   a set with only a distance takes the typical pace's time.
 * - The rest of the workout: strength training at MET 3.5 (moderate, rests included), counting at most 2.5 hours.
 * On the low side on purpose, so eating them back doesn't undo a deficit. Apple Health's real numbers replace this in
 * the iPhone app.
 */
export function exerciseCalories(workout: Workout, weightLb: number, names: Map<number, string>): number {
  const kg = weightLb * KG_PER_LB
  let cardioHours = 0
  let cardio = 0
  for (const set of workout.sets.filter(isCardioSet)) {
    const { met, mph } = CARDIO.find((c) => c.match.test(names.get(set.exerciseId) ?? '')) ?? OTHER_CARDIO
    const hours = set.durationSeconds ? set.durationSeconds / 3600 : (set.distance ?? 0) / mph
    const speed = set.distance && set.durationSeconds ? set.distance / hours : mph
    cardio += (1 + (met - 1) * Math.min(2, speed / mph)) * kg * hours
    cardioHours += hours
  }
  const hours = Math.min(2.5, Math.max(0, Date.parse(workout.finishedAt) - Date.parse(workout.startedAt)) / 3_600_000)
  return Math.round(cardio + 3.5 * kg * Math.max(0, hours - cardioHours))
}

/**
 * A day's goals: your goals, less your rest-day calories on a rest day in your weekly plan. They come off carbs;
 * protein and fat stay.
 */
export function dayGoals(profile: Profile, restDay: boolean): Nutrition {
  const adjust = restDay ? (profile.restDayCalorieAdjust ?? 0) : 0
  return { calories: profile.calorieGoal + adjust, protein: profile.proteinGoal, carbs: Math.max(0, profile.carbsGoal + Math.round(adjust / 4)), fat: profile.fatGoal }
}

/** Your weight on a day: the latest weigh-in on or before it, else `fallback` (the weight you set your goals with). */
export function weightOn(weighIns: WeighIn[] | undefined, day: string, fallback: number): number {
  let weight = fallback
  for (const w of weighIns ?? []) if (w.date <= day) weight = w.weight // oldest first, so the last match is the latest
  return weight
}

/**
 * Change from a week before your latest weigh-in (to the latest one on or before that day), rounded to 0.1 lb; undefined
 * without one that old.
 */
export function weekChange(weighIns: WeighIn[] | undefined): number | undefined {
  const latest = weighIns?.at(-1)
  if (!latest) return undefined
  const before = weighIns!.findLast((w) => w.date <= addDays(latest.date, -7))
  return before && Math.round((latest.weight - before.weight) * 10) / 10
}

/** Totals for food entries (each one's nutrition × its servings). */
export function totals(entries: (Nutrition & { servings: number })[]): Nutrition {
  return entries.reduce(
    (sum, e) => ({
      calories: sum.calories + e.calories * e.servings,
      protein: sum.protein + e.protein * e.servings,
      carbs: sum.carbs + e.carbs * e.servings,
      fat: sum.fat + e.fat * e.servings,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

/** Calories left today: Goal − Food + Exercise (negative when over). */
export const remaining = (goal: number, food: number, exercise: number) => Math.round(goal - food + exercise)

const kcal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/** "1,240" */
export const formatKcal = (calories: number) => kcal.format(Math.round(calories))

/** "1 cup", or "2 × 1 cup" */
export const servingLabel = (food: { serving: string; servings: number }) => (food.servings === 1 ? food.serving : `${food.servings} × ${food.serving}`)

const DAY_MS = 86_400_000
const dayNumber = (day: string) => Math.round(parseDate(day).getTime() / DAY_MS)

/**
 * Your weight trend in pounds a week (negative = losing): the least-squares slope through your weigh-ins in the `days`
 * up to `today`, so one heavy morning doesn't swing it. Undefined with fewer than 2 weigh-ins, or under a week apart.
 */
export function weightTrend(weighIns: WeighIn[] | undefined, today: string, days = 28): number | undefined {
  const since = addDays(today, -(days - 1))
  const points = (weighIns ?? []).filter((w) => w.date >= since && w.date <= today).map((w) => ({ x: dayNumber(w.date), y: w.weight }))
  if (points.length < 2 || points.at(-1)!.x - points[0].x < 7) return undefined
  const mx = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const my = points.reduce((sum, p) => sum + p.y, 0) / points.length
  const slope = points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0)
  return slope * 7
}

/** Your planned change in pounds a week from your goal and pace: −1 to lose a pound a week. */
export const plannedTrend = (profile: Profile) => (profile.goal === 'lose' ? -profile.pace : profile.goal === 'gain' ? profile.pace : 0)

/**
 * The day you'd reach `goal` from `current` at `lbPerWeek`: `today` once you're within half a pound, undefined when
 * that pace isn't heading there (or would take over two years).
 */
export function goalEta(current: number, goal: number, lbPerWeek: number | undefined, today: string): string | undefined {
  const toGo = goal - current
  if (Math.abs(toGo) < 0.5) return today
  if (!lbPerWeek || Math.sign(lbPerWeek) !== Math.sign(toGo)) return undefined
  const days = Math.ceil((toGo / lbPerWeek) * 7)
  return days <= 730 ? addDays(today, days) : undefined
}

/**
 * How well the days you logged food before `today` matched your goals: on target when calories are within 10% of
 * that day's goal (rest days have their own, see dayGoals), and protein hit at 90% of its goal or more. `streak`:
 * on-target days in a row up to yesterday. Today is still going, so it doesn't count yet.
 */
export function calorieAdherence(days: DayTotals[], profile: Profile, plan: PlanDay[] | undefined, today: string): { logged: number; onTarget: number; protein: number; streak: number } {
  const logged = days.filter((d) => d.date < today && d.calories > 0)
  const goals = (day: string) => dayGoals(profile, isRestDay(plan, day))
  const hit = (d: DayTotals) => Math.abs(d.calories - goals(d.date).calories) <= goals(d.date).calories * 0.1
  const onTarget = new Set(logged.filter(hit).map((d) => d.date))
  let streak = 0
  while (onTarget.has(addDays(today, -(streak + 1)))) streak++
  return { logged: logged.length, onTarget: onTarget.size, protein: logged.filter((d) => d.protein >= goals(d.date).protein * 0.9).length, streak }
}

/**
 * The calorie goal your own numbers point to: over the 3 weeks before today, your maintenance is about what you ate on
 * average less your weight change (3,500 kcal a pound), then your goal's deficit or surplus is applied (500 kcal a day
 * per pound a week). Undefined until you've logged food on 14 of those days with a weight trend, or when it's within
 * 75 kcal of your goal already.
 * ponytail: days you logged only part of what you ate pull the average down; a "this day is complete" mark would fix it.
 */
export function adaptiveCalories(days: DayTotals[], weighIns: WeighIn[] | undefined, profile: Profile, today: string):
  { average: number; trend: number; maintenance: number; suggested: number } | undefined {
  const since = addDays(today, -21)
  const logged = days.filter((d) => d.date >= since && d.date < today && d.calories > 0)
  const trend = weightTrend(weighIns, addDays(today, -1), 21)
  if (logged.length < 14 || trend === undefined) return undefined
  const average = logged.reduce((sum, d) => sum + d.calories, 0) / logged.length
  const maintenance = Math.round(average - (trend / 7) * 3500)
  const suggested = Math.max(calorieFloor(profile.sex), Math.round((maintenance + plannedTrend(profile) * 500) / 10) * 10)
  return Math.abs(suggested - profile.calorieGoal) < 75 ? undefined : { average: Math.round(average), trend, maintenance, suggested }
}
