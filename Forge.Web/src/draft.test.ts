import { describe, expect, it } from 'vitest'
import type { Workout } from './api'
import { editDraft, emptyDraft, leaveSuperset, repeatDraft, replaceExercise, restsAfter, supersetWithNext, toWorkout, workoutName, type Draft, type DraftExercise } from './draft'

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
