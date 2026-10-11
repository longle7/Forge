import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutSet } from './api'
import { calculateGoals, exerciseCalories, remaining, restingCalories, totals, weightOn, type GoalInputs } from './nutrition'

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

it('weightOn uses the latest weigh-in on or before the day, else the starting weight', () => {
  const weighIns = [
    { date: '2026-10-01', weight: 186 },
    { date: '2026-10-08', weight: 184.5 },
  ]
  expect(weightOn(weighIns, '2026-10-10', 190)).toBe(184.5)
  expect(weightOn(weighIns, '2026-10-05', 190)).toBe(186)
  expect(weightOn(weighIns, '2026-09-30', 190)).toBe(190)
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
