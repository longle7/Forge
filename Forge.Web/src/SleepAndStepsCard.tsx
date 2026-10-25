import { BarChart, ChartTable } from './charts'
import { RING } from './colors'
import { Card } from './components'
import { healthConnected, healthDaily, healthSleep, type HealthDay } from './health'
import { CardTitle, Stat } from './pages/ProgressPage'
import { averageBars, shortDate, type Bucket } from './progress'
import { usePolling } from './usePolling'
import { formatDuration } from './workouts'

/** Progress's range: `period` names it in labels ("4 weeks"); `bucket` is what one bar covers. */
interface Range {
  from: string
  today: string
  period: string
  bucket: Bucket
}

/** Sleep and steps on Progress (iPhone app, with Apple Health connected), read from Health on this phone. */
export function SleepAndStepsCard(range: Range) {
  return healthConnected() ? <SleepAndSteps {...range} /> : null
}

// ponytail: a year of sleep is ~20,000 samples from Health; add up nights natively if the Year range opens slowly.
async function readSleepAndSteps(from: string, to: string) {
  const [nights, steps] = await Promise.all([healthSleep(from, to), healthDaily('stepCount', from, to)])
  return { nights, steps }
}

function SleepAndSteps(range: Range) {
  const health = usePolling(() => readSleepAndSteps(range.from, range.today), `health:sleep-and-steps:${range.from}:${range.today}`)
  const { nights = [], steps = [] } = health.data ?? {}
  if (nights.length === 0 && steps.length === 0) return null

  const sleepHours = nights.map((night) => ({ date: night.date, value: night.value / 60 }))
  return (
    <Card>
      <CardTitle icon="moon" title="Sleep and steps" detail={range.bucket === 'day' ? 'per day' : `average per day, by ${range.bucket}`} />
      {nights.length > 0 && <ReadingChart name="Sleep" days={sleepHours} format={(hours) => formatDuration(hours * 3_600_000)} {...range} />}
      {steps.length > 0 && <ReadingChart name="Steps" days={steps} format={(count) => Math.round(count).toLocaleString()} {...range} />}
    </Card>
  )
}

/** A reading's average over the range, then its bars and their table. */
function ReadingChart({ name, days, format, from, today, period, bucket }: Range & { name: string; days: HealthDay[]; format: (value: number) => string }) {
  const bars = averageBars(days, from, today, bucket)
  const average = days.reduce((sum, d) => sum + d.value, 0) / days.length
  return (
    <div className="mt-3">
      <Stat label={`Average ${name.toLowerCase()}`} value={format(average)} />
      <BarChart bars={bars} bucket={bucket} label={`${name} over the last ${period}`} color={RING.move} format={format} />
      <ChartTable caption={name} rows={[...bars].reverse().filter((b) => b.value !== undefined).map((b) => [shortDate(b.start, bucket), format(b.value!)])} />
    </div>
  )
}
