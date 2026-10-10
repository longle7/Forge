import { getExercises, getWorkouts } from '../api'
import { Card, PrBadge, Status } from '../components'
import { failure, usePolling, useTitle } from '../usePolling'
import { formatDay, formatDuration, formatTime, formatWeight, groupSets, personalRecords, volume } from '../workouts'

const MAX_EXERCISES_SHOWN = 4

/** The History tab: every finished workout, newest first. */
export default function HistoryPage() {
  useTitle('History')
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercises = usePolling(getExercises, '/exercises')
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const records = personalRecords(workouts.data ?? [])

  return (
    <>
      <h1 className="text-2xl font-bold">History</h1>
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} />
      {workouts.data?.length === 0 && <p className="text-neutral-500">No workouts yet. Finish one and it shows up here.</p>}
      {workouts.data?.map((workout) => {
        const groups = groupSets(workout.sets)
        const prs = records.get(workout.id)?.size ?? 0
        return (
          <Card key={workout.id} to={`/history/${workout.id}`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{workout.name}</h2>
              {prs > 0 && (
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  <PrBadge /> {prs > 1 && `× ${prs}`}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500">
              {formatDay(workout.startedAt)} · {formatTime(workout.startedAt)} · {formatDuration(Date.parse(workout.finishedAt) - Date.parse(workout.startedAt))} ·{' '}
              {formatWeight(volume(workout))} lb
            </p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {groups.slice(0, MAX_EXERCISES_SHOWN).map((g) => (
                <li key={g.exerciseId}>
                  {g.sets.length} × {names.get(g.exerciseId) ?? 'Exercise'}
                </li>
              ))}
              {groups.length > MAX_EXERCISES_SHOWN && <li className="text-neutral-500">and {groups.length - MAX_EXERCISES_SHOWN} more</li>}
            </ul>
          </Card>
        )
      })}
    </>
  )
}
