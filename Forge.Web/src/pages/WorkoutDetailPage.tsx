import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { deleteWorkout, getExercises, getProfile, getWorkouts, type Workout } from '../api'
import { ChartTable, HeartRateChart } from '../charts'
import { Card, dangerButton, Notice, NotFound, Page, PrBadge, Status, tintedButton } from '../components'
import { workoutDay } from '../dates'
import { editDraft, loadDraft, repeatDraft, saveDraft, type Draft } from '../draft'
import { maxHeartRate, timeInZones, ZONES } from '../heartRate'
import { Icon } from '../icons'
import { drawShareCard, shareImage } from '../shareCard'
import { failure, useAction, usePolling, useSettled } from '../usePolling'
import { formatClock, formatDay, formatDuration, formatSet, formatTime, groupSets, personalRecords, plural, workoutLength, workoutTotals } from '../workouts'

const BACK = { to: '/workouts/history', label: 'History' }

/** One finished workout: its sets and PRs, and Repeat, Edit, Share, and Delete. Straight from Finish, a word of congrats. */
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
  const sharing = useAction()
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

  // The workout as an image (shareCard.ts), to the share sheet on the iPhone or downloaded on the website.
  const shareButton = (className: string) => (
    <button
      onClick={() => sharing.run(async () => shareImage(await drawShareCard(workout, { prCount: prs.size, names }), `forge-workout-${workoutDay(workout)}.png`))}
      disabled={sharing.busy}
      className={`${tintedButton} ${className}`}
    >
      <Icon name="share" className="size-5" />
      {sharing.busy ? 'Preparing…' : 'Share'}
    </button>
  )
  const notice = message ?? sharing.error

  return (
    <Page title={workout.name} back={BACK}>
      <p className="-mt-3 text-muted">
        {[formatDay(workout.startedAt), formatTime(workout.startedAt), formatDuration(workoutLength(workout)), workoutTotals(workout)].filter(Boolean).join(' · ')}
      </p>
      {workout.source === 'health' && <p className="-mt-3 text-[15px] text-muted">From Apple Health{workout.sets.length === 0 && ' · the Watch doesn’t record sets for strength training'}</p>}

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
          {shareButton('mt-3 w-full')}
        </Card>
      )}

      {groupSets(workout.sets).map((group, g) => (
        <Card key={g}>
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

      {(!!workout.avgHeartRate || !!workout.heartRate?.length) && <HeartRateCard workout={workout} />}

      {notice && <Notice>{notice}</Notice>}

      <div className="grid grid-cols-2 gap-2">
        {workout.sets.length > 0 && (
          <>
            <button onClick={() => open(repeatDraft(workout))} className={tintedButton}>
              <Icon name="repeat" className="size-5" />
              Repeat
            </button>
            <button onClick={() => open(editDraft(workout))} className={tintedButton}>
              Edit
            </button>
          </>
        )}
        {shareButton('col-span-2')}
      </div>
      <button onClick={remove} disabled={deleting} className={dangerButton}>
        {deleting ? 'Deleting…' : 'Delete Workout'}
      </button>
    </Page>
  )
}

/** From the Watch: average and max, the curve, and time in each zone (zones need your birth year, from Setup). */
function HeartRateCard({ workout }: { workout: Workout }) {
  const profile = usePolling(getProfile, '/profile')
  const points = workout.heartRate ?? []
  const max = profile.data ? maxHeartRate(profile.data.birthYear, new Date(workout.startedAt).getFullYear()) : undefined
  const zones = max && points.length ? timeInZones(points, max) : undefined
  const recorded = points.length ? points.at(-1)!.s - points[0].s + 30 : 0
  return (
    <Card>
      <p className="text-[13px] font-semibold text-muted uppercase">Heart rate</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {workout.avgHeartRate && <Stat label="Average" value={`${workout.avgHeartRate} bpm`} />}
        {workout.maxHeartRate && <Stat label="Max" value={`${workout.maxHeartRate} bpm`} />}
      </div>
      {points.length > 1 && (
        <>
          <HeartRateChart points={points} max={max} label="Heart rate through the workout" />
          <ChartTable caption="Heart rate" rows={points.map((p) => [formatClock(p.s * 1000), `${p.bpm} bpm`])} />
        </>
      )}
      {zones && (
        <>
          <p className="mt-3 text-[13px] text-muted">Time in each zone, from your estimated max of {max} bpm</p>
          <ul className="mt-2 space-y-2 text-[15px]">
            {ZONES.map((zone, i) => (
              <li key={zone.name} className="flex items-center gap-3">
                <span className="w-28 shrink-0">
                  <span className="font-semibold">{zone.name}</span> <span className="text-muted">{zone.label}</span>
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
                  <div className="h-full rounded-full" style={{ width: `${(zones[i] / recorded) * 100}%`, background: zone.color }} />
                </div>
                <span className="w-14 shrink-0 text-right text-muted tabular-nums">{zones[i] ? formatDuration(zones[i] * 1000) : '0m'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/** A stat: label, then the value (as on Progress). */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="text-[24px] leading-tight font-bold">{value}</p>
    </div>
  )
}
