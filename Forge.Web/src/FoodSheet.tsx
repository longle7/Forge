import { useState } from 'react'
import { MEALS, type Meal, type Micros, type Nutrition } from './api'
import { dangerButton, field, Notice, plainButton, Segmented, Sheet } from './components'
import { haptic } from './notify'
import { formatKcal, MICROS } from './nutrition'
import { useAction } from './usePolling'

export type FoodChoice = Nutrition & Micros & { name: string; brand?: string | null; serving: string }

const QUICK_SERVINGS = [0.5, 1, 1.5, 2]

/**
 * Log a food (from search or recent), or edit a logged one: how many servings, which meal, and what that comes to.
 * `onSubmit` saves; the owner closes the sheet (and refreshes) when it resolves. A rejection shows its message here.
 */
export function FoodSheet({ title, food, initialServings = 1, initialMeal, submitLabel, onSubmit, onDelete, onClose }: {
  title: string
  food: FoodChoice
  initialServings?: number
  initialMeal: Meal
  submitLabel: string
  onSubmit: (servings: number, meal: Meal) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [servings, setServings] = useState(String(initialServings))
  const [meal, setMeal] = useState(initialMeal)
  const action = useAction()
  const { busy, error } = action
  // A save or delete closes the sheet (the owner does that); in the iPhone app you feel that it went through.
  const run = (save: () => Promise<void>) =>
    action.run(async () => {
      await save()
      void haptic('success')
    })
  const amount = Number(servings)
  const valid = amount > 0 && amount <= 100

  return (
    <Sheet
      title={title}
      onClose={onClose}
      action={
        <button onClick={() => run(() => onSubmit(amount, meal))} disabled={!valid || busy} className={plainButton}>
          {submitLabel}
        </button>
      }
    >
      <div>
        <p className="text-[20px] leading-snug font-semibold">{food.name}</p>
        <p className="text-[15px] text-muted">
          {food.brand ? `${food.brand} · ` : ''}
          {food.serving}
        </p>
      </div>

      <label className="block">
        <span className="text-[15px] text-muted">Servings</span>
        <input value={servings} onChange={(e) => setServings(e.target.value)} inputMode="decimal" className={`${field} text-center text-[22px] font-semibold`} />
      </label>
      <div className="flex gap-2">
        {QUICK_SERVINGS.map((n) => (
          <button key={n} type="button" onClick={() => setServings(String(n))} className={`min-h-9 flex-1 rounded-full text-[15px] font-semibold ${amount === n ? 'bg-coral/15 text-coral-ink' : 'bg-surface text-muted'}`}>
            {n}
          </button>
        ))}
      </div>

      <Segmented label="Meal" options={MEALS.map((m) => ({ value: m.id, label: m.label }))} value={meal} onChange={setMeal} />

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-surface p-3 text-center">
        {[
          ['Calories', formatKcal(food.calories * (valid ? amount : 0))],
          ['Protein', `${Math.round(food.protein * (valid ? amount : 0))} g`],
          ['Carbs', `${Math.round(food.carbs * (valid ? amount : 0))} g`],
          ['Fat', `${Math.round(food.fat * (valid ? amount : 0))} g`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[17px] font-semibold tabular-nums">{value}</p>
            <p className="text-[13px] text-muted">{label}</p>
          </div>
        ))}
      </div>
      {MICROS.some((m) => food[m.key] != null) && (
        <p className="-mt-2 text-center text-[13px] text-muted tabular-nums">
          {MICROS.filter((m) => food[m.key] != null)
            .map((m) => `${m.label} ${Math.round(food[m.key]! * (valid ? amount : 0))} ${m.unit}`)
            .join(' · ')}
        </p>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {onDelete && (
        <button onClick={() => run(onDelete)} disabled={busy} className={dangerButton}>
          Delete
        </button>
      )}
    </Sheet>
  )
}
