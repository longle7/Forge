import { Card } from './components'
import { addDays, localDate } from './dates'
import { healthConnected, healthDaily, healthSleep, recovery, type RecoveryReading } from './health'
import { AllowHealthButton } from './HealthSettings'
import { useNow, usePolling } from './usePolling'
import { formatDuration } from './workouts'

/**
 * Home's recovery card (iPhone app, with Apple Health connected): how ready you look today, from heart rate variability
 * and resting heart rate against your usual, with last night's sleep and today's steps. Read from Health on this phone;
 * none of it goes to Forge's server.
 */
export function RecoveryCard() {
  return healthConnected() ? <RecoveryToday /> : null
}

// The 30 days before today are your usual (see `recovery`).
async function readToday(today: string) {
  const monthAgo = addDays(today, -30)
  const [hrv, restingHeartRate, nights, steps] = await Promise.all([
    healthDaily('heartRateVariabilitySDNN', monthAgo, today),
    healthDaily('restingHeartRate', monthAgo, today),
    healthSleep(today, today),
    healthDaily('stepCount', today, today),
  ])
  return {
    ...recovery({ hrv, restingHeartRate }, today),
    sleepMinutes: nights.find((night) => night.date === today)?.value,
    steps: steps.find((day) => day.date === today)?.value,
  }
}

function RecoveryToday() {
  const today = localDate(useNow(60_000))
  const health = usePolling(() => readToday(today), `health:recovery:${today}`)
  if (!health.data) return null

  const { verdict, hrv, restingHeartRate, sleepMinutes, steps } = health.data
  const sleepAndSteps = [sleepMinutes && `Slept ${formatDuration(sleepMinutes * 60_000)}`, steps && `${Math.round(steps).toLocaleString()} steps today`].filter(Boolean).join(' · ')
  return (
    <Card className="space-y-3">
      <div>
        <p className="text-[13px] font-semibold text-muted uppercase">Recovery</p>
        {verdict ? (
          <p className="mt-1 text-[28px] leading-tight font-bold">{verdict}</p>
        ) : (
          <p className="mt-1 text-[15px] text-muted">Wear your Apple Watch day and night: after 2 weeks, Forge compares each day with your usual.</p>
        )}
        {hrv && <p className="text-[15px] text-muted">{againstUsual('HRV', hrv, 'ms')}</p>}
        {restingHeartRate && <p className="text-[15px] text-muted">{againstUsual('Resting heart rate', restingHeartRate, 'bpm')}</p>}
        {sleepAndSteps && <p className="text-[15px] text-muted">{sleepAndSteps}</p>}
      </div>
      <AllowHealthButton onAllowed={health.reload} />
    </Card>
  )
}

/** "HRV 38 ms, usual 45–62" */
const againstUsual = (name: string, reading: RecoveryReading, unit: string) => `${name} ${Math.round(reading.today)} ${unit}, usual ${Math.round(reading.low)}–${Math.round(reading.high)}`
