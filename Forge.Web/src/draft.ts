import { readJson, write } from './cache'
import { randomId, type PlanDay, type SetKind, type Workout, type WorkoutInput, type WorkoutSet } from './api'
import { formatClock, groupSets, isCardioSet, parseDuration } from './workouts'

/**
 * The workout in progress. It lives on this device (localStorage) until Finish uploads it, so a reload, a closed tab,
 * or no signal at the gym loses nothing.
 */
export interface Draft {
  id: string // the workout's ID: Finish, a retry, or an edit all save to PUT /workouts/{id}
  name: string
  startedAt: string // ISO
  finishedAt?: string // set by the first Finish, so a retry later keeps the real end time; kept when editing
  editing?: boolean // a saved workout opened from History
  exercises: DraftExercise[]
  restEndsAt?: number // the rest timer, ms since epoch
  restTotal?: number // its length in seconds
}

export interface DraftExercise {
  exerciseId: number
  superset?: number // exercises done back to back as a superset share this group number
  sets: DraftSet[]
}

export interface DraftSet {
  weight: string // text while typing, so a field can be empty
  reps: string
  distance?: string // cardio: miles
  time?: string // cardio: "27:30", or minutes
  kind?: SetKind // lifting only; none = a normal set, as in drafts saved before set kinds
  done: boolean // checked off; only these are saved
}

const KEY = 'forge.activeWorkout'

export const loadDraft = () => readJson<Draft>(KEY)

/** Keeps the workout in progress on this device; undefined once it's saved or discarded. */
export const saveDraft = (draft: Draft | undefined) => write(KEY, draft ? JSON.stringify(draft) : null)

/** "Morning Workout", "Afternoon Workout", or "Evening Workout", like Strong. */
export function workoutName(now: Date): string {
  const hour = now.getHours()
  return `${hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'} Workout`
}

export const emptyDraft = (now = new Date()): Draft => ({ id: randomId(), name: workoutName(now), startedAt: now.toISOString(), exercises: [] })

const draftExercises = (workout: Workout, done: boolean): DraftExercise[] =>
  groupSets(workout.sets).map(({ exerciseId, sets }) => ({
    exerciseId,
    superset: sets[0].superset ?? undefined,
    sets: sets.map((s) =>
      isCardioSet(s)
        ? { weight: '', reps: '', distance: s.distance ? String(s.distance) : '', time: s.durationSeconds ? formatClock(s.durationSeconds * 1000) : '', done }
        : { weight: String(s.weight), reps: String(s.reps), kind: s.kind ?? undefined, done },
    ),
  }))

/** A new workout with the same exercises and sets as `workout`, values filled in, nothing checked off yet. */
export const repeatDraft = (workout: Workout, now = new Date()): Draft => ({
  ...emptyDraft(now),
  // A name you chose ("Push day") carries over; an automatic one follows the time of day.
  name: /^(Morning|Afternoon|Evening) Workout$/.test(workout.name) ? workoutName(now) : workout.name,
  exercises: draftExercises(workout, false),
})

/**
 * A planned workout, ready to log: its exercises with the planned number of sets and reps filled in, and one set for
 * each cardio exercise (`cardio`: their IDs). Weights stay empty: the logger shows last time's as hints and uses them
 * when you check a set off.
 */
export const planDraft = (plan: PlanDay, cardio: Set<number>, now = new Date()): Draft => ({
  ...emptyDraft(now),
  name: plan.name,
  exercises: plan.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    sets: cardio.has(e.exerciseId)
      ? [{ weight: '', reps: '', distance: '', time: '', done: false }]
      : Array.from({ length: e.sets }, () => ({ weight: '', reps: String(e.reps), done: false })),
  })),
})

/** A saved workout opened for editing: the same ID and times, every set checked off. */
export const editDraft = (workout: Workout): Draft => ({
  id: workout.id,
  name: workout.name,
  startedAt: workout.startedAt,
  finishedAt: workout.finishedAt,
  editing: true,
  exercises: draftExercises(workout, true),
})

/**
 * What Finish saves: the checked-off sets, exercise by exercise, that have reps (an empty weight counts as 0, bodyweight)
 * or, for cardio, a distance or time. Each set carries its exercise's superset.
 */
export function toWorkout(draft: Draft, finishedAt: string): WorkoutInput {
  return {
    name: draft.name.trim(),
    startedAt: draft.startedAt,
    finishedAt,
    sets: draft.exercises.flatMap(({ exerciseId, superset, sets }) => sets.flatMap((s) => toSet(exerciseId, s) ?? []).map((set) => ({ ...set, superset }))),
  }
}

/** A checked-off set as it will be saved, or undefined when it isn't done or has nothing in it. */
export function toSet(exerciseId: number, s: DraftSet): WorkoutSet | undefined {
  if (!s.done) return undefined
  const distance = Number(s.distance) || 0
  const seconds = parseDuration(s.time ?? '')
  if (distance > 0 || seconds > 0) return { exerciseId, weight: 0, reps: 0, distance: distance > 0 ? distance : null, durationSeconds: seconds > 0 ? seconds : null }
  const reps = Math.round(Number(s.reps))
  return reps > 0 ? { exerciseId, weight: Number(s.weight) || 0, reps, kind: s.kind } : undefined
}
