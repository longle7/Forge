/// <reference types="node" />
// Node's types, for reading the API's C# source below; the app itself never sees them.
import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { MUSCLE_GROUPS } from './api'
import { equipmentOf, liftInfo, LIFTS, MUSCLE_GROUP, musclesWorked, nameWithEquipment } from './lifts'
import { POSES } from './poses'

// Every built-in's name, from the API: BuiltInExercises.cs, and the migrations that INSERT more as SQL rows like
// (NULL, N'Running', N'Cardio') or (N'Farmer''s Carry (Dumbbell)', N'Core').
const api = new URL('../../Forge.Api/', import.meta.url)
const source = (path: string) => readFileSync(new URL(path, api), 'utf8')
const migrations = readdirSync(new URL('Migrations/', api)).filter((file) => file.endsWith('.cs') && !file.endsWith('.Designer.cs'))
const builtIns = [
  ...[...source('Data/BuiltInExercises.cs').matchAll(/Name = "([^"]+)"/g)].map((match) => match[1]),
  ...migrations.flatMap((file) => [...source(`Migrations/${file}`).matchAll(/\((?:NULL, )?N'((?:[^']|'')+)', N'\w+'\)/g)].map((match) => match[1].replaceAll("''", "'"))),
]

it('has a catalog entry for every built-in, and none for anything else', () => {
  expect(builtIns).toHaveLength(73) // 35 seeded, 5 cardio, 33 from AddLiftLibrary
  expect(Object.keys(LIFTS).sort()).toEqual([...builtIns].sort())
})

it.each(Object.entries(LIFTS))('%s: pose, muscles, equipment, and cues', (name, lift) => {
  expect(POSES).toHaveProperty(lift.pose)
  expect(lift.primary.length).toBeGreaterThan(0)
  for (const muscle of [...lift.primary, ...lift.secondary]) expect(MUSCLE_GROUP).toHaveProperty(muscle)
  expect(lift.equipment).toBe(equipmentOf(name))
  expect(lift.cues.length).toBeGreaterThanOrEqual(2)
  expect(lift.cues.length).toBeLessThanOrEqual(4)
})

it('puts every muscle in one of the six groups on the body', () => {
  expect(new Set(Object.values(MUSCLE_GROUP))).toEqual(new Set(MUSCLE_GROUPS.filter((group) => group !== 'Cardio' && group !== 'Other')))
})

it.each([
  ['Bench Press (Barbell)', 'barbell'],
  ['Row (Dumbbell)', 'dumbbell'],
  ['Lat Pulldown (Cable)', 'cable'],
  ['Leg Press (Machine)', 'machine'],
  ['Kettlebell Swing (Kettlebell)', 'kettlebell'],
  ['zercher squat (barbell)', 'barbell'],
  ['Pull Up', 'bodyweight'],
  ['Barbell Shrug', 'bodyweight'], // only equipment in parentheses counts
  ['Squat (Paused)', 'bodyweight'],
])('equipmentOf(%s) is %s', (name, equipment) => {
  expect(equipmentOf(name)).toBe(equipment)
})

it.each([
  { muscleGroup: 'Chest', pose: 'bench', primary: ['chest'] },
  { muscleGroup: 'Back', pose: 'row', primary: ['lats', 'upperBack'] },
  { muscleGroup: 'Legs', pose: 'squat', primary: ['quads', 'glutes'] },
  { muscleGroup: 'Shoulders', pose: 'overheadPress', primary: ['frontDelts', 'sideDelts'] },
  { muscleGroup: 'Arms', pose: 'curl', primary: ['biceps', 'triceps'] },
  { muscleGroup: 'Core', pose: 'crunch', primary: ['abs'] },
  { muscleGroup: 'Cardio', pose: 'run', primary: ['quads'] },
  { muscleGroup: 'Other', pose: 'walk', primary: [] },
])('a lift you added under $muscleGroup gets its group’s pose and muscles', ({ muscleGroup, pose, primary }) => {
  const lift = liftInfo({ name: 'Zercher Thing (Barbell)', muscleGroup })
  expect(lift).toMatchObject({ pose, primary, equipment: 'barbell', cues: [] })
})

it('knows a built-in by its name, and only by its own entries', () => {
  expect(liftInfo({ name: 'Push Up', muscleGroup: 'Chest' })).toBe(LIFTS['Push Up'])
  expect(liftInfo({ name: 'constructor', muscleGroup: 'Core' }).pose).toBe('crunch')
})

it.each([
  ['Zercher Squat', 'barbell', 'Zercher Squat (Barbell)'],
  ['Sled Push', 'machine', 'Sled Push (Machine)'],
  ['Sissy Squat', 'bodyweight', 'Sissy Squat'],
  ['Zercher Squat (Barbell)', 'barbell', 'Zercher Squat (Barbell)'], // already named
] as const)('nameWithEquipment(%s, %s) is %s', (name, equipment, expected) => {
  expect(nameWithEquipment(name, equipment)).toBe(expected)
})

it.each([
  ['Bench Press (Barbell)', 'Works chest · helps triceps, front delts'],
  ['Leg Extension (Machine)', 'Works quads'],
  ['Deadlift (Barbell)', 'Works hamstrings, glutes, lower back · helps lats, upper back, quads, forearms'],
])('musclesWorked for %s', (name, text) => {
  expect(musclesWorked(LIFTS[name])).toBe(text)
})

it('musclesWorked says nothing when nothing is known', () => {
  expect(musclesWorked({ primary: [], secondary: [] })).toBe('')
})
