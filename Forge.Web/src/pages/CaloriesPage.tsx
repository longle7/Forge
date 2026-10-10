import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { deleteFoodEntry, foodLogPath, getFoodLog, getProfile, getWeighIns, getWorkouts, MEALS, saveFoodEntry, type FoodEntry } from '../api'
import { Card, Group, MacroBar, Page, primaryButton, RING, Rings, Status } from '../components'
import { addDays, dayLabel, localDate, workoutDay } from '../dates'
import { FoodSheet } from '../FoodSheet'
import { Icon } from '../icons'
import { exerciseCalories, formatKcal, remaining, totals, weightOn } from '../nutrition'
import { failure, useNow, usePolling } from '../usePolling'

/** The Calories tab: a day's food by meal, and what's left of its calories (Goal − Food + Exercise) and macros. */
export default function CaloriesPage() {
  const [params, setParams] = useSearchParams()
  const today = localDate(useNow(60_000))
  const date = params.get('date') ?? today
  const setDate = (day: string) => setParams(day === today ? {} : { date: day }, { replace: true })

  const profile = usePolling(getProfile, '/profile')
  const log = usePolling(() => getFoodLog(date), foodLogPath(date))
  const workouts = usePolling(getWorkouts, '/workouts')
  const weighIns = usePolling(getWeighIns, '/weigh-ins')
  const [editing, setEditing] = useState<FoodEntry>()

  const goals = profile.data
  const food = totals(log.data ?? [])
  const weight = weightOn(weighIns.data, date, goals?.startWeight ?? 0)
  const exercise = (workouts.data ?? []).filter((w) => workoutDay(w) === date).reduce((sum, w) => sum + exerciseCalories(w, weight), 0)

  return (
    <Page title="Calories">
      <div className="flex items-center justify-between rounded-2xl bg-surface p-1">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Previous day" className="grid size-11 place-items-center rounded-xl text-coral-ink active:bg-fill">
          <Icon name="chevronLeft" />
        </button>
        <span className="font-semibold">{dayLabel(date, today)}</span>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day" className="grid size-11 place-items-center rounded-xl text-coral-ink active:bg-fill disabled:opacity-30">
          <Icon name="chevronRight" />
        </button>
      </div>

      {goals ? (
        <Summary goal={goals.calorieGoal} food={food.calories} exercise={exercise}>
          <div className="mt-4 space-y-3">
            <MacroBar label="Protein" value={food.protein} goal={goals.proteinGoal} color={RING.move} />
            <MacroBar label="Carbs" value={food.carbs} goal={goals.carbsGoal} color={RING.eat} />
            <MacroBar label="Fat" value={food.fat} goal={goals.fatGoal} color="#ff4f8b" />
          </div>
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

      <Status loading={log.data === undefined && !log.error} error={failure(log)} rows={2} />
      {log.data &&
        MEALS.map(({ id, label }) => {
          const entries = log.data!.filter((e) => e.meal === id)
          const mealTotal = totals(entries).calories
          return (
            <Group key={id} title={entries.length ? `${label} · ${formatKcal(mealTotal)} kcal` : label}>
              {entries.map((entry) => (
                <button key={entry.id} onClick={() => setEditing(entry)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{entry.name}</span>
                    <span className="block truncate text-[15px] text-muted">
                      {entry.servings === 1 ? entry.serving : `${entry.servings} × ${entry.serving}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted tabular-nums">{formatKcal(entry.calories * entry.servings)}</span>
                </button>
              ))}
              <Link to={`/calories/add?date=${date}&meal=${id}`} className="flex min-h-11 items-center gap-2 px-4 text-coral-ink active:bg-fill">
                <Icon name="plus" className="size-5" />
                Add Food
              </Link>
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
    </Page>
  )
}

/** Calories left (Goal − Food + Exercise) beside the Eat ring, with the sum spelled out. */
function Summary({ goal, food, exercise, children }: { goal: number; food: number; exercise: number; children: ReactNode }) {
  const left = remaining(goal, food, exercise)
  return (
    <Card>
      <div className="flex items-center gap-4">
        <Rings size={92} rings={[{ label: 'Eaten', value: food / (goal + exercise), color: RING.eat }]} />
        <div>
          <p className="text-[34px] leading-tight font-bold tabular-nums">{formatKcal(Math.abs(left))}</p>
          <p className={left < 0 ? 'font-semibold text-amber-ink' : 'text-muted'}>{left < 0 ? 'kcal over' : 'kcal left'}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center text-center tabular-nums">
        <Part label="Goal" value={goal} />
        <span className="text-muted">−</span>
        <Part label="Food" value={food} />
        <span className="text-muted">+</span>
        <Part label="Exercise" value={exercise} />
      </div>
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
