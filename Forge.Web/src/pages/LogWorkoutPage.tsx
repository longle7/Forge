import { useState } from 'react'
import { useNavigate } from 'react-router'
import { randomId, saveWorkout } from '../api'
import { field, Notice, Page, plainButton } from '../components'
import { localDate, localTime, parseDateTime } from '../dates'
import { builderToSets, hasEmptySet, workoutName, type DraftExercise } from '../draft'
import { haptic } from '../notify'
import { useAction, useNow } from '../usePolling'
import { WorkoutBuilder } from '../WorkoutBuilder'

const BACK = { to: '/workouts/history', label: 'History' }
const MAX_MINUTES = 24 * 60 // the API's longest workout

/**
 * A workout you didn't log as you went (History → Log Past Workout): its name, when it started, how long it took, and
 * its exercises with their sets, reps, and weights. Every set counts as done.
 */
export default function LogWorkoutPage() {
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [id] = useState(randomId) // one ID, so saving again after a lost answer makes no copy
  // A workout that just ended: an hour long, starting an hour ago.
  const [start, setStart] = useState(() => {
    const hourAgo = new Date(Date.now() - 60 * 60_000)
    return { day: localDate(hourAgo), time: localTime(hourAgo) }
  })
  const [minutes, setMinutes] = useState('60')
  const [name, setName] = useState<string>() // until you type one, it's named for the time of day
  const [exercises, setExercises] = useState<DraftExercise[]>([])
  const { busy, error, setError, run } = useAction()
  const startedAt = parseDateTime(start.day, start.time)
  const hasStart = !Number.isNaN(startedAt.getTime())
  const automaticName = workoutName(hasStart ? startedAt : now)

  const save = () => {
    const length = Math.round(Number(minutes))
    const finishedAt = new Date(startedAt.getTime() + length * 60_000)
    if (exercises.length === 0) return setError('Add at least one exercise.')
    if (hasEmptySet(exercises)) return setError('Enter a distance or time for each cardio exercise.')
    if (!hasStart) return setError('Pick the day and the time it started.')
    if (!(length >= 1 && length <= MAX_MINUTES)) return setError('Enter how many minutes it took, up to 24 hours.')
    if (finishedAt.getTime() > Date.now()) return setError('That ends in the future. Pick an earlier start or a shorter length.')
    void run(async () => {
      await saveWorkout(id, { name: name?.trim() || automaticName, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), sets: builderToSets(exercises) })
      void haptic('success')
      navigate(`/workouts/history/${id}`, { replace: true })
    })
  }

  return (
    <Page
      title="Log Past Workout"
      back={BACK}
      action={
        <button onClick={save} disabled={busy} className={`font-semibold ${plainButton}`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <input value={name ?? automaticName} onChange={(e) => setName(e.target.value)} placeholder={automaticName} aria-label="Workout name" maxLength={100} className={field} />
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <label className="col-span-2 block">
          <span className="text-[15px] text-muted">Day</span>
          <input type="date" value={start.day} max={localDate(now)} onChange={(e) => setStart({ ...start, day: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="text-[15px] text-muted">Start time</span>
          <input type="time" value={start.time} onChange={(e) => setStart({ ...start, time: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="text-[15px] text-muted">Length (min)</span>
          <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" aria-label="Length in minutes" className={field} />
        </label>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <WorkoutBuilder exercises={exercises} onChange={setExercises} weights />
    </Page>
  )
}
