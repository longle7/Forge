import { useState } from 'react'
import { addExercise, MUSCLE_GROUPS, type Exercise } from './api'
import { Notice, SearchInput, Sheet, tapArea, tintedButton } from './components'
import { haptic } from './notify'
import { useAction } from './usePolling'

/**
 * Choose an exercise, or add a new one by name: for the workout logger and the plan editor. Chips narrow it to a muscle
 * group, and pick the group of a new one; `recent` (exercise IDs, most recent first) are listed on top. A full-screen
 * Sheet, titled `title` (the logger's Replace says so).
 */
export function ExercisePicker({ title = 'Add Exercise', exercises, recent = [], onPick, onClose }: {
  title?: string
  exercises: Exercise[]
  recent?: number[]
  onPick: (exercise: Exercise) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>()
  const { busy: adding, error, run } = useAction()

  const q = query.trim()
  const matches = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!group || e.muscleGroup === group))
  const recentShown = q || group ? [] : recent.map((id) => exercises.find((e) => e.id === id)).filter((e) => e !== undefined)
  const isNew = !!q && !exercises.some((e) => e.name.toLowerCase() === q.toLowerCase())

  const add = async (muscleGroup: string) => {
    await run(async () => {
      const exercise = await addExercise(q, muscleGroup)
      void haptic('success')
      onPick(exercise)
    })
  }

  return (
    <Sheet title={title} full onClose={onClose}>
      <SearchInput value={query} onChange={setQuery} placeholder="Search exercises" onSubmit={() => matches[0] && onPick(matches[0])} />
      {/* py-1 makes room for the chips' tap areas, which a scrolling row would cut off. */}
      <div role="group" aria-label="Muscle group" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
        {[undefined, ...MUSCLE_GROUPS].map((g) => (
          <button
            key={g ?? 'All'}
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={`${tapArea} min-h-9 shrink-0 rounded-full px-3.5 text-[15px] font-medium ${group === g ? 'bg-coral/15 text-coral-ink' : 'bg-surface text-muted'}`}
          >
            {g ?? 'All'}
          </button>
        ))}
      </div>
      {/* A new exercise goes in the muscle group you pick with the chips above. */}
      {isNew && group && (
        <button onClick={() => add(group)} disabled={adding} className={`w-full ${tintedButton}`}>
          {adding ? 'Adding…' : `Add “${q}” to ${group}`}
        </button>
      )}
      {isNew && !group && <p className="px-1 text-[15px] text-muted">To add “{q}” as a new exercise, pick its muscle group above.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {recentShown.length > 0 && (
        <>
          <h3 className="px-1 pt-1 text-[13px] font-semibold text-muted uppercase">Recent</h3>
          <List exercises={recentShown} onPick={onPick} />
          <h3 className="px-1 pt-1 text-[13px] font-semibold text-muted uppercase">All exercises</h3>
        </>
      )}
      <List exercises={matches} onPick={onPick} />
      {exercises.length === 0 && <p className="text-[15px] text-muted">The exercise list needs a connection the first time. Check your signal.</p>}
    </Sheet>
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
