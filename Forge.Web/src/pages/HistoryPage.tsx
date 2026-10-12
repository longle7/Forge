import { Fragment } from 'react'
import { getExercises, getWorkouts } from '../api'
import { Card, Page, PrBadge, SectionTitle, Status } from '../components'
import { failure, usePolling } from '../usePolling'
import { formatDay, formatDuration, formatSet, formatTime, groupSets, isCardioSet, personalRecords, workoutLength, workoutTotals } from '../workouts'

const MAX_EXERCISES_SHOWN = 4

/** "October", or "October 2025" for another year: the heading over each month's workouts. */
const month = (iso: string) => {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, { month: 'long', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

/** Every finished workout, newest first and under a heading for each month (Workouts → See All). */
export default function HistoryPage() {
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercises = usePolling(getExercises, '/exercises')
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const records = personalRecords(workouts.data ?? [])

  return (
    <Page title="History" back={{ to: '/workouts', label: 'Workouts' }}>
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} />
      {workouts.data?.length === 0 && <p className="text-muted">No workouts yet. Finish one and it shows up here.</p>}
      {workouts.data?.map((workout, i) => {
        const groups = groupSets(workout.sets)
        const prs = records.get(workout.id)?.size ?? 0
        const heading = month(workout.startedAt)
        return (
          <Fragment key={workout.id}>
            {heading !== (i > 0 ? month(workouts.data![i - 1].startedAt) : undefined) && <SectionTitle title={heading} />}
            <Card to={`/workouts/history/${workout.id}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{workout.name}</h3>
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
          </Fragment>
        )
      })}
    </Page>
  )
}
