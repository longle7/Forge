import { describe, expect, it } from 'vitest'
import type { TestedMax, Workout, WorkoutSet } from './api'
import { bigThree, estimatedMax, liftedExercises, percentTable, repMaxes } from './maxes'

const BENCH = 1
const SQUAT = 14
const DEADLIFT = 7
const PULL_UP = 8

const set = (exerciseId: number, weight: number, reps: number): WorkoutSet => ({ exerciseId, weight, reps })
const workout = (day: number, sets: WorkoutSet[]): Workout => ({
  id: `w${day}`,
  name: 'Workout',
  startedAt: `2026-10-${String(day).padStart(2, '0')}T21:00:00Z`,
  finishedAt: `2026-10-${String(day).padStart(2, '0')}T22:00:00Z`,
  sets,
})
const tested = (exerciseId: number, date: string, weight: number, reps = 1): TestedMax => ({ id: `${exerciseId}-${date}`, exerciseId, date, weight, reps })

describe('repMaxes', () => {
  it('finds the heaviest weight for at least each rep count, from sets and tested maxes', () => {
    const workouts = [workout(5, [set(BENCH, 185, 5), set(BENCH, 155, 10), set(BENCH, 205, 2)]), workout(8, [set(BENCH, 190, 3)])]
    const best = repMaxes(workouts, [tested(BENCH, '2026-10-12', 225)], BENCH).map((r) => [r.reps, r.best?.weight, r.best?.tested])

    expect(best).toEqual([
      [1, 225, true], // the tested single beats every set
      [3, 190, false], // 190 × 3 beats 185 × 5 for "at least 3"
      [5, 185, false],
      [10, 155, false],
    ])
  })

  it('has nothing for rep counts you never reached, and ignores bodyweight sets', () => {
    const best = repMaxes([workout(5, [set(BENCH, 185, 3), set(PULL_UP, 0, 12)])], [], BENCH)
    expect(best.map((r) => r.best?.weight)).toEqual([185, 185, undefined, undefined])
    expect(repMaxes([workout(5, [set(PULL_UP, 0, 12)])], [], PULL_UP).every((r) => !r.best)).toBe(true)
  })
})

describe('estimatedMax', () => {
  const workouts = [workout(1, [set(SQUAT, 315, 5)]), workout(20, [set(SQUAT, 300, 3)])]

  it('takes the best Epley estimate across sets and tested maxes', () => {
    expect(estimatedMax(workouts, [], SQUAT)).toMatchObject({ value: 367.5, weight: 315, reps: 5, date: '2026-10-01', tested: false })
    expect(estimatedMax(workouts, [tested(SQUAT, '2026-10-15', 375)], SQUAT)).toMatchObject({ value: 375, tested: true })
  })

  it('only counts lifts on or after `since`', () => {
    expect(estimatedMax(workouts, [], SQUAT, '2026-10-10')).toMatchObject({ value: 330, date: '2026-10-20' })
    expect(estimatedMax(workouts, [], SQUAT, '2026-10-21')).toBeUndefined()
  })
})

describe('warm-ups never count', () => {
  // Heavier than the real set, so it would win if it counted.
  const warmup: WorkoutSet = { ...set(SQUAT, 405, 1), kind: 'warmup' }
  const workouts = [workout(1, [warmup, set(SQUAT, 315, 1)])]

  it.each([
    { name: 'estimatedMax: not your max', value: () => estimatedMax(workouts, [], SQUAT)?.value, expected: 315 },
    { name: 'repMaxes: not your best single', value: () => repMaxes(workouts, [], SQUAT)[0].best?.weight, expected: 315 },
    { name: 'liftedExercises: an exercise with only warm-ups has no estimatedMax, so it isn’t listed', value: () => liftedExercises([workout(1, [warmup])], []), expected: [] },
  ])('$name', ({ value, expected }) => {
    expect(value()).toEqual(expected)
  })
})

it('percentTable rounds to 5 lb and lists the plates for each side', () => {
  const rows = percentTable(225)
  expect(rows.map((r) => r.percent)).toEqual([95, 90, 85, 80, 75, 70, 65, 60, 55, 50])
  expect(rows[0]).toEqual({ percent: 95, weight: 215, plates: [45, 35, 5] }) // 213.75 → 215
  expect(rows.at(-1)).toEqual({ percent: 50, weight: 115, plates: [35] }) // 112.5 → 115
})

it('liftedExercises lists weighted lifts, most recent first', () => {
  const workouts = [workout(3, [set(BENCH, 135, 5), set(PULL_UP, 0, 8)]), workout(9, [set(SQUAT, 225, 5)])]
  expect(liftedExercises(workouts, [tested(DEADLIFT, '2026-10-05', 405)])).toEqual([SQUAT, DEADLIFT, BENCH])
})

it('bigThree totals the three lifts once each has an estimate', () => {
  const workouts = [workout(3, [set(SQUAT, 315, 1), set(BENCH, 225, 1)])]
  expect(bigThree(workouts, []).total).toBeUndefined()
  const full = bigThree(workouts, [tested(DEADLIFT, '2026-10-04', 405)])
  expect(full.lifts.map((l) => [l.label, l.value])).toEqual([
    ['Squat', 315],
    ['Bench', 225],
    ['Deadlift', 405],
  ])
  expect(full.total).toBe(945)
})
