import { useNavigate } from 'react-router'
import { readJson, write } from './cache'
import { randomId, type PlanDay, type Routine, type SetKind, type Workout, type WorkoutInput, type WorkoutSet } from './api'
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
  routineId?: string // started from this routine: the finished workout offers to update it
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

/**
 * Opens a new workout in the logger, which holds one at a time: with one already in progress it opens nothing and
 * returns the message to show instead.
 */
export function useStartWorkout() {
  const navigate = useNavigate()
  return (draft: Draft): string | undefined => {
    if (loadDraft()) return 'Finish or discard the workout in progress first.'
    saveDraft(draft)
    navigate('/workouts/active')
  }
}

/** "Morning Workout", "Afternoon Workout", or "Evening Workout", like Strong. */
export function workoutName(now: Date): string {
  const hour = now.getHours()
  return `${hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'} Workout`
}

export const emptyDraft = (now = new Date()): Draft => ({ id: randomId(), name: workoutName(now), startedAt: now.toISOString(), exercises: [] })

const draftExercises = (workout: Pick<Workout, 'sets'>, done: boolean): DraftExercise[] =>
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
export const repeatDraft = (workout: Pick<Workout, 'name' | 'sets'>, now = new Date()): Draft => ({
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

/**
 * A routine, ready to log: its exercises, sets, reps, kinds, and supersets. Weights and cardio values stay empty, as in
 * planDraft, so they come from last time with the progression hint, not from the workout the routine was saved from.
 */
export function routineDraft(routine: Routine, now = new Date()): Draft {
  const draft = repeatDraft(routine, now)
  const exercises = draft.exercises.map((e) => ({
    ...e,
    // Only cardio sets have a distance and time.
    sets: e.sets.map((s) => (s.distance === undefined ? { ...s, weight: '' } : { ...s, distance: '', time: '' })),
  }))
  return { ...draft, name: routine.name, routineId: routine.id, exercises }
}

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

// Supersets: exercises done back to back share a number, and an exercise is in a superset only while a neighbour shares
// its number (groupSupersets). So moving, removing, or replacing an exercise needs no cleanup.

/** The superset an exercise is in: its number when a neighbour shares it, else undefined. */
function supersetOf(exercises: DraftExercise[], index: number): number | undefined {
  const { superset } = exercises[index]
  return superset !== undefined && (exercises[index - 1]?.superset === superset || exercises[index + 1]?.superset === superset) ? superset : undefined
}

/**
 * Puts an exercise in a superset with the next one: the superset either is in already (both join into one), or a new
 * one numbered one past the highest, so a number left on an exercise from an old superset is never reused.
 */
export function supersetWithNext(exercises: DraftExercise[], index: number): DraftExercise[] {
  const nextSuperset = supersetOf(exercises, index + 1)
  const number = supersetOf(exercises, index) ?? nextSuperset ?? Math.max(0, ...exercises.map((e) => e.superset ?? 0)) + 1
  // The next exercise brings the rest of its superset along.
  let last = index + 1
  while (nextSuperset !== undefined && exercises[last + 1]?.superset === nextSuperset) last++
  return exercises.map((exercise, i) => (i >= index && i <= last ? { ...exercise, superset: number } : exercise))
}

/** Takes an exercise out of its superset. */
export const leaveSuperset = (exercises: DraftExercise[], index: number) =>
  exercises.map((exercise, i) => (i === index ? { ...exercise, superset: undefined } : exercise))

/**
 * Whether checking off a set of exercise `index` starts the rest timer: not while a later exercise in its superset
 * still has a set to do, so in a superset you rest after each round.
 */
export function restsAfter(exercises: DraftExercise[], index: number): boolean {
  const { superset } = exercises[index]
  for (let i = index + 1; superset !== undefined && exercises[i]?.superset === superset; i++) {
    if (exercises[i].sets.some((s) => !s.done)) return false
  }
  return true
}

/**
 * An exercise swapped for another (Replace): its sets keep their reps and kinds, but not the weights, which were for the
 * other exercise, and none stays checked off. A cardio exercise's sets start empty.
 */
export const replaceExercise = (exercise: DraftExercise, exerciseId: number, cardio: boolean): DraftExercise => ({
  ...exercise,
  exerciseId,
  sets: exercise.sets.map(({ reps, kind }) => (cardio ? { weight: '', reps: '', done: false } : { weight: '', reps, kind, done: false })),
})
