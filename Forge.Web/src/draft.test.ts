import { expect, it } from 'vitest'
import type { Routine, Workout } from './api'
import { editDraft, emptyDraft, repeatDraft, routineDraft, toWorkout, workoutName, type Draft } from './draft'

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
