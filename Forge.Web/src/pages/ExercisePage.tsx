import { Link, useParams } from 'react-router'
import { getExercises, getWorkouts } from '../api'
import { Card, NotFound, Section, Status } from '../components'
import { failure, usePolling, useSettled, useTitle } from '../usePolling'
import { bestSet, formatDay, formatSet, formatWeight, oneRepMax } from '../workouts'

const MAX_HISTORY = 20

/** One exercise: your best set, estimated one-rep max, and recent sets. */
export default function ExercisePage() {
  const id = Number(useParams().id)
  const exercises = usePolling(getExercises, '/exercises')
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercise = exercises.data?.find((e) => e.id === id)
  const settled = useSettled(exercises)
  useTitle(exercise?.name)

  if (!exercise && settled && exercises.data) {
    return <NotFound title="Exercise not found" message="It isn't in your exercise list." back={{ to: '/exercises', label: 'All exercises' }} />
  }
  if (!exercise) return <Status loading={!exercises.error} error={failure(exercises)} />

  const best = bestSet(workouts.data ?? [], id)
  const history = (workouts.data ?? []).filter((w) => w.sets.some((s) => s.exerciseId === id)).slice(0, MAX_HISTORY)

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{exercise.name}</h1>
        <p className="text-sm text-neutral-500">
          {exercise.muscleGroup}
          {exercise.isCustom && ' · added by you'}
        </p>
      </div>

      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} rows={1} />
      {workouts.data && !best && <p className="text-neutral-500">You haven't logged this exercise yet.</p>}
      {best && (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <p className="text-sm text-neutral-500">Best set</p>
            <p className="text-lg font-bold">{formatSet(best.set)}</p>
            <p className="text-sm text-neutral-500">{formatDay(best.workout.startedAt)}</p>
          </Card>
          {best.set.weight > 0 && (
            <Card>
              <p className="text-sm text-neutral-500">Estimated 1RM</p>
              <p className="text-lg font-bold">{formatWeight(Math.round(oneRepMax(best.set.weight, best.set.reps)))} lb</p>
              <p className="text-sm text-neutral-500">from your best set</p>
            </Card>
          )}
        </div>
      )}

      {history.length > 0 && (
        <Section title="Recent">
          {history.map((workout) => (
            <Card key={workout.id} to={`/history/${workout.id}`}>
              <p className="font-semibold">{formatDay(workout.startedAt)}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {workout.sets
                  .filter((s) => s.exerciseId === id)
                  .map(formatSet)
                  .join(', ')}
              </p>
            </Card>
          ))}
        </Section>
      )}

      <Link to="/exercises" className="block text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
        All exercises
      </Link>
    </>
  )
}
