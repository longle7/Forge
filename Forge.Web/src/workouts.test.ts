import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutSet } from './api'
import {
  bestSet,
  formatCardio,
  formatClock,
  formatDuration,
  formatSet,
  groupSets,
  livePr,
  oneRepMax,
  parseDuration,
  personalRecords,
  platesPerSide,
  previousSets,
  progressionStep,
  volume,
  workoutLength,
  workoutTotals,
} from './workouts'

const BENCH = 1
const SQUAT = 14
const PULL_UP = 8
const RUNNING = 36

const set = (exerciseId: number, weight: number, reps: number): WorkoutSet => ({ exerciseId, weight, reps })
const run = (distance: number | null, durationSeconds: number | null): WorkoutSet => ({ exerciseId: RUNNING, weight: 0, reps: 0, distance, durationSeconds })
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

describe('livePr', () => {
  const saved = [workout('a', 1, [set(BENCH, 135, 8)])]

  it('marks the best done set once it beats every saved workout', () => {
    expect(livePr(saved, BENCH, [set(BENCH, 135, 8), undefined, set(BENCH, 145, 8), set(BENCH, 140, 8)])).toBe(2)
    expect(livePr(saved, BENCH, [set(BENCH, 135, 8), undefined])).toBeUndefined() // a tie isn't a PR
  })

  it('never on the first try, and not against the workout being edited', () => {
    expect(livePr(saved, SQUAT, [set(SQUAT, 225, 5)])).toBeUndefined()
    expect(livePr(saved, BENCH, [set(BENCH, 135, 8)], 'a')).toBeUndefined()
  })
})

describe('personalRecords', () => {
  it('marks a set that beats every earlier workout, at most one per exercise, never on the first try', () => {
    const first = workout('a', 1, [set(BENCH, 135, 8), set(SQUAT, 185, 5)])
    const second = workout('b', 3, [set(BENCH, 140, 8), set(BENCH, 145, 8), set(SQUAT, 185, 5)])
    const third = workout('c', 5, [set(BENCH, 140, 6)])

    // Newest first, as the API returns them; order doesn't matter.
    const records = personalRecords([third, second, first])

    expect(records.get('a')).toEqual(new Set()) // first time: nothing to beat
    expect(records.get('b')).toEqual(new Set([second.sets[1]])) // the 145 set, not 140 too; squat only tied
    expect(records.get('c')).toEqual(new Set())
  })

  it('ranks bodyweight sets by reps', () => {
    const b = workout('b', 2, [set(PULL_UP, 0, 10)])
    const records = personalRecords([workout('a', 1, [set(PULL_UP, 0, 8)]), b])
    expect(records.get('b')).toEqual(new Set(b.sets))
  })

  it('ranks cardio by distance: a PR is your longest', () => {
    const b = workout('b', 2, [run(3.1, 1800)])
    const records = personalRecords([workout('a', 1, [run(3, 1700)]), b, workout('c', 3, [run(2, 900)])])
    expect(records.get('b')).toEqual(new Set(b.sets))
    expect(records.get('c')).toEqual(new Set())
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
  expect(formatDuration(5_000)).toBe('<1m')
})

it('formats cardio sets with their pace, and reads times as minutes or m:ss', () => {
  expect(formatSet(run(3.1, 1620))).toBe('3.1 mi · 27:00 · 8:42 /mi')
  expect(formatSet(run(null, 1800))).toBe('30:00')
  expect(formatSet(run(2, null))).toBe('2 mi')
  expect(formatCardio(run(3.1, 1620))).toBe('3.1 mi')
  expect(formatCardio(run(null, 1800))).toBe('30:00')
  expect(formatClock(3_900_000)).toBe('1:05:00')
  expect(parseDuration('27:30')).toBe(1650)
  expect(parseDuration(' 1:05:00 ')).toBe(3900)
  expect(parseDuration('27')).toBe(1620)
  expect(parseDuration('27.5')).toBe(1650)
  expect(parseDuration('')).toBeNaN()
  expect(parseDuration('2:x')).toBeNaN()
})

it('workoutTotals and workoutLength count cardio', () => {
  const mixed = workout('a', 1, [set(BENCH, 100, 5), run(3.1, 1620)])
  expect(workoutTotals(mixed)).toBe('500 lb · 3.1 mi')
  expect(workoutTotals(workout('b', 1, [set(PULL_UP, 0, 10)]))).toBe('')
  expect(workoutLength(mixed)).toBe(60 * 60_000)
  // A 27-minute run logged in a 2-minute workout took 27 minutes.
  expect(workoutLength({ ...workout('c', 1, [run(3.1, 1620)]), finishedAt: '2026-10-01T21:02:00Z' })).toBe(27 * 60_000)
})

describe('progressionStep', () => {
  const last = [set(BENCH, 135, 8), set(BENCH, 135, 8), set(BENCH, 135, 9)]

  it('adds 5 lb, or 10 for legs, when every target rep was hit', () => {
    expect(progressionStep(last, [8, 8, 8], false)).toBe(5)
    expect(progressionStep(last, [8, 8], true)).toBe(10)
  })

  it('adds nothing after a missed rep or fewer sets, for bodyweight, or without targets', () => {
    expect(progressionStep([set(BENCH, 135, 8), set(BENCH, 135, 7)], [8, 8], false)).toBe(0)
    expect(progressionStep(last, [8, 8, 8, 8], false)).toBe(0)
    expect(progressionStep([set(PULL_UP, 0, 10)], [8], false)).toBe(0)
    expect(progressionStep(last, [NaN, 8, 8], false)).toBe(0) // an empty reps field
    expect(progressionStep([], [8], false)).toBe(0)
  })
})

it('platesPerSide loads the heaviest plates first, and says when it can\'t be exact', () => {
  expect(platesPerSide(225)).toEqual({ plates: [45, 45], loaded: 225 })
  expect(platesPerSide(185)).toEqual({ plates: [45, 25], loaded: 185 })
  expect(platesPerSide(140)).toEqual({ plates: [45, 2.5], loaded: 140 })
  expect(platesPerSide(137.5)).toEqual({ plates: [45], loaded: 135 })
  expect(platesPerSide(45)).toEqual({ plates: [], loaded: 45 })
})
