import { Link } from 'react-router'
import { getWorkouts, type Workout } from '../api'
import { Group, Page, Status, tintedButton, WorkoutRow } from '../components'
import { Icon } from '../icons'
import { failure, usePolling } from '../usePolling'
import { personalRecords } from '../workouts'

/** "October", or "October 2025" for another year: the title over each month's workouts. */
const month = (iso: string) => {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, { month: 'long', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

/** Every finished workout, newest first, in a group for each month (Workouts → See All), and Log Past Workout. */
export default function HistoryPage() {
  const workouts = usePolling(getWorkouts, '/workouts')
  const records = personalRecords(workouts.data ?? [])
  // Newest first, so each month's workouts come one after another and the months stay in order.
  const months = new Map<string, Workout[]>()
  for (const workout of workouts.data ?? []) {
    const title = month(workout.startedAt)
    months.set(title, [...(months.get(title) ?? []), workout])
  }

  return (
    <Page title="History" back={{ to: '/workouts', label: 'Workouts' }}>
      <Link to="/workouts/log" className={`w-full ${tintedButton}`}>
        <Icon name="plus" className="size-5" />
        Log Past Workout
      </Link>
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} onRetry={workouts.reload} />
      {workouts.data?.length === 0 && <p className="text-muted">No workouts yet. Finish one and it shows up here.</p>}
      {[...months].map(([title, list]) => (
        <Group key={title} title={title}>
          {list.map((workout) => (
            <WorkoutRow key={workout.id} workout={workout} prs={records.get(workout.id)?.size ?? 0} />
          ))}
        </Group>
      ))}
    </Page>
  )
}
