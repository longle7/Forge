import { useState } from 'react'
import { useParams } from 'react-router'
import { getExercises, getMaxes, getWorkouts, isCardio, type TestedMax } from '../api'
import { ChartTable, LineChart } from '../charts'
import { RING } from '../colors'
import { Card, Group, NotFound, Page, plainButton, Row, Status } from '../components'
import { localDate } from '../dates'
import { loadEquipment, swapsFor } from '../equipment'
import { Icon } from '../icons'
import { LiftFigure, LiftIcon } from '../LiftFigure'
import { liftInfo, musclesWorked } from '../lifts'
import { estimatedMax, percentTable, repMaxes } from '../maxes'
import { LiftMuscles } from '../MuscleFigure'
import { shortDate, strengthSeries } from '../progress'
import { TestedMaxSheet } from '../TestedMaxSheet'
import { failure, useNow, usePolling, useSettled } from '../usePolling'
import { bestSet, formatCardio, formatClock, formatDay, formatSet, formatWeight, oneRepMax, pace } from '../workouts'

const MAX_HISTORY = 20
const MAX_SWAPS = 4
const BACK = { to: '/workouts/exercises', label: 'Exercises' }
const lb = (value: number) => `${formatWeight(Math.round(value))} lb`

/**
 * One exercise: its drawing and the muscles it works, how to do it, lifts to swap for it with your equipment, your best
 * set, estimated one-rep max and its trend, rep maxes, a percentage chart, the maxes you tested, and recent sets; for
 * cardio, your longest and best pace.
 */
export default function ExercisePage() {
  const id = Number(useParams().id)
  const today = localDate(useNow(60_000))
  const exercises = usePolling(getExercises, '/exercises')
  const workouts = usePolling(getWorkouts, '/workouts')
  const maxes = usePolling(getMaxes, '/maxes')
  const [editing, setEditing] = useState<TestedMax | 'new'>()
  const exercise = exercises.data?.find((e) => e.id === id)
  const settled = useSettled(exercises)

  if (!exercise && settled && exercises.data) {
    return <NotFound title="Exercise not found" message="It isn't in your exercise list." back={{ to: '/workouts/exercises', label: 'All Exercises' }} />
  }
  if (!exercise) {
    return (
      <Page title="" back={BACK}>
        <Status loading={!exercises.error} error={failure(exercises)} onRetry={exercises.reload} />
      </Page>
    )
  }

  const all = workouts.data ?? []
  const best = bestSet(all, id)
  const history = all.filter((w) => w.sets.some((s) => s.exerciseId === id)).slice(0, MAX_HISTORY)
  const cardio = isCardio(exercise)
  const tested = cardio ? [] : (maxes.data ?? []).filter((m) => m.exerciseId === id)
  const max = cardio ? undefined : estimatedMax(all, tested, id)
  // Logged workouts and tested maxes on one timeline, oldest first.
  const trend = cardio
    ? []
    : [
        ...strengthSeries(all, id, '').map((p) => ({ ...p, tested: false })),
        ...tested.map((m) => ({ day: m.date, value: oneRepMax(m.weight, m.reps), tested: true })),
      ].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  const paces = all.flatMap((w) => w.sets.filter((s) => s.exerciseId === id).map(pace)).filter((p) => p !== undefined)
  const lift = liftInfo(exercise)
  const works = musclesWorked(lift)
  const swaps = swapsFor(exercise, exercises.data ?? [], loadEquipment()).slice(0, MAX_SWAPS)

  return (
    <Page title={exercise.name} back={BACK}>
      <p className="-mt-3 text-muted">
        {exercise.muscleGroup}
        {exercise.isCustom && ' · added by you'}
      </p>
      <Card>
        <div className="flex items-center justify-center gap-6">
          <LiftFigure pose={lift.pose} equipment={lift.equipment} className="size-30" />
          <LiftMuscles lift={lift} className="h-30" />
        </div>
        {works && <p className="mt-2 text-center text-[15px]">{works}</p>}
      </Card>
      {lift.cues.length > 0 && (
        <Group title="How to do it">
          <ul className="list-disc space-y-1 py-3 pr-4 pl-9">
            {lift.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </Group>
      )}
      {swaps.length > 0 && (
        <Group title="Swap for">
          {swaps.map((swap) => (
            <Row key={swap.id} to={`/workouts/exercises/${swap.id}`}>
              <span className="flex items-center gap-3">
                <LiftIcon exercise={swap} />
                {swap.name}
              </span>
            </Row>
          ))}
        </Group>
      )}

      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} rows={1} onRetry={workouts.reload} />
      {workouts.data && !best && !max && <p className="text-muted">You haven't logged this exercise yet.</p>}
      {(best || max) && (
        <div className="grid grid-cols-2 gap-3">
          {best && <StatCard label={cardio ? 'Longest' : 'Best set'} value={cardio ? formatCardio(best.set) : formatSet(best.set)} detail={formatDay(best.workout.startedAt)} />}
          {cardio && paces.length > 0 && <StatCard label="Best pace" value={`${formatClock(Math.min(...paces) * 1000)} /mi`} detail="minutes per mile" />}
          {max && <StatCard label="Est. 1-rep max" value={lb(max.value)} detail={max.tested ? `tested ${shortDate(max.date)}` : 'from your best set'} />}
        </div>
      )}

      {max && <RepMaxes reps={repMaxes(all, tested, id)} />}
      {max && <Percentages max={max.value} />}

      {trend.length > 1 && (
        <Card>
          <p className="text-[13px] font-semibold text-muted uppercase">Est. 1-rep max over time</p>
          <LineChart points={trend} label={`Estimated 1-rep max for ${exercise.name}, by workout`} color={RING.move} format={(v) => `${formatWeight(Math.round(v))} lb`} axis={(v) => formatWeight(v)} />
          <ChartTable caption="Estimated 1-rep max" rows={[...trend].reverse().map((p) => [shortDate(p.day), `${lb(p.value)}${p.tested ? ' (tested)' : ''}`])} />
        </Card>
      )}

      {!cardio && maxes.data && (
        <Group title="Tested maxes" footer="A max from a meet or a test day outside Forge. It counts toward your estimated 1-rep max.">
          {tested.map((m) => (
            <button key={m.id} onClick={() => setEditing(m)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-fill">
              <span>{m.reps === 1 ? lb(m.weight) : `${lb(m.weight)} × ${m.reps}`}</span>
              <span className="text-[15px] text-muted">{shortDate(m.date)}</span>
            </button>
          ))}
          <button onClick={() => setEditing('new')} className={`w-full px-3 ${plainButton}`}>
            <Icon name="plus" className="size-5" /> Add Tested Max
          </button>
        </Group>
      )}
      {editing && (
        <TestedMaxSheet
          exerciseId={id}
          max={editing === 'new' ? undefined : editing}
          today={today}
          onSaved={() => {
            setEditing(undefined)
            maxes.reload()
          }}
          onClose={() => setEditing(undefined)}
        />
      )}

      {history.length > 0 && (
        <Group title="Recent">
          {history.map((workout) => (
            <Row key={workout.id} to={`/workouts/history/${workout.id}`}>
              <span className="block font-medium">{formatDay(workout.startedAt)}</span>
              <span className="block text-[15px] text-muted">
                {workout.sets
                  .filter((s) => s.exerciseId === id)
                  .map(formatSet)
                  .join(', ')}
              </span>
            </Row>
          ))}
        </Group>
      )}
    </Page>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <p className="text-[13px] font-semibold text-muted uppercase">{label}</p>
      <p className="mt-1 text-[22px] font-bold">{value}</p>
      <p className="text-[15px] text-muted">{detail}</p>
    </Card>
  )
}

/** The heaviest you've lifted for at least 1, 3, 5, and 10 reps. */
function RepMaxes({ reps }: { reps: ReturnType<typeof repMaxes> }) {
  return (
    <Card>
      <p className="text-[13px] font-semibold text-muted uppercase">Rep maxes</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {reps.map(({ reps, best }) => (
          <div key={reps}>
            <p className="text-[13px] text-muted">{reps}RM</p>
            <p className="text-[18px] font-bold tabular-nums">{best ? formatWeight(best.weight) : '–'}</p>
            {best && <p className="text-[13px] text-muted">{best.tested ? 'tested' : shortDate(best.date)}</p>}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** 95% down to 50% of your estimated max, rounded to loadable weights, for programs written in percentages. */
function Percentages({ max }: { max: number }) {
  return (
    <Card>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between font-semibold">
          Percentages of {lb(max)}
          <span className="text-[15px] font-normal text-coral-ink">Show</span>
        </summary>
        <table className="mt-1 w-full text-[15px] tabular-nums">
          <thead className="text-left text-[13px] text-muted">
            <tr>
              <th className="py-1 font-normal">%</th>
              <th className="py-1 font-normal">Weight</th>
              <th className="py-1 font-normal">Each side</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {percentTable(max).map((row) => (
              <tr key={row.percent}>
                <td className="py-1.5">{row.percent}%</td>
                <td className="py-1.5 font-semibold">{lb(row.weight)}</td>
                <td className="py-1.5 text-muted">{row.plates.length ? row.plates.join(' · ') : 'bar'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  )
}
