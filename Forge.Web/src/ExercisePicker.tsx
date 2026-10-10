import { useEffect, useRef, useState } from 'react'
import { addExercise, type Exercise } from './api'
import { plainButton, SearchInput, tintedButton } from './components'

/**
 * Choose an exercise, or add a new one by name: for the workout logger and the plan editor. A full-screen native
 * <dialog>: it traps focus, and Escape or Cancel closes it.
 */
export function ExercisePicker({ exercises, onPick, onClose }: { exercises: Exercise[]; onPick: (exercise: Exercise) => void; onClose: () => void }) {
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
        {q && !exact && (
          <button onClick={add} disabled={adding} className={`w-full ${tintedButton}`}>
            {adding ? 'Adding…' : `Add “${q}” as a new exercise`}
          </button>
        )}
        {error && <p className="text-[15px] text-red-600 dark:text-red-400">{error}</p>}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {matches.map((exercise) => (
            <li key={exercise.id}>
              <button onClick={() => onPick(exercise)} className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left active:bg-fill">
                <span>{exercise.name}</span>
                <span className="text-[15px] text-muted">{exercise.muscleGroup}</span>
              </button>
            </li>
          ))}
        </ul>
        {exercises.length === 0 && <p className="text-[15px] text-muted">The exercise list needs a connection the first time. Check your signal.</p>}
      </div>
    </dialog>
  )
}
