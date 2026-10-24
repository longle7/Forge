import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutSet } from './api'
import { cardStats, fitList, fitText, heartRateLine } from './shareCard'

// Every character is half the font size wide.
const measure = (text: string, size: number) => text.length * size * 0.5

const workout = (fields: Partial<Workout>): Workout => ({
  id: 'w',
  name: 'Push Day',
  startedAt: '2026-10-17T17:00:00Z',
  finishedAt: '2026-10-17T18:05:00Z',
  sets: [],
  ...fields,
})

describe('fitText', () => {
  it('keeps the largest size that fits', () => {
    expect(fitText('Push Day', 1000, 104, 64, measure)).toEqual({ text: 'Push Day', size: 104 })
  })

  it('shrinks in 4 px steps until it fits', () => {
    expect(fitText('Push Day', 8 * 0.5 * 88, 104, 64, measure)).toEqual({ text: 'Push Day', size: 88 })
  })

  it('cuts it short with an ellipsis at the smallest size', () => {
    expect(fitText('Upper Body Power', 6 * 0.5 * 64, 104, 64, measure)).toEqual({ text: 'Upper…', size: 64 })
  })
})

describe('fitList', () => {
  const fits = (text: string) => text.length <= 24

  it('lists them all when they fit', () => {
    expect(fitList(['Bench', 'Squat', 'Row'], fits)).toBe('Bench · Squat · Row')
  })

  it('counts the rest when they don’t', () => {
    expect(fitList(['Bench Press', 'Squat', 'Deadlift', 'Row'], fits)).toBe('Bench Press +3 more')
  })

  it('is empty with nothing to list', () => {
    expect(fitList([], fits)).toBe('')
  })
})

describe('heartRateLine', () => {
  const box = { x: 10, y: 20, width: 100, height: 50 }

  it('runs across the box, the highest reading at the top', () => {
    const line = heartRateLine([{ s: 0, bpm: 100 }, { s: 30, bpm: 160 }, { s: 60, bpm: 130 }], box)
    expect(line).toEqual([[10, 70], [60, 20], [110, 45]])
  })

  it('draws a steady heart rate across the middle', () => {
    expect(heartRateLine([{ s: 0, bpm: 120 }, { s: 30, bpm: 120 }], box)).toEqual([[10, 45], [110, 45]])
  })
})

describe('cardStats', () => {
  it('shows a lifting session’s time, volume, and sets', () => {
    const sets = [{ exerciseId: 1, weight: 135, reps: 8 }, { exerciseId: 1, weight: 145, reps: 6 }]
    expect(cardStats(workout({ sets }))).toEqual([
      { label: 'Time', value: '1h 5m' },
      { label: 'Volume', value: '1,950 lb' },
      { label: 'Sets', value: '2' },
    ])
  })

  it('leaves warm-ups out of the volume and sets', () => {
    const sets: WorkoutSet[] = [{ exerciseId: 1, weight: 95, reps: 10, kind: 'warmup' }, { exerciseId: 1, weight: 135, reps: 8 }]
    expect(cardStats(workout({ sets }))).toEqual([
      { label: 'Time', value: '1h 5m' },
      { label: 'Volume', value: '1,080 lb' },
      { label: 'Sets', value: '1' },
    ])
  })

  it('keeps four tiles, the Watch’s calories before its heart rate', () => {
    const sets = [{ exerciseId: 1, weight: 135, reps: 8 }]
    expect(cardStats(workout({ sets, activeCalories: 312.4, avgHeartRate: 128 })).map((s) => s.label)).toEqual(['Time', 'Volume', 'Sets', 'Active calories'])
  })

  it('shows a Watch run’s distance, calories, and heart rate', () => {
    const run = workout({ sets: [{ exerciseId: 36, weight: 0, reps: 0, distance: 3.1, durationSeconds: 1620 }], activeCalories: 340, avgHeartRate: 152, source: 'health' })
    expect(cardStats(run)).toEqual([
      { label: 'Time', value: '1h 5m' },
      { label: 'Distance', value: '3.1 mi' },
      { label: 'Active calories', value: '340 kcal' },
      { label: 'Avg heart rate', value: '152 bpm' },
    ])
  })
})
