import { Link } from 'react-router'
import { getWorkouts } from '../api'
import { Card, Page, PrBadge, SectionTitle } from '../components'
import { Icon } from '../icons'
import { useNow, usePolling } from '../usePolling'
import { formatDay, formatDuration, formatWeight, groupSets, personalRecords, plural, volume } from '../workouts'
import { TodayWorkoutCard } from './WorkoutsPage'

/** Home: today at a glance. */
export default function HomePage() {
  const now = useNow(60_000)
  const workouts = usePolling(getWorkouts, '/workouts')
  const last = workouts.data?.[0]
  const prs = last ? (personalRecords(workouts.data!).get(last.id)?.size ?? 0) : 0

  return (
    <Page
      eyebrow={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      title={greeting(now)}
      action={
        <Link to="/settings" aria-label="Settings" className="mb-1 grid size-11 place-items-center rounded-full bg-surface text-coral-ink shadow-[0_1px_2px_rgb(42_31_26/0.06)]">
          <Icon name="person" />
        </Link>
      }
    >
      <TodayWorkoutCard last={last} />

      {last && (
        <>
          <SectionTitle title="Recent" />
          <Card to={`/workouts/history/${last.id}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{last.name}</p>
              {prs > 0 && <PrBadge />}
            </div>
            <p className="text-[15px] text-muted">
              {formatDay(last.startedAt)} · {formatDuration(Date.parse(last.finishedAt) - Date.parse(last.startedAt))} · {plural(groupSets(last.sets).length, 'exercise')} ·{' '}
              {formatWeight(volume(last))} lb
            </p>
          </Card>
        </>
      )}
    </Page>
  )
}

/** "Good morning", "Good afternoon", or "Good evening". */
function greeting(now: Date): string {
  const hour = now.getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}
