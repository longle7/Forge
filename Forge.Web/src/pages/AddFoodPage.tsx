import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  deleteSavedMeal,
  getRecentFoods,
  getSavedMeals,
  MEALS,
  randomId,
  saveFoodEntry,
  searchFoods,
  type FoodEntry,
  type FoodResult,
  type Meal,
  type SavedMeal,
} from '../api'
import { Card, field, Group, Page, primaryButton, SearchInput, Segmented, Status } from '../components'
import { localDate } from '../dates'
import { FoodSheet, type FoodChoice } from '../FoodSheet'
import { Icon } from '../icons'
import { ScanFlow } from '../ScanFlow'
import { failure, useNow, usePolling } from '../usePolling'
import { formatKcal, totals } from '../nutrition'

type Tab = 'search' | 'recent' | 'meals' | 'quick'
type Choice = FoodChoice & { servings: number; source: FoodEntry['source'] }

/** Add food to a day's meal (/calories/add?date=…&meal=…): search, a recent food, a saved meal, or your own numbers. */
export default function AddFoodPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const now = useNow(60_000)
  const today = localDate(now)
  const date = params.get('date') ?? today
  const [meal, setMeal] = useState<Meal>(() => (MEALS.some((m) => m.id === params.get('meal')) ? (params.get('meal') as Meal) : mealAt(now)))
  const [tab, setTab] = useState<Tab>('search')
  const [chosen, setChosen] = useState<Choice>()
  const back = date === today ? '/calories' : `/calories?date=${date}`

  const log = async (food: FoodChoice, servings: number, mealId: Meal, source: FoodEntry['source']) => {
    await saveFoodEntry(randomId(), { date, meal: mealId, name: food.name, serving: food.serving, servings, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, source })
    navigate(back, { replace: true })
  }
  // A saved meal logs each of its foods, in order.
  const logMeal = async (saved: SavedMeal) => {
    for (const item of saved.items) await saveFoodEntry(randomId(), { ...item, date, meal, source: 'manual' })
    navigate(back, { replace: true })
  }

  return (
    <Page title="Add Food" back={{ to: back, label: 'Calories' }}>
      <Segmented label="Meal" options={MEALS.map((m) => ({ value: m.id, label: m.label }))} value={meal} onChange={setMeal} />
      <ScanFlow date={date} meal={meal} onLogged={() => navigate(back, { replace: true })} />
      <Segmented
        label="How to add"
        options={[
          { value: 'search', label: 'Search' },
          { value: 'recent', label: 'Recent' },
          { value: 'meals', label: 'Meals' },
          { value: 'quick', label: 'Quick' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'search' && <FoodSearch onChoose={(food) => setChosen({ ...food, servings: 1, source: 'search' })} />}
      {tab === 'recent' && <RecentFoods onChoose={(entry) => setChosen({ ...entry, source: entry.source })} />}
      {tab === 'meals' && <SavedMeals onLog={logMeal} />}
      {tab === 'quick' && <QuickAdd onAdd={(food) => log(food, 1, meal, 'manual')} />}

      {chosen && (
        <FoodSheet
          title="Add Food"
          food={chosen}
          initialServings={chosen.servings}
          initialMeal={meal}
          submitLabel="Add"
          onSubmit={(servings, mealId) => log(chosen, servings, mealId, chosen.source)}
          onClose={() => setChosen(undefined)}
        />
      )}
    </Page>
  )
}

/** The meal you're probably logging at this hour. */
function mealAt(now: Date): Meal {
  const hour = now.getHours() + now.getMinutes() / 60
  return hour < 10.5 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 21 ? 'dinner' : 'snack'
}

function FoodSearch({ onChoose }: { onChoose: (food: FoodResult) => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ query: string; foods?: FoodResult[]; error?: string }>()
  const q = query.trim()

  // Search as you type, once you pause: each new keystroke cancels the last search.
  useEffect(() => {
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(
      () =>
        searchFoods(q, controller.signal).then(
          (foods) => setFound({ query: q, foods }),
          (error: Error) => !controller.signal.aborted && setFound({ query: q, error: error.message }),
        ),
      350,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  const current = found?.query === q ? found : undefined
  return (
    <>
      <SearchInput value={query} onChange={setQuery} placeholder="Search foods, like greek yogurt" />
      {q.length >= 2 && !current && <Status loading rows={3} />}
      {current?.error && <p className="px-1 text-[15px] text-red-600 dark:text-red-400">{current.error}</p>}
      {current?.foods?.length === 0 && <p className="px-1 text-muted">Nothing found for “{q}”. Try other words, or use Quick Add.</p>}
      {current?.foods && current.foods.length > 0 && (
        <Group>
          {current.foods.map((food, i) => (
            <FoodRow key={i} name={food.name} detail={`${food.brand ? `${food.brand} · ` : ''}${food.serving}`} calories={food.calories} onClick={() => onChoose(food)} />
          ))}
        </Group>
      )}
      {q.length < 2 && <p className="px-1 text-[15px] text-muted">Foods come from the USDA's database: generic foods per 100 g, and packaged foods per label serving.</p>}
    </>
  )
}

function RecentFoods({ onChoose }: { onChoose: (entry: FoodEntry) => void }) {
  const recent = usePolling(getRecentFoods, '/food-log/recent')
  return (
    <>
      <Status loading={recent.data === undefined && !recent.error} error={failure(recent)} rows={3} />
      {recent.data?.length === 0 && <p className="px-1 text-muted">Foods you log show up here, ready to log again in one tap.</p>}
      {recent.data && recent.data.length > 0 && (
        <Group>
          {recent.data.map((entry) => (
            <FoodRow key={entry.id} name={entry.name} detail={entry.servings === 1 ? entry.serving : `${entry.servings} × ${entry.serving}`} calories={entry.calories * entry.servings} onClick={() => onChoose(entry)} />
          ))}
        </Group>
      )}
    </>
  )
}

function SavedMeals({ onLog }: { onLog: (meal: SavedMeal) => Promise<void> }) {
  const meals = usePolling(getSavedMeals, '/saved-meals')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const act = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)
    try {
      await work()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }
  const remove = (meal: SavedMeal) => {
    if (!confirm(`Delete ${meal.name}? Foods you logged from it stay logged.`)) return
    void act(async () => {
      await deleteSavedMeal(meal.id)
      meals.reload()
    })
  }

  return (
    <>
      <Status loading={meals.data === undefined && !meals.error} error={failure(meals)} rows={2} />
      {meals.data?.length === 0 && <p className="px-1 text-muted">Save a meal you eat often from the Calories tab (Save as Meal, under the meal), then log it here in one tap.</p>}
      {error && <p className="px-1 text-[15px] text-red-600 dark:text-red-400">{error}</p>}
      {meals.data && meals.data.length > 0 && (
        <Group footer="Tap a meal to log all of it.">
          {meals.data.map((meal) => (
            <div key={meal.id} className="flex items-center">
              <div className="min-w-0 flex-1">
                <FoodRow name={meal.name} detail={meal.items.map((i) => i.name).join(', ')} calories={totals(meal.items).calories} onClick={() => !busy && act(() => onLog(meal))} />
              </div>
              <button onClick={() => remove(meal)} disabled={busy} aria-label={`Delete ${meal.name}`} className="grid size-11 shrink-0 place-items-center text-muted active:bg-fill">
                <Icon name="trash" className="size-5" />
              </button>
            </div>
          ))}
        </Group>
      )}
    </>
  )
}

function FoodRow({ name, detail, calories, onClick }: { name: string; detail: string; calories: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
      <span className="min-w-0 flex-1">
        <span className="block">{name}</span>
        <span className="block truncate text-[15px] text-muted">{detail}</span>
      </span>
      <span className="shrink-0 text-muted tabular-nums">{formatKcal(calories)} kcal</span>
    </button>
  )
}

function QuickAdd({ onAdd }: { onAdd: (food: FoodChoice) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })
  const number = (text: string) => Number(text) || 0

  const add = async () => {
    if (!(number(form.calories) > 0)) return setError('Enter the calories.')
    setSaving(true)
    setError(undefined)
    try {
      await onAdd({ name: form.name.trim() || 'Quick add', serving: '1 serving', calories: number(form.calories), protein: number(form.protein), carbs: number(form.carbs), fat: number(form.fat) })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className="space-y-2">
        <input value={form.name} onChange={set('name')} placeholder="What was it? (optional)" aria-label="Food name" maxLength={200} className={field} />
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['calories', 'Calories (kcal)'],
              ['protein', 'Protein (g)'],
              ['carbs', 'Carbs (g)'],
              ['fat', 'Fat (g)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-[15px] text-muted">{label}</span>
              <input value={form[key]} onChange={set(key)} inputMode="decimal" className={field} />
            </label>
          ))}
        </div>
        {error && <p className="text-[15px] text-red-600 dark:text-red-400">{error}</p>}
        <button onClick={add} disabled={saving} className={primaryButton}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
    </Card>
  )
}
