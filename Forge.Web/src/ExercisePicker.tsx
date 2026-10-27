import { useState } from 'react'
import { addExercise, MUSCLE_GROUPS, type Exercise } from './api'
import { Card, Notice, SearchInput, Sheet, tapArea, tintedButton } from './components'
import { LiftIcon } from './LiftFigure'
import { EQUIPMENT_LABELS, nameWithEquipment, type Equipment } from './lifts'
import { haptic } from './notify'
import { useAction } from './usePolling'

/**
 * Choose an exercise, or add a new one by name: for the workout logger and the plan editor. Chips narrow it to a muscle
 * group, and pick the group of a new one, then its equipment; `recent` (exercise IDs, most recent first) are listed on
 * top. A full-screen Sheet, titled `title` (the logger's Replace says so).
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
  const [equipment, setEquipment] = useState<Equipment>('bodyweight')
  const { busy: adding, error, run } = useAction()

  const q = query.trim()
  const matches = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!group || e.muscleGroup === group))
  const recentShown = q || group ? [] : recent.map((id) => exercises.find((e) => e.id === id)).filter((e) => e !== undefined)
  const isNew = !!q && !exercises.some((e) => e.name.toLowerCase() === q.toLowerCase())
  const newName = nameWithEquipment(q, equipment)

  const add = async (muscleGroup: string) => {
    await run(async () => {
      const exercise = await addExercise(newName, muscleGroup)
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
      {/* A new exercise goes in the muscle group you pick with the chips above, with the equipment you pick here. */}
      {isNew && group && (
        <Card>
          <EquipmentChips value={equipment} onChange={setEquipment} />
          <button onClick={() => add(group)} disabled={adding} className={`mt-3 w-full ${tintedButton}`}>
            {adding ? 'Adding…' : `Add “${newName}” to ${group}`}
          </button>
        </Card>
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
          <button onClick={() => onPick(exercise)} className="flex min-h-12 w-full items-center gap-3 px-4 py-1 text-left active:bg-fill">
            <LiftIcon exercise={exercise} />
            <span className="min-w-0 flex-1">{exercise.name}</span>
            <span className="text-[15px] text-muted">{exercise.muscleGroup}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Chips for a new lift's equipment, which goes in its name like the built-ins': "Zercher Squat (Barbell)". */
export function EquipmentChips({ value, onChange }: { value: Equipment; onChange: (equipment: Equipment) => void }) {
  return (
    <div role="group" aria-label="Equipment" className="flex flex-wrap gap-2">
      {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((equipment) => (
        <button
          key={equipment}
          type="button"
          onClick={() => onChange(equipment)}
          aria-pressed={value === equipment}
          className={`${tapArea} min-h-9 rounded-full px-3.5 text-[15px] font-medium ${value === equipment ? 'bg-coral/15 text-coral-ink' : 'bg-fill text-muted'}`}
        >
          {EQUIPMENT_LABELS[equipment]}
        </button>
      ))}
    </div>
  )
}
