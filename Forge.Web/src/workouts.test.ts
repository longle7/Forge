import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutSet } from './api'
import { bestSet, formatDuration, formatSet, groupSets, oneRepMax, personalRecords, previousSets, volume } from './workouts'

const BENCH = 1
const SQUAT = 14
const PULL_UP = 8

const set = (exerciseId: number, weight: number, reps: number): WorkoutSet => ({ exerciseId, weight, reps })
const workout = (id: string, day: number, sets: WorkoutSet[]): Workout => ({
  id,
  name: 'Workout',
  startedAt: `2026-10-${String(day).padStart(2, '0')}T21:00:00Z`,
  finishedAt: `2026-10-${String(day).padStart(2, '0')}T22:00:00Z`,
  sets,
})

it('groupSets keeps each exercise together, in the order it was first done', () => {
  const groups = groupSets([set(BENCH, 135, 8), set(SQUAT, 185, 5), set(BENCH, 135, 6)])
  expect(groups.map((g) => [g.exerciseId, g.sets.length])).toEqual([
    [BENCH, 2],
    [SQUAT, 1],
  ])
})

it('oneRepMax uses Epley, and a single rep is the weight itself', () => {
  expect(oneRepMax(135, 8)).toBeCloseTo(171)
  expect(oneRepMax(225, 1)).toBe(225)
})

describe('personalRecords', () => {
  it('marks a set that beats every earlier workout, at most one per exercise, never on the first try', () => {
    const first = workout('a', 1, [set(BENCH, 135, 8), set(SQUAT, 185, 5)])
    const second = workout('b', 3, [set(BENCH, 140, 8), set(BENCH, 145, 8), set(SQUAT, 185, 5)])
    const third = workout('c', 5, [set(BENCH, 140, 6)])

    // Newest first, as the API returns them; order doesn't matter.
    const records = personalRecords([third, second, first])

    expect(records.get('a')).toEqual(new Set()) // first time: nothing to beat
    expect(records.get('b')).toEqual(new Set([1])) // the 145 set, not 140 too; squat only tied
    expect(records.get('c')).toEqual(new Set())
  })

  it('ranks bodyweight sets by reps', () => {
    const records = personalRecords([workout('a', 1, [set(PULL_UP, 0, 8)]), workout('b', 2, [set(PULL_UP, 0, 10)])])
    expect(records.get('b')).toEqual(new Set([0]))
  })
})

it('bestSet finds the highest estimated 1RM and its workout', () => {
  const workouts = [workout('b', 3, [set(BENCH, 185, 2)]), workout('a', 1, [set(BENCH, 155, 10)])]
  // 155 × 10 ≈ 206.7 beats 185 × 2 ≈ 197.3
  expect(bestSet(workouts, BENCH)).toEqual({ set: set(BENCH, 155, 10), workout: workouts[1] })
  expect(bestSet(workouts, SQUAT)).toBeUndefined()
})

it('previousSets comes from the most recent workout with the exercise, skipping the one being edited', () => {
  const workouts = [workout('c', 5, [set(SQUAT, 185, 5)]), workout('b', 3, [set(BENCH, 140, 8), set(BENCH, 140, 7)]), workout('a', 1, [set(BENCH, 135, 8)])]
  expect(previousSets(workouts, BENCH)).toEqual([set(BENCH, 140, 8), set(BENCH, 140, 7)])
  expect(previousSets(workouts, BENCH, 'b')).toEqual([set(BENCH, 135, 8)])
  expect(previousSets(workouts, PULL_UP)).toEqual([])
})

it('volume, formatSet, and formatDuration', () => {
  expect(volume(workout('a', 1, [set(BENCH, 135, 8), set(PULL_UP, 0, 10)]))).toBe(1080)
  expect(formatSet(set(BENCH, 137.5, 8))).toBe('137.5 lb × 8')
  expect(formatSet(set(PULL_UP, 0, 12))).toBe('12 reps')
  expect(formatDuration(48 * 60_000)).toBe('48m')
  expect(formatDuration(65 * 60_000)).toBe('1h 5m')
})
