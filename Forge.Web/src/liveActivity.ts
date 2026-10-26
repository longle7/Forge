import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Draft, DraftExercise } from './draft'

// The iPhone app's Live Activity: the workout in progress on the Lock Screen, in the Dynamic Island, and in the Apple
// Watch Smart Stack. There's no server behind it: the logger sends what changed when you tap, and its timers count by
// themselves. The native side is ios/App/App/LiveActivityPlugin.swift.

/** What the Live Activity shows (WorkoutActivityAttributes.swift). Times in ms since 1970, like the rest timer's. */
export interface ActivityState {
  workoutId: string
  startedAt: number
  name: string
  exercise: string // the next set's exercise; empty when there's no next set
  detail: string // "Set 2 of 4", "All sets done", or "No sets yet"
  setsDone: number
  restEndsAt?: number
  restTotal?: number // the rest's length in seconds
}

const LiveActivity = registerPlugin<{
  show(state: ActivityState): Promise<void>
  endAll(): Promise<void>
}>('LiveActivity')

// Nothing on the website. In the iPhone app it's a nice extra: when iOS refuses it (Live Activities are off in
// Settings), the workout carries on without it.
async function quietly(action: () => Promise<void>) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await action()
  } catch {
    // no Live Activity: the logger still shows everything
  }
}

/** Starts the workout's Live Activity, or updates it, and ends any other workout's. */
export const showWorkout = (state: ActivityState) => quietly(() => LiveActivity.show(state))

/** Takes the Live Activity down: the workout is over (finished or discarded), or there's none going. */
export const endWorkout = () => quietly(() => LiveActivity.endAll())

/** A workout that's going on now: not a saved one opened for editing, nor one finished and waiting to upload. */
export const isLive = (draft: Draft | undefined) => !!draft && !draft.editing && !draft.finishedAt

/** The next set to do: the first exercise with a set that isn't checked off, and that set's index. */
export function nextSet(draft: Draft): { exercise: DraftExercise; set: number } | undefined {
  const exercise = draft.exercises.find((e) => e.sets.some((s) => !s.done))
  return exercise && { exercise, set: exercise.sets.findIndex((s) => !s.done) }
}

/**
 * What the Live Activity shows for a workout: its name, the next set, how many sets are done, and the rest timer.
 * Never the weights or reps, so typing them doesn't update it. `names`: exercise names by ID.
 */
export function activityState(draft: Draft, names: Map<number, string>): ActivityState {
  const next = nextSet(draft)
  const sets = draft.exercises.flatMap((e) => e.sets)
  return {
    workoutId: draft.id,
    startedAt: Date.parse(draft.startedAt),
    name: draft.name.trim() || 'Workout',
    exercise: next ? (names.get(next.exercise.exerciseId) ?? 'Exercise') : '',
    detail: next ? `Set ${next.set + 1} of ${next.exercise.sets.length}` : sets.length > 0 ? 'All sets done' : 'No sets yet',
    setsDone: sets.filter((s) => s.done).length,
    restEndsAt: draft.restEndsAt,
    restTotal: draft.restTotal,
  }
}
