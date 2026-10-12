import { useEffect, useRef, useState } from 'react'
import { addExercise, MUSCLE_GROUPS, type Exercise } from './api'
import { plainButton, SearchInput, tintedButton } from './components'

/**
 * Choose an exercise, or add a new one by name: for the workout logger and the plan editor. Chips narrow it to a muscle
 * group; `recent` (exercise IDs, most recent first) are listed on top. A full-screen native <dialog>: it traps focus,
 * and Escape or Cancel closes it.
 */
export function ExercisePicker({ exercises, recent = [], onPick, onClose }: {
  exercises: Exercise[]
  recent?: number[]
  onPick: (exercise: Exercise) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal() // StrictMode runs this twice in development
  }, [])

  const q = query.trim()
  const matches = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!group || e.muscleGroup === group))
  const recentShown = q || group ? [] : recent.map((id) => exercises.find((e) => e.id === id)).filter((e) => e !== undefined)
  const exact = exercises.some((e) => e.name.toLowerCase() === q.toLowerCase())

  const add = async () => {
    setAdding(true)
    setError(undefined)
    try {
      onPick(await addExercise(q, group ?? 'Other'))
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
      className="m-0 h-full max-h-none w-full max-w-none bg-canvas p-0 text-ink backdrop:bg-black/40"
    >
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <button onClick={() => dialog.current?.close()} className={plainButton}>
            Cancel
          </button>
          <h2 id="picker-title" className="font-semibold">
            Add Exercise
          </h2>
          <span className="w-14" aria-hidden />
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search exercises" onSubmit={() => matches[0] && onPick(matches[0])} />
        <div role="group" aria-label="Muscle group" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {[undefined, ...MUSCLE_GROUPS].map((g) => (
            <button
              key={g ?? 'All'}
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={`min-h-9 shrink-0 rounded-full px-3.5 text-[15px] font-medium ${group === g ? 'bg-coral/15 text-coral-ink' : 'bg-surface text-muted'}`}
            >
              {g ?? 'All'}
            </button>
          ))}
        </div>
        {q && !exact && (
          <button onClick={add} disabled={adding} className={`w-full ${tintedButton}`}>
            {adding ? 'Adding…' : `Add “${q}” as a new exercise`}
          </button>
        )}
        {error && <p className="text-[15px] text-red-600 dark:text-red-400">{error}</p>}
        {recentShown.length > 0 && (
          <>
            <h3 className="px-1 pt-1 text-[13px] font-semibold text-muted uppercase">Recent</h3>
            <List exercises={recentShown} onPick={onPick} />
            <h3 className="px-1 pt-1 text-[13px] font-semibold text-muted uppercase">All exercises</h3>
          </>
        )}
        <List exercises={matches} onPick={onPick} />
        {exercises.length === 0 && <p className="text-[15px] text-muted">The exercise list needs a connection the first time. Check your signal.</p>}
      </div>
    </dialog>
  )
}

function List({ exercises, onPick }: { exercises: Exercise[]; onPick: (exercise: Exercise) => void }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
      {exercises.map((exercise) => (
        <li key={exercise.id}>
          <button onClick={() => onPick(exercise)} className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left active:bg-fill">
            <span>{exercise.name}</span>
            <span className="text-[15px] text-muted">{exercise.muscleGroup}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
