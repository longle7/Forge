import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { deleteWorkout, getExercises, getWorkouts, type Workout } from '../api'
import { Card, dangerButton, Notice, NotFound, Page, PrBadge, Status, tintedButton } from '../components'
import { editDraft, loadDraft, repeatDraft, saveDraft, type Draft } from '../draft'
import { Icon } from '../icons'
import { failure, usePolling, useSettled } from '../usePolling'
import { formatDay, formatDuration, formatSet, formatTime, groupSets, personalRecords, plural, workoutLength, workoutTotals } from '../workouts'

const BACK = { to: '/workouts/history', label: 'History' }

/** One finished workout: its sets and PRs, and Repeat, Edit, and Delete. Straight from Finish, a word of congrats. */
export default function WorkoutDetailPage() {
  const { id } = useParams()
  const workouts = usePolling(getWorkouts, '/workouts')
  const workout = workouts.data?.find((w) => w.id === id)
  const settled = useSettled(workouts)

  if (!workout && settled && workouts.data) {
    return <NotFound title="Workout not found" message="It may have been deleted." back={{ to: '/workouts/history', label: 'All Workouts' }} />
  }
  if (!workout) {
    return (
      <Page title="" back={BACK}>
        <Status loading={!workouts.error} error={failure(workouts)} />
      </Page>
    )
  }
  return <Details workout={workout} workouts={workouts.data!} />
}

function Details({ workout, workouts }: { workout: Workout; workouts: Workout[] }) {
  const navigate = useNavigate()
  const finished = (useLocation().state as { finished?: boolean } | null)?.finished
  const exercises = usePolling(getExercises, '/exercises')
  const [message, setMessage] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  // groupSets keeps the same set objects, so PRs are looked up by object.
  const prs = personalRecords(workouts).get(workout.id) ?? new Set()

  // Repeat and Edit both open a workout in the logger, which holds one workout at a time.
  const open = (draft: Draft) => {
    if (loadDraft()) return setMessage('Finish or discard the workout in progress first.')
    saveDraft(draft)
    navigate('/workouts/active')
  }

  const remove = async () => {
    if (!confirm(`Delete ${workout.name} from ${formatDay(workout.startedAt)}? This can't be undone.`)) return
    setDeleting(true)
    try {
      await deleteWorkout(workout.id)
      navigate('/workouts/history', { replace: true })
    } catch (error) {
      setMessage((error as Error).message)
      setDeleting(false)
    }
  }

  return (
    <Page title={workout.name} back={BACK}>
      <p className="-mt-3 text-muted">
        {[formatDay(workout.startedAt), formatTime(workout.startedAt), formatDuration(workoutLength(workout)), workoutTotals(workout)].filter(Boolean).join(' · ')}
      </p>

      {finished && (
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-green/15 text-green-ink">
              <Icon name="check" className="size-6 stroke-[3]" />
            </span>
            <span>
              <span className="block font-semibold">Workout saved</span>
              <span className="block text-[15px] text-muted">
                {prs.size ? `${plural(prs.size, 'new PR')}. Nice work!` : `${plural(workout.sets.length, 'set')} done. Nice work!`}
              </span>
            </span>
          </div>
        </Card>
      )}

      {groupSets(workout.sets).map((group) => (
        <Card key={group.exerciseId}>
          <Link to={`/workouts/exercises/${group.exerciseId}`} className="font-semibold text-coral-ink">
            {names.get(group.exerciseId) ?? 'Exercise'}
          </Link>
          <ol className="mt-2 space-y-1.5">
            {group.sets.map((set, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-5 text-[15px] font-semibold text-muted">{i + 1}</span>
                <span>{formatSet(set)}</span>
                {prs.has(set) && <PrBadge />}
              </li>
            ))}
          </ol>
        </Card>
      ))}

      {message && <Notice>{message}</Notice>}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => open(repeatDraft(workout))} className={tintedButton}>
          <Icon name="repeat" className="size-5" />
          Repeat
        </button>
        <button onClick={() => open(editDraft(workout))} className={tintedButton}>
          Edit
        </button>
      </div>
      <button onClick={remove} disabled={deleting} className={dangerButton}>
        {deleting ? 'Deleting…' : 'Delete Workout'}
      </button>
    </Page>
  )
}
