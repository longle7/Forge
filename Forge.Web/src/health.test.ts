import { describe, expect, it } from 'vitest'
import type { Exercise, Workout } from './api'
import { addDays } from './dates'
import { matchWorkout, newWeighIns, recovery, sleepByNight, toForgeWorkout, workoutHealth, type WatchWorkout } from './health'
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

describe('recovery', () => {
  const today = '2026-10-24'
  // One reading a day before today, yesterday first, alternating between two values.
  const alternating = (a: number, b: number, days = 20) => Array.from({ length: days }, (_, i) => ({ date: addDays(today, -1 - i), value: i % 2 ? a : b }))
  const withToday = (days: { date: string; value: number }[], value: number | undefined) => (value === undefined ? days : [...days, { date: today, value }])
  const hrvMonth = alternating(40, 60) // usual 40–60 ms, average 49 (worked out in log space)
  const restingMonth = alternating(55, 59) // usual 55–59 bpm, average 57

  it.each([
    { name: 'both on the good side of average', hrv: 52, resting: 56, verdict: 'Ready' },
    { name: 'HRV under average but in your usual', hrv: 45, resting: 56, verdict: 'Normal' },
    { name: 'HRV below your usual', hrv: 38, resting: 56, verdict: 'Take it easy' },
    { name: 'resting heart rate above your usual', hrv: 55, resting: 61, verdict: 'Take it easy' },
    { name: 'HRV alone', hrv: 52, resting: undefined, verdict: 'Ready' },
    { name: 'resting heart rate alone', hrv: undefined, resting: 58, verdict: 'Normal' },
    { name: 'no readings today', hrv: undefined, resting: undefined, verdict: undefined },
  ])('$name: $verdict', ({ hrv, resting, verdict }) => {
    expect(recovery({ hrv: withToday(hrvMonth, hrv), restingHeartRate: withToday(restingMonth, resting) }, today).verdict).toBe(verdict)
  })

  it("gives today's readings with your usual range", () => {
    const { hrv, restingHeartRate } = recovery({ hrv: withToday(hrvMonth, 38), restingHeartRate: withToday(restingMonth, 56) }, today)
    expect(hrv?.today).toBe(38)
    expect(hrv?.low).toBeCloseTo(40)
    expect(hrv?.high).toBeCloseTo(60)
    expect(restingHeartRate).toEqual({ today: 56, low: 55, average: 57, high: 59 })
  })

  it('needs readings on 14 of the 30 days before today', () => {
    expect(recovery({ hrv: withToday(alternating(40, 60, 13), 52), restingHeartRate: [] }, today)).toEqual({})
    const monthsAgo = hrvMonth.map((d) => ({ ...d, date: addDays(d.date, -30) }))
    expect(recovery({ hrv: withToday(monthsAgo, 52), restingHeartRate: [] }, today)).toEqual({})
  })

  it.each([
    { hrv: 48, resting: 58, verdict: 'Normal' },
    { hrv: 47, resting: 58, verdict: 'Take it easy' }, // more than 5% under
    { hrv: 50, resting: 60, verdict: 'Take it easy' }, // more than 2 bpm over
  ])('a steady month still allows ±5% HRV and ±2 bpm: HRV $hrv, resting $resting is $verdict', ({ hrv, resting, verdict }) => {
    expect(recovery({ hrv: withToday(alternating(50, 50), hrv), restingHeartRate: withToday(alternating(57, 57), resting) }, today).verdict).toBe(verdict)
  })
})

it.each([
  { name: 'brings in a day without a weigh-in, to 0.1 lb', scale: [{ date: '2026-10-23', value: 181.46 }], weighIns: [{ date: '2026-10-23', weight: 181.5 }] },
  { name: 'never replaces a weigh-in you typed', scale: [{ date: '2026-10-22', value: 181.9 }], weighIns: [] },
  { name: 'skips weights the API would refuse', scale: [{ date: '2026-10-21', value: 30 }, { date: '2026-10-20', value: 1200 }], weighIns: [] },
])('newWeighIns $name', ({ scale, weighIns }) => {
  expect(newWeighIns(scale, [{ date: '2026-10-22', weight: 182 }])).toEqual(weighIns)
})
