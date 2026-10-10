import { expect, it } from 'vitest'
import type { Workout } from './api'
import { editDraft, emptyDraft, repeatDraft, toWorkout, workoutName, type Draft } from './draft'

const saved: Workout = {
  id: 'w1',
  name: 'Push day',
  startedAt: '2026-10-08T21:00:00.000Z',
  finishedAt: '2026-10-08T22:00:00.000Z',
  sets: [
    { exerciseId: 1, weight: 135, reps: 8 },
    { exerciseId: 25, weight: 20, reps: 12 },
    { exerciseId: 1, weight: 135, reps: 6 },
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

it('repeatDraft copies the exercises and values with nothing checked off, under a new ID', () => {
  const now = new Date(2026, 9, 10, 7)
  const draft = repeatDraft(saved, now)

  expect(draft.id).not.toBe(saved.id)
  expect(draft.name).toBe('Push day') // a chosen name carries over
  expect(draft.startedAt).toBe(now.toISOString())
  expect(draft.exercises).toEqual([
    {
      exerciseId: 1,
      sets: [
        { weight: '135', reps: '8', done: false },
        { weight: '135', reps: '6', done: false },
      ],
    },
    { exerciseId: 25, sets: [{ weight: '20', reps: '12', done: false }] },
  ])
  expect(repeatDraft({ ...saved, name: 'Evening Workout' }, now).name).toBe('Morning Workout')
})

it('editDraft keeps the ID and times, with every set checked off, and saves back the same sets', () => {
  const draft = editDraft(saved)

  expect(draft).toMatchObject({ id: 'w1', editing: true, startedAt: saved.startedAt, finishedAt: saved.finishedAt })
  // Grouped by exercise, so the order becomes bench, bench, raise.
  expect(toWorkout(draft, saved.finishedAt).sets).toEqual([
    { exerciseId: 1, weight: 135, reps: 8 },
    { exerciseId: 1, weight: 135, reps: 6 },
    { exerciseId: 25, weight: 20, reps: 12 },
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
