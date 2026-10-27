import { useState } from 'react'
import { foodDaysPath, getFoodDays, saveProfile, type Profile, type WeighIn } from './api'
import { read, write } from './cache'
import { Card, Notice, plainButton, tintedButton } from './components'
import { addDays, weekday } from './dates'
import { adaptiveCalories, formatKcal } from './nutrition'
import { useAction, usePolling } from './usePolling'
import { formatWeight } from './workouts'

export const DISMISSED_KEY = 'forge.adaptiveDismissed'

/**
 * "Adjust your goal?": when 3 weeks of food and weigh-ins say your calorie goal is off (see adaptiveCalories), offer
 * the goal they point to. Update Goal changes calories (the difference comes off or goes onto carbs); Not Now hides it
 * until next week.
 */
export function AdaptiveGoalCard({ profile, weighIns, today, onUpdated }: { profile: Profile; weighIns: WeighIn[] | undefined; today: string; onUpdated: () => void }) {
  const from = addDays(today, -21)
  const days = usePolling(() => getFoodDays(from, addDays(today, -1)), foodDaysPath(from, addDays(today, -1)))
  const week = addDays(today, -((weekday(today) + 6) % 7)) // this week's Monday
  const [dismissed, setDismissed] = useState(() => read(DISMISSED_KEY) === week)
  const { busy, error, run } = useAction()
  const advice = days.data && adaptiveCalories(days.data, weighIns, profile, today)
  if (!advice || dismissed) return null

  const change = advice.suggested - profile.calorieGoal
  const moved = advice.trend < 0 ? `lost ${formatWeight(Math.abs(Math.round(advice.trend * 10) / 10))} lb a week` : advice.trend > 0 ? `gained ${formatWeight(Math.round(advice.trend * 10) / 10)} lb a week` : 'held steady'
  const update = () =>
    run(async () => {
      await saveProfile({ ...profile, calorieGoal: advice.suggested, carbsGoal: Math.max(0, profile.carbsGoal + Math.round(change / 4)) })
      onUpdated()
    })
  const notNow = () => {
    write(DISMISSED_KEY, week)
    setDismissed(true)
  }

  return (
    <Card>
      <p className="font-semibold">Adjust your goal?</p>
      <p className="mt-1 text-[15px] text-muted">
        Over 3 weeks you've eaten about {formatKcal(advice.average)} kcal a day and {moved}, so your maintenance is about {formatKcal(advice.maintenance)}. For
        your goal, that means {formatKcal(advice.suggested)} kcal a day ({change > 0 ? '+' : '−'}
        {formatKcal(Math.abs(change))}).
      </p>
      {error && <Notice>{error}</Notice>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={update} disabled={busy} className={`flex-1 ${tintedButton}`}>
          {busy ? 'Updating…' : `Update to ${formatKcal(advice.suggested)}`}
        </button>
        <button onClick={notNow} className={plainButton}>
          Not Now
        </button>
      </div>
    </Card>
  )
}
