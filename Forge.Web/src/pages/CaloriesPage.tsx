import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  activityPath,
  deleteFoodEntry,
  foodLogPath,
  getActivity,
  getExercises,
  getFoodLog,
  getPlan,
  getProfile,
  getWeighIns,
  getWorkouts,
  MEALS,
  randomId,
  saveFoodEntry,
  saveSavedMeal,
  type FoodEntry,
} from '../api'
import { Card, field, FoodRow, Group, MacroBar, Notice, Page, plainButton, primaryButton, Rings, Sheet, Status, tintedButton } from '../components'
import { addDays, dayLabel, localDate, workoutDay } from '../dates'
import { AdaptiveGoalCard } from '../AdaptiveGoalCard'
import { FoodSheet } from '../FoodSheet'
import { FAT, RING } from '../colors'
import { Icon } from '../icons'
import { haptic } from '../notify'
import { dayBudget, dayGoals, exerciseCalories, formatKcal, MICROS, microTotals, remaining, servingLabel, totals, weightOn } from '../nutrition'
import { isRestDay } from '../plan'
import { failure, useNow, usePolling, useAction } from '../usePolling'
import { plural } from '../workouts'

/**
 * The Calories tab: a day's food by meal, and what's left of its calories (Goal − Food + Exercise) and macros. A meal
 * can be copied from the day before, or saved to log again in one tap.
 */
export default function CaloriesPage() {
  const [params, setParams] = useSearchParams()
  const today = localDate(useNow(60_000))
  const date = params.get('date') ?? today
  const setDate = (day: string) => setParams(day === today ? {} : { date: day }, { replace: true })
  const dayBefore = addDays(date, -1)

  const profile = usePolling(getProfile, '/profile')
  const log = usePolling(() => getFoodLog(date), foodLogPath(date))
  const before = usePolling(() => getFoodLog(dayBefore), foodLogPath(dayBefore))
  const workouts = usePolling(getWorkouts, '/workouts')
  const weighIns = usePolling(getWeighIns, '/weigh-ins')
  const exercises = usePolling(getExercises, '/exercises')
  const plan = usePolling(getPlan, '/plan')
  const activity = usePolling(() => getActivity(date, date), activityPath(date, date))
  const [editing, setEditing] = useState<FoodEntry>()
  const [toSave, setToSave] = useState<FoodEntry[]>() // a meal's foods, being saved as a meal
  const [copying, setCopying] = useState(false)
  const [message, setMessage] = useState<string>()
  const names = new Map(exercises.data?.map((e) => [e.id, e.name]))

  const restDay = isRestDay(plan.data, date)
  const goals = profile.data && dayGoals(profile.data, restDay)
  const food = totals(log.data ?? [])
  const micros = microTotals(log.data ?? [])
  const tracked = MICROS.filter((m) => profile.data?.[m.setting])
  const weight = weightOn(weighIns.data, date, profile.data?.startWeight ?? 0)
  const exercise = (workouts.data ?? []).filter((w) => workoutDay(w) === date).reduce((sum, w) => sum + exerciseCalories(w, weight, names), 0)
  const budget = profile.data && dayBudget({ profile: profile.data, restDay, weightLb: weight, year: Number(date.slice(0, 4)), activeKcal: activity.data?.[0]?.kcal, workoutEstimate: exercise })
  const beforeLabel = date === today ? 'yesterday' : dayLabel(dayBefore, today)
  const restDayCut = restDay ? -(profile.data?.restDayCalorieAdjust ?? 0) : 0

  // Logs the day before's foods again on this day, in the same order. They're new entries: the originals stay.
  const copy = async (entries: FoodEntry[]) => {
    setCopying(true)
    setMessage(undefined)
    try {
      for (const entry of entries) await saveFoodEntry(randomId(), { ...entry, date })
    } catch (error) {
      setMessage(`Couldn't copy all of it: ${(error as Error).message}`)
    }
    setCopying(false)
    log.reload()
  }

  return (
    <Page title="Calories">
      <div className="flex items-center justify-between rounded-2xl bg-surface p-1">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Previous day" className="grid size-11 place-items-center rounded-xl text-coral-ink active:bg-fill">
          <Icon name="chevronLeft" />
        </button>
        {date === today ? (
          <span className="font-semibold">{dayLabel(date, today)}</span>
        ) : (
          // Another day: the label also jumps back to today, with a hint under it.
          <button onClick={() => setDate(today)} className="flex min-h-11 flex-col items-center justify-center rounded-xl px-3 active:bg-fill">
            <span className="font-semibold">{dayLabel(date, today)}</span>
            <span className="text-[13px] text-coral-ink">Back to Today</span>
          </button>
        )}
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day" className="grid size-11 place-items-center rounded-xl text-coral-ink active:bg-fill disabled:opacity-30">
          <Icon name="chevronRight" />
        </button>
      </div>

      {goals && budget ? (
        <Summary {...budget} food={food.calories}>
          <div className="mt-4 space-y-3">
            <MacroBar label="Protein" value={food.protein} goal={goals.protein} color={RING.move} />
            <MacroBar label="Carbs" value={food.carbs} goal={goals.carbs} color={RING.eat} />
            <MacroBar label="Fat" value={food.fat} goal={goals.fat} color={FAT} />
            {tracked.map((m) => (
              <MacroBar key={m.key} label={m.limit ? `${m.label} (limit)` : m.label} value={micros[m.key]} goal={profile.data![m.setting]!} color={RING.unlock} unit={m.unit} limit={m.limit} />
            ))}
          </div>
          {tracked.length > 0 && micros.unknown > 0 && (
            <p className="mt-2 text-[13px] text-muted">{plural(micros.unknown, 'food')} without fiber, sugar, or sodium info.</p>
          )}
          {restDayCut > 0 && <p className="mt-3 text-[13px] text-muted">Rest day: {formatKcal(restDayCut)} kcal less, from carbs.</p>}
        </Summary>
      ) : (
        goals === null && (
          <Card>
            <p className="font-semibold">See what's left each day</p>
            <p className="text-[15px] text-muted">Set your calorie and macro goals, and Forge keeps count as you log.</p>
            <Link to="/setup" className={`mt-3 ${primaryButton}`}>
              Set Your Goals
            </Link>
          </Card>
        )
      )}
      {goals && date === today && profile.data && <AdaptiveGoalCard profile={profile.data} weighIns={weighIns.data} today={today} onUpdated={profile.reload} />}

      {log.data?.length === 0 && !!before.data?.length && (
        <button onClick={() => copy(before.data!)} disabled={copying} className={`w-full ${tintedButton}`}>
          <Icon name="repeat" className="size-5" />
          {copying ? 'Copying…' : `Copy all of ${beforeLabel} · ${formatKcal(totals(before.data).calories)} kcal`}
        </button>
      )}
      {message && <Notice>{message}</Notice>}

      <Status loading={log.data === undefined && !log.error} error={failure(log)} rows={2} onRetry={log.reload} />
      {log.data &&
        MEALS.map(({ id, label }) => {
          const entries = log.data!.filter((e) => e.meal === id)
          const earlier = before.data?.filter((e) => e.meal === id) ?? []
          const mealTotal = totals(entries).calories
          return (
            <Group key={id} title={entries.length ? `${label} · ${formatKcal(mealTotal)} kcal` : label}>
              {entries.map((entry) => (
                <FoodRow
                  key={entry.id}
                  name={entry.name}
                  detail={`${servingLabel(entry)}${entry.protein > 0 ? ` · ${Math.round(entry.protein * entry.servings)} g protein` : ''}`}
                  calories={entry.calories * entry.servings}
                  onClick={() => setEditing(entry)}
                />
              ))}
              {entries.length === 0 && earlier.length > 0 && (
                <button onClick={() => copy(earlier)} disabled={copying} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-coral-ink active:bg-fill disabled:opacity-50">
                  <Icon name="repeat" className="size-5" />
                  <span className="flex-1">
                    Copy {label.toLowerCase()} from {beforeLabel}
                  </span>
                  <span className="text-[15px] text-muted tabular-nums">{formatKcal(totals(earlier).calories)} kcal</span>
                </button>
              )}
              <div className="flex items-center">
                <Link to={`/calories/add?date=${date}&meal=${id}`} className="flex min-h-11 flex-1 items-center gap-2 px-4 text-coral-ink active:bg-fill">
                  <Icon name="plus" className="size-5" />
                  Add Food
                </Link>
                {entries.length > 0 && (
                  <button onClick={() => setToSave(entries)} className="min-h-11 px-4 text-[15px] text-coral-ink active:bg-fill">
                    Save as Meal
                  </button>
                )}
              </div>
            </Group>
          )
        })}

      {editing && (
        <FoodSheet
          title="Edit Food"
          food={editing}
          initialServings={editing.servings}
          initialMeal={editing.meal}
          submitLabel="Save"
          onSubmit={async (servings, meal) => {
            await saveFoodEntry(editing.id, { ...editing, servings, meal })
            setEditing(undefined)
            log.reload()
          }}
          onDelete={async () => {
            await deleteFoodEntry(editing.id)
            setEditing(undefined)
            log.reload()
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
      {toSave && (
        <SaveMealSheet
          foods={toSave}
          onSaved={(name) => {
            setToSave(undefined)
            setMessage(`Saved ${name}. Log it again from Add Food → Meals.`)
          }}
          onClose={() => setToSave(undefined)}
        />
      )}
    </Page>
  )
}

/** Calories left (Goal − Food + Exercise, or Active with Apple Watch data) beside the Eat ring, with the sum spelled out. */
function Summary({ goal, food, exercise, label, children }: { goal: number; food: number; exercise: number; label: 'Active' | 'Exercise'; children: ReactNode }) {
  const left = remaining(goal, food, exercise)
  return (
    <Card>
      <div className="flex items-center gap-4">
        <Rings size={92} rings={[{ label: 'Eaten', value: food / (goal + exercise), color: RING.eat }]} />
        <div>
          <p className="text-[34px] leading-tight font-bold">{formatKcal(Math.abs(left))}</p>
          <p className={left < 0 ? 'font-semibold text-amber-ink' : 'text-muted'}>{left < 0 ? 'kcal over' : 'kcal left'}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center text-center tabular-nums">
        <Part label="Goal" value={goal} />
        <span className="text-muted">−</span>
        <Part label="Food" value={food} />
        <span className="text-muted">+</span>
        <Part label={label} value={exercise} />
      </div>
      {label === 'Active' && <p className="mt-3 text-[13px] text-muted">Active calories from Apple Watch; your goal leaves out daily activity so it isn't counted twice.</p>}
      {children}
    </Card>
  )
}

const Part = ({ label, value }: { label: string; value: number }) => (
  <div>
    <p className="font-semibold">{formatKcal(value)}</p>
    <p className="text-[13px] text-muted">{label}</p>
  </div>
)

/** Saves a meal's foods under a name, to log them all again in one tap from Add Food → Meals. */
function SaveMealSheet({ foods, onSaved, onClose }: { foods: FoodEntry[]; onSaved: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const { busy: saving, error, setError, run } = useAction()

  const save = async () => {
    if (!name.trim()) return setError('Give it a name, like Usual breakfast.')
    await run(async () => {
      const items = foods.map((f) => ({ name: f.name, serving: f.serving, servings: f.servings, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, sugar: f.sugar, sodium: f.sodium }))
      await saveSavedMeal(randomId(), { name: name.trim(), items })
      void haptic('success')
      onSaved(name.trim())
    })
  }

  return (
    <Sheet
      title="Save as Meal"
      onClose={onClose}
      action={
        <button type="submit" form="save-meal" disabled={saving} className={plainButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <form
        id="save-meal"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="space-y-3"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, like Usual breakfast" aria-label="Meal name" maxLength={50} className={field} />
        <p className="text-[15px] text-muted">
          {foods.map((f) => f.name).join(', ')} · {formatKcal(totals(foods).calories)} kcal
        </p>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Sheet>
  )
}
