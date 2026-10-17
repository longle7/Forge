import { describe, expect, it } from 'vitest'
import type { DayTotals, PlanDay, Profile, Workout, WorkoutSet } from './api'
import { addDays } from './dates'
import {
  adaptiveCalories,
  calculateGoals,
  calorieAdherence,
  dayBudget,
  dayGoals,
  exerciseCalories,
  goalEta,
  microTotals,
  optionalNumber,
  remaining,
  restingCalories,
  suggestedMicros,
  totals,
  weekChange,
  weightOn,
  weightTrend,
  type GoalInputs,
} from './nutrition'

const him: GoalInputs = { sex: 'male', birthYear: 1994, heightIn: 70, weight: 185.4, activity: 'light', goal: 'lose', pace: 1 }

describe('calculateGoals', () => {
  it('works out maintenance, a 500 kcal deficit per pound a week, and macros', () => {
    // Resting: 10 × 84.1 kg + 6.25 × 177.8 cm − 5 × 32 + 5 ≈ 1,797; × 1.375 lightly active ≈ 2,471.
    expect(restingCalories('male', 185.4, 70, 32)).toBeCloseTo(1797.2, 0)
    expect(calculateGoals(him, 2026)).toEqual({ maintenance: 2471, calories: 1970, protein: 167, carbs: 177, fat: 66 })
  })

  it('adds calories to gain and none to maintain', () => {
    expect(calculateGoals({ ...him, goal: 'maintain' }, 2026).calories).toBe(2470)
    expect(calculateGoals({ ...him, goal: 'gain', pace: 0.5 }, 2026).calories).toBe(2720)
  })

  it('never goes below a safe floor', () => {
    const her: GoalInputs = { sex: 'female', birthYear: 1990, heightIn: 65, weight: 150, activity: 'sedentary', goal: 'lose', pace: 1.5 }
    expect(calculateGoals(her, 2026).calories).toBe(1200) // maintenance ≈ 1,646 − 750 would be 896
    expect(calculateGoals({ ...him, weight: 120, pace: 2 }, 2026).calories).toBe(1500)
  })

  it('counts protein up to 220 lb', () => {
    expect(calculateGoals({ ...him, weight: 300 }, 2026).protein).toBe(198)
  })
})

describe('exerciseCalories', () => {
  const RUNNING = 36
  const WALKING = 37
  const ELLIPTICAL = 40
  const STAIRS = 99 // your own cardio exercise
  const names = new Map([
    [RUNNING, 'Running'],
    [WALKING, 'Walking'],
    [ELLIPTICAL, 'Elliptical (Machine)'],
    [STAIRS, 'Stair Climber'],
  ])
  const workout = (minutes: number, sets: WorkoutSet[] = []): Workout => ({
    id: 'w',
    name: 'Workout',
    startedAt: '2026-10-10T21:00:00Z',
    finishedAt: new Date(Date.parse('2026-10-10T21:00:00Z') + minutes * 60_000).toISOString(),
    sets,
  })
  const cardio = (exerciseId: number, distance: number | null, durationSeconds: number | null): WorkoutSet => ({ exerciseId, weight: 0, reps: 0, distance, durationSeconds })

  it('counts strength training from the workout length, capped at 2.5 hours', () => {
    expect(exerciseCalories(workout(60), 180, names)).toBe(286) // 3.5 × 81.6 kg × 1 h
    expect(exerciseCalories(workout(300), 180, names)).toBe(exerciseCalories(workout(150), 180, names))
  })

  it('counts cardio from its own time, so a run logged afterwards counts in full', () => {
    // 3.1 mi in 27:00 is 6.9 mph, a bit quicker than running's typical 6: MET 1 + 8.8 × 6.9 / 6 ≈ 11.1, × 81.6 kg × 0.45 h.
    expect(exerciseCalories(workout(2, [cardio(RUNNING, 3.1, 1620)]), 180, names)).toBe(408)
    // A distance alone takes the typical pace's time: 2 mi of walking at 3 mph is 40 minutes at MET 3.5.
    expect(exerciseCalories(workout(1, [cardio(WALKING, 2, null)]), 180, names)).toBe(191)
    // Your own cardio exercise counts at MET 6.
    expect(exerciseCalories(workout(1, [cardio(STAIRS, null, 600)]), 180, names)).toBe(82)
  })

  it('counts the rest of a mixed workout as strength training', () => {
    // 20 minutes of elliptical (MET 5) and 40 minutes of lifting (MET 3.5): 136 + 191.
    expect(exerciseCalories(workout(60, [cardio(ELLIPTICAL, null, 1200)]), 180, names)).toBe(327)
  })

  it('caps a cardio set at double its typical pace, so a typo stays sane', () => {
    // 30 miles in 10 minutes counts as 12 mph: MET 1 + 8.8 × 2 = 18.6 for 10 minutes.
    expect(exerciseCalories(workout(1, [cardio(RUNNING, 30, 600)]), 180, names)).toBe(253)
  })
})

it('dayGoals takes rest-day calories off carbs, on rest days only', () => {
  const profile: Profile = {
    sex: 'male', birthYear: 1994, heightIn: 70, startWeight: 185, activity: 'light', goal: 'lose', pace: 1,
    calorieGoal: 2000, proteinGoal: 165, carbsGoal: 200, fatGoal: 65,
    unlockAfterWorkout: false, unlockAfterMeals: 0, unlockAfterWeighIn: false, restDayCalorieAdjust: -200,
  }
  expect(dayGoals(profile, true)).toEqual({ calories: 1800, protein: 165, carbs: 150, fat: 65 })
  expect(dayGoals(profile, false)).toEqual({ calories: 2000, protein: 165, carbs: 200, fat: 65 })
  expect(dayGoals({ ...profile, restDayCalorieAdjust: undefined }, true).calories).toBe(2000) // saved before the setting
  expect(dayGoals({ ...profile, carbsGoal: 20 }, true).carbs).toBe(0) // never below zero
})

it('weightOn uses the latest weigh-in on or before the day, else the starting weight', () => {
  const weighIns = [
    { date: '2026-10-01', weight: 186 },
    { date: '2026-10-08', weight: 184.5 },
  ]
  expect(weightOn(weighIns, '2026-10-10', 190)).toBe(184.5)
  expect(weightOn(weighIns, '2026-10-05', 190)).toBe(186)
  expect(weightOn(weighIns, '2026-09-30', 190)).toBe(190)
})

it('weekChange compares the latest weigh-in with the latest one a week or more before it', () => {
  const day = (date: string, weight: number) => ({ date, weight })
  expect(weekChange([day('2026-10-01', 186), day('2026-10-03', 185.8), day('2026-10-09', 184.6)])).toBe(-1.4) // vs Oct 1
  expect(weekChange([day('2026-10-05', 186), day('2026-10-09', 184.6)])).toBeUndefined() // nothing a week back
  expect(weekChange([])).toBeUndefined()
})

it('totals multiply by servings, and remaining is Goal − Food + Exercise', () => {
  const food = totals([
    { calories: 150, protein: 20, carbs: 9, fat: 4, servings: 2 },
    { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, servings: 1 },
  ])
  expect(food.calories).toBe(405)
  expect(food.protein).toBeCloseTo(41.3)
  expect(remaining(2150, food.calories, 286)).toBe(2031)
  expect(remaining(2000, 2300, 0)).toBe(-300)
})

const profile: Profile = {
  sex: 'male', birthYear: 1994, heightIn: 70, startWeight: 185, activity: 'light', goal: 'lose', pace: 1,
  calorieGoal: 2000, proteinGoal: 165, carbsGoal: 200, fatGoal: 65,
  unlockAfterWorkout: false, unlockAfterMeals: 0, unlockAfterWeighIn: false, restDayCalorieAdjust: -200,
}

describe('dayBudget', () => {
  const day = { profile, restDay: false, weightLb: 185, year: 2026, workoutEstimate: 286 }

  it('adds the workouts estimate to the goal without Watch data', () => {
    expect(dayBudget({ ...day, activeKcal: undefined })).toEqual({ goal: 2000, exercise: 286, label: 'Exercise' })
    expect(dayBudget({ ...day, restDay: true, activeKcal: undefined }).goal).toBe(1800)
  })

  it("adds the Watch's active calories instead, and leaves daily activity out of the goal", () => {
    // Resting ≈ 1,795; lightly active (× 1.375) less × 1.1 for digesting food: 1,795 × 0.275 ≈ 494 off 2,000.
    expect(dayBudget({ ...day, activeKcal: 640 })).toEqual({ goal: 1510, exercise: 640, label: 'Active' })
    // Mostly sitting leaves only 10% of resting out: 1,795 × 0.1 ≈ 180.
    expect(dayBudget({ ...day, profile: { ...profile, activity: 'sedentary' }, activeKcal: 640 }).goal).toBe(1820)
  })

  it('never goes below the safe floor, or below a goal you set lower', () => {
    expect(dayBudget({ ...day, restDay: true, activeKcal: 640 }).goal).toBe(1500) // 1,800 − 494 would be 1,306
    expect(dayBudget({ ...day, profile: { ...profile, calorieGoal: 1400 }, activeKcal: 640 }).goal).toBe(1400)
  })
})

describe('weightTrend', () => {
  it('is the slope through the weigh-ins, in pounds a week', () => {
    const weighIns = [
      { date: '2026-10-01', weight: 186 },
      { date: '2026-10-08', weight: 185.6 }, // a heavy morning barely moves it
      { date: '2026-10-15', weight: 184 },
    ]
    expect(weightTrend(weighIns, '2026-10-15')).toBeCloseTo(-1)
    expect(weightTrend(weighIns, '2026-10-15', 7)).toBeUndefined() // only Oct 15 in the last week
  })

  it('needs two weigh-ins at least a week apart', () => {
    expect(weightTrend([{ date: '2026-10-10', weight: 185 }], '2026-10-15')).toBeUndefined()
    expect(weightTrend([{ date: '2026-10-10', weight: 185 }, { date: '2026-10-13', weight: 184 }], '2026-10-15')).toBeUndefined()
    expect(weightTrend(undefined, '2026-10-15')).toBeUndefined()
  })
})

it('goalEta projects the day you reach your goal, only when heading toward it', () => {
  expect(goalEta(185, 175, -1, '2026-10-15')).toBe('2026-12-24') // 10 lb at 1 lb a week: 70 days
  expect(goalEta(170, 180, 0.5, '2026-10-15')).toBe('2027-03-04') // gaining 10 lb at half a pound: 140 days
  expect(goalEta(185, 175, 0.5, '2026-10-15')).toBeUndefined() // gaining, but the goal is lower
  expect(goalEta(185, 175, 0, '2026-10-15')).toBeUndefined()
  expect(goalEta(185, 175, -0.05, '2026-10-15')).toBeUndefined() // years away
  expect(goalEta(175.3, 175, -1, '2026-10-15')).toBe('2026-10-15') // there
})

it('calorieAdherence counts days within 10% of that day goal, protein, and the streak up to yesterday', () => {
  const plan: PlanDay[] = [{ dayOfWeek: 1, name: 'Push', createdAt: '2026-10-01T00:00:00Z', exercises: [] }] // Mondays; the rest are rest days
  const day = (date: string, calories: number, protein: number): DayTotals => ({ date, calories, protein })
  const days = [
    day('2026-10-12', 2050, 160), // Monday: 2,000 goal; on target, protein hit
    day('2026-10-13', 1850, 100), // rest day: 1,800 goal; on target, protein missed
    day('2026-10-14', 2300, 150), // over by more than 10%
    day('2026-10-15', 1790, 149),
    day('2026-10-16', 1810, 120),
    day('2026-10-17', 900, 50), // today: still going, not counted
  ]
  expect(calorieAdherence(days, profile, plan, '2026-10-17')).toEqual({ logged: 5, onTarget: 4, protein: 3, streak: 2 })
  expect(calorieAdherence([], profile, plan, '2026-10-17')).toEqual({ logged: 0, onTarget: 0, protein: 0, streak: 0 })
})

describe('adaptiveCalories', () => {
  const today = '2026-10-22'
  const eaten = (count: number, calories: number) => Array.from({ length: count }, (_, i) => ({ date: addDays(today, -(i + 1)), calories, protein: 150 }))
  // Half a pound a week down over the 3 weeks before today.
  const weighIns = [
    { date: addDays(today, -21), weight: 186 },
    { date: addDays(today, -14), weight: 185.5 },
    { date: addDays(today, -7), weight: 185 },
  ]

  it('works out maintenance from what you ate and how your weight moved, then applies your goal', () => {
    // 2,400 a day while losing 0.5 lb a week: maintenance ≈ 2,400 + 0.5 / 7 × 3,500 = 2,650; losing a pound a week: 2,150.
    expect(adaptiveCalories(eaten(21, 2400), weighIns, profile, today)).toEqual({ average: 2400, trend: expect.closeTo(-0.5), maintenance: 2650, suggested: 2150 })
    expect(adaptiveCalories(eaten(21, 2400), weighIns, { ...profile, goal: 'maintain', pace: 0 }, today)?.suggested).toBe(2650)
  })

  it('waits for enough data, and stays quiet when your goal is already close', () => {
    expect(adaptiveCalories(eaten(13, 2400), weighIns, profile, today)).toBeUndefined() // 13 logged days
    expect(adaptiveCalories(eaten(21, 2400), weighIns.slice(2), profile, today)).toBeUndefined() // no trend
    expect(adaptiveCalories(eaten(21, 2400), weighIns, { ...profile, calorieGoal: 2100 }, today)).toBeUndefined() // 50 kcal off
  })

  it('never suggests less than the safe floor', () => {
    expect(adaptiveCalories(eaten(21, 1000), weighIns, { ...profile, calorieGoal: 1300 }, today)?.suggested).toBe(1500)
  })
})

it('microTotals multiply by servings, count unknown as 0, and say how many foods had no info', () => {
  const day = microTotals([
    { fiber: 4, sugar: 1, sodium: 0, servings: 2 }, // oats
    { fiber: 3.1, sugar: 14.4, sodium: 1, servings: 1 }, // banana
    { servings: 1 }, // logged before fiber, sugar, and sodium were tracked
    { fiber: null, sugar: 5, sodium: null, servings: 1 }, // a label without fiber: still counts as having info
  ])
  expect(day.fiber).toBeCloseTo(11.1)
  expect(day.sugar).toBeCloseTo(21.4)
  expect(day.sodium).toBe(1)
  expect(day.unknown).toBe(1)
})

it('suggestedMicros scale fiber and sugar with calories', () => {
  expect(suggestedMicros(2000)).toEqual({ fiberGoal: 28, sugarLimit: 50, sodiumLimit: 2300 })
})

it('optionalNumber keeps an empty field unknown', () => {
  expect(optionalNumber('')).toBeNull()
  expect(optionalNumber('  ')).toBeNull()
  expect(optionalNumber('4.5')).toBe(4.5)
  expect(optionalNumber('0')).toBe(0)
  expect(optionalNumber('abc')).toBe(0)
})
