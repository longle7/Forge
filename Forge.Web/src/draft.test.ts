import { describe, expect, it } from 'vitest'
import type { Routine, Workout, WorkoutSet } from './api'
import {
  builderToPlanExercises,
  builderToRoutineSets,
  builderToSets,
  editDraft,
  emptyDraft,
  hasEmptySet,
  leaveSuperset,
  planExercisesToBuilder,
  planExerciseToBuilder,
  repeatDraft,
  replaceExercise,
  restsAfter,
  routineDraft,
  routineToBuilder,
  separateFromNext,
  supersetWithNext,
  toWorkout,
  withSetCount,
  withNormalSets,
  workoutName,
  type Draft,
  type DraftExercise,
} from './draft'

const RUNNING = 36

// Bench (a warm-up first) and lateral raises as a superset, then bench again for a drop set.
const saved: Workout = {
  id: 'w1',
  name: 'Push day',
  startedAt: '2026-10-08T21:00:00.000Z',
  finishedAt: '2026-10-08T22:00:00.000Z',
  sets: [
    { exerciseId: 1, weight: 95, reps: 10, kind: 'warmup', superset: 1 },
    { exerciseId: 1, weight: 135, reps: 8, kind: null, superset: 1 },
    { exerciseId: 25, weight: 20, reps: 12, kind: 'failure', superset: 1 },
    { exerciseId: 1, weight: 115, reps: 10, kind: 'drop', superset: null },
  ],
}

it('workoutName follows the time of day', () => {
  expect(workoutName(new Date(2026, 9, 10, 7))).toBe('Morning Workout')
  expect(workoutName(new Date(2026, 9, 10, 13))).toBe('Afternoon Workout')
  expect(workoutName(new Date(2026, 9, 10, 19))).toBe('Evening Workout')
})

it('emptyDraft gets a new ID each time', () => {
  expect(emptyDraft().id).not.toBe(emptyDraft().id)
})

it('repeatDraft copies the exercises, kinds, supersets, and values with nothing checked off, under a new ID', () => {
  const now = new Date(2026, 9, 10, 7)
  const draft = repeatDraft(saved, now)

  expect(draft.id).not.toBe(saved.id)
  expect(draft.name).toBe('Push day') // a chosen name carries over
  expect(draft.startedAt).toBe(now.toISOString())
  // The API's nulls (a normal set, no superset) leave the draft without them.
  expect(draft.exercises).toEqual([
    {
      exerciseId: 1,
      superset: 1,
      sets: [
        { weight: '95', reps: '10', kind: 'warmup', done: false },
        { weight: '135', reps: '8', done: false },
      ],
    },
    { exerciseId: 25, superset: 1, sets: [{ weight: '20', reps: '12', kind: 'failure', done: false }] },
    { exerciseId: 1, sets: [{ weight: '115', reps: '10', kind: 'drop', done: false }] },
  ])
  expect(repeatDraft({ ...saved, name: 'Evening Workout' }, now).name).toBe('Morning Workout')
})

it('editDraft keeps the ID and times, with every set checked off, and saves back the same sets', () => {
  const draft = editDraft(saved)

  expect(draft).toMatchObject({ id: 'w1', editing: true, startedAt: saved.startedAt, finishedAt: saved.finishedAt })
  // The same sets in the same order, bench twice. A normal set or no superset is left out, which the API reads as null.
  expect(toWorkout(draft, saved.finishedAt).sets).toEqual([
    { exerciseId: 1, weight: 95, reps: 10, kind: 'warmup', superset: 1 },
    { exerciseId: 1, weight: 135, reps: 8, superset: 1 },
    { exerciseId: 25, weight: 20, reps: 12, kind: 'failure', superset: 1 },
    { exerciseId: 1, weight: 115, reps: 10, kind: 'drop' },
  ])
})

it('toWorkout saves only checked-off sets with reps; an empty weight is bodyweight', () => {
  const draft: Draft = {
    ...emptyDraft(new Date('2026-10-10T21:00:00Z')),
    name: '  Legs  ',
    exercises: [
      {
        exerciseId: 14,
        sets: [
          { weight: '185', reps: '5', done: true },
          { weight: '185', reps: '5', done: false }, // not checked off
          { weight: '185', reps: '', done: true }, // no reps
        ],
      },
      { exerciseId: 8, sets: [{ weight: '', reps: '10', done: true }] },
    ],
  }

  expect(toWorkout(draft, '2026-10-10T22:00:00.000Z')).toEqual({
    name: 'Legs',
    startedAt: '2026-10-10T21:00:00.000Z',
    finishedAt: '2026-10-10T22:00:00.000Z',
    sets: [
      { exerciseId: 14, weight: 185, reps: 5 },
      { exerciseId: 8, weight: 0, reps: 10 },
    ],
  })
})

it('toWorkout saves cardio as distance and time, and repeating one shows its time as m:ss', () => {
  const draft: Draft = {
    ...emptyDraft(new Date('2026-10-10T21:00:00Z')),
    exercises: [
      {
        exerciseId: RUNNING,
        sets: [
          { weight: '', reps: '', distance: '3.1', time: '27:00', done: true },
          { weight: '', reps: '', distance: '', time: '10', kind: 'warmup', done: true }, // minutes; cardio has no kinds
          { weight: '', reps: '', distance: '', time: '', done: true }, // nothing to save
          { weight: '', reps: '', distance: '1', time: '', done: false }, // not checked off
        ],
      },
    ],
  }

  const sets = toWorkout(draft, '2026-10-10T21:30:00.000Z').sets

  expect(sets).toEqual([
    { exerciseId: RUNNING, weight: 0, reps: 0, distance: 3.1, durationSeconds: 1620 },
    { exerciseId: RUNNING, weight: 0, reps: 0, distance: null, durationSeconds: 600 },
  ])
  expect(repeatDraft({ ...saved, sets }).exercises[0].sets).toEqual([
    { weight: '', reps: '', distance: '3.1', time: '27:00', done: false },
    { weight: '', reps: '', distance: '', time: '10:00', done: false },
  ])
})

it('routineDraft keeps the sets, reps, kinds, and supersets, and leaves weights and cardio values for last time to fill', () => {
  const routine: Routine = {
    id: 'r1',
    name: 'Evening Workout', // a routine keeps its name, even one that reads like an automatic one
    sets: [...saved.sets, { exerciseId: RUNNING, weight: 0, reps: 0, distance: 3.1, durationSeconds: 1620 }],
  }
  const now = new Date(2026, 9, 10, 7)
  const draft = routineDraft(routine, now)

  expect(draft).toMatchObject({ name: 'Evening Workout', routineId: 'r1', startedAt: now.toISOString() })
  expect(draft.exercises).toEqual([
    {
      exerciseId: 1,
      superset: 1,
      sets: [
        { weight: '', reps: '10', kind: 'warmup', done: false },
        { weight: '', reps: '8', done: false },
      ],
    },
    { exerciseId: 25, superset: 1, sets: [{ weight: '', reps: '12', kind: 'failure', done: false }] },
    { exerciseId: 1, sets: [{ weight: '', reps: '10', kind: 'drop', done: false }] },
    { exerciseId: RUNNING, sets: [{ weight: '', reps: '', distance: '', time: '', done: false }] },
  ])
})

describe('supersets', () => {
  // Only the superset numbers matter here.
  const exercises = (...supersets: (number | undefined)[]): DraftExercise[] => supersets.map((superset, i) => ({ exerciseId: i, superset, sets: [] }))
  const numbers = (list: DraftExercise[]) => list.map((e) => e.superset)

  it.each([
    { name: 'starts a new superset, one past the highest number', list: exercises(undefined, undefined, 3), index: 0, expected: [4, 4, 3] },
    { name: 'never reuses a number left from an old superset', list: exercises(1, undefined), index: 0, expected: [2, 2] },
    { name: 'the next exercise joins this one’s superset', list: exercises(1, 1, undefined), index: 1, expected: [1, 1, 1] },
    { name: 'this exercise joins the next one’s superset', list: exercises(undefined, 2, 2), index: 0, expected: [2, 2, 2] },
    { name: 'two supersets become one', list: exercises(1, 1, 2, 2, undefined), index: 1, expected: [1, 1, 1, 1, undefined] },
  ])('supersetWithNext $name', ({ list, index, expected }) => {
    expect(numbers(supersetWithNext(list, index))).toEqual(expected)
  })

  it('leaveSuperset takes one exercise out', () => {
    expect(numbers(leaveSuperset(exercises(1, 1, 1), 2))).toEqual([1, 1, undefined])
  })

  it.each([
    { name: 'a pair becomes two exercises on their own', list: exercises(1, 1), index: 0, expected: [1, 2] },
    { name: 'the rest of the superset goes on together', list: exercises(1, 1, 1), index: 0, expected: [1, 2, 2] },
    { name: 'splits in the middle', list: exercises(1, 1, 1, 1), index: 1, expected: [1, 1, 2, 2] },
    { name: 'leaves the next superset alone', list: exercises(1, 1, 3, 3), index: 0, expected: [1, 4, 3, 3] },
  ])('separateFromNext $name', ({ list, index, expected }) => {
    expect(numbers(separateFromNext(list, index))).toEqual(expected)
  })

  const withSets = (superset: number | undefined, ...done: boolean[]): DraftExercise => ({ exerciseId: 1, superset, sets: done.map((d) => ({ weight: '', reps: '8', done: d })) })

  it.each([
    { name: 'rests after a set of an exercise on its own', list: [withSets(undefined, true), withSets(undefined, false)], index: 0, rests: true },
    { name: 'goes on to the next exercise in the superset', list: [withSets(1, true), withSets(1, false)], index: 0, rests: false },
    { name: 'rests after the round’s last exercise', list: [withSets(1, false), withSets(1, true)], index: 1, rests: true },
    { name: 'skips a later exercise that’s all done', list: [withSets(1, true), withSets(1, true), withSets(1, false)], index: 0, rests: false },
    { name: 'rests when the rest of the superset is all done', list: [withSets(1, true), withSets(1, true)], index: 0, rests: true },
    { name: 'a number no neighbour shares is no superset', list: [withSets(1, true), withSets(undefined, false), withSets(1, false)], index: 0, rests: true },
  ])('restsAfter $name', ({ list, index, rests }) => {
    expect(restsAfter(list, index)).toBe(rests)
  })
})

it.each([
  { name: 'keeps reps, kinds, and the superset, but not weights or checks', cardio: false, sets: [{ weight: '', reps: '10', kind: 'warmup', done: false }, { weight: '', reps: '8', done: false }] },
  { name: 'gives a cardio exercise empty sets', cardio: true, sets: [{ weight: '', reps: '', done: false }, { weight: '', reps: '', done: false }] },
])('replaceExercise $name', ({ cardio, sets }) => {
  const bench: DraftExercise = { exerciseId: 1, superset: 2, sets: [{ weight: '95', reps: '10', kind: 'warmup', done: true }, { weight: '135', reps: '8', done: false }] }
  expect(replaceExercise(bench, 7, cardio)).toEqual({ exerciseId: 7, superset: 2, sets })
})

describe('the workout builder', () => {
  const W = { weight: '95', reps: '10', kind: 'warmup' as const, done: false }
  const D = { weight: '115', reps: '10', kind: 'drop' as const, done: false }
  const normal = (reps: string) => ({ weight: '135', reps, done: false })
  const run = (distance: number | null, durationSeconds: number | null): WorkoutSet => ({ exerciseId: RUNNING, weight: 0, reps: 0, distance, durationSeconds })

  it('turns a plan day into the builder’s exercises and back', () => {
    const plan = [
      { exerciseId: 1, sets: 3, reps: 8 },
      { exerciseId: RUNNING, sets: 1, reps: 1 },
    ]
    const exercises = planExercisesToBuilder(plan, new Set([RUNNING]))

    expect(exercises).toEqual([
      { exerciseId: 1, sets: Array(3).fill({ weight: '', reps: '8', done: false }) },
      { exerciseId: RUNNING, sets: [{ weight: '', reps: '', distance: '', time: '', done: false }] },
    ])
    expect(builderToPlanExercises(exercises)).toEqual(plan)
  })

  // The API's nulls (a normal set, no superset) are left out, as editDraft's test shows: the same to the API.
  it.each([
    { name: 'warm-ups, a superset, and a drop set', sets: toWorkout(editDraft(saved), saved.finishedAt).sets },
    { name: 'sets with different reps', sets: [8, 8, 6].map((reps): WorkoutSet => ({ exerciseId: 1, weight: 135, reps })) },
    { name: 'cardio with a distance, a time, or both, in a superset', sets: [run(3.1, null), run(null, 1620), { ...run(3.1, 1620), superset: 2 }, { exerciseId: 8, weight: 0, reps: 20, superset: 2 }] },
  ])('a routine with $name comes back from the builder as it was', ({ sets }) => {
    expect(builderToRoutineSets(routineToBuilder({ sets }))).toEqual(sets)
  })

  it('a cardio exercise added to a routine saves a 1-minute stand-in, since the API wants a distance or time', () => {
    expect(builderToRoutineSets([planExerciseToBuilder({ exerciseId: RUNNING, sets: 1, reps: 1 }, true)])).toEqual([run(null, 60)])
  })

  it('builderToSets saves every set of a past workout, done; a cardio exercise needs a distance or time', () => {
    const bench = withNormalSets(planExerciseToBuilder({ exerciseId: 1, sets: 2, reps: 8 }, false), { weight: '135' })
    const running = planExerciseToBuilder({ exerciseId: RUNNING, sets: 1, reps: 1 }, true)
    const ran = withNormalSets(running, { distance: '3.1', time: '27:00' })

    expect(hasEmptySet([bench, running])).toBe(true)
    expect(hasEmptySet([bench, ran])).toBe(false)
    expect(builderToSets([bench, ran])).toEqual([
      { exerciseId: 1, weight: 135, reps: 8 },
      { exerciseId: 1, weight: 135, reps: 8 },
      run(3.1, 1620),
    ])
  })

  it.each([
    { name: 'adds copies of the last normal set after it', sets: [W, normal('8'), normal('6'), D], count: 4, expected: [W, normal('8'), normal('6'), normal('6'), normal('6'), D] },
    { name: 'takes the last normal sets off', sets: [W, normal('8'), normal('6'), D], count: 1, expected: [W, normal('8'), D] },
    { name: 'with only warm-ups, adds a normal copy of the last one', sets: [W, W], count: 1, expected: [W, W, { ...W, kind: undefined }] },
  ])('withSetCount $name, other kinds of sets staying as they are', ({ sets, count, expected }) => {
    expect(withSetCount({ exerciseId: 1, sets }, count).sets).toEqual(expected)
  })

  it('withNormalSets changes only the normal sets', () => {
    expect(withNormalSets({ exerciseId: 1, sets: [W, normal('8'), normal('6'), D] }, { reps: '5' }).sets).toEqual([W, normal('5'), normal('5'), D])
  })
})
