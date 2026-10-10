import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getExercises, getPlan, makeRestDay, savePlanDay, type Exercise, type PlanDay, type PlanExercise } from '../api'
import { Card, dangerButton, field, Notice, NotFound, Page, primaryButton, Status, Stepper, tintedButton } from '../components'
import { DAY_NAMES } from '../dates'
import { ExercisePicker } from '../ExercisePicker'
import { Icon } from '../icons'
import { usePolling } from '../usePolling'

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
  const [name, setName] = useState(existing?.name ?? '')
  const [items, setItems] = useState<PlanExercise[]>(existing?.exercises ?? [])
  const [picking, setPicking] = useState(false)
  const [added, setAdded] = useState<Exercise[]>([]) // made in the picker, before the list reloads
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const names = new Map([...exercises, ...added].map((e) => [e.id, e.name]))

  const change = (i: number, update: Partial<PlanExercise>) => setItems(items.map((item, j) => (j === i ? { ...item, ...update } : item)))
  const move = (i: number, by: number) => {
    const next = [...items]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setItems(next)
  }
  const pick = (exercise: Exercise) => {
    setPicking(false)
    if (!names.has(exercise.id)) setAdded((list) => [...list, exercise])
    setItems([...items, { exerciseId: exercise.id, sets: 3, reps: 10 }])
  }

  const save = async () => {
    if (!name.trim()) return setMessage('Give this day a name, like Push Day.')
    if (items.length === 0) return setMessage('Add at least one exercise, or make it a rest day.')
    setSaving(true)
    setMessage(undefined)
    try {
      await savePlanDay(day, { name: name.trim(), exercises: items })
      navigate('/workouts')
    } catch (error) {
      setMessage((error as Error).message)
      setSaving(false)
    }
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
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, like Push Day" aria-label="Workout name" maxLength={50} className={field} />
      {!name && (
        <div className="flex flex-wrap gap-2">
          {NAME_IDEAS.map((idea) => (
            <button key={idea} onClick={() => setName(idea)} className="min-h-9 rounded-full bg-surface px-3 text-[15px] text-coral-ink shadow-[0_1px_2px_rgb(42_31_26/0.06)] active:opacity-70">
              {idea}
            </button>
          ))}
        </div>
      )}

      {items.map((item, i) => {
        const label = names.get(item.exerciseId) ?? 'Exercise'
        return (
          <Card key={`${item.exerciseId}-${i}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="pt-2 font-semibold">{label}</p>
              <div className="flex text-muted">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${label} up`} className="grid size-10 place-items-center rounded-lg active:bg-fill disabled:opacity-30">
                  <Icon name="arrowUp" className="size-5" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${label} down`} className="grid size-10 place-items-center rounded-lg active:bg-fill disabled:opacity-30">
                  <Icon name="arrowDown" className="size-5" />
                </button>
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove ${label}`} className="grid size-10 place-items-center rounded-lg active:bg-fill">
                  <Icon name="trash" className="size-5" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[15px] text-muted">
                Sets <Stepper value={item.sets} onChange={(sets) => change(i, { sets })} min={1} max={20} label={`sets of ${label}`} />
              </span>
              <span className="flex items-center gap-2 text-[15px] text-muted">
                Reps <Stepper value={item.reps} onChange={(reps) => change(i, { reps })} min={1} max={100} label={`reps of ${label}`} />
              </span>
            </div>
          </Card>
        )
      })}

      <button onClick={() => setPicking(true)} className={`w-full ${tintedButton}`}>
        <Icon name="plus" className="size-5" />
        Add Exercise
      </button>

      {message && <Notice>{message}</Notice>}
      <button onClick={save} disabled={saving} className={primaryButton}>
        {saving ? 'Saving…' : `Save ${DAY_NAMES[day]}`}
      </button>
      <button onClick={rest} className={dangerButton}>
        {existing ? 'Make It a Rest Day' : 'Keep It a Rest Day'}
      </button>

      {picking && <ExercisePicker exercises={[...exercises, ...added]} onPick={pick} onClose={() => setPicking(false)} />}
    </Page>
  )
}
