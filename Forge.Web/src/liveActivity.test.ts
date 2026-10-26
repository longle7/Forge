import { expect, it } from 'vitest'
import { emptyDraft, type Draft, type DraftExercise } from './draft'
import { activityState, isLive, nextSet } from './liveActivity'

const BENCH = 1
const ROW = 25
const names = new Map([[BENCH, 'Bench Press'], [ROW, 'Barbell Row']])

const workout: Draft = { ...emptyDraft(new Date('2026-10-10T21:00:00Z')), name: 'Push day' }

/** An exercise whose sets are checked off (true) or not (false). */
const exercise = (exerciseId: number, ...done: boolean[]): DraftExercise => ({
  exerciseId,
  sets: done.map((d) => ({ weight: '135', reps: '8', done: d })),
})

it.each([
  { name: 'a workout in progress', draft: workout, live: true },
  { name: 'no workout', draft: undefined, live: false },
  { name: 'a saved workout being edited', draft: { ...workout, editing: true }, live: false },
  { name: 'a finished workout waiting to upload', draft: { ...workout, finishedAt: '2026-10-10T22:00:00.000Z' }, live: false },
])('isLive: $name', ({ draft, live }) => {
  expect(isLive(draft)).toBe(live)
})

it.each([
  { name: 'the first set', exercises: [exercise(BENCH, false, false)], next: { exerciseId: BENCH, set: 0 } },
  { name: 'after the checked-off sets', exercises: [exercise(BENCH, true, false, false)], next: { exerciseId: BENCH, set: 1 } },
  { name: 'a set skipped earlier comes first', exercises: [exercise(BENCH, true, false, true)], next: { exerciseId: BENCH, set: 1 } },
  { name: 'the next exercise once one is done', exercises: [exercise(BENCH, true, true), exercise(ROW, false)], next: { exerciseId: ROW, set: 0 } },
  { name: 'none when every set is done', exercises: [exercise(BENCH, true), exercise(ROW, true)], next: undefined },
  { name: 'none before the first exercise', exercises: [], next: undefined },
])('nextSet: $name', ({ exercises, next }) => {
  const found = nextSet({ ...workout, exercises })
  expect(found && { exerciseId: found.exercise.exerciseId, set: found.set }).toEqual(next)
})

it.each([
  { name: 'the next set', exercises: [exercise(BENCH, true, false, false)], shows: { exercise: 'Bench Press', detail: 'Set 2 of 3', setsDone: 1 } },
  { name: 'the next exercise', exercises: [exercise(BENCH, true, true), exercise(ROW, false)], shows: { exercise: 'Barbell Row', detail: 'Set 1 of 1', setsDone: 2 } },
  { name: 'an exercise not loaded yet', exercises: [exercise(99, false)], shows: { exercise: 'Exercise', detail: 'Set 1 of 1', setsDone: 0 } },
  { name: 'every set done', exercises: [exercise(BENCH, true, true)], shows: { exercise: '', detail: 'All sets done', setsDone: 2 } },
  { name: 'no sets yet', exercises: [], shows: { exercise: '', detail: 'No sets yet', setsDone: 0 } },
])('activityState shows $name', ({ exercises, shows }) => {
  expect(activityState({ ...workout, exercises }, names)).toMatchObject(shows)
})

it('activityState carries the workout, its start in ms, and the rest timer', () => {
  const resting = { ...workout, name: '  Push day ', restEndsAt: Date.parse('2026-10-10T21:10:00Z'), restTotal: 90 }

  expect(activityState(resting, names)).toMatchObject({
    workoutId: workout.id,
    startedAt: Date.parse('2026-10-10T21:00:00Z'),
    name: 'Push day',
    restEndsAt: Date.parse('2026-10-10T21:10:00Z'),
    restTotal: 90,
  })
  expect(activityState({ ...workout, name: '' }, names).name).toBe('Workout')
})

it('activityState leaves out weights and reps, so typing them changes nothing', () => {
  const typing = (weight: string, reps: string): Draft => ({ ...workout, exercises: [{ exerciseId: BENCH, sets: [{ weight, reps, done: false }] }] })

  expect(activityState(typing('140', '5'), names)).toEqual(activityState(typing('', ''), names))
})
