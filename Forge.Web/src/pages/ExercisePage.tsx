import { useParams } from 'react-router'
import { getExercises, getWorkouts, isCardio } from '../api'
import { Card, Group, NotFound, Page, Row, Status } from '../components'
import { failure, usePolling, useSettled } from '../usePolling'
import { bestSet, formatCardio, formatClock, formatDay, formatSet, formatWeight, oneRepMax, pace } from '../workouts'

const MAX_HISTORY = 20
const BACK = { to: '/workouts/exercises', label: 'Exercises' }

/** One exercise: your best set, estimated one-rep max, and recent sets; for cardio, your longest and best pace. */
export default function ExercisePage() {
  const id = Number(useParams().id)
  const exercises = usePolling(getExercises, '/exercises')
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercise = exercises.data?.find((e) => e.id === id)
  const settled = useSettled(exercises)

  if (!exercise && settled && exercises.data) {
    return <NotFound title="Exercise not found" message="It isn't in your exercise list." back={{ to: '/workouts/exercises', label: 'All Exercises' }} />
  }
  if (!exercise) {
    return (
      <Page title="" back={BACK}>
        <Status loading={!exercises.error} error={failure(exercises)} />
      </Page>
    )
  }

  const best = bestSet(workouts.data ?? [], id)
  const history = (workouts.data ?? []).filter((w) => w.sets.some((s) => s.exerciseId === id)).slice(0, MAX_HISTORY)
  const cardio = isCardio(exercise)
  const paces = (workouts.data ?? []).flatMap((w) => w.sets.filter((s) => s.exerciseId === id).map(pace)).filter((p) => p !== undefined)

  return (
    <Page title={exercise.name} back={BACK}>
      <p className="-mt-3 text-muted">
        {exercise.muscleGroup}
        {exercise.isCustom && ' · added by you'}
      </p>

      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} rows={1} />
      {workouts.data && !best && <p className="text-muted">You haven't logged this exercise yet.</p>}
      {best && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-[13px] font-semibold text-muted uppercase">{cardio ? 'Longest' : 'Best set'}</p>
            <p className="mt-1 text-[22px] font-bold">{cardio ? formatCardio(best.set) : formatSet(best.set)}</p>
            <p className="text-[15px] text-muted">{formatDay(best.workout.startedAt)}</p>
          </Card>
          {cardio && paces.length > 0 && (
            <Card>
              <p className="text-[13px] font-semibold text-muted uppercase">Best pace</p>
              <p className="mt-1 text-[22px] font-bold">{formatClock(Math.min(...paces) * 1000)} /mi</p>
              <p className="text-[15px] text-muted">minutes per mile</p>
            </Card>
          )}
          {!cardio && best.set.weight > 0 && (
            <Card>
              <p className="text-[13px] font-semibold text-muted uppercase">Est. 1-rep max</p>
              <p className="mt-1 text-[22px] font-bold">{formatWeight(Math.round(oneRepMax(best.set.weight, best.set.reps)))} lb</p>
              <p className="text-[15px] text-muted">from your best set</p>
            </Card>
          )}
        </div>
      )}

      {history.length > 0 && (
        <Group title="Recent">
          {history.map((workout) => (
            <Row key={workout.id} to={`/workouts/history/${workout.id}`}>
              <span className="block font-medium">{formatDay(workout.startedAt)}</span>
              <span className="block text-[15px] text-muted">
                {workout.sets
                  .filter((s) => s.exerciseId === id)
                  .map(formatSet)
                  .join(', ')}
              </span>
            </Row>
          ))}
        </Group>
      )}
    </Page>
  )
}
