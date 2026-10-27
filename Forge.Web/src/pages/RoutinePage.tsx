import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getRoutines, randomId, saveRoutine, type Routine } from '../api'
import { field, Notice, NotFound, Page, plainButton, Status } from '../components'
import { builderToRoutineSets, routineToBuilder } from '../draft'
import { haptic } from '../notify'
import { failure, useAction, usePolling, useSettled } from '../usePolling'
import { WorkoutBuilder } from '../WorkoutBuilder'

const BACK = { to: '/workouts', label: 'Workouts' }

/** Build a routine from scratch (/workouts/routines/new) or change one (/workouts/routines/{id}): its name and exercises. */
export default function RoutinePage() {
  const { id } = useParams()
  const routines = usePolling(getRoutines, '/routines')
  const settled = useSettled(routines)
  const routine = routines.data?.find((r) => r.id === id)

  if (id === 'new') return <RoutineEditor />
  if (!routine && settled && routines.data) return <NotFound title="Routine not found" message="It may have been deleted." back={BACK} />
  if (!routine) {
    return (
      <Page title="" back={BACK}>
        <Status loading={!routines.error} error={failure(routines)} onRetry={routines.reload} />
      </Page>
    )
  }
  return <RoutineEditor routine={routine} />
}

function RoutineEditor({ routine }: { routine?: Routine }) {
  const navigate = useNavigate()
  const [id] = useState(() => routine?.id ?? randomId()) // one ID, so saving again after a lost answer makes no copy
  const [name, setName] = useState(routine?.name ?? '')
  const [exercises, setExercises] = useState(() => (routine ? routineToBuilder(routine) : []))
  const { busy, error, setError, run } = useAction()

  const save = () => {
    if (!name.trim()) return setError('Give it a name, like Push A.')
    if (exercises.length === 0) return setError('Add at least one exercise.')
    void run(async () => {
      await saveRoutine(id, { name: name.trim(), sets: builderToRoutineSets(exercises) })
      void haptic('success')
      navigate('/workouts#routines')
    })
  }

  return (
    <Page
      title={routine ? 'Edit Routine' : 'New Routine'}
      back={BACK}
      action={
        <button onClick={save} disabled={busy} className={`font-semibold ${plainButton}`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, like Push A" aria-label="Routine name" maxLength={50} className={field} />
      {error && <Notice tone="error">{error}</Notice>}
      <WorkoutBuilder exercises={exercises} onChange={setExercises} supersets />
    </Page>
  )
}
