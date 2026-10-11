import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getProfile, saveProfile, saveWeighIn, type Activity, type Goal, type Nutrition, type Profile, type Sex } from '../api'
import { Card, field, Group, Notice, Page, plainButton, primaryButton, Segmented, Status } from '../components'
import { localDate } from '../dates'
import { Icon } from '../icons'
import { ACTIVITY, calculateGoals, formatKcal, type GoalInputs } from '../nutrition'
import { failure, useNow, usePolling } from '../usePolling'

const BACK = { to: '/', label: 'Home' }

/** Your goals (/setup): a one-minute setup that works out daily calories and macros, all of them adjustable. */
export default function SetupPage() {
  const profile = usePolling(getProfile, '/profile')
  if (profile.data === undefined && !profile.error) {
    return (
      <Page title="Your Goals" back={BACK}>
        <Status loading rows={4} />
      </Page>
    )
  }
  // Offline with nothing remembered, the form still works; saving says so if it can't.
  return <SetupForm existing={profile.data ?? null} loadError={failure(profile)} />
}

function SetupForm({ existing, loadError }: { existing: Profile | null; loadError?: Error }) {
  const navigate = useNavigate()
  const now = useNow(60_000)
  const year = now.getFullYear()
  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'male')
  const [birthYear, setBirthYear] = useState(existing ? String(existing.birthYear) : '')
  const [feet, setFeet] = useState(existing ? String(Math.floor(existing.heightIn / 12)) : '')
  const [inches, setInches] = useState(existing ? String(Math.round(existing.heightIn % 12)) : '')
  const [weight, setWeight] = useState(existing ? String(existing.startWeight) : '')
  const [activity, setActivity] = useState<Activity>(existing?.activity ?? 'light')
  const [goal, setGoal] = useState<Goal>(existing?.goal ?? 'lose')
  const [pace, setPace] = useState(existing?.pace || 1)
  const [restDayAdjust, setRestDayAdjust] = useState(existing?.restDayCalorieAdjust ?? 0)
  // Numbers you adjusted by hand; null means "use the calculated ones". Kept if you'd adjusted them before.
  const [custom, setCustom] = useState<Nutrition | null>(() => (existing && adjusted(existing, year) ? goalsOf(existing) : null))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()

  const inputs = validInputs({ sex, birthYear, feet, inches, weight, activity, goal, pace }, year)
  const calculated = inputs && calculateGoals(inputs, year)
  const goals = custom ?? calculated

  const save = async () => {
    if (!inputs || !goals) return setMessage('Fill in your details above to work out your goals.')
    setSaving(true)
    setMessage(undefined)
    try {
      await saveProfile({
        sex,
        birthYear: inputs.birthYear,
        heightIn: inputs.heightIn,
        startWeight: inputs.weight,
        activity,
        goal,
        pace: goal === 'maintain' ? 0 : pace,
        calorieGoal: Math.round(goals.calories),
        proteinGoal: Math.round(goals.protein),
        carbsGoal: Math.round(goals.carbs),
        fatGoal: Math.round(goals.fat),
        restDayCalorieAdjust: restDayAdjust,
        unlockAfterWorkout: existing?.unlockAfterWorkout ?? false,
        unlockAfterMeals: existing?.unlockAfterMeals ?? 0,
        unlockAfterWeighIn: existing?.unlockAfterWeighIn ?? false,
        unlockAfterHabits: existing?.unlockAfterHabits ?? false,
      })
      // The first setup's weight starts your weight chart.
      if (!existing) await saveWeighIn(localDate(now), inputs.weight).catch(() => {})
      navigate('/', { replace: true })
    } catch (error) {
      setMessage((error as Error).message)
      setSaving(false)
    }
  }

  return (
    <Page title="Your Goals" back={BACK}>
      <p className="-mt-3 text-muted">A minute of details, and Forge works out your daily calories and macros. You can adjust any number.</p>
      {loadError && <Status error={loadError} />}

      <Group title="About you">
        <div className="space-y-3 p-4">
          <Segmented label="Sex" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={sex} onChange={setSex} />
          <label className="block">
            <span className="text-[15px] text-muted">Birth year</span>
            <input value={birthYear} onChange={(e) => setBirthYear(e.target.value)} inputMode="numeric" placeholder="1994" maxLength={4} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[15px] text-muted">Height (ft)</span>
              <input value={feet} onChange={(e) => setFeet(e.target.value)} inputMode="numeric" placeholder="5" maxLength={1} className={field} />
            </label>
            <label className="block">
              <span className="text-[15px] text-muted">(in)</span>
              <input value={inches} onChange={(e) => setInches(e.target.value)} inputMode="numeric" placeholder="10" maxLength={2} className={field} />
            </label>
          </div>
          <label className="block">
            <span className="text-[15px] text-muted">Weight (lb)</span>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="185" maxLength={5} className={field} />
          </label>
        </div>
      </Group>

      <Group title="Activity outside workouts" footer="Workouts aren't counted here: Forge adds their calories back on the days you train.">
        <div role="radiogroup" aria-label="Activity outside workouts" className="divide-y divide-line">
          {(Object.keys(ACTIVITY) as Activity[]).map((id) => (
            <button key={id} role="radio" aria-checked={activity === id} onClick={() => setActivity(id)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
              <span className="flex-1">
                <span className="block">{ACTIVITY[id].label}</span>
                <span className="block text-[15px] text-muted">{ACTIVITY[id].detail}</span>
              </span>
              {activity === id && <Icon name="check" className="size-5 text-coral-ink" />}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Your goal">
        <div className="space-y-3 p-4">
          <Segmented
            label="Goal"
            options={[
              { value: 'lose', label: 'Lose' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Gain' },
            ]}
            value={goal}
            onChange={setGoal}
          />
          {goal !== 'maintain' && (
            <Segmented
              label="Pounds a week"
              options={[
                { value: 0.5, label: '0.5 lb/wk' },
                { value: 1, label: '1 lb/wk' },
                { value: 1.5, label: '1.5 lb/wk' },
              ]}
              value={pace}
              onChange={setPace}
            />
          )}
        </div>
      </Group>

      <Group title="Rest days" footer="On rest days in your weekly plan, eat a little less, from carbs. Workout days already add back what you burn.">
        <div className="p-4">
          <Segmented
            label="Calories on rest days"
            options={[
              { value: 0, label: 'Same' },
              { value: -100, label: '−100' },
              { value: -200, label: '−200' },
              { value: -300, label: '−300' },
            ]}
            value={restDayAdjust}
            onChange={setRestDayAdjust}
          />
        </div>
      </Group>

      {goals ? (
        <Card>
          <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">Your daily goal</p>
          {custom ? (
            <AdjustGoals goals={custom} onChange={setCustom} />
          ) : (
            <>
              <p className="mt-1 text-[34px] leading-tight font-bold">
                {formatKcal(goals.calories)} <span className="text-[17px] font-semibold text-muted">kcal</span>
              </p>
              <p className="text-[15px] text-muted">
                Protein {Math.round(goals.protein)} g · Carbs {Math.round(goals.carbs)} g · Fat {Math.round(goals.fat)} g
              </p>
            </>
          )}
          {restDayAdjust < 0 && <p className="mt-1 text-[15px] text-muted">Rest days: {formatKcal(goals.calories + restDayAdjust)} kcal</p>}
          {calculated && (
            <p className="mt-2 text-[13px] text-muted">
              Maintenance is about {formatKcal(calculated.maintenance)} kcal a day.
              {goal !== 'maintain' && ` ${goal === 'lose' ? 'Eating' : 'Adding'} ${formatKcal(pace * 500)} kcal ${goal === 'lose' ? 'less' : 'more'} ${goal === 'lose' ? 'loses' : 'gains'} about ${pace} lb a week.`}
            </p>
          )}
          <button onClick={() => setCustom(custom ? null : goals)} className={`-ml-1 ${plainButton}`}>
            {custom ? 'Use the calculated numbers' : 'Adjust the numbers'}
          </button>
        </Card>
      ) : (
        <p className="px-1 text-muted">Fill in your details to see your daily goal.</p>
      )}

      {message && <Notice>{message}</Notice>}
      <button onClick={save} disabled={saving} className={primaryButton}>
        {saving ? 'Saving…' : 'Save Goals'}
      </button>
    </Page>
  )
}

function AdjustGoals({ goals, onChange }: { goals: Nutrition; onChange: (goals: Nutrition) => void }) {
  const fields: { key: keyof Nutrition; label: string }[] = [
    { key: 'calories', label: 'Calories (kcal)' },
    { key: 'protein', label: 'Protein (g)' },
    { key: 'carbs', label: 'Carbs (g)' },
    { key: 'fat', label: 'Fat (g)' },
  ]
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {fields.map(({ key, label }) => (
        <label key={key} className="block">
          <span className="text-[15px] text-muted">{label}</span>
          <input
            value={String(Math.round(goals[key]))}
            onChange={(e) => onChange({ ...goals, [key]: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            inputMode="numeric"
            className={field}
          />
        </label>
      ))}
    </div>
  )
}

/** The form's text as calculator inputs, or null while something is missing or out of range. */
function validInputs(form: { sex: Sex; birthYear: string; feet: string; inches: string; weight: string; activity: Activity; goal: Goal; pace: number }, year: number): GoalInputs | null {
  const birthYear = Number(form.birthYear)
  const heightIn = Number(form.feet) * 12 + Number(form.inches || 0)
  const weight = Number(form.weight)
  if (!(birthYear >= 1900 && birthYear <= year - 13)) return null
  if (!(heightIn >= 36 && heightIn <= 96)) return null
  if (!(weight >= 50 && weight <= 1000)) return null
  return { sex: form.sex, birthYear, heightIn, weight, activity: form.activity, goal: form.goal, pace: form.goal === 'maintain' ? 0 : form.pace }
}

const goalsOf = (p: Profile): Nutrition => ({ calories: p.calorieGoal, protein: p.proteinGoal, carbs: p.carbsGoal, fat: p.fatGoal })

/** Whether a saved profile's goals were adjusted by hand (they don't match what its details calculate to). */
function adjusted(p: Profile, year: number): boolean {
  const calculated = calculateGoals({ sex: p.sex, birthYear: p.birthYear, heightIn: p.heightIn, weight: p.startWeight, activity: p.activity, goal: p.goal, pace: p.pace }, year)
  const saved = goalsOf(p)
  return (Object.keys(saved) as (keyof Nutrition)[]).some((k) => Math.round(calculated[k]) !== saved[k])
}
