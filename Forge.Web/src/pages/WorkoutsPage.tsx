import { useNavigate } from 'react-router'
import { getWorkouts, type Workout } from '../api'
import { Card, Group, Page, PrBadge, primaryButton, Row, SectionTitle, Status, tintedButton } from '../components'
import { emptyDraft, loadDraft, repeatDraft, saveDraft, type Draft } from '../draft'
import { Icon } from '../icons'
import { failure, usePolling } from '../usePolling'
import { formatDay, formatTime, groupSets, personalRecords, plural } from '../workouts'

/** The Workouts tab: today's workout, recent history, and the exercise list. */
export default function WorkoutsPage() {
  const workouts = usePolling(getWorkouts, '/workouts')
  const records = personalRecords(workouts.data ?? [])
  const recent = workouts.data?.slice(0, 3) ?? []

  return (
    <Page title="Workouts">
      <TodayWorkoutCard last={workouts.data?.[0]} />

      <SectionTitle title="History" link={workouts.data?.length ? { to: '/workouts/history', label: 'See All' } : undefined} />
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} rows={2} />
      {workouts.data?.length === 0 && <p className="px-1 text-muted">Finished workouts show up here.</p>}
      {recent.length > 0 && (
        <Group>
          {recent.map((w) => (
            <Row key={w.id} to={`/workouts/history/${w.id}`} detail={(records.get(w.id)?.size ?? 0) > 0 ? <PrBadge /> : undefined}>
              <span className="block font-medium">{w.name}</span>
              <span className="block text-[15px] text-muted">
                {formatDay(w.startedAt)} · {plural(groupSets(w.sets).length, 'exercise')}
              </span>
            </Row>
          ))}
        </Group>
      )}

      <Group>
        <Row to="/workouts/exercises" icon="list">
          Exercises
        </Row>
      </Group>
    </Page>
  )
}

/**
 * Today's workout, on Home and the Workouts tab: Continue the one in progress, or start one (empty, or a repeat of
 * the last). The workout itself opens at /workouts/active.
 */
export function TodayWorkoutCard({ last }: { last: Workout | undefined }) {
  const navigate = useNavigate()
  const draft = loadDraft()
  const start = (next: Draft) => {
    saveDraft(next)
    navigate('/workouts/active')
  }

  if (draft) {
    return (
      <Card>
        <p className="text-[13px] font-semibold tracking-wide text-coral-ink uppercase">{draft.editing ? 'Editing' : 'In progress'}</p>
        <p className="mt-0.5 text-[22px] font-bold">{draft.name}</p>
        <p className="text-[15px] text-muted">
          {draft.editing ? formatDay(draft.startedAt) : `Started ${formatTime(draft.startedAt)}`} ·{' '}
          {plural(draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0), 'set')} done
        </p>
        <button onClick={() => navigate('/workouts/active')} className={`mt-4 ${primaryButton}`}>
          <Icon name="play" className="size-5 fill-current" />
          Continue
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <p className="text-[13px] font-semibold tracking-wide text-coral-ink uppercase">Today</p>
      <p className="mt-0.5 text-[22px] font-bold">Ready when you are</p>
      <button onClick={() => start(emptyDraft())} className={`mt-4 ${primaryButton}`}>
        <Icon name="play" className="size-5 fill-current" />
        Start Workout
      </button>
      {last && (
        <button onClick={() => start(repeatDraft(last))} className={`mt-2 w-full ${tintedButton}`}>
          <Icon name="repeat" className="size-5" />
          Repeat {last.name}
        </button>
      )}
    </Card>
  )
}
