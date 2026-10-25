import { Capacitor, registerPlugin } from '@capacitor/core'
import { getActivity, getExercises, getWeighIns, getWorkouts, saveActivity, saveWeighIn, saveWorkout, saveWorkoutHealth, type Exercise, type HeartRatePoint, type WeighIn, type Workout, type WorkoutHealth, type WorkoutInput } from './api'
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

/** A day's reading from Apple Health: its total (steps), average (resting heart rate), or latest (weight). */
export interface HealthDay {
  date: string // YYYY-MM-DD, your time zone
  value: number
}

/** A stretch of sleep as Health keeps it. Times in ms since 1970; `value` is the stage (see ASLEEP). */
export interface SleepSample {
  start: number
  end: number
  value: number
}

// What `daily` can read, by HealthKit's names: active calories (kcal), steps, resting heart rate (bpm), heart rate
// variability (ms), and weight (lb).
type DailyType = 'activeEnergy' | 'stepCount' | 'restingHeartRate' | 'heartRateVariabilitySDNN' | 'bodyMass'

// The native side: plugins/health. Read-only; Forge never writes to Apple Health.
const Health = registerPlugin<{
  isAvailable(): Promise<{ available: boolean }>
  requestAccess(): Promise<void>
  needsAccess(): Promise<{ needed: boolean }>
  workouts(options: { since: number }): Promise<{ workouts: WatchWorkout[] }>
  heartRate(options: { start: number; end: number }): Promise<{ points: HeartRatePoint[] }>
  daily(options: { type: DailyType; from: string; to: string }): Promise<{ days: HealthDay[] }>
  sleep(options: { from: string; to: string }): Promise<{ samples: SleepSample[] }>
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

/** Whether Health has something to ask you about: what Forge started reading after you connected, like sleep. */
export const healthNeedsAccess = () => Health.needsAccess().then((r) => r.needed)

/** Shows Apple Health's permission sheet for what it hasn't asked about yet. Resolves whatever you allow. */
export const requestHealthAccess = () => Health.requestAccess()

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

// The sleep stages that are sleep: 1 asleep (from apps and Watches that don't record stages), 3 core, 4 deep, 5 REM; not
// 0 in bed or 2 awake. Health's raw numbers, so the plugin needs no checks for iOS 16, which added the stages.
const ASLEEP = new Set([1, 3, 4, 5])

/**
 * Minutes asleep each night, by the day you woke up, oldest first. The Watch, the iPhone, and other apps can each record
 * the same night, so overlapping stretches are merged before they're added up. A night runs from 6 PM to 6 PM, so sleep
 * before a wake-up before midnight still counts toward the morning after.
 * ponytail: naps count as sleep (after 6 PM, toward the next morning); split them out by time of day if that misleads.
 */
export function sleepByNight(samples: SleepSample[]): HealthDay[] {
  const asleep = samples.filter((s) => ASLEEP.has(s.value)).sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  for (const { start, end } of asleep) {
    const last = merged.at(-1)
    if (last && start <= last.end) last.end = Math.max(last.end, end)
    else merged.push({ start, end })
  }
  const minutes = new Map<string, number>()
  for (const { start, end } of merged) {
    const night = localDate(new Date(end + 6 * 3_600_000))
    minutes.set(night, (minutes.get(night) ?? 0) + (end - start) / 60_000)
  }
  return [...minutes].map(([date, value]) => ({ date, value }))
}

/**
 * Weights from Health (a smart scale, or typed into Health) for days without a weigh-in in Forge, rounded to 0.1 lb
 * like one you type, and only 50 to 1,000 lb, as the API takes. A weight you typed in Forge is never replaced, and
 * bringing them in again adds nothing.
 */
export function newWeighIns(scale: HealthDay[], saved: WeighIn[]): WeighIn[] {
  const weighed = new Set(saved.map((w) => w.date))
  return scale
    .filter((day) => !weighed.has(day.date))
    .map((day) => ({ date: day.date, weight: Math.round(day.value * 10) / 10 }))
    .filter((w) => w.weight >= 50 && w.weight <= 1000)
}

let syncing: Promise<number> | undefined

/**
 * Brings in Apple Health workouts since the last sync (the last 30 days the first time): one that's the same session
 * as a workout you logged in Forge adds its calories and heart rate to it; any other becomes a workout of its own,
 * saved under Apple Health's ID so it's never added twice. Then the last week's active calories, for the calorie
 * budget (see dayBudget), and the last 30 days' weights from a smart scale, as weigh-ins on days without one. Runs when
 * the app opens or comes back (at most every 5 minutes) and from Settings → Sync Now (`force`). Resolves to how many
 * workouts came in or got Watch data.
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
    const kcal = Math.min(10_000, Math.round(day.value))
    if (kcal === 0 || saved.find((s) => s.date === day.date)?.kcal === kcal) continue
    await saveActivity(day.date, kcal)
    changed = true
  }

  // Weights from the last 30 days, so a scale that syncs late, or a weigh-in from before you allowed weight, still
  // comes in.
  const [scale, weighIns] = await Promise.all([healthDaily('bodyMass', addDays(to, -29), to), getWeighIns()])
  for (const weighIn of newWeighIns(scale, weighIns)) {
    await saveWeighIn(weighIn.date, weighIn.weight)
    changed = true
  }
  if (changed) window.dispatchEvent(new Event(REFRESH))
  return count
}

/** Each day's reading of `type` from Apple Health, `from` to `to` (YYYY-MM-DD); days without one are left out. */
export const healthDaily = (type: DailyType, from: string, to: string) => Health.daily({ type, from, to }).then((r) => r.days)

/** Active calories (Move ring) per day from Apple Health, for `from` to `to` (YYYY-MM-DD). */
export const healthActiveEnergy = (from: string, to: string) => healthDaily('activeEnergy', from, to)

/** Minutes asleep each night from `from` to `to` (YYYY-MM-DD), by the day you woke up (see sleepByNight). */
export const healthSleep = (from: string, to: string) => Health.sleep({ from, to }).then((r) => sleepByNight(r.samples).filter((night) => night.date >= from && night.date <= to))
