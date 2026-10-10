import { useEffect, useEffectEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ApiError, getExercises, getWorkouts, saveWorkout, type Exercise, type Workout } from '../api'
import { Card, dangerButton, field, Notice, plainButton, primaryButton, tintedButton } from '../components'
import { loadDraft, saveDraft, toWorkout, type Draft, type DraftExercise, type DraftSet } from '../draft'
import { ExercisePicker } from '../ExercisePicker'
import { Icon } from '../icons'
import { useNow, usePolling, useTitle } from '../usePolling'
import { formatDay, formatWeight, previousSets } from '../workouts'

/** Rest after each checked-off set; −15s / +15s adjust it. */
const REST_SECONDS = 90
const restEndsAt = () => Date.now() + REST_SECONDS * 1000

/** The workout in progress (/workouts/active). Started from Home or the Workouts tab, which put it on this phone. */
export default function LoggerPage() {
  const [draft, setDraft] = useState(loadDraft)
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercises = usePolling(getExercises, '/exercises')

  // Every change is kept on this device at once, so a reload or a closed tab loses nothing.
  const update = (next: Draft) => {
    saveDraft(next)
    setDraft(next)
  }

  if (!draft) return <Navigate to="/workouts" replace />
  return <Logger draft={draft} update={update} workouts={workouts.data ?? []} exercises={exercises.data ?? []} />
}

function Logger({ draft, update, workouts, exercises }: {
  draft: Draft
  update: (draft: Draft) => void
  workouts: Workout[]
  exercises: Exercise[]
}) {
  const navigate = useNavigate()
  const now = useNow()
  const [picking, setPicking] = useState(false)
  const [added, setAdded] = useState<Exercise[]>([]) // made in the picker, before the list reloads
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const names = new Map([...exercises, ...added].map((e) => [e.id, e.name]))
  useTitle(draft.name || 'Workout')

  // The workout is done with this page: leave it, and stop keeping it on the phone.
  const close = (to: string) => {
    saveDraft(undefined)
    navigate(to, { replace: true })
  }

  // A change to the sets means the workout isn't over yet: a new Finish sets the end time again.
  const setExercises = (list: DraftExercise[], rest = draft.restEndsAt) =>
    update({ ...draft, exercises: list, restEndsAt: rest, finishedAt: draft.editing ? draft.finishedAt : undefined })
  const withSet = (e: number, s: number, change: Partial<DraftSet>) =>
    draft.exercises.map((ex, i) => (i !== e ? ex : { ...ex, sets: ex.sets.map((set, j) => (j !== s ? set : { ...set, ...change })) }))

  const previous = (exerciseId: number) => previousSets(workouts, exerciseId, draft.editing ? draft.id : undefined)

  // Checking off a set fills empty fields from last time (like Strong) and starts the rest timer.
  const toggleDone = (e: number, s: number) => {
    const set = draft.exercises[e].sets[s]
    if (set.done) return setExercises(withSet(e, s, { done: false }))
    const prev = previous(draft.exercises[e].exerciseId)
    const hint = prev[s] ?? prev.at(-1)
    const reps = set.reps || (hint ? String(hint.reps) : '')
    if (!(Number(reps) > 0)) return setMessage('Enter the reps first, then check the set off.')
    setMessage(undefined)
    const weight = set.weight || (hint ? String(hint.weight) : '')
    setExercises(withSet(e, s, { weight, reps, done: true }), draft.editing ? draft.restEndsAt : restEndsAt())
  }

  const addSet = (e: number) => {
    const last = draft.exercises[e].sets.at(-1)
    setExercises(draft.exercises.map((ex, i) => (i !== e ? ex : { ...ex, sets: [...ex.sets, { weight: last?.weight ?? '', reps: last?.reps ?? '', done: false }] })))
  }
  const removeSet = (e: number) => setExercises(draft.exercises.map((ex, i) => (i !== e ? ex : { ...ex, sets: ex.sets.slice(0, -1) })))
  const removeExercise = (e: number) => {
    if (draft.exercises[e].sets.some((s) => s.done) && !confirm(`Remove ${names.get(draft.exercises[e].exerciseId) ?? 'this exercise'} and its sets?`)) return
    setExercises(draft.exercises.filter((_, i) => i !== e))
  }
  const pick = (exercise: Exercise) => {
    setPicking(false)
    if (!names.has(exercise.id)) setAdded((list) => [...list, exercise])
    setExercises([...draft.exercises, { exerciseId: exercise.id, sets: [{ weight: '', reps: '', done: false }] }])
  }

  const finish = async () => {
    if (saving) return
    const finishedAt = draft.finishedAt ?? new Date().toISOString()
    const workout = toWorkout(draft, finishedAt)
    if (workout.sets.length === 0) return setMessage('Check off at least one set (✓) to save this workout.')
    // Keep the end time with the workout on this phone, so a later retry saves the real one.
    const pending = { ...draft, finishedAt }
    update(pending)
    setSaving(true)
    setMessage(undefined)
    try {
      await saveWorkout(pending.id, workout)
      close(`/workouts/history/${pending.id}`)
    } catch (error) {
      setSaving(false)
      setMessage(
        error instanceof ApiError && error.status === 0
          ? "Saved on this phone. It uploads when you're back online, or tap Finish to try again."
          : (error as Error).message,
      )
    }
  }

  // A finished workout that couldn't upload goes up by itself once the phone is back online.
  const retry = useEffectEvent(() => void finish())
  const waiting = !!draft.finishedAt && !draft.editing
  useEffect(() => {
    if (!waiting) return
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [waiting])

  const discard = () => {
    if (!confirm(draft.editing ? 'Discard your changes to this workout?' : "Discard this workout? Its sets won't be saved.")) return
    close(draft.editing ? `/workouts/history/${draft.id}` : '/workouts')
  }

  const restLeft = draft.restEndsAt ? Math.ceil((draft.restEndsAt - now.getTime()) / 1000) : 0
  const finishLabel = saving ? 'Saving…' : draft.editing ? 'Save' : 'Finish'

  return (
    <>
      {/* Like an iOS nav bar: Back keeps the workout going (it stays on this phone); Finish saves it. */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-canvas/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <button onClick={() => navigate('/workouts')} className={plainButton}>
          <Icon name="chevronLeft" className="size-7" />
          Workouts
        </button>
        <button onClick={finish} disabled={saving} className={`${plainButton} px-3 font-semibold`}>
          {finishLabel}
        </button>
      </div>

      <div>
        <input
          value={draft.name}
          onChange={(e) => update({ ...draft, name: e.target.value })}
          aria-label="Workout name"
          maxLength={100}
          className="w-full rounded-lg bg-transparent text-[34px] leading-tight font-bold tracking-tight outline-none focus:ring-2 focus:ring-coral"
        />
        <p className="text-muted tabular-nums">
          {draft.editing ? `Editing · ${formatDay(draft.startedAt)}` : formatClock(now.getTime() - Date.parse(draft.startedAt))}
        </p>
      </div>

      {draft.exercises.length === 0 && <p className="text-muted">Add your first exercise to get going.</p>}

      {draft.exercises.map((ex, e) => {
        const prev = previous(ex.exerciseId)
        return (
          <Card key={`${ex.exerciseId}-${e}`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="pt-2.5 font-semibold text-coral-ink">{names.get(ex.exerciseId) ?? 'Exercise'}</h2>
              <button onClick={() => removeExercise(e)} className={`-mr-1 text-[15px] ${plainButton}`}>
                Remove
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[2rem_1fr_4.5rem_4rem_2.75rem] items-center gap-x-2 gap-y-1.5 text-center text-[15px]">
              <span className="text-[13px] font-semibold text-muted">SET</span>
              <span className="text-[13px] font-semibold text-muted">PREVIOUS</span>
              <span className="text-[13px] font-semibold text-muted">LB</span>
              <span className="text-[13px] font-semibold text-muted">REPS</span>
              {/* A real cell: an sr-only element alone is taken out of the grid and would shift every row. */}
              <span>
                <span className="sr-only">Done</span>
              </span>
              {ex.sets.map((set, s) => {
                const hint = prev[s] ?? prev.at(-1)
                return (
                  <SetRow
                    key={s}
                    number={s + 1}
                    set={set}
                    previous={hint && (hint.weight > 0 ? `${formatWeight(hint.weight)} × ${hint.reps}` : `${hint.reps} reps`)}
                    placeholder={hint && { weight: formatWeight(hint.weight), reps: String(hint.reps) }}
                    onChange={(change) => setExercises(withSet(e, s, change))}
                    onToggle={() => toggleDone(e, s)}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex justify-between">
              <button onClick={() => addSet(e)} className={plainButton}>
                <Icon name="plus" className="size-5" />
                Add Set
              </button>
              <button onClick={() => removeSet(e)} disabled={ex.sets.length <= 1} className={`text-[15px] ${plainButton}`}>
                Remove Set
              </button>
            </div>
          </Card>
        )
      })}

      <button onClick={() => setPicking(true)} className={`w-full ${tintedButton}`}>
        <Icon name="plus" className="size-5" />
        Add Exercise
      </button>

      {message && <Notice>{message}</Notice>}

      <button onClick={finish} disabled={saving} className={primaryButton}>
        {saving ? 'Saving…' : draft.editing ? 'Save Changes' : 'Finish Workout'}
      </button>
      <button onClick={discard} className={dangerButton}>
        {draft.editing ? 'Cancel Editing' : 'Discard Workout'}
      </button>

      {restLeft > 0 && (
        <>
          <div className="h-16" aria-hidden />
          <RestTimer
            seconds={restLeft}
            onAdjust={(by) => update({ ...draft, restEndsAt: Math.max(Date.now(), draft.restEndsAt! + by * 1000) })}
            onSkip={() => update({ ...draft, restEndsAt: undefined })}
          />
        </>
      )}

      {picking && <ExercisePicker exercises={[...exercises, ...added]} onPick={pick} onClose={() => setPicking(false)} />}
    </>
  )
}

function SetRow({ number, set, previous, placeholder, onChange, onToggle }: {
  number: number
  set: DraftSet
  previous: string | undefined
  placeholder: { weight: string; reps: string } | undefined
  onChange: (change: Partial<DraftSet>) => void
  onToggle: () => void
}) {
  const input = `${field} px-1 text-center ${set.done ? 'bg-green/15' : ''}`
  return (
    <>
      <span className="font-semibold">{number}</span>
      <span className="truncate text-muted">{previous ?? '–'}</span>
      <input
        value={set.weight}
        onChange={(e) => onChange({ weight: e.target.value })}
        inputMode="decimal"
        placeholder={placeholder?.weight}
        aria-label={`Set ${number} weight in pounds`}
        className={input}
      />
      <input
        value={set.reps}
        onChange={(e) => onChange({ reps: e.target.value })}
        inputMode="numeric"
        placeholder={placeholder?.reps}
        aria-label={`Set ${number} reps`}
        className={input}
      />
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={set.done}
        aria-label={`Set ${number} done`}
        className={`grid size-11 place-items-center rounded-xl transition ${set.done ? 'bg-green-strong text-white' : 'bg-fill text-muted'}`}
      >
        <Icon name="check" className="size-5 stroke-[3]" />
      </button>
    </>
  )
}

/** Counts down above the tab bar. It counts to a saved end time, so it stays right across reloads and backgrounding. */
function RestTimer({ seconds, onAdjust, onSkip }: { seconds: number; onAdjust: (by: number) => void; onSkip: () => void }) {
  const button = 'min-h-11 rounded-xl bg-coral/12 px-3 text-[15px] font-semibold text-coral-ink active:opacity-70'
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 backdrop-blur-md">
      {/* How much rest is left, as a thin Sunrise bar along the top. */}
      <div className="h-0.5 bg-linear-to-r from-coral to-pink transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (seconds / REST_SECONDS) * 100)}%` }} />
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2">
        <p role="timer" aria-live="off" className="text-[20px] font-semibold tabular-nums">
          Rest {formatClock(seconds * 1000)}
        </p>
        <div className="flex gap-2">
          <button onClick={() => onAdjust(-15)} className={button} aria-label="15 seconds less">
            −15s
          </button>
          <button onClick={() => onAdjust(15)} className={button} aria-label="15 seconds more">
            +15s
          </button>
          <button onClick={onSkip} className={button}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

/** "4:05", "1:02:03" */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}
