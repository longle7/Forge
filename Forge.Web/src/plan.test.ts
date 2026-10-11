import { expect, it } from 'vitest'
import type { PlanDay, Workout } from './api'
import { addDays, dayLabel, localDate, weekday } from './dates'
import { planDraft } from './draft'
import { planFor, workedOut } from './plan'

const pushDay: PlanDay = {
  dayOfWeek: 1,
  name: 'Push Day',
  createdAt: '2026-10-01T12:00:00Z',
  exercises: [
    { exerciseId: 1, sets: 3, reps: 8 },
    { exerciseId: 10, sets: 2, reps: 12 },
  ],
}

it('dates count local days, across months', () => {
  expect(localDate(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
  expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(weekday('2026-10-12')).toBe(1) // a Monday
  expect(dayLabel('2026-10-09', '2026-10-10')).toBe('Yesterday')
})

it('planFor finds the weekday’s plan; other days are rest days', () => {
  expect(planFor([pushDay], '2026-10-12')).toBe(pushDay) // Monday
  expect(planFor([pushDay], '2026-10-13')).toBeUndefined()
  expect(planFor(undefined, '2026-10-12')).toBeUndefined()
})

it('workedOut checks the local day a workout started', () => {
  const evening: Workout = { id: 'w', name: 'Push Day', startedAt: new Date(2026, 9, 12, 19).toISOString(), finishedAt: new Date(2026, 9, 12, 20).toISOString(), sets: [] }
  expect(workedOut([evening], '2026-10-12')).toBe(true)
  expect(workedOut([evening], '2026-10-13')).toBe(false)
})

it('planDraft fills in the planned sets and reps, weights left for last time’s hints', () => {
  const draft = planDraft(pushDay, new Set(), new Date(2026, 9, 12, 18))
  expect(draft.name).toBe('Push Day')
  expect(draft.exercises).toEqual([
    { exerciseId: 1, sets: Array(3).fill({ weight: '', reps: '8', done: false }) },
    { exerciseId: 10, sets: Array(2).fill({ weight: '', reps: '12', done: false }) },
  ])
})

it('planDraft gives a planned cardio exercise one set, for its distance and time', () => {
  const RUNNING = 36
  const draft = planDraft({ ...pushDay, exercises: [{ exerciseId: RUNNING, sets: 1, reps: 1 }] }, new Set([RUNNING]))
  expect(draft.exercises).toEqual([{ exerciseId: RUNNING, sets: [{ weight: '', reps: '', distance: '', time: '', done: false }] }])
})
