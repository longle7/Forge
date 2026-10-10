import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { deleteWorkout, getExercises, getWorkouts, type Workout } from '../api'
import { Card, dangerButton, NotFound, PrBadge, secondaryButton, Status } from '../components'
import { editDraft, loadDraft, repeatDraft, saveDraft, type Draft } from '../draft'
import { failure, usePolling, useSettled, useTitle } from '../usePolling'
import { formatDay, formatDuration, formatSet, formatTime, formatWeight, groupSets, personalRecords, volume } from '../workouts'

/** One finished workout: its sets and PRs, and Repeat, Edit, and Delete. */
export default function WorkoutDetailPage() {
  const { id } = useParams()
  const workouts = usePolling(getWorkouts, '/workouts')
  const workout = workouts.data?.find((w) => w.id === id)
  const settled = useSettled(workouts)
  useTitle(workout?.name)

  if (!workout && settled && workouts.data) {
    return <NotFound title="Workout not found" message="It may have been deleted." back={{ to: '/history', label: 'All workouts' }} />
  }
  if (!workout) return <Status loading={!workouts.error} error={failure(workouts)} />
  return <Details workout={workout} workouts={workouts.data!} />
}

function Details({ workout, workouts }: { workout: Workout; workouts: Workout[] }) {
  const navigate = useNavigate()
  const exercises = usePolling(getExercises, '/exercises')
  const [message, setMessage] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  // PRs are indexes into workout.sets; groupSets keeps the same set objects, so look them up by object.
  const prs = new Set([...(personalRecords(workouts).get(workout.id) ?? [])].map((i) => workout.sets[i]))

  // Repeat and Edit both load a workout into the Workout tab, which holds one workout at a time.
  const open = (draft: Draft) => {
    if (loadDraft()) return setMessage('Finish or discard the workout in progress first (Workout tab).')
    saveDraft(draft)
    navigate('/')
  }

  const remove = async () => {
    if (!confirm(`Delete ${workout.name} from ${formatDay(workout.startedAt)}? This can't be undone.`)) return
    setDeleting(true)
    try {
      await deleteWorkout(workout.id)
      navigate('/history', { replace: true })
    } catch (error) {
      setMessage((error as Error).message)
      setDeleting(false)
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{workout.name}</h1>
        <p className="text-sm text-neutral-500">
          {formatDay(workout.startedAt)} · {formatTime(workout.startedAt)} · {formatDuration(Date.parse(workout.finishedAt) - Date.parse(workout.startedAt))} ·{' '}
          {formatWeight(volume(workout))} lb
        </p>
      </div>

      {groupSets(workout.sets).map((group) => (
        <Card key={group.exerciseId}>
          <Link to={`/exercises/${group.exerciseId}`} className="font-semibold hover:underline">
            {names.get(group.exerciseId) ?? 'Exercise'}
          </Link>
          <ol className="mt-2 space-y-1 text-sm">
            {group.sets.map((set, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-5 font-semibold text-neutral-500">{i + 1}</span>
                <span>{formatSet(set)}</span>
                {prs.has(set) && <PrBadge />}
              </li>
            ))}
          </ol>
        </Card>
      ))}

      {message && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-50">
          {message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => open(repeatDraft(workout))} className={secondaryButton}>
          Repeat
        </button>
        <button onClick={() => open(editDraft(workout))} className={secondaryButton}>
          Edit
        </button>
      </div>
      <button onClick={remove} disabled={deleting} className={dangerButton}>
        {deleting ? 'Deleting…' : 'Delete workout'}
      </button>
    </>
  )
}
