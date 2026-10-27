import { useState } from 'react'
import { getExercises, getWorkouts, isCardio, type Exercise } from './api'
import { Card, field, Stepper, SupersetGroup, Switch, tintedButton } from './components'
import { isNormalSet, planExerciseToBuilder, separateFromNext, supersetWithNext, withSetCount, withNormalSets, type DraftExercise, type DraftSet } from './draft'
import { ExercisePicker } from './ExercisePicker'
import { Icon } from './icons'
import { usePolling } from './usePolling'
import { groupSupersets, move, recentExercises, setKindsSummary } from './workouts'

const iconButton = 'grid size-11 place-items-center rounded-lg active:bg-fill disabled:opacity-30'

/**
 * The exercises of a plan day, a routine, or a past workout, in order, each with its sets and reps: to put together
 * from scratch or change. `weights` (a past workout): each lift's weight, and each cardio exercise's distance and time.
 * `supersets` (a routine): an exercise can go back to back with the next. Warm-ups, drop sets, and sets to failure
 * (only a routine has them) stay as they are, shown as "+2 warm-ups".
 */
export function WorkoutBuilder({ exercises, onChange, weights = false, supersets = false }: {
  exercises: DraftExercise[]
  onChange: (exercises: DraftExercise[]) => void
  weights?: boolean
  supersets?: boolean
}) {
  const known = usePolling(getExercises, '/exercises')
  const workouts = usePolling(getWorkouts, '/workouts')
  const [picking, setPicking] = useState(false)
  const [added, setAdded] = useState<Exercise[]>([]) // made in the picker, before the list reloads
  const all = [...(known.data ?? []), ...added]
  const names = new Map(all.map((e) => [e.id, e.name]))
  const cardio = new Set(all.filter(isCardio).map((e) => e.id))

  const pick = (exercise: Exercise) => {
    setPicking(false)
    if (!names.has(exercise.id)) setAdded((list) => [...list, exercise])
    // A lift starts at 3 sets of 10.
    onChange([...exercises, planExerciseToBuilder({ exerciseId: exercise.id, sets: 3, reps: 10 }, isCardio(exercise))])
  }

  const card = (i: number) => {
    const exercise = exercises[i]
    const name = names.get(exercise.exerciseId) ?? 'Exercise'
    const next = exercises[i + 1]
    const linked = exercise.superset !== undefined && exercise.superset === next?.superset
    return (
      <Card key={`${exercise.exerciseId}-${i}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="pt-2.5 font-semibold">{name}</p>
          <div className="flex text-muted">
            <button onClick={() => onChange(move(exercises, i, -1))} disabled={i === 0} aria-label={`Move ${name} up`} className={iconButton}>
              <Icon name="arrowUp" className="size-5" />
            </button>
            <button onClick={() => onChange(move(exercises, i, 1))} disabled={!next} aria-label={`Move ${name} down`} className={iconButton}>
              <Icon name="arrowDown" className="size-5" />
            </button>
            <button onClick={() => onChange(exercises.filter((_, j) => j !== i))} aria-label={`Remove ${name}`} className={iconButton}>
              <Icon name="trash" className="size-5" />
            </button>
          </div>
        </div>
        <SetsFields
          name={name}
          exercise={exercise}
          cardio={cardio.has(exercise.exerciseId)}
          weights={weights}
          onChange={(changed) => onChange(exercises.map((e, j) => (j === i ? changed : e)))}
        />
        {supersets && next && (
          // A label, so the whole row is the switch's tap area.
          <label className="mt-2 flex min-h-11 items-center justify-between gap-3 text-[15px]">
            Superset with next
            <Switch
              checked={linked}
              onChange={(on) => onChange(on ? supersetWithNext(exercises, i) : separateFromNext(exercises, i))}
              label={`Superset ${name} with ${names.get(next.exerciseId) ?? 'the next exercise'}`}
            />
          </label>
        )}
      </Card>
    )
  }

  return (
    <>
      {groupSupersets([...exercises.keys()], (i) => exercises[i].superset).map((group) =>
        group.length > 1 ? <SupersetGroup key={`superset-${group[0]}`}>{group.map(card)}</SupersetGroup> : card(group[0]),
      )}
      <button onClick={() => setPicking(true)} className={`w-full ${tintedButton}`}>
        <Icon name="plus" className="size-5" />
        Add Exercise
      </button>
      {picking && <ExercisePicker exercises={all} recent={recentExercises(workouts.data ?? [])} onPick={pick} onClose={() => setPicking(false)} />}
    </>
  )
}

/**
 * One exercise's normal sets: how many, their reps, and with `weights` their weight; or a cardio exercise's distance
 * and time. Reps that differ from set to set ("8, 8, 6") stay until the stepper sets them all.
 */
function SetsFields({ name, exercise, cardio, weights, onChange }: {
  name: string
  exercise: DraftExercise
  cardio: boolean
  weights: boolean
  onChange: (exercise: DraftExercise) => void
}) {
  const changeAll = (change: Partial<DraftSet>) => onChange(withNormalSets(exercise, change))
  const caption = 'flex items-center gap-2 text-[15px] text-muted'

  if (cardio && !weights) return <p className="text-[15px] text-muted">You'll log the distance and time when you go.</p>
  if (cardio) {
    const [set] = exercise.sets
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[15px] text-muted">Distance (mi)</span>
          <input value={set.distance ?? ''} onChange={(e) => changeAll({ distance: e.target.value })} inputMode="decimal" aria-label={`${name} distance in miles`} className={field} />
        </label>
        <label className="block">
          <span className="text-[15px] text-muted">Time</span>
          <input value={set.time ?? ''} onChange={(e) => changeAll({ time: e.target.value })} inputMode="decimal" placeholder="min or m:ss" aria-label={`${name} time, in minutes or minutes:seconds`} className={field} />
        </label>
      </div>
    )
  }

  const normal = exercise.sets.filter(isNormalSet)
  const reps = normal.map((s) => s.reps)
  const kinds = setKindsSummary(exercise.sets)
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className={caption}>
          Sets <Stepper value={normal.length} onChange={(count) => onChange(withSetCount(exercise, count))} min={1} max={20} label={`sets of ${name}`} />
        </span>
        {normal.length > 0 && (
          <span className={caption}>
            Reps
            <Stepper
              value={Number(reps[0])}
              text={new Set(reps).size > 1 ? reps.join(', ') : undefined}
              onChange={(count) => changeAll({ reps: String(count) })}
              min={1}
              max={100}
              label={`reps of ${name}`}
            />
          </span>
        )}
      </div>
      {weights && normal.length > 0 && (
        <label className={`mt-2 justify-between ${caption}`}>
          Weight (lb)
          <input
            value={normal[0].weight}
            onChange={(e) => changeAll({ weight: e.target.value })}
            inputMode="decimal"
            placeholder="Bodyweight"
            aria-label={`${name} weight in pounds`}
            className={`${field} max-w-32 text-center`}
          />
        </label>
      )}
      {kinds && <p className="mt-1 text-[15px] text-muted">{kinds}</p>}
    </>
  )
}
