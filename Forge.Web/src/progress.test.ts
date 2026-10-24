import { describe, expect, it } from 'vitest'
import type { PlanDay, Workout, WorkoutSet } from './api'
import { adherence, calorieBars, niceTicks, plannedDays, strengthSeries, streak, topLifts, weekStatuses } from './progress'

it('niceTicks spans the values with round steps', () => {
  expect(niceTicks(181.6, 186.2)).toEqual([180, 182, 184, 186, 188])
  expect(niceTicks(0, 2400)).toEqual([0, 1000, 2000, 3000])
  expect(niceTicks(150, 150)).toEqual([149, 150, 151])
})
import { isUnlocked, unlockGoals, type TodaySoFar } from './timeout'

// Monday and Thursday are planned; the plan started Monday, Sep 28, 2026.
const plan: PlanDay[] = [
  { dayOfWeek: 1, name: 'Push Day', createdAt: new Date(2026, 8, 28, 9).toISOString(), exercises: [{ exerciseId: 1, sets: 3, reps: 8 }] },
  { dayOfWeek: 4, name: 'Pull Day', createdAt: new Date(2026, 8, 28, 9).toISOString(), exercises: [{ exerciseId: 10, sets: 3, reps: 10 }] },
]
const trainedOn = (day: string, sets = [{ exerciseId: 1, weight: 135, reps: 8 }]): Workout => {
  const [y, m, d] = day.split('-').map(Number)
  return { id: day, name: 'W', startedAt: new Date(y, m - 1, d, 18).toISOString(), finishedAt: new Date(y, m - 1, d, 19).toISOString(), sets }
}

describe('sticking to the plan', () => {
  // Planned so far: Mon 9/28 ✓, Thu 10/1 ✓, Mon 10/5 ✗, Thu 10/8 ✓, Mon 10/12 (today, not done yet).
  const workouts = [trainedOn('2026-09-28'), trainedOn('2026-10-01'), trainedOn('2026-10-08'), trainedOn('2026-10-10')]
  const today = '2026-10-12'

  it('counts planned days since the plan began, leaving today out until it is done', () => {
    const days = plannedDays(plan, workouts, '2026-09-01', today)
    expect(days.map((d) => `${d.day}${d.done ? '✓' : '✗'}`)).toEqual(['2026-09-28✓', '2026-10-01✓', '2026-10-05✗', '2026-10-08✓'])
    expect(adherence(days)).toBe(0.75)
    expect(adherence([])).toBeUndefined()
  })

  it('streaks count planned days in a row back from today, across rest days', () => {
    expect(streak(plan, workouts, today)).toBe(1) // 10/8 ✓, then the miss on 10/5
    expect(streak(plan, [...workouts, trainedOn('2026-10-12')], today)).toBe(2)
    expect(streak([], workouts, today)).toBe(0)
  })

  it('weekStatuses marks each day of the last weeks', () => {
    const weeks = weekStatuses(plan, workouts, '2026-10-08', 2) // weeks of Sep 28 and Oct 5
    expect(weeks[0].map((d) => d.status)).toEqual(['done', 'rest', 'rest', 'done', 'rest', 'rest', 'rest'])
    expect(weeks[1].map((d) => d.status)).toEqual(['missed', 'rest', 'rest', 'done', 'rest', 'extra', 'rest']) // Saturday 10/10
    expect(weekStatuses(plan, [trainedOn('2026-10-10')], '2026-10-12', 1)[0].map((d) => d.status)).toEqual(['planned', 'rest', 'rest', 'planned', 'rest', 'rest', 'rest'])
    expect(weekStatuses(plan, [trainedOn('2026-10-10')], '2026-10-11', 1)[0][5].status).toBe('extra') // a Saturday workout
  })
})

it('topLifts ranks weighted exercises by how many workouts have them', () => {
  const workouts = [
    trainedOn('2026-10-01', [{ exerciseId: 1, weight: 135, reps: 8 }, { exerciseId: 14, weight: 185, reps: 5 }]),
    trainedOn('2026-10-03', [{ exerciseId: 1, weight: 140, reps: 8 }, { exerciseId: 8, weight: 0, reps: 10 }]),
  ]
  expect(topLifts(workouts)).toEqual([1, 14])
})

it('strengthSeries is each workout’s best estimated 1RM, oldest first', () => {
  const workouts = [
    trainedOn('2026-10-08', [{ exerciseId: 1, weight: 145, reps: 5 }, { exerciseId: 1, weight: 135, reps: 10 }]),
    trainedOn('2026-10-01', [{ exerciseId: 1, weight: 135, reps: 8 }]),
    trainedOn('2026-09-01', [{ exerciseId: 1, weight: 115, reps: 8 }]),
  ]
  const series = strengthSeries(workouts, 1, '2026-09-28')
  expect(series.map((p) => p.day)).toEqual(['2026-10-01', '2026-10-08'])
  expect(series[1].value).toBeCloseTo(180) // 135 × 10 → 180 beats 145 × 5 → 169.2
})

describe('warm-ups never count', () => {
  const warmup: WorkoutSet = { exerciseId: 1, weight: 225, reps: 5, kind: 'warmup' }

  it.each([
    { name: 'topLifts: an exercise with only warm-ups isn’t a lift', value: () => topLifts([trainedOn('2026-10-01', [warmup])]), expected: [] },
    { name: 'strengthSeries: not the day’s best', value: () => strengthSeries([trainedOn('2026-10-01', [warmup, { exerciseId: 1, weight: 135, reps: 1 }])], 1, '2026-09-28').map((p) => p.value), expected: [135] },
  ])('$name', ({ value, expected }) => {
    expect(value()).toEqual(expected)
  })
})

it('calorieBars buckets by day, week, or month, and leaves empty periods empty', () => {
  const days = [
    { date: '2026-10-05', calories: 2000, protein: 0, carbs: 0, fat: 0 },
    { date: '2026-10-06', calories: 2400, protein: 0, carbs: 0, fat: 0 },
    { date: '2026-10-12', calories: 1800, protein: 0, carbs: 0, fat: 0 },
  ]
  expect(calorieBars(days, '2026-10-05', '2026-10-07', 'day')).toEqual([
    { start: '2026-10-05', value: 2000 },
    { start: '2026-10-06', value: 2400 },
    { start: '2026-10-07', value: undefined },
  ])
  expect(calorieBars(days, '2026-10-01', '2026-10-14', 'week')).toEqual([
    { start: '2026-10-01', value: undefined }, // the week of Sep 28, from where the range starts
    { start: '2026-10-05', value: 2200 },
    { start: '2026-10-12', value: 1800 },
  ])
  expect(calorieBars(days, '2026-09-20', '2026-10-14', 'month').map((b) => b.start)).toEqual(['2026-09-20', '2026-10-01'])
})

describe('Time Out goals', () => {
  const day: TodaySoFar = { planName: 'Push Day', restDay: false, workedOut: false, meals: 1, weighedIn: true }
  const rules = { unlockAfterWorkout: true, unlockAfterMeals: 2, unlockAfterWeighIn: true }

  it('lists each goal and whether it is met; locked until all are', () => {
    const goals = unlockGoals(rules, day)
    expect(goals.map((g) => [g.label, g.met])).toEqual([
      ['Finish Push Day', false],
      ['Log 2 meals (1 of 2)', false],
      ['Weigh in', true],
    ])
    expect(isUnlocked(goals)).toBe(false)
    expect(isUnlocked(unlockGoals(rules, { ...day, workedOut: true, meals: 3 }))).toBe(true)
  })

  it('a rest day counts as done, and no goals means nothing is locked', () => {
    expect(unlockGoals({ ...rules, unlockAfterMeals: 0, unlockAfterWeighIn: false }, { ...day, planName: undefined, restDay: true })).toEqual([
      { id: 'workout', label: 'Rest day: no workout needed', met: true },
    ])
    expect(isUnlocked(unlockGoals({ unlockAfterWorkout: false, unlockAfterMeals: 0, unlockAfterWeighIn: false }, day))).toBe(true)
  })
})
