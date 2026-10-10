import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { addExercise, ApiError, getExercises, getWorkouts, saveWorkout, type Exercise, type Workout } from '../api'
import { Card, dangerButton, field, linkButton, primaryButton, SearchInput, secondaryButton } from '../components'
import { emptyDraft, loadDraft, repeatDraft, saveDraft, toWorkout, type Draft, type DraftExercise, type DraftSet } from '../draft'
import { useNow, usePolling, useTitle } from '../usePolling'
import { formatDay, formatWeight, groupSets, previousSets } from '../workouts'

/** Rest after each checked-off set; −15s / +15s adjust it. */
const REST_SECONDS = 90
const restEndsAt = () => Date.now() + REST_SECONDS * 1000

/** The Workout tab: start a workout, or log the one in progress. */
export default function WorkoutPage() {
  const [draft, setDraft] = useState(loadDraft)
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercises = usePolling(getExercises, '/exercises')

  // Every change is kept on this device at once, so a reload or a closed tab loses nothing.
  const update = (next: Draft | undefined) => {
    saveDraft(next)
    setDraft(next)
  }

  return draft ? (
    <Logger draft={draft} update={update} workouts={workouts.data ?? []} exercises={exercises.data ?? []} />
  ) : (
    <Start onStart={update} last={workouts.data?.[0]} />
  )
}

function Start({ onStart, last }: { onStart: (draft: Draft) => void; last: Workout | undefined }) {
  useTitle('Workout')
  return (
    <>
      <h1 className="text-2xl font-bold">Workout</h1>
      <button onClick={() => onStart(emptyDraft())} className={primaryButton}>
        Start an empty workout
      </button>
      {last && (
        <Card>
          <p className="text-sm font-semibold text-neutral-500 uppercase">Last workout</p>
          <p className="mt-1 font-semibold">{last.name}</p>
          <p className="text-sm text-neutral-500">
            {formatDay(last.startedAt)} · {groupSets(last.sets).length} exercises · {last.sets.length} sets
          </p>
          <button onClick={() => onStart(repeatDraft(last))} className={`mt-3 w-full ${secondaryButton}`}>
            Repeat this workout
          </button>
        </Card>
      )}
    </>
  )
}

function Logger({ draft, update, workouts, exercises }: {
  draft: Draft
  update: (draft: Draft | undefined) => void
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

  // A change to the sets means the workout isn't over yet: a new Finish sets the end time again.
  const setExercises = (list: DraftExercise[], restEndsAt = draft.restEndsAt) =>
    update({ ...draft, exercises: list, restEndsAt, finishedAt: draft.editing ? draft.finishedAt : undefined })
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
      update(undefined)
      navigate(`/history/${pending.id}`)
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 0
          ? "Saved on this phone. It uploads when you're back online, or tap Finish to try again."
          : (error as Error).message,
      )
    } finally {
      setSaving(false)
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
    update(undefined)
    if (draft.editing) navigate(`/history/${draft.id}`)
  }

  const restLeft = draft.restEndsAt ? Math.ceil((draft.restEndsAt - now.getTime()) / 1000) : 0

  return (
    <>
      <div className="space-y-1">
        <input
          value={draft.name}
          onChange={(e) => update({ ...draft, name: e.target.value })}
          aria-label="Workout name"
          maxLength={100}
          className="w-full rounded-lg bg-transparent text-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600"
        />
        <p className="text-sm text-neutral-500">
          {draft.editing ? `Editing · ${formatDay(draft.startedAt)}` : `${formatClock(now.getTime() - Date.parse(draft.startedAt))} · started ${formatDay(draft.startedAt)}`}
        </p>
      </div>

      {draft.exercises.map((ex, e) => {
        const prev = previous(ex.exerciseId)
        return (
          <Card key={`${ex.exerciseId}-${e}`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="pt-2 font-semibold">{names.get(ex.exerciseId) ?? 'Exercise'}</h2>
              <button onClick={() => removeExercise(e)} className={`-mr-2 text-sm ${linkButton}`}>
                Remove
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[2rem_1fr_4.5rem_4rem_2.75rem] items-center gap-x-2 gap-y-1.5 text-center text-sm">
              <span className="font-semibold text-neutral-500">Set</span>
              <span className="font-semibold text-neutral-500">Previous</span>
              <span className="font-semibold text-neutral-500">lb</span>
              <span className="font-semibold text-neutral-500">Reps</span>
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
              <button onClick={() => addSet(e)} className={linkButton}>
                + Add set
              </button>
              <button onClick={() => removeSet(e)} disabled={ex.sets.length <= 1} className={`text-sm ${linkButton}`}>
                Remove set
              </button>
            </div>
          </Card>
        )
      })}

      <button onClick={() => setPicking(true)} className={`w-full ${secondaryButton}`}>
        + Add exercise
      </button>

      {message && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-50">
          {message}
        </p>
      )}

      <button onClick={finish} disabled={saving} className={primaryButton}>
        {saving ? 'Saving…' : draft.editing ? 'Save changes' : 'Finish'}
      </button>
      <button onClick={discard} className={dangerButton}>
        {draft.editing ? 'Cancel editing' : 'Discard workout'}
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
  const input = `${field} px-1 text-center ${set.done ? 'bg-green-100 dark:bg-green-950' : ''}`
  return (
    <>
      <span className="font-semibold">{number}</span>
      <span className="truncate text-neutral-500">{previous ?? '–'}</span>
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
        className={`grid size-11 place-items-center rounded-lg ${set.done ? 'bg-green-600 text-white' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'}`}
      >
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
          <path d="m5 12 5 5 9-10" />
        </svg>
      </button>
    </>
  )
}

/** Counts down above the tab bar. It counts to a saved end time, so it stays right across reloads and backgrounding. */
function RestTimer({ seconds, onAdjust, onSkip }: { seconds: number; onAdjust: (by: number) => void; onSkip: () => void }) {
  const button = 'min-h-11 rounded-lg bg-white/10 px-3 font-semibold active:bg-white/20'
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 bg-neutral-900 text-white">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2">
        <p role="timer" aria-live="off" className="text-lg font-bold tabular-nums">
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

/** Choose an exercise, or add a new one by name. A full-screen native <dialog>: it traps focus and Escape closes it. */
function ExercisePicker({ exercises, onPick, onClose }: { exercises: Exercise[]; onPick: (exercise: Exercise) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal() // StrictMode runs this twice in development
  }, [])

  const q = query.trim()
  const matches = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
  const exact = exercises.some((e) => e.name.toLowerCase() === q.toLowerCase())

  const add = async () => {
    setAdding(true)
    setError(undefined)
    try {
      onPick(await addExercise(q, 'Other'))
    } catch (e) {
      setError((e as Error).message)
      setAdding(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="picker-title"
      className="m-0 h-full max-h-none w-full max-w-none bg-neutral-100 p-0 text-neutral-900 backdrop:bg-black/60 dark:bg-neutral-950 dark:text-neutral-100"
    >
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 id="picker-title" className="text-xl font-bold">
            Add exercise
          </h2>
          <button onClick={() => dialog.current?.close()} className={`-mr-2 ${linkButton}`}>
            Cancel
          </button>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search exercises" onSubmit={() => matches[0] && onPick(matches[0])} />
        {q && !exact && (
          <button onClick={add} disabled={adding} className={`w-full ${secondaryButton}`}>
            {adding ? 'Adding…' : `Add “${q}” as a new exercise`}
          </button>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <ul className="divide-y divide-neutral-100 rounded-xl bg-white shadow-sm dark:divide-neutral-800 dark:bg-neutral-900">
          {matches.map((exercise) => (
            <li key={exercise.id}>
              <button onClick={() => onPick(exercise)} className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left active:bg-neutral-50 dark:active:bg-neutral-800">
                <span className="font-medium">{exercise.name}</span>
                <span className="text-sm text-neutral-500">{exercise.muscleGroup}</span>
              </button>
            </li>
          ))}
        </ul>
        {exercises.length === 0 && <p className="text-sm text-neutral-500">The exercise list needs a connection the first time. Check your signal.</p>}
      </div>
    </dialog>
  )
}

/** "4:05", "1:02:03" */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}
