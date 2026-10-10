import type { Workout, WorkoutSet } from './api'

/** A workout's sets by exercise, in the order each exercise was first done. */
export function groupSets(sets: WorkoutSet[]): { exerciseId: number; sets: WorkoutSet[] }[] {
  const groups = new Map<number, WorkoutSet[]>()
  for (const set of sets) {
    const group = groups.get(set.exerciseId)
    if (group) group.push(set)
    else groups.set(set.exerciseId, [set])
  }
  return [...groups].map(([exerciseId, sets]) => ({ exerciseId, sets }))
}

/** Estimated one-rep max (Epley): what 8 reps at 135 lb says you could lift once (171 lb). */
export const oneRepMax = (weight: number, reps: number) => (reps === 1 ? weight : weight * (1 + reps / 30))

/**
 * How a set ranks for records: its estimated 1RM, or its reps for a bodyweight set.
 * ponytail: bodyweight sets score by reps, so mixing bodyweight and weighted sets of one exercise can mislabel PRs.
 */
const score = (set: WorkoutSet) => (set.weight > 0 ? oneRepMax(set.weight, set.reps) : set.reps)

const byStart = (a: Workout, b: Workout) => Date.parse(a.startedAt) - Date.parse(b.startedAt)

/**
 * Each workout's PRs, as indexes into its sets: for every exercise, the workout's best set when it beats all earlier
 * workouts. The first time you do an exercise isn't a PR (there's nothing to beat).
 */
export function personalRecords(workouts: Workout[]): Map<string, Set<number>> {
  const best = new Map<number, number>() // exerciseId → best score so far
  const records = new Map<string, Set<number>>()
  for (const workout of [...workouts].sort(byStart)) {
    const top = new Map<number, number>() // exerciseId → index of this workout's best set
    workout.sets.forEach((set, i) => {
      const t = top.get(set.exerciseId)
      if (t === undefined || score(set) > score(workout.sets[t])) top.set(set.exerciseId, i)
    })
    const prs = new Set<number>()
    for (const [exerciseId, i] of top) {
      const previous = best.get(exerciseId)
      const value = score(workout.sets[i])
      if (previous !== undefined && value > previous) prs.add(i)
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
      if (set.exerciseId === exerciseId && (!best || score(set) > score(best.set))) best = { set, workout }
    }
  }
  return best
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

/** Total pounds lifted: weight × reps over every set. */
export const volume = (workout: Workout) => workout.sets.reduce((sum, s) => sum + s.weight * s.reps, 0)

const pounds = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

/** "135", "137.5", "12,345" */
export const formatWeight = (weight: number) => pounds.format(weight)

/** "135 lb × 8", or "12 reps" for a bodyweight set. */
export const formatSet = (set: WorkoutSet) => (set.weight > 0 ? `${formatWeight(set.weight)} lb × ${set.reps}` : `${set.reps} reps`)

/** "48m", "1h 5m" */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

/** "Sat, Oct 10" */
export const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/** "6:05 PM" */
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
