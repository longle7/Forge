import { useState } from 'react'
import { useNavigate } from 'react-router'
import { addExercise, getExercises, getWorkouts, isCardio, MUSCLE_GROUPS } from '../api'
import { Card, field, Group, Notice, Page, primaryButton, Row, SearchInput, Status } from '../components'
import { failure, usePolling, useAction } from '../usePolling'
import { bestSet, formatCardio, formatSet } from '../workouts'

/** Every exercise by muscle group with your best set in each, and adding your own (Workouts → Exercises). */
export default function ExercisesPage() {
  const exercises = usePolling(getExercises, '/exercises')
  const workouts = usePolling(getWorkouts, '/workouts')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = exercises.data?.filter((e) => e.name.toLowerCase().includes(q)) ?? []

  return (
    <Page title="Exercises" back={{ to: '/workouts', label: 'Workouts' }}>
      <SearchInput value={query} onChange={setQuery} placeholder="Search exercises" />
      <Status loading={exercises.data === undefined && !exercises.error} error={failure(exercises)} onRetry={exercises.reload} />
      {exercises.data && matches.length === 0 && <p className="text-muted">No exercise matches “{query.trim()}”. Add it below.</p>}
      {MUSCLE_GROUPS.map((group) => {
        const list = matches.filter((e) => e.muscleGroup === group)
        if (list.length === 0) return null
        return (
          <Group key={group} title={group}>
            {list.map((exercise) => {
              const best = bestSet(workouts.data ?? [], exercise.id)?.set
              return (
                <Row
                  key={exercise.id}
                  to={`/workouts/exercises/${exercise.id}`}
                  detail={best ? <span className="text-[15px]">{isCardio(exercise) ? formatCardio(best) : formatSet(best)}</span> : exercise.isCustom ? 'Yours' : undefined}
                >
                  {exercise.name}
                </Row>
              )
            })}
          </Group>
        )
      })}
      <AddExercise initialName={query.trim()} />
    </Page>
  )
}

function AddExercise({ initialName }: { initialName: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState<string>()
  const [muscleGroup, setMuscleGroup] = useState(MUSCLE_GROUPS[0])
  const { busy: saving, error, run } = useAction()
  const value = name ?? initialName // follows the search box until you type here

  const add = async () => {
    await run(async () => {
      const exercise = await addExercise(value.trim(), muscleGroup)
      navigate(`/workouts/exercises/${exercise.id}`)
    })
  }

  return (
    <Card>
      <h2 className="font-semibold">Add an Exercise</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
        className="mt-3 space-y-2"
      >
        <input value={value} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Zercher Squat (Barbell)" aria-label="Exercise name" maxLength={100} className={field} />
        <select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} aria-label="Muscle group" className={field}>
          {MUSCLE_GROUPS.map((group) => (
            <option key={group}>{group}</option>
          ))}
        </select>
        {muscleGroup === 'Cardio' && <p className="text-[15px] text-muted">Cardio is logged as a distance and time instead of weight and reps.</p>}
        {error && <Notice tone="error">{error}</Notice>}
        <button disabled={saving || !value.trim()} className={primaryButton}>
          {saving ? 'Adding…' : 'Add Exercise'}
        </button>
      </form>
    </Card>
  )
}
