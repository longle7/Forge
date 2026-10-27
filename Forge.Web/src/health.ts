import { Capacitor, registerPlugin } from '@capacitor/core'
import { getActivity, getExercises, getWorkouts, saveActivity, saveWorkout, saveWorkoutHealth, type Exercise, type HeartRatePoint, type Workout, type WorkoutHealth, type WorkoutInput } from './api'
import { read, readJson, write } from './cache'
import { addDays, localDate } from './dates'
import { REFRESH } from './usePolling'

/** A workout from Apple Health (plugins/health), recorded by the Apple Watch or another app. Times in ms since 1970. */
export interface WatchWorkout {
  uuid: string
  activity: string // 'running', 'walking', 'cycling', 'rowing', 'elliptical', 'strength', 'hiit', 'stairs', 'swimming', 'yoga', 'other'
  start: number
  end: number
  source: string // the app that recorded it, e.g. "Workout" (the Watch's) or "Strava"
  activeCalories?: number
  distanceMiles?: number
  avgHeartRate?: number
  maxHeartRate?: number
}

// The native side: plugins/health. Read-only; Forge never writes to Apple Health.
const Health = registerPlugin<{
  isAvailable(): Promise<{ available: boolean }>
  requestAccess(): Promise<void>
  workouts(options: { since: number }): Promise<{ workouts: WatchWorkout[] }>
  heartRate(options: { start: number; end: number }): Promise<{ points: HeartRatePoint[] }>
  activeEnergy(options: { from: string; to: string }): Promise<{ days: { date: string; kcal: number }[] }>
}>('Health')

const CONNECTED_KEY = 'forge.healthConnected'
const SYNCED_KEY = 'forge.healthSyncedAt'
const SEEN_KEY = 'forge.healthSeen' // Apple Health workout IDs already brought in, so one you delete in Forge stays deleted
const FIRST_SYNC_DAYS = 30
const EVERY_MS = 5 * 60_000

/** Apple Health is only on the iPhone app. */
export const healthSupported = () => Capacitor.getPlatform() === 'ios'
export const healthConnected = () => healthSupported() && read(CONNECTED_KEY) === '1'
export const lastHealthSync = () => Number(read(SYNCED_KEY)) || undefined

/** Shows Apple Health's permission sheet, then brings in your recent workouts. Resolves to how many came in. */
export async function connectHealth(): Promise<number> {
  if (!(await Health.isAvailable()).available) throw new Error("Apple Health isn't available on this iPhone.")
  await Health.requestAccess()
  write(CONNECTED_KEY, '1')
  return syncHealth(true)
}

/** Stops bringing in Apple Health data on this phone. What came in stays; Health's own switch is in Health → Sharing. */
export function disconnectHealth() {
  write(CONNECTED_KEY, null)
  write(SYNCED_KEY, null)
}

/** After Delete Account: forget everything about Apple Health on this phone, too. */
export function forgetHealth() {
  disconnectHealth()
  write(SEEN_KEY, null)
}

// Apple Health activities that are one of Forge's built-in cardio exercises.
const CARDIO_EXERCISE: Record<string, string> = {
  running: 'Running',
  walking: 'Walking',
  cycling: 'Cycling',
  rowing: 'Rowing (Machine)',
  elliptical: 'Elliptical (Machine)',
}
const NAMES: Record<string, string> = {
  running: 'Run',
  walking: 'Walk',
  cycling: 'Ride',
  rowing: 'Row',
  elliptical: 'Elliptical',
  strength: 'Strength Training',
  hiit: 'HIIT',
  stairs: 'Stair Climbing',
  swimming: 'Swim',
  yoga: 'Yoga',
}

/**
 * The workout you logged in Forge that an Apple Health workout is the same session as: they overlap by at least half
 * of the shorter one. Workouts that came from Health themselves don't count.
 */
export function matchWorkout(watch: WatchWorkout, workouts: Workout[]): Workout | undefined {
  let best: { workout: Workout; overlap: number } | undefined
  for (const workout of workouts) {
    if (workout.source === 'health') continue
    const [start, end] = [Date.parse(workout.startedAt), Date.parse(workout.finishedAt)]
    const overlap = Math.min(end, watch.end) - Math.max(start, watch.start)
    if (overlap > 0 && overlap >= Math.min(end - start, watch.end - watch.start) / 2 && (!best || overlap > best.overlap)) best = { workout, overlap }
  }
  return best?.workout
}

/**
 * Heart rate the API takes: 30–250 bpm, at most 600 points (every other one past that), with average and max from
 * the points when Health had no summary.
 */
export function workoutHealth(watch: WatchWorkout, points: HeartRatePoint[]): WorkoutHealth {
  let curve = points.filter((p) => p.bpm >= 30 && p.bpm <= 250)
  while (curve.length > 600) curve = curve.filter((_, i) => i % 2 === 0)
  const inRange = (bpm: number | undefined) => (bpm !== undefined && bpm >= 30 && bpm <= 250 ? Math.round(bpm) : null)
  const average = curve.length ? curve.reduce((sum, p) => sum + p.bpm, 0) / curve.length : undefined
  return {
    activeCalories: watch.activeCalories !== undefined ? Math.min(5000, Math.max(0, Math.round(watch.activeCalories))) : null,
    avgHeartRate: inRange(watch.avgHeartRate ?? average),
    maxHeartRate: inRange(watch.maxHeartRate ?? (curve.length ? Math.max(...curve.map((p) => p.bpm)) : undefined)),
    heartRate: curve,
  }
}

/**
 * An Apple Health workout as a Forge workout: a run, walk, ride, row, or elliptical session is one cardio set (its
 * distance and time); anything else, like strength training, has no sets (the Watch doesn't record them).
 */
export function toForgeWorkout(watch: WatchWorkout, exercises: Exercise[], points: HeartRatePoint[]): WorkoutInput {
  const cardio = exercises.find((e) => !e.isCustom && e.name === CARDIO_EXERCISE[watch.activity])
  const seconds = Math.round((watch.end - watch.start) / 1000)
  const miles = watch.distanceMiles && watch.distanceMiles > 0 ? Math.min(1000, Math.round(watch.distanceMiles * 100) / 100) : null
  return {
    name: NAMES[watch.activity] ?? 'Workout',
    startedAt: new Date(watch.start).toISOString(),
    finishedAt: new Date(watch.end).toISOString(),
    sets: cardio && seconds > 0 ? [{ exerciseId: cardio.id, weight: 0, reps: 0, distance: miles, durationSeconds: Math.min(86_400, seconds) }] : [],
    source: 'health',
    activity: watch.activity,
    ...workoutHealth(watch, points),
  }
}

let syncing: Promise<number> | undefined

/**
 * Brings in Apple Health workouts since the last sync (the last 30 days the first time): one that's the same session
 * as a workout you logged in Forge adds its calories and heart rate to it; any other becomes a workout of its own,
 * saved under Apple Health's ID so it's never added twice. Then the last week's active calories, for the calorie
 * budget (see dayBudget). Runs when the app opens or comes back (at most every 5 minutes) and from Settings → Sync Now
 * (`force`). Resolves to how many workouts came in or got Watch data.
 */
export function syncHealth(force = false): Promise<number> {
  if (!healthConnected()) return Promise.resolve(0)
  if (!force && Date.now() - (lastHealthSync() ?? 0) < EVERY_MS) return Promise.resolve(syncing ?? 0)
  syncing ??= sync().finally(() => (syncing = undefined))
  return syncing
}

async function sync(): Promise<number> {
  const startedAt = Date.now()
  // A day of overlap: the Watch can hand a workout to the phone hours after it ended.
  const since = (lastHealthSync() ?? startedAt - FIRST_SYNC_DAYS * 86_400_000) - 86_400_000
  const [{ workouts: watch }, workouts, exercises] = await Promise.all([Health.workouts({ since }), getWorkouts(), getExercises()])
  const seen = new Set(readJson<string[]>(SEEN_KEY) ?? [])
  let count = 0
  for (const w of watch) {
    const id = w.uuid.toLowerCase()
    if (seen.has(id) || w.end > startedAt) continue // already in, or still going
    const { points } = await Health.heartRate({ start: w.start, end: w.end })
    const match = matchWorkout(w, workouts)
    if (match) await saveWorkoutHealth(match.id, workoutHealth(w, points))
    else await saveWorkout(id, toForgeWorkout(w, exercises, points))
    seen.add(id)
    count++
  }
  write(SEEN_KEY, JSON.stringify([...seen].slice(-500))) // ponytail: the last 500 is plenty for a day of overlap
  write(SYNCED_KEY, String(startedAt))

  // Active calories for the last week: today's grows all day, and the Watch can hand over a day's calories late. Only
  // days that changed are saved.
  const to = localDate(new Date(startedAt))
  const from = addDays(to, -6)
  const [days, saved] = await Promise.all([healthActiveEnergy(from, to), getActivity(from, to)])
  let changed = count > 0
  for (const day of days) {
    const kcal = Math.min(10_000, Math.round(day.kcal))
    if (kcal === 0 || saved.find((s) => s.date === day.date)?.kcal === kcal) continue
    await saveActivity(day.date, kcal)
    changed = true
  }
  if (changed) window.dispatchEvent(new Event(REFRESH))
  return count
}

/** Active calories (Move ring) per day from Apple Health, for `from` to `to` (YYYY-MM-DD). */
export const healthActiveEnergy = (from: string, to: string) => Health.activeEnergy({ from, to }).then((r) => r.days)
