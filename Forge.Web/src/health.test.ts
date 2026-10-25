import { describe, expect, it } from 'vitest'
import type { Exercise, Workout } from './api'
import { matchWorkout, sleepByNight, toForgeWorkout, workoutHealth, type WatchWorkout } from './health'
import { workoutTotals } from './workouts'

const at = (time: string) => Date.parse(`2026-10-10T${time}:00Z`)
const watch = (activity: string, start: string, end: string, extra: Partial<WatchWorkout> = {}): WatchWorkout => ({
  uuid: 'ABC-123',
  activity,
  start: at(start),
  end: at(end),
  source: 'Workout',
  ...extra,
})
const logged = (id: string, start: string, end: string, source?: Workout['source']): Workout => ({
  id,
  name: 'Push Day',
  startedAt: new Date(at(start)).toISOString(),
  finishedAt: new Date(at(end)).toISOString(),
  sets: [{ exerciseId: 1, weight: 185, reps: 5 }],
  source,
})
const exercises: Exercise[] = [
  { id: 36, name: 'Running', muscleGroup: 'Cardio', isCustom: false },
  { id: 37, name: 'Walking', muscleGroup: 'Cardio', isCustom: false },
  { id: 90, name: 'Cycling', muscleGroup: 'Cardio', isCustom: true }, // someone's own, not the built-in
]

describe('matchWorkout', () => {
  it('finds the Forge workout that is the same session: overlapping by half of the shorter one', () => {
    const workouts = [logged('a', '17:00', '18:00'), logged('b', '18:30', '19:30')]
    expect(matchWorkout(watch('strength', '17:05', '18:02'), workouts)?.id).toBe('a')
    expect(matchWorkout(watch('strength', '17:50', '18:40'), workouts)?.id).toBeUndefined() // 10 min of 50 with each
    expect(matchWorkout(watch('running', '20:00', '20:30'), workouts)).toBeUndefined()
  })

  it('takes the bigger overlap, and never a workout that came from Health itself', () => {
    const workouts = [logged('a', '17:00', '17:40'), logged('b', '17:30', '18:30'), logged('w', '17:00', '18:30', 'health')]
    expect(matchWorkout(watch('strength', '17:35', '18:30'), workouts)?.id).toBe('b')
  })
})

describe('toForgeWorkout', () => {
  it('makes a run one cardio set with its distance and time', () => {
    const run = toForgeWorkout(watch('running', '07:00', '07:27', { distanceMiles: 3.1049, activeCalories: 312.4, avgHeartRate: 151, maxHeartRate: 172 }), exercises, [])
    expect(run).toMatchObject({ name: 'Run', source: 'health', activity: 'running', activeCalories: 312, avgHeartRate: 151, maxHeartRate: 172 })
    expect(run.sets).toEqual([{ exerciseId: 36, weight: 0, reps: 0, distance: 3.1, durationSeconds: 1620 }])
    expect(run.startedAt).toBe('2026-10-10T07:00:00.000Z')
  })

  it('gives strength training, and cardio without a built-in match, no sets', () => {
    expect(toForgeWorkout(watch('strength', '17:00', '18:00'), exercises, []).sets).toEqual([])
    expect(toForgeWorkout(watch('cycling', '17:00', '18:00'), exercises, []).sets).toEqual([]) // only a custom "Cycling"
    expect(toForgeWorkout(watch('surfing', '17:00', '18:00'), exercises, []).name).toBe('Workout')
  })
})

describe('workoutHealth', () => {
  it('works out average and max from the curve when Health had no summary, and drops impossible readings', () => {
    const health = workoutHealth(watch('strength', '17:00', '18:00'), [
      { s: 0, bpm: 100 },
      { s: 30, bpm: 400 }, // a glitch
      { s: 60, bpm: 140 },
    ])
    expect(health).toEqual({ activeCalories: null, avgHeartRate: 120, maxHeartRate: 140, heartRate: [{ s: 0, bpm: 100 }, { s: 60, bpm: 140 }] })
  })

  it('keeps at most 600 points, for the API', () => {
    const points = Array.from({ length: 1500 }, (_, i) => ({ s: i * 30, bpm: 120 }))
    expect(workoutHealth(watch('hiit', '17:00', '18:00'), points).heartRate!.length).toBeLessThanOrEqual(600)
  })
})

it('workoutTotals adds the Watch calories and average heart rate', () => {
  const workout: Workout = { ...logged('a', '17:00', '18:00'), activeCalories: 1312.6, avgHeartRate: 128 }
  expect(workoutTotals(workout)).toBe('925 lb · 1,313 kcal · 128 bpm avg')
})

describe('sleepByNight', () => {
  // Local times, as the phone sees them.
  const stretch = (start: string, end: string, value: number) => ({ start: Date.parse(start), end: Date.parse(end), value })

  it.each([
    {
      name: 'adds up core, deep, and REM, but not in bed or awake',
      samples: [
        stretch('2026-10-23T22:30', '2026-10-24T07:00', 0), // in bed
        stretch('2026-10-23T23:00', '2026-10-24T01:00', 3),
        stretch('2026-10-24T01:00', '2026-10-24T01:10', 2), // awake
        stretch('2026-10-24T01:10', '2026-10-24T02:00', 4),
        stretch('2026-10-24T02:00', '2026-10-24T03:00', 5),
        stretch('2026-10-24T03:00', '2026-10-24T06:30', 3),
      ],
      nights: [{ date: '2026-10-24', value: 440 }],
    },
    {
      name: 'counts a night two apps recorded once',
      samples: [stretch('2026-10-23T23:00', '2026-10-24T07:00', 3), stretch('2026-10-23T23:30', '2026-10-24T07:30', 1)],
      nights: [{ date: '2026-10-24', value: 510 }],
    },
    {
      name: 'keeps sleep from before a wake-up before midnight with the morning after',
      samples: [stretch('2026-10-23T22:00', '2026-10-23T23:40', 1), stretch('2026-10-23T23:50', '2026-10-24T06:30', 1)],
      nights: [{ date: '2026-10-24', value: 500 }],
    },
    {
      name: 'counts a nap toward its day',
      samples: [stretch('2026-10-23T23:00', '2026-10-24T06:00', 1), stretch('2026-10-24T14:00', '2026-10-24T14:30', 1)],
      nights: [{ date: '2026-10-24', value: 450 }],
    },
    {
      name: 'gives each night its own day',
      samples: [stretch('2026-10-23T23:30', '2026-10-24T07:00', 1), stretch('2026-10-22T23:00', '2026-10-23T06:00', 1)],
      nights: [
        { date: '2026-10-23', value: 420 },
        { date: '2026-10-24', value: 450 },
      ],
    },
    { name: 'no sleep recorded', samples: [], nights: [] },
  ])('$name', ({ samples, nights }) => {
    expect(sleepByNight(samples)).toEqual(nights)
  })
})
