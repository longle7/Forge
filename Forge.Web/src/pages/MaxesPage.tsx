import { Link } from 'react-router'
import { getExercises, getMaxes, getProfile, getWeighIns, getWorkouts } from '../api'
import { Sparkline } from '../charts'
import { RING } from '../colors'
import { Card, Group, Page, Row, Status } from '../components'
import { addDays, localDate } from '../dates'
import { bigThree, estimatedMax, liftedExercises } from '../maxes'
import { weightOn } from '../nutrition'
import { strengthSeries } from '../progress'
import { failure, useNow, usePolling } from '../usePolling'
import { formatWeight } from '../workouts'

/** "Current" means your best in this many days, so an old max doesn't hide that you've lost (or gained) strength. */
export const CURRENT_DAYS = 90
const BACK = { to: '/workouts', label: 'Workouts' }
const lb = (value: number) => `${formatWeight(Math.round(value))} lb`

/** Every lift's estimated 1-rep max, and your squat, bench, and deadlift total against your bodyweight. */
export default function MaxesPage() {
  const today = localDate(useNow(60_000))
  const workouts = usePolling(getWorkouts, '/workouts')
  const maxes = usePolling(getMaxes, '/maxes')
  const exercises = usePolling(getExercises, '/exercises')
  const weighIns = usePolling(getWeighIns, '/weigh-ins')
  const profile = usePolling(getProfile, '/profile')
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))
  const since = addDays(today, -(CURRENT_DAYS - 1))
  const all = workouts.data ?? []
  const tested = maxes.data ?? []
  const loaded = workouts.data !== undefined && maxes.data !== undefined
  const big = bigThree(all, tested, since)
  const bodyweight = weightOn(weighIns.data, today, profile.data?.startWeight ?? 0)
  const times = (value: number) => `${(value / bodyweight).toFixed(2)}× bodyweight`
  const lifts = liftedExercises(all, tested)

  return (
    <Page title="Maxes" back={BACK}>
      <p className="-mt-3 text-muted">Estimated 1-rep maxes from your last {CURRENT_DAYS} days of sets and the maxes you tested.</p>
      <Status loading={!loaded && !workouts.error && !maxes.error} error={failure(workouts) ?? failure(maxes)} rows={3} />

      {loaded && (
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Big Three</h2>
            {big.total !== undefined && <span className="text-[15px] font-semibold tabular-nums">{lb(big.total)} total</span>}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {big.lifts.map((l) => (
              <Link key={l.id} to={`/workouts/exercises/${l.id}`} className="active:opacity-60">
                <p className="text-[13px] text-muted">{l.label}</p>
                <p className="text-[22px] leading-tight font-bold tabular-nums">{l.value ? formatWeight(Math.round(l.value)) : '–'}</p>
                <p className="text-[13px] text-muted">{l.value ? (bodyweight > 0 ? times(l.value) : 'lb') : 'No lift yet'}</p>
              </Link>
            ))}
          </div>
          {big.total !== undefined && bodyweight > 0 && (
            <p className="mt-2 text-[15px] text-muted">
              Your total is {times(big.total)} ({lb(bodyweight)}).
            </p>
          )}
        </Card>
      )}

      {loaded && lifts.length === 0 && <p className="text-muted">Log a workout with weights, or add a tested max from an exercise's page.</p>}
      {lifts.length > 0 && (
        <Group title="All lifts" footer="Tap a lift for its rep maxes, a percentage chart, and the maxes you tested.">
          {lifts.map((id) => {
            const current = estimatedMax(all, tested, id, since)
            const ever = estimatedMax(all, tested, id)!
            const series = strengthSeries(all, id, '').slice(-12)
            return (
              <Row key={id} to={`/workouts/exercises/${id}`} detail={series.length > 1 ? <Sparkline values={series.map((p) => p.value)} color={RING.move} /> : undefined}>
                <span className="block font-medium">{names.get(id) ?? 'Exercise'}</span>
                <span className="block text-[15px] text-muted tabular-nums">
                  {current ? lb(current.value) : `None in ${CURRENT_DAYS} days`}
                  {ever.value > (current?.value ?? 0) && ` · best ${lb(ever.value)}`}
                </span>
              </Row>
            )
          })}
        </Group>
      )}
    </Page>
  )
}
