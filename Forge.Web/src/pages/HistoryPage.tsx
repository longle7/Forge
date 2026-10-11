import { getExercises, getWorkouts } from '../api'
import { Card, Page, PrBadge, Status } from '../components'
import { failure, usePolling } from '../usePolling'
import { formatDay, formatDuration, formatSet, formatTime, groupSets, isCardioSet, personalRecords, workoutLength, workoutTotals } from '../workouts'

const MAX_EXERCISES_SHOWN = 4

/** Every finished workout, newest first (Workouts → See All). */
export default function HistoryPage() {
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercises = usePolling(getExercises, '/exercises')
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const records = personalRecords(workouts.data ?? [])

  return (
    <Page title="History" back={{ to: '/workouts', label: 'Workouts' }}>
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} />
      {workouts.data?.length === 0 && <p className="text-muted">No workouts yet. Finish one and it shows up here.</p>}
      {workouts.data?.map((workout) => {
        const groups = groupSets(workout.sets)
        const prs = records.get(workout.id)?.size ?? 0
        return (
          <Card key={workout.id} to={`/workouts/history/${workout.id}`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{workout.name}</h2>
              {prs > 0 && (
                <span className="flex items-center gap-1 text-[15px] font-semibold text-amber-ink">
                  <PrBadge /> {prs > 1 && `× ${prs}`}
                </span>
              )}
            </div>
            <p className="text-[15px] text-muted">
              {[formatDay(workout.startedAt), formatTime(workout.startedAt), formatDuration(workoutLength(workout)), workoutTotals(workout)].filter(Boolean).join(' · ')}
            </p>
            <ul className="mt-2 space-y-0.5 text-[15px]">
              {groups.slice(0, MAX_EXERCISES_SHOWN).map((g) => (
                <li key={g.exerciseId}>
                  {g.sets.length === 1 && isCardioSet(g.sets[0])
                    ? `${names.get(g.exerciseId) ?? 'Exercise'} · ${formatSet(g.sets[0])}`
                    : `${g.sets.length} × ${names.get(g.exerciseId) ?? 'Exercise'}`}
                </li>
              ))}
              {groups.length > MAX_EXERCISES_SHOWN && <li className="text-muted">and {groups.length - MAX_EXERCISES_SHOWN} more</li>}
            </ul>
          </Card>
        )
      })}
    </Page>
  )
}
