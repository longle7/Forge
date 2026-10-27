import type { SetKind, Workout, WorkoutSet } from './api'

/**
 * A workout's sets, one group for each exercise as it was done. Sets are saved exercise by exercise (see toWorkout), so
 * a group ends where the exercise or its superset changes, and an exercise done twice shows twice.
 */
export function groupSets(sets: WorkoutSet[]): { exerciseId: number; sets: WorkoutSet[] }[] {
  const groups: { exerciseId: number; sets: WorkoutSet[] }[] = []
  for (const set of sets) {
    const group = groups.at(-1)
    // null (from the API) and missing (made in the app) both mean "not in a superset".
    if (group?.exerciseId === set.exerciseId && (group.sets[0].superset ?? null) === (set.superset ?? null)) group.sets.push(set)
    else groups.push({ exerciseId: set.exerciseId, sets: [set] })
  }
  return groups
}

/** Each exercise in `sets` once, by name, in the order first done. */
export const exerciseNames = (sets: WorkoutSet[], names: Map<number, string>) => [...new Set(sets.map((s) => s.exerciseId))].map((id) => names.get(id) ?? 'Exercise')

/** Estimated one-rep max (Epley): what 8 reps at 135 lb says you could lift once (171 lb). */
export const oneRepMax = (weight: number, reps: number) => (reps === 1 ? weight : weight * (1 + reps / 30))

/** A cardio set: a distance and/or a time instead of weight and reps. */
export const isCardioSet = (set: WorkoutSet) => set.distance != null || set.durationSeconds != null

/** A warm-up set: it only gets you ready, so PRs, maxes, and totals leave it out. */
export const isWarmup = (set: Pick<WorkoutSet, 'kind'>) => set.kind === 'warmup'

/** A set to estimate a 1-rep max from: weighted, not cardio, and not a warm-up. */
export const isLift = (set: WorkoutSet) => set.weight > 0 && !isCardioSet(set) && !isWarmup(set)

/**
 * How a set ranks for records: its estimated 1RM, its reps for a bodyweight set, or for cardio its distance (minutes
 * when it has no distance), so a cardio PR is your longest one.
 * ponytail: bodyweight sets score by reps and time-only cardio by minutes, so mixing those with weighted or distance
 * sets of one exercise can mislabel PRs.
 */
const score = (set: WorkoutSet) =>
  isCardioSet(set) ? set.distance || (set.durationSeconds ?? 0) / 60 : set.weight > 0 ? oneRepMax(set.weight, set.reps) : set.reps

/** Oldest first, for sort. */
export const byStart = (a: Workout, b: Workout) => Date.parse(a.startedAt) - Date.parse(b.startedAt)

/**
 * Each workout's PRs (the set objects themselves): for every exercise, the workout's best set when it beats all
 * earlier workouts. The first time you do an exercise isn't a PR (there's nothing to beat).
 */
export function personalRecords(workouts: Workout[]): Map<string, Set<WorkoutSet>> {
  const best = new Map<number, number>() // exerciseId → best score so far
  const records = new Map<string, Set<WorkoutSet>>()
  for (const workout of [...workouts].sort(byStart)) {
    const top = new Map<number, number>() // exerciseId → index of this workout's best set
    workout.sets.forEach((set, i) => {
      const t = top.get(set.exerciseId)
      if (!isWarmup(set) && (t === undefined || score(set) > score(workout.sets[t]))) top.set(set.exerciseId, i)
    })
    const prs = new Set<WorkoutSet>()
    for (const [exerciseId, i] of top) {
      const previous = best.get(exerciseId)
      const value = score(workout.sets[i])
      if (previous !== undefined && value > previous) prs.add(workout.sets[i])
      if (previous === undefined || value > previous) best.set(exerciseId, value)
    }
    records.set(workout.id, prs)
  }
  return records
}

/** An exercise's best set ever (by estimated 1RM, or reps for bodyweight), and the workout it was in. */
export function bestSet(workouts: Workout[], exerciseId: number): { set: WorkoutSet; workout: Workout } | undefined {
  let best: { set: WorkoutSet; workout: Workout } | undefined
  for (const workout of workouts) {
    for (const set of workout.sets) {
      if (set.exerciseId === exerciseId && !isWarmup(set) && (!best || score(set) > score(best.set))) best = { set, workout }
    }
  }
  return best
}

/**
 * While logging: the index of the set that's a PR so far, the best of `sets` (undefined = not done) when it beats every
 * saved workout but `excludeId`. Like personalRecords, the first time you do an exercise isn't a PR.
 */
export function livePr(workouts: Workout[], exerciseId: number, sets: (WorkoutSet | undefined)[], excludeId?: string): number | undefined {
  const best = bestSet(workouts.filter((w) => w.id !== excludeId), exerciseId)
  if (!best) return undefined
  let top: number | undefined
  sets.forEach((set, i) => {
    if (set && !isWarmup(set) && score(set) > score(best.set) && (top === undefined || score(set) > score(sets[top]!))) top = i
  })
  return top
}

/**
 * The "Previous" column: this exercise's sets from the most recent workout that has it. `workouts` are newest first,
 * as the API returns them; `excludeId` skips the workout being edited.
 */
export function previousSets(workouts: Workout[], exerciseId: number, excludeId?: string): WorkoutSet[] {
  for (const workout of workouts) {
    if (workout.id === excludeId) continue
    const sets = workout.sets.filter((s) => s.exerciseId === exerciseId)
    if (sets.length > 0) return sets
  }
  return []
}

/**
 * Last time's set to show beside set `index` of `sets`, and to fill it in from: warm-ups match warm-ups and working sets
 * match working sets, by their place among their own kind, or the last one of that kind when last time had fewer.
 */
export function previousFor(previous: WorkoutSet[], sets: Pick<WorkoutSet, 'kind'>[], index: number): WorkoutSet | undefined {
  const warmup = isWarmup(sets[index])
  const sameKind = previous.filter((s) => isWarmup(s) === warmup)
  const place = sets.slice(0, index).filter((s) => isWarmup(s) === warmup).length
  return sameKind[place] ?? sameKind.at(-1)
}

/** What each kind of set is called, in menus and to screen readers, and the letter that marks it in a list of sets. */
export const SET_KINDS: Record<SetKind, { name: string; letter: string }> = {
  warmup: { name: 'Warm-up', letter: 'W' },
  drop: { name: 'Drop set', letter: 'D' },
  failure: { name: 'Failure', letter: 'F' },
}

/** How each set is marked in a list: W, D, or F, or its number among the normal sets, so warm-ups don't use up numbers. */
export function setLabels(sets: Pick<WorkoutSet, 'kind'>[]): string[] {
  let normalSets = 0
  return sets.map((set) => (set.kind ? SET_KINDS[set.kind].letter : String(++normalSets)))
}

/** The sets that aren't normal ones, counted: "+2 warm-ups, 1 drop set", or "" when there are none. */
export function setKindsSummary(sets: Pick<WorkoutSet, 'kind'>[]): string {
  const counted = (Object.keys(SET_KINDS) as SetKind[])
    .map((kind) => ({ kind, count: sets.filter((s) => s.kind === kind).length }))
    .filter(({ count }) => count > 0)
    .map(({ kind, count }) => plural(count, SET_KINDS[kind].name.toLowerCase()))
  return counted.length ? `+${counted.join(', ')}` : ''
}

/**
 * Exercises as they're done: the neighbours that share a superset number together, every other exercise on its own. A
 * number only counts when a neighbour shares it, so moving or removing an exercise needs no cleanup. `superset` reads
 * an exercise's number (null or undefined: none).
 */
export function groupSupersets<T>(exercises: T[], superset: (exercise: T) => number | null | undefined): T[][] {
  const groups: T[][] = []
  for (const exercise of exercises) {
    const group = groups.at(-1)
    const number = superset(exercise)
    if (group && number != null && superset(group[0]) === number) group.push(exercise)
    else groups.push([exercise])
  }
  return groups
}

/** The list with the item at `index` swapped with its neighbour: `by` -1 moves it up, 1 down (an exercise in a plan or workout). */
export function move<T>(list: T[], index: number, by: number): T[] {
  const moved = [...list]
  ;[moved[index], moved[index + by]] = [moved[index + by], moved[index]]
  return moved
}

/** The exercises in your latest workouts, most recent first, for the top of the exercise picker. */
export const recentExercises = (workouts: Workout[], count = 6) => [...new Set(workouts.flatMap((w) => w.sets.map((s) => s.exerciseId)))].slice(0, count)

/** Total pounds lifted: weight × reps over every set but warm-ups. */
export const volume = (workout: Workout) => workout.sets.filter((s) => !isWarmup(s)).reduce((sum, s) => sum + s.weight * s.reps, 0)

/**
 * What a workout added up to: "12,345 lb", "3.1 mi", and from Apple Health "312 kcal" and "128 bpm avg", or ""
 * (bodyweight and timed cardio only).
 */
export function workoutTotals(workout: Workout): string {
  const miles = workout.sets.reduce((sum, s) => sum + (s.distance ?? 0), 0)
  return [
    volume(workout) > 0 && `${formatWeight(volume(workout))} lb`,
    miles > 0 && `${formatMiles(miles)} mi`,
    workout.activeCalories && `${Math.round(workout.activeCalories).toLocaleString()} kcal`,
    workout.avgHeartRate && `${workout.avgHeartRate} bpm avg`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** How long a workout took: start to finish, or its cardio time when that's longer (a run logged afterwards). */
export function workoutLength(workout: Workout): number {
  const cardio = workout.sets.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) * 1000
  return Math.max(Date.parse(workout.finishedAt) - Date.parse(workout.startedAt), cardio)
}

/** Seconds per mile, for a cardio set with both a distance and a time. */
export const pace = (set: WorkoutSet) => (set.distance && set.durationSeconds ? set.durationSeconds / set.distance : undefined)

/**
 * How much weight to add this time: 5 lb (10 for legs) when last time's sets, warm-ups aside, all hit their target reps
 * (this workout's reps, which a plan fills in), with at least as many sets; otherwise 0, as with no weights to go on.
 */
export function progressionStep(previous: WorkoutSet[], targets: number[], legs: boolean): number {
  const workingSets = previous.filter((s) => !isWarmup(s))
  const hitEveryRep =
    targets.length > 0 && workingSets.length >= targets.length && targets.every((reps, i) => reps > 0 && workingSets[i].weight > 0 && workingSets[i].reps >= reps)
  return hitEveryRep ? (legs ? 10 : 5) : 0
}

export const BAR = 45
const PLATES = [45, 35, 25, 10, 5, 2.5]

/** The plates for each side of a 45 lb bar, heaviest first, and the total they make (less when it can't be exact). */
export function platesPerSide(total: number): { plates: number[]; loaded: number } {
  const plates: number[] = []
  let side = (total - BAR) / 2
  for (const plate of PLATES) {
    while (side >= plate) {
      plates.push(plate)
      side -= plate
    }
  }
  return { plates, loaded: BAR + 2 * plates.reduce((sum, p) => sum + p, 0) }
}

/** "1 exercise", "3 exercises" */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

const decimals = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

/** "135", "137.5", "12,345" */
export const formatWeight = (weight: number) => decimals.format(weight)

/** "3.1", "26.22" */
export const formatMiles = (miles: number) => decimals.format(miles)

/** "135 lb × 8", "12 reps" for a bodyweight set, or "3.1 mi · 27:00 · 8:42 /mi" for cardio. */
export function formatSet(set: WorkoutSet): string {
  if (!isCardioSet(set)) return set.weight > 0 ? `${formatWeight(set.weight)} lb × ${set.reps}` : `${set.reps} reps`
  const perMile = pace(set)
  return [set.distance && `${formatMiles(set.distance)} mi`, set.durationSeconds && formatClock(set.durationSeconds * 1000), perMile && `${formatClock(perMile * 1000)} /mi`]
    .filter(Boolean)
    .join(' · ')
}

/** One exercise's sets in a routine: "3 sets · 10, 8, 8 reps", or for cardio only how many ("1 set"). */
export const setsSummary = (sets: WorkoutSet[]) =>
  isCardioSet(sets[0]) ? plural(sets.length, 'set') : `${plural(sets.length, 'set')} · ${sets.map((s) => s.reps).join(', ')} reps`

/** A cardio set in short: "3.1 mi", or its time ("30:00") when it has no distance. */
export const formatCardio = (set: WorkoutSet) => (set.distance ? `${formatMiles(set.distance)} mi` : formatClock((set.durationSeconds ?? 0) * 1000))

/** "4:05", "1:02:03" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Seconds from "27:30" or "1:05:00", or from minutes as a number ("27", "27.5"). NaN when it isn't a time. */
export function parseDuration(text: string): number {
  const parts = text.trim().split(':')
  if (parts.length === 1) return parts[0] ? Math.round(Number(parts[0]) * 60) : NaN
  return parts.length <= 3 && parts.every((p) => /^\d+$/.test(p)) ? parts.reduce((total, p) => total * 60 + Number(p), 0) : NaN
}

/** "48m", "1h 5m"; "<1m" for a few seconds. */
export function formatDuration(ms: number): string {
  if (ms < 30_000) return '<1m'
  const minutes = Math.round(ms / 60_000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

/** "Sat, Oct 10" */
export const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/** "6:05 PM" */
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
