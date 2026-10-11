import type { Activity, Goal, Nutrition, Profile, Sex, WeighIn, Workout } from './api'
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

/**
 * Daily goals: maintenance (resting × activity), then ±500 kcal for each pound a week to lose or gain, rounded to 10
 * and never below a safe floor (1,500 kcal for men, 1,200 for women). Protein 0.9 g per pound (counted up to 220 lb,
 * so it stays reasonable at higher weights), fat 30% of calories, carbs the rest.
 */
export function calculateGoals(inputs: GoalInputs, year: number): Nutrition & { maintenance: number } {
  const age = year - inputs.birthYear
  const maintenance = Math.round(restingCalories(inputs.sex, inputs.weight, inputs.heightIn, age) * ACTIVITY[inputs.activity].factor)
  const change = inputs.goal === 'maintain' ? 0 : (inputs.goal === 'lose' ? -500 : 500) * inputs.pace
  const calories = Math.max(inputs.sex === 'male' ? 1500 : 1200, Math.round((maintenance + change) / 10) * 10)
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
