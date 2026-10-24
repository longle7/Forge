import { useState, type ChangeEvent } from 'react'
import { MEALS, randomId, saveFoodEntry, scanLabel, scanMeal, type Meal, type ScannedFood } from './api'
import { field, Notice, plainButton, primaryButton, Sheet } from './components'
import { Icon, type IconName } from './icons'
import { haptic } from './notify'
import { formatKcal, MICROS, optionalNumber } from './nutrition'
import { giveScanConsent, hasScanConsent, shrinkPhoto } from './photo'
import { useAction } from './usePolling'

type Kind = 'label' | 'meal'
// A scanned food while you check it: every number is text, so a field can be cleared and retyped.
type Item = { name: string; serving: string; servings: string; calories: string; protein: string; carbs: string; fat: string; fiber: string; sugar: string; sodium: string }

const toItem = (food: ScannedFood): Item => ({
  name: food.name,
  serving: food.serving,
  servings: '1',
  calories: String(food.calories),
  protein: String(food.protein),
  carbs: String(food.carbs),
  fat: String(food.fat),
  fiber: food.fiber == null ? '' : String(food.fiber),
  sugar: food.sugar == null ? '' : String(food.sugar),
  sodium: food.sodium == null ? '' : String(food.sodium),
})

/**
 * Photo logging on Add Food: Scan a Label or Snap a Meal. A photo is shrunk on the phone, read by Claude (the first
 * time, after you agree to that), and comes back for you to check and edit before anything is logged.
 */
export function ScanFlow({ date, meal, onLogged }: { date: string; meal: Meal; onLogged: () => void }) {
  const [step, setStep] = useState<{ kind: Kind; at: 'consent' | 'reading' | 'review'; photo?: File; items?: Item[] }>()
  const [error, setError] = useState<string>()

  const read = async (kind: Kind, photo: File) => {
    setError(undefined)
    setStep({ kind, at: 'reading' })
    try {
      const small = await shrinkPhoto(photo)
      const foods = kind === 'label' ? [await scanLabel(small)] : await scanMeal(small)
      setStep({ kind, at: 'review', items: foods.map(toItem) })
    } catch (e) {
      setStep(undefined)
      setError((e as Error).message)
    }
  }

  const choose = (kind: Kind) => (event: ChangeEvent<HTMLInputElement>) => {
    const photo = event.target.files?.[0]
    event.target.value = '' // so the same photo can be chosen again
    if (!photo) return
    if (hasScanConsent()) void read(kind, photo)
    else setStep({ kind, at: 'consent', photo })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <ScanTile icon="camera" title="Scan a Label" detail="Reads the Nutrition Facts" onChange={choose('label')} />
        <ScanTile icon="sparkles" title="Snap a Meal" detail="Estimates each food" onChange={choose('meal')} />
      </div>
      {error && <Notice>{error}</Notice>}

      {step?.at === 'consent' && (
        <Sheet title="Photo Logging" onClose={() => setStep(undefined)}>
          <p>
            To read a label or recognize your food, Forge sends the photo to Anthropic's Claude. The photo isn't stored: only
            the foods you choose to log are saved.
          </p>
          <button
            onClick={() => {
              giveScanConsent()
              void read(step.kind, step.photo!)
            }}
            className={primaryButton}
          >
            Continue
          </button>
        </Sheet>
      )}

      {step?.at === 'reading' && (
        <Sheet title={step.kind === 'label' ? 'Scan a Label' : 'Snap a Meal'} onClose={() => setStep(undefined)}>
          <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-coral/12 text-coral-ink motion-safe:animate-pulse">
              <Icon name={step.kind === 'label' ? 'camera' : 'sparkles'} className="size-7" />
            </span>
            <p className="text-muted">{step.kind === 'label' ? 'Reading the label…' : 'Looking at your plate…'}</p>
          </div>
        </Sheet>
      )}

      {step?.at === 'review' && step.items && (
        <Review kind={step.kind} initial={step.items} date={date} meal={meal} onLogged={onLogged} onClose={() => setStep(undefined)} />
      )}
    </>
  )
}

function ScanTile({ icon, title, detail, onChange }: { icon: IconName; title: string; detail: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="block cursor-pointer rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgb(42_31_26/0.06)] focus-within:ring-2 focus-within:ring-coral active:scale-[0.99]">
      <span className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-coral to-pink text-white">
        <Icon name={icon} className="size-6" />
      </span>
      <span className="mt-2 block font-semibold">{title}</span>
      <span className="block text-[13px] text-muted">{detail}</span>
      {/* No `capture`, so the iPhone offers Take Photo or the Photo Library. */}
      <input type="file" accept="image/*" onChange={onChange} className="sr-only" aria-label={`${title}: take or choose a photo`} />
    </label>
  )
}

/** Check and fix what was read, then log it: each food becomes its own entry in the chosen meal. */
function Review({ kind, initial, date, meal, onLogged, onClose }: { kind: Kind; initial: Item[]; date: string; meal: Meal; onLogged: () => void; onClose: () => void }) {
  const [items, setItems] = useState(initial)
  const { busy: saving, error, setError, run } = useAction()
  const change = (i: number, update: Partial<Item>) => setItems(items.map((item, j) => (j === i ? { ...item, ...update } : item)))
  const number = (text: string) => Number(text) || 0
  const total = items.reduce((sum, item) => sum + number(item.calories) * number(item.servings), 0)

  const add = async () => {
    if (items.some((item) => !(number(item.servings) > 0))) return setError('Each food needs a number of servings.')
    await run(async () => {
      for (const item of items) {
        await saveFoodEntry(randomId(), {
          date,
          meal,
          name: item.name.trim() || (kind === 'label' ? 'Scanned food' : 'Food'),
          serving: item.serving.trim() || '1 serving',
          servings: number(item.servings),
          calories: number(item.calories),
          protein: number(item.protein),
          carbs: number(item.carbs),
          fat: number(item.fat),
          fiber: optionalNumber(item.fiber),
          sugar: optionalNumber(item.sugar),
          sodium: optionalNumber(item.sodium),
          source: kind === 'label' ? 'label' : 'photo',
        })
      }
      void haptic('success')
      onLogged()
    })
  }

  const mealLabel = MEALS.find((m) => m.id === meal)!.label
  return (
    <Sheet title="Check and Log" onClose={onClose}>
      <p className="text-[15px] text-muted">
        {kind === 'label' ? 'Here’s what the label says. Fix anything that’s off.' : 'These are estimates. Adjust portions or numbers as needed.'}
      </p>
      <div className="max-h-[50dvh] space-y-3 overflow-y-auto">
        {items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-2xl bg-surface p-3">
            <div className="flex items-center gap-2">
              <input value={item.name} onChange={(e) => change(i, { name: e.target.value })} placeholder="Name this food" aria-label="Food name" className={`${field} font-semibold`} />
              {items.length > 1 && (
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove ${item.name || 'this food'}`} className="grid size-11 shrink-0 place-items-center rounded-xl text-muted active:bg-fill">
                  <Icon name="trash" className="size-5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_6rem] items-end gap-2">
              <label className="block">
                <span className="text-[13px] text-muted">Serving</span>
                <input value={item.serving} onChange={(e) => change(i, { serving: e.target.value })} aria-label="Serving" className={field} />
              </label>
              <label className="block">
                <span className="text-[13px] text-muted">Servings</span>
                <input value={item.servings} onChange={(e) => change(i, { servings: e.target.value })} inputMode="decimal" aria-label="Servings" className={`${field} text-center`} />
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['calories', 'kcal'],
                  ['protein', 'Protein'],
                  ['carbs', 'Carbs'],
                  ['fat', 'Fat'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-[13px] text-muted">{label}</span>
                  <input value={item[key]} onChange={(e) => change(i, { [key]: e.target.value })} inputMode="decimal" aria-label={`${label} per serving`} className={`${field} px-1 text-center`} />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MICROS.map((m) => (
                <label key={m.key} className="block">
                  <span className="text-[13px] text-muted">
                    {m.label} ({m.unit})
                  </span>
                  <input value={item[m.key]} onChange={(e) => change(i, { [m.key]: e.target.value })} inputMode="decimal" aria-label={`${m.label} per serving, ${m.unit}`} className={`${field} px-1 text-center`} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-[15px] text-red-600 dark:text-red-400">{error}</p>}
      <button onClick={add} disabled={saving} className={primaryButton}>
        {saving ? 'Logging…' : `Add to ${mealLabel} · ${formatKcal(total)} kcal`}
      </button>
      <button onClick={onClose} className={`w-full justify-center ${plainButton}`}>
        Retake
      </button>
    </Sheet>
  )
}
