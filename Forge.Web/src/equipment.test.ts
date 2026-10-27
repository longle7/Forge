import { expect, it } from 'vitest'
import type { Exercise } from './api'
import { available, BODYWEIGHT, FULL_GYM, HOME_DUMBBELLS, sameEquipment, swapsFor } from './equipment'
import { LIFTS, type Equipment } from './lifts'

// Every built-in, in catalog order. Built-ins are known by name, so their muscle group doesn't matter here.
const exercises: Exercise[] = Object.keys(LIFTS).map((name, i) => ({ id: i + 1, name, muscleGroup: 'Other', isCustom: false }))
const named = (name: string) => exercises.find((e) => e.name === name)!

it('has every lift in a full gym', () => {
  expect(exercises.every((e) => available(e, FULL_GYM))).toBe(true)
})

it.each([
  ['Bench Press (Barbell)', HOME_DUMBBELLS, false],
  ['Bench Press (Dumbbell)', HOME_DUMBBELLS, true],
  ['Lat Pulldown (Cable)', HOME_DUMBBELLS, false],
  ['Goblet Squat (Dumbbell)', BODYWEIGHT, false],
  ['Push Up', BODYWEIGHT, true],
  ['Pull Up', [], true], // bodyweight needs nothing
  ['Kettlebell Swing (Kettlebell)', ['kettlebell'], true],
] as [string, Equipment[], boolean][])('%s with %j: %s', (name, equipment, expected) => {
  expect(available(named(name), equipment)).toBe(expected)
})

it.each([
  ['Zercher Squat (Barbell)', false],
  ['Sissy Squat', true],
])('a lift you added, %s, with bodyweight only: %s', (name, expected) => {
  expect(available({ name, muscleGroup: 'Legs' }, BODYWEIGHT)).toBe(expected)
})

it.each([
  [
    'Bench Press (Barbell)',
    FULL_GYM,
    // Different equipment first, then the other barbell presses.
    ['Bench Press (Dumbbell)', 'Incline Bench Press (Dumbbell)', 'Chest Press (Machine)', 'Push Up', 'Incline Bench Press (Barbell)', 'Decline Bench Press (Barbell)', 'Close Grip Bench Press (Barbell)'],
  ],
  ['Bench Press (Barbell)', HOME_DUMBBELLS, ['Bench Press (Dumbbell)', 'Incline Bench Press (Dumbbell)', 'Push Up']],
  ['Bench Press (Barbell)', BODYWEIGHT, ['Push Up']],
  [
    'Incline Bench Press (Dumbbell)',
    FULL_GYM,
    // The incline barbell press works both its main muscles, chest and front delts; the rest work one.
    ['Incline Bench Press (Barbell)', 'Bench Press (Barbell)', 'Decline Bench Press (Barbell)', 'Chest Press (Machine)', 'Push Up', 'Close Grip Bench Press (Barbell)', 'Bench Press (Dumbbell)'],
  ],
  ['Squat (Barbell)', HOME_DUMBBELLS, ['Goblet Squat (Dumbbell)', 'Bodyweight Squat']],
  ['Lateral Raise (Dumbbell)', FULL_GYM, ['Lateral Raise (Cable)']], // not Hip Abduction, a raise for the glutes
  ['Running', FULL_GYM, []],
] as [string, Equipment[], string[]][])('swaps for %s with %j', (name, equipment, swaps) => {
  expect(swapsFor(named(name), exercises, equipment).map((e) => e.name)).toEqual(swaps)
})

it('swaps a lift you added by its muscle group, and nothing for one under Other', () => {
  const zercher = { id: 0, name: 'Zercher Squat (Barbell)', muscleGroup: 'Legs', isCustom: true }
  expect(swapsFor(zercher, exercises, HOME_DUMBBELLS).map((e) => e.name)).toEqual(['Goblet Squat (Dumbbell)', 'Bodyweight Squat'])
  expect(swapsFor({ ...zercher, muscleGroup: 'Other' }, exercises, FULL_GYM)).toEqual([])
})

it.each([
  [['dumbbell', 'bodyweight'], ['bodyweight', 'dumbbell'], true],
  [[...FULL_GYM].reverse(), FULL_GYM, true],
  [HOME_DUMBBELLS, BODYWEIGHT, false],
  [['barbell', 'bodyweight'], HOME_DUMBBELLS, false],
] as [Equipment[], Equipment[], boolean][])('sameEquipment(%j, %j) is %s', (a, b, expected) => {
  expect(sameEquipment(a, b)).toBe(expected)
})
