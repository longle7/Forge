import { useState } from 'react'
import { Link } from 'react-router'
import { foodDaysPath, getExercises, getFoodDays, getHabits, getPlan, getProfile, getWeighIns, getWorkouts, type DayTotals, type Habit, type PlanDay, type Profile, type WeighIn, type Workout } from '../api'
import { completion, habitStreak } from '../habits'
import { BarChart, ChartTable, LineChart, Sparkline } from '../charts'
import { RING } from '../colors'
import { Card, Page, plainButton, Segmented, Status } from '../components'
import { addDays, dayLabel, localDate, monthStart, parseDate, workoutDay } from '../dates'
import { Icon } from '../icons'
import { calorieAdherence, formatKcal, goalEta, plannedTrend, weightTrend } from '../nutrition'
import { adherence, calorieBars, plannedDays, shortDate, strengthSeries, streak, topLifts, weekStatuses, type Bucket, type DayStatus } from '../progress'
import { failure, useNow, usePolling } from '../usePolling'
import { WeighInSheet } from '../WeighInSheet'
import { formatSet, formatWeight, personalRecords, plural } from '../workouts'

// `bucket`: what one calorie bar covers.
const RANGES: { value: number; label: string; bucket: Bucket }[] = [
  { value: 28, label: '4 Weeks', bucket: 'day' },
  { value: 91, label: '3 Months', bucket: 'week' },
  { value: 365, label: 'Year', bucket: 'month' },
]

/** The Progress tab: weight, sticking to the plan, calories, strength, and records over 4 weeks, 3 months, or a year. */
export default function ProgressPage() {
  const today = localDate(useNow(60_000))
  const [days, setDays] = useState(28)
  const from = addDays(today, -(days - 1))
  const range = RANGES.find((r) => r.value === days)!
  const period = range.label.toLowerCase()

  const profile = usePolling(getProfile, '/profile')
  const workouts = usePolling(getWorkouts, '/workouts')
  const plan = usePolling(getPlan, '/plan')
  const weighIns = usePolling(getWeighIns, '/weigh-ins')
  const exercises = usePolling(getExercises, '/exercises')
  const food = usePolling(() => getFoodDays(from, today), foodDaysPath(from, today))
  const habits = usePolling(getHabits, '/habits')
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))

  return (
    <Page title="Progress">
      {/* One range for every chart below, so their numbers always agree. */}
      <Segmented label="Time range" options={RANGES} value={days} onChange={setDays} />
      <Status loading={workouts.data === undefined && !workouts.error} error={failure(workouts)} rows={3} />

      <WeightCard weighIns={weighIns.data ?? []} from={from} profile={profile.data ?? undefined} today={today} period={period} onSaved={weighIns.reload} />
      <PlanCard plan={plan.data ?? []} workouts={workouts.data ?? []} from={from} today={today} period={period} />
      <TrainingCalendar plan={plan.data ?? []} workouts={workouts.data ?? []} today={today} />
      <HabitsCard habits={(habits.data ?? []).filter((h) => !h.archived)} from={from} today={today} period={period} />
      <CaloriesCard days={food.data ?? []} profile={profile.data ?? undefined} plan={plan.data} from={from} today={today} period={period} bucket={range.bucket} />
      <StrengthCard workouts={workouts.data ?? []} from={from} names={names} period={period} />
      <RecordsCard workouts={workouts.data ?? []} from={from} names={names} period={period} />

      <Card>
        <CardTitle icon="hourglass" title="Screen time" />
        <p className="mt-1 text-[15px] text-muted">With the Forge iPhone app, this shows how much time Time Out saved you each week.</p>
      </Card>
    </Page>
  )
}

function CardTitle({ icon, title, detail }: { icon: Parameters<typeof Icon>[0]['name']; title: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="size-5 text-coral-ink" />
      <h2 className="font-semibold">{title}</h2>
      {detail && <span className="ml-auto text-[13px] text-muted">{detail}</span>}
    </div>
  )
}

/** A stat: label, then the value (proportional figures, as a standalone number should be). */
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="text-[24px] leading-tight font-bold">{value}</p>
      {detail && <p className="text-[13px] text-muted">{detail}</p>}
    </div>
  )
}

/**
 * Your goal weight and when you'd reach it: at your trend over the last 4 weeks, or before there's one, at the pace
 * you set.
 */
function GoalStat({ weighIns, profile, goal, today }: { weighIns: WeighIn[]; profile: Profile; goal: number; today: string }) {
  const current = weighIns.at(-1)?.weight ?? profile.startWeight
  const trend = weightTrend(weighIns, today)
  const eta = goalEta(current, goal, trend ?? plannedTrend(profile), today)
  const when = (day: string) => parseDate(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' })
  const detail = eta === today ? 'You made it!' : eta ? `about ${when(eta)} ${trend === undefined ? 'at your planned pace' : 'at this pace'}` : 'Not heading there yet'
  return (
    <p className="mt-3 text-[15px]">
      <span className="font-semibold">Goal {formatWeight(goal)} lb</span>
      <span className="text-muted"> · {eta === today ? '' : `${formatWeight(Math.round(Math.abs(goal - current) * 10) / 10)} lb to go, `}{detail}</span>
    </p>
  )
}

function WeightCard({ weighIns: all, from, profile, today, period, onSaved }: { weighIns: WeighIn[]; from: string; profile?: Profile; today: string; period: string; onSaved: () => void }) {
  const [weighing, setWeighing] = useState(false)
  const weighIns = all.filter((w) => w.date >= from)
  const first = weighIns[0]
  const last = weighIns.at(-1)
  const change = first && last ? last.weight - first.weight : 0
  return (
    <Card>
      <CardTitle icon="scale" title="Weight" />
      {weighIns.length >= 2 ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat label="Latest" value={`${formatWeight(last!.weight)} lb`} detail={shortDate(last!.date)} />
            <Stat label={`Change, ${period}`} value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${formatWeight(Math.abs(Math.round(change * 10) / 10))} lb`} detail={`since ${shortDate(first!.date)}`} />
          </div>
          <LineChart points={weighIns.map((w) => ({ day: w.date, value: w.weight }))} label={`Weight over the last ${period}`} color={RING.move} format={(v) => `${formatWeight(v)} lb`} axis={(v) => formatWeight(v)} />
          <ChartTable caption="Weigh-ins" rows={[...weighIns].reverse().map((w) => [shortDate(w.date), `${formatWeight(w.weight)} lb`])} />
        </>
      ) : (
        <p className="mt-1 text-[15px] text-muted">{last ? `${formatWeight(last.weight)} lb on ${shortDate(last.date)}. ` : ''}Weigh in a few times to see your trend.</p>
      )}
      {profile?.goalWeight && <GoalStat weighIns={all} profile={profile} goal={profile.goalWeight} today={today} />}
      <button onClick={() => setWeighing(true)} className={`-ml-1 ${plainButton}`}>
        <Icon name="plus" className="size-5" />
        Log Weight
      </button>
      {weighing && (
        <WeighInSheet
          day={today}
          current={last?.date === today ? last.weight : undefined}
          onSaved={() => {
            setWeighing(false)
            onSaved()
          }}
          onClose={() => setWeighing(false)}
        />
      )}
    </Card>
  )
}

const DOT_LABELS: Record<DayStatus, string> = {
  done: 'trained',
  missed: 'missed',
  planned: 'planned',
  rest: 'rest day',
  extra: 'trained on a rest day',
  none: 'no workout',
}

/** One day of the training calendar. Never color alone: done has a check, missed is an open ring, rest a dash. */
function DayDot({ status }: { status: DayStatus }) {
  const base = 'grid size-7 place-items-center rounded-full'
  if (status === 'done' || status === 'extra')
    return (
      <span className={`${base} ${status === 'done' ? 'bg-green-strong text-white' : 'bg-green/20 text-green-ink'}`}>
        <Icon name="check" className="size-4 stroke-[3]" />
      </span>
    )
  if (status === 'missed') return <span className={`${base} border-2 border-muted/40`} />
  if (status === 'planned') return <span className={`${base} border-2 border-coral/50`} />
  // Rest days get a dash; days with no workout and nothing planned (before the plan, or without one), a faint dot.
  return <span className={`${base} text-muted/50`}>{status === 'rest' ? '–' : '·'}</span>
}

function PlanCard({ plan, workouts, from, today, period }: { plan: PlanDay[]; workouts: Workout[]; from: string; today: string; period: string }) {
  if (plan.length === 0) {
    return (
      <Card>
        <CardTitle icon="calendar" title="Sticking to the plan" />
        <p className="mt-1 text-[15px] text-muted">Plan your week in Workouts, and this shows how often you stick to it.</p>
        <Link to="/workouts" className={`-ml-1 ${plainButton}`}>
          Plan Your Week
        </Link>
      </Card>
    )
  }
  const days = plannedDays(plan, workouts, from, today)
  const share = adherence(days)
  return (
    <Card>
      <CardTitle icon="calendar" title="Sticking to the plan" />
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Stat
          label="Done as planned"
          value={share === undefined ? '–' : `${Math.round(share * 100)}%`}
          detail={days.length ? `${days.filter((d) => d.done).length} of ${days.length}, ${period}` : 'counts from your first planned day'}
        />
        <Stat label="Streak" value={String(streak(plan, workouts, today))} detail="planned days in a row" />
      </div>
    </Card>
  )
}

/**
 * A month of training days, Monday first, with or without a plan; with one, also the days missed, planned, and rest.
 * ‹ › change the month, up to this one. A training day opens its workout.
 */
function TrainingCalendar({ plan, workouts, today }: { plan: PlanDay[]; workouts: Workout[]; today: string }) {
  const [month, setMonth] = useState(() => monthStart(today))
  const last = addDays(monthStart(month, 1), -1)
  // A month touches at most 6 weeks: take the 6 through its last day, less any that end before it begins.
  const weeks = weekStatuses(plan, workouts, today, 6, last).filter((week) => week[6].day >= month)
  const monthName = parseDate(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return (
    <Card>
      <CardTitle icon="calendar" title="Training calendar" />
      <div className="mt-1 flex items-center justify-between">
        <button onClick={() => setMonth(monthStart(month, -1))} aria-label="Previous month" className={`${plainButton} min-w-11 justify-center`}>
          <Icon name="chevronLeft" className="size-5" />
        </button>
        <p className="font-semibold" aria-live="polite">
          {monthName}
        </p>
        <button onClick={() => setMonth(monthStart(month, 1))} disabled={month === monthStart(today)} aria-label="Next month" className={`${plainButton} min-w-11 justify-center`}>
          <Icon name="chevronRight" className="size-5" />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 justify-items-center gap-y-1 text-[11px] text-muted" role="table" aria-label={`Training days in ${monthName}`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} role="columnheader" aria-hidden>
            {d}
          </span>
        ))}
        {/* Days of the months either side stay blank. */}
        {weeks.flat().map(({ day, status, workoutId }) =>
          day < month || day > last ? <span key={day} aria-hidden /> : <CalendarDay key={day} day={day} status={status} workoutId={workoutId} today={today} />,
        )}
      </div>
      {plan.length > 0 && <DotLegend />}
    </Card>
  )
}

/** One day of the calendar: the date (today's in bold coral) over its dot. A training day links to its first workout. */
function CalendarDay({ day, status, workoutId, today }: { day: string; status: DayStatus; workoutId?: string; today: string }) {
  const label = `${dayLabel(day, today)}: ${DOT_LABELS[status]}`
  const style = 'flex min-h-11 min-w-11 flex-col items-center gap-0.5'
  const content = (
    <>
      <span aria-hidden className={day === today ? 'font-bold text-coral-ink' : undefined}>
        {Number(day.slice(8))}
      </span>
      <DayDot status={status} />
    </>
  )
  return workoutId ? (
    <span role="cell">
      <Link to={`/workouts/history/${workoutId}`} aria-label={label} className={`${style} active:opacity-60`}>
        {content}
      </Link>
    </span>
  ) : (
    <span role="cell" aria-label={label} className={style}>
      {content}
    </span>
  )
}

/** What the dots mean. Only with a plan: without one, a check is the only mark. */
function DotLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
      {(['done', 'missed', 'planned', 'rest'] as const).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="origin-left scale-75">
            <DayDot status={s} />
          </span>
          {DOT_LABELS[s][0].toUpperCase() + DOT_LABELS[s].slice(1)}
        </span>
      ))}
    </div>
  )
}

/** Each habit's streak, and how often it was done in the range: a meter in the Unlock green, the number beside it. */
function HabitsCard({ habits, from, today, period }: { habits: Habit[]; from: string; today: string; period: string }) {
  if (habits.length === 0) return null
  return (
    <Card>
      <CardTitle icon="check" title="Habit streaks" detail={`done of scheduled days, ${period}`} />
      <ul className="mt-2 divide-y divide-line">
        {habits.map((habit) => {
          const { done, scheduled } = completion(habit, from, today)
          const share = scheduled ? done / scheduled : 0
          const streak = habitStreak(habit, today)
          return (
            <li key={habit.id} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">
                  {habit.emoji} {habit.name}
                </span>
                <span className="shrink-0 text-[13px] text-muted">{streak ? `${streak}-day streak` : 'No streak yet'}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'color-mix(in oklab, var(--chart-unlock) 18%, transparent)' }}>
                  <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: 'var(--chart-unlock)' }} />
                </div>
                <span className="w-24 shrink-0 text-right text-[13px] text-muted tabular-nums">{scheduled ? `${done} of ${plural(scheduled, 'day')}` : 'Starts today'}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function CaloriesCard({ days, profile, plan, from, today, period, bucket }: {
  days: DayTotals[]
  profile?: Profile
  plan?: PlanDay[]
  from: string
  today: string
  period: string
  bucket: Bucket
}) {
  const goal = profile?.calorieGoal
  const logged = days.filter((d) => d.calories > 0)
  const hit = profile && calorieAdherence(days, profile, plan, today)
  const average = (key: 'calories' | 'protein') => logged.reduce((sum, d) => sum + d[key], 0) / (logged.length || 1)
  const bars = calorieBars(days, from, today, bucket)
  return (
    <Card>
      <CardTitle icon="food" title="Calories" detail={bucket === 'day' ? 'per day' : `average per day, by ${bucket}`} />
      {logged.length ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat label="Average a day" value={`${formatKcal(average('calories'))} kcal`} detail={goal ? `goal ${formatKcal(goal)}` : undefined} />
            <Stat label="Protein a day" value={`${Math.round(average('protein'))} g`} detail={`${logged.length} days logged`} />
            {hit && hit.logged > 0 && (
              <>
                <Stat label="On target" value={`${hit.onTarget} of ${plural(hit.logged, 'day')}`} detail={hit.streak > 1 ? `${hit.streak} in a row` : 'within 10% of your goal'} />
                <Stat label="Protein goal hit" value={`${hit.protein} of ${plural(hit.logged, 'day')}`} detail={`${profile!.proteinGoal} g or close`} />
              </>
            )}
          </div>
          <BarChart bars={bars} bucket={bucket} goal={goal} label={`Calories over the last ${period}`} color={RING.eat} format={(v) => formatKcal(v)} />
          <ChartTable caption="Calories" rows={[...bars].reverse().filter((b) => b.value !== undefined).map((b) => [shortDate(b.start, bucket), `${formatKcal(b.value!)} kcal`])} />
        </>
      ) : (
        <p className="mt-1 text-[15px] text-muted">Log food in Calories to see your trends here.</p>
      )}
    </Card>
  )
}

function StrengthCard({ workouts, from, names, period }: { workouts: Workout[]; from: string; names: Map<number, string>; period: string }) {
  const lifts = topLifts(workouts.filter((w) => workoutDay(w) >= from))
  return (
    <Card>
      <CardTitle icon="dumbbell" title="Strength" detail="estimated 1-rep max" />
      {lifts.length === 0 && <p className="mt-1 text-[15px] text-muted">Log workouts with weights to see your strength trends.</p>}
      <ul className="mt-2 divide-y divide-line">
        {lifts.map((id) => {
          const series = strengthSeries(workouts, id, from)
          const latest = series.at(-1)?.value ?? 0
          const change = latest - (series[0]?.value ?? latest)
          return (
            <li key={id}>
              <Link to={`/workouts/exercises/${id}`} className="flex min-h-14 items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{names.get(id) ?? 'Exercise'}</span>
                  <span className="block text-[13px] text-muted">
                    {formatWeight(Math.round(latest))} lb{series.length > 1 && ` · ${change >= 0 ? '+' : '−'}${formatWeight(Math.abs(Math.round(change)))} lb in ${period}`}
                  </span>
                </span>
                <Sparkline values={series.map((p) => p.value)} color={RING.move} />
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function RecordsCard({ workouts, from, names, period }: { workouts: Workout[]; from: string; names: Map<number, string>; period: string }) {
  const records = personalRecords(workouts)
  const prs = workouts
    .filter((w) => workoutDay(w) >= from)
    .flatMap((w) => [...(records.get(w.id) ?? [])].map((set) => ({ workout: w, set })))
  return (
    <Card>
      <CardTitle icon="trophy" title="Personal records" />
      <Stat label={`PRs, ${period}`} value={String(prs.length)} />
      {prs.length === 0 && <p className="text-[15px] text-muted">Beat your best set on any lift and it shows up here.</p>}
      <ul className="mt-1">
        {prs.slice(0, 5).map(({ workout, set }, i) => (
          <li key={i}>
            <Link to={`/workouts/exercises/${set.exerciseId}`} className="flex min-h-11 items-center justify-between gap-3 text-[15px] active:opacity-60">
              <span className="min-w-0 truncate">
                {names.get(set.exerciseId) ?? 'Exercise'} · <span className="font-semibold">{formatSet(set)}</span>
              </span>
              <span className="shrink-0 text-[13px] text-muted">{shortDate(workoutDay(workout))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
