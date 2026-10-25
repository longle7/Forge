import { useState, type FormEvent } from 'react'
import { saveWeighIn } from './api'
import { field, Notice, plainButton, Sheet } from './components'
import { haptic } from './notify'
import { useAction } from './usePolling'

/** Log today's weight (from Home or Progress). Calls `onSaved` once it's saved; the owner closes the sheet. */
export function WeighInSheet({ day, current, onSaved, onClose }: { day: string; current?: number; onSaved: () => void; onClose: () => void }) {
  const [weight, setWeight] = useState(current ? String(current) : '')
  const { busy: saving, error, setError, run } = useAction()

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const pounds = Number(weight)
    if (!(pounds >= 50 && pounds <= 1000)) return setError('Enter your weight in pounds.')
    await run(async () => {
      await saveWeighIn(day, Math.round(pounds * 10) / 10)
      void haptic('success')
      onSaved()
    })
  }

  return (
    <Sheet
      title="Log Weight"
      onClose={onClose}
      action={
        <button type="submit" form="weigh-in" disabled={saving} className={plainButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <form id="weigh-in" onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="text-[15px] text-muted">Today's weight (lb)</span>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="185.0" className={`${field} min-h-14 text-center text-[28px] font-bold`} />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    </Sheet>
  )
}
