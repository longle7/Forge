import { randomId, type PlanDay, type Workout, type WorkoutInput } from './api'
import { groupSets } from './workouts'

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
}

export interface DraftExercise {
  exerciseId: number
  sets: DraftSet[]
}

export interface DraftSet {
  weight: string // text while typing, so a field can be empty
  reps: string
  done: boolean // checked off; only these are saved
}

const KEY = 'forge.activeWorkout'

export function loadDraft(): Draft | undefined {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? undefined
  } catch {
    return undefined // blocked or corrupted storage
  }
}

/** Keeps the workout in progress on this device; undefined once it's saved or discarded. */
export function saveDraft(draft: Draft | undefined) {
  try {
    if (draft) localStorage.setItem(KEY, JSON.stringify(draft))
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: the workout lasts while the page stays open
  }
}

/** "Morning Workout", "Afternoon Workout", or "Evening Workout", like Strong. */
export function workoutName(now: Date): string {
  const hour = now.getHours()
  return `${hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'} Workout`
}

export const emptyDraft = (now = new Date()): Draft => ({ id: randomId(), name: workoutName(now), startedAt: now.toISOString(), exercises: [] })

const draftExercises = (workout: Workout, done: boolean): DraftExercise[] =>
  groupSets(workout.sets).map(({ exerciseId, sets }) => ({
    exerciseId,
    sets: sets.map((s) => ({ weight: String(s.weight), reps: String(s.reps), done })),
  }))

/** A new workout with the same exercises and sets as `workout`, values filled in, nothing checked off yet. */
export const repeatDraft = (workout: Workout, now = new Date()): Draft => ({
  ...emptyDraft(now),
  // A name you chose ("Push day") carries over; an automatic one follows the time of day.
  name: /^(Morning|Afternoon|Evening) Workout$/.test(workout.name) ? workoutName(now) : workout.name,
  exercises: draftExercises(workout, false),
})

/**
 * A planned workout, ready to log: its exercises with the planned number of sets and reps filled in. Weights stay
 * empty: the logger shows last time's as hints and uses them when you check a set off.
 */
export const planDraft = (plan: PlanDay, now = new Date()): Draft => ({
  ...emptyDraft(now),
  name: plan.name,
  exercises: plan.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    sets: Array.from({ length: e.sets }, () => ({ weight: '', reps: String(e.reps), done: false })),
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

/** What Finish saves: the checked-off sets that have reps, in order. An empty weight counts as 0 (bodyweight). */
export function toWorkout(draft: Draft, finishedAt: string): WorkoutInput {
  return {
    name: draft.name.trim(),
    startedAt: draft.startedAt,
    finishedAt,
    sets: draft.exercises.flatMap(({ exerciseId, sets }) =>
      sets
        .filter((s) => s.done && Number(s.reps) > 0)
        .map((s) => ({ exerciseId, weight: Number(s.weight) || 0, reps: Math.round(Number(s.reps)) })),
    ),
  }
}
