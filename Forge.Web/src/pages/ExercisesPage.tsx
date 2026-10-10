import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { addExercise, getExercises, MUSCLE_GROUPS } from '../api'
import { Card, field, primaryButton, SearchInput, Section, Status } from '../components'
import { failure, usePolling, useTitle } from '../usePolling'

/** The Exercises tab: every exercise by muscle group, and adding your own. */
export default function ExercisesPage() {
  useTitle('Exercises')
  const exercises = usePolling(getExercises, '/exercises')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = exercises.data?.filter((e) => e.name.toLowerCase().includes(q)) ?? []

  return (
    <>
      <h1 className="text-2xl font-bold">Exercises</h1>
      <SearchInput value={query} onChange={setQuery} placeholder="Search exercises" />
      <Status loading={exercises.data === undefined && !exercises.error} error={failure(exercises)} />
      {exercises.data && matches.length === 0 && <p className="text-neutral-500">No exercise matches “{query.trim()}”. Add it below.</p>}
      {MUSCLE_GROUPS.map((group) => {
        const list = matches.filter((e) => e.muscleGroup === group)
        if (list.length === 0) return null
        return (
          <Section key={group} title={group}>
            <ul className="divide-y divide-neutral-100 rounded-xl bg-white shadow-sm dark:divide-neutral-800 dark:bg-neutral-900">
              {list.map((exercise) => (
                <li key={exercise.id}>
                  <Link to={`/exercises/${exercise.id}`} className="flex min-h-12 items-center justify-between gap-2 px-4">
                    <span className="font-medium">{exercise.name}</span>
                    {exercise.isCustom && <span className="text-xs font-semibold text-neutral-500 uppercase">Yours</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )
      })}
      <AddExercise initialName={query.trim()} />
    </>
  )
}

function AddExercise({ initialName }: { initialName: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState<string>()
  const [muscleGroup, setMuscleGroup] = useState(MUSCLE_GROUPS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const value = name ?? initialName // follows the search box until you type here

  const add = async () => {
    setSaving(true)
    setError(undefined)
    try {
      const exercise = await addExercise(value.trim(), muscleGroup)
      navigate(`/exercises/${exercise.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Section title="Add an exercise">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
          className="space-y-2"
        >
          <input value={value} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Zercher Squat (Barbell)" aria-label="Exercise name" maxLength={100} className={field} />
          <select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} aria-label="Muscle group" className={field}>
            {MUSCLE_GROUPS.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button disabled={saving || !value.trim()} className={primaryButton}>
            {saving ? 'Adding…' : 'Add exercise'}
          </button>
        </form>
      </Card>
    </Section>
  )
}
