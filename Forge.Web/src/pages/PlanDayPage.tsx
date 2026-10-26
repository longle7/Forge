import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getExercises, getPlan, isCardio, makeRestDay, savePlanDay, type Exercise, type PlanDay } from '../api'
import { dangerButton, field, Notice, NotFound, Page, plainButton, primaryButton, Status, tapArea, tintedButton } from '../components'
import { DAY_NAMES } from '../dates'
import { builderToPlanExercises, planDraft, planExercisesToBuilder, useStartWorkout } from '../draft'
import { Icon } from '../icons'
import { usePolling, useAction } from '../usePolling'
import { WorkoutBuilder } from '../WorkoutBuilder'

const BACK = { to: '/workouts', label: 'Workouts' }
const NAME_IDEAS = ['Push Day', 'Pull Day', 'Leg Day', 'Upper Body', 'Lower Body', 'Full Body']

/** Plan one weekday (/workouts/plan/1 = Monday): a name and exercises with sets × reps, or make it a rest day. */
export default function PlanDayPage() {
  const day = Number(useParams().day)
  const plan = usePolling(getPlan, '/plan')
  const exercises = usePolling(getExercises, '/exercises')

  if (!(Number.isInteger(day) && day >= 0 && day <= 6)) return <NotFound back={{ to: '/workouts', label: 'Workouts' }} />
  if (plan.data === undefined && !plan.error) {
    return (
      <Page title={DAY_NAMES[day]} back={BACK}>
        <Status loading />
      </Page>
    )
  }
  return <PlanEditor day={day} existing={plan.data?.find((p) => p.dayOfWeek === day)} exercises={exercises.data ?? []} />
}

function PlanEditor({ day, existing, exercises }: { day: number; existing: PlanDay | undefined; exercises: Exercise[] }) {
  const navigate = useNavigate()
  const cardio = new Set(exercises.filter(isCardio).map((e) => e.id))
  const [name, setName] = useState(existing?.name ?? '')
  const [planned, setPlanned] = useState(() => planExercisesToBuilder(existing?.exercises ?? [], cardio))
  const { busy: saving, error: message, setError: setMessage, run } = useAction()
  const startWorkout = useStartWorkout()

  const save = async () => {
    if (!name.trim()) return setMessage('Give this day a name, like Push Day.')
    if (planned.length === 0) return setMessage('Add at least one exercise, or make it a rest day.')
    await run(async () => {
      await savePlanDay(day, { name: name.trim(), exercises: builderToPlanExercises(planned) })
      navigate('/workouts')
    })
  }

  const rest = async () => {
    if (existing && !confirm(`Make ${DAY_NAMES[day]} a rest day? Its plan is removed.`)) return
    try {
      await makeRestDay(day)
      navigate('/workouts')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <Page title={DAY_NAMES[day]} back={BACK}>
      {/* The saved plan, whichever day it is: to do Thursday's workout on Wednesday, or catch up on a missed one. */}
      {existing && (
        <button onClick={() => setMessage(startWorkout(planDraft(existing, cardio)))} className={`w-full ${tintedButton}`}>
          <Icon name="play" className="size-5 fill-current" />
          Start {existing.name}
        </button>
      )}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, like Push Day" aria-label="Workout name" maxLength={50} className={field} />
      {!name && (
        <div className="flex flex-wrap gap-2">
          {NAME_IDEAS.map((idea) => (
            <button key={idea} onClick={() => setName(idea)} className={`${tapArea} min-h-9 rounded-full bg-surface px-3 text-[15px] text-coral-ink shadow-[0_1px_2px_rgb(42_31_26/0.06)] active:opacity-70`}>
              {idea}
            </button>
          ))}
        </div>
      )}

      <WorkoutBuilder exercises={planned} onChange={setPlanned} />

      {message && <Notice tone="error">{message}</Notice>}
      <button onClick={save} disabled={saving} className={primaryButton}>
        {saving ? 'Saving…' : `Save ${DAY_NAMES[day]}`}
      </button>
      {/* Red only when a plan would go; keeping a rest day loses nothing. */}
      <button onClick={rest} className={existing ? dangerButton : `w-full justify-center ${plainButton}`}>
        {existing ? 'Make It a Rest Day' : 'Keep It a Rest Day'}
      </button>
    </Page>
  )
}
