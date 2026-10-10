import { useState, type FormEvent } from 'react'
import { saveWeighIn } from './api'
import { field, primaryButton, Sheet } from './components'

/** Log today's weight (from Home or Progress). Calls `onSaved` once it's saved; the owner closes the sheet. */
export function WeighInSheet({ day, current, onSaved, onClose }: { day: string; current?: number; onSaved: () => void; onClose: () => void }) {
  const [weight, setWeight] = useState(current ? String(current) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const pounds = Number(weight)
    if (!(pounds >= 50 && pounds <= 1000)) return setError('Enter your weight in pounds.')
    setSaving(true)
    setError(undefined)
    try {
      await saveWeighIn(day, Math.round(pounds * 10) / 10)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Sheet title="Log Weight" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="text-[15px] text-muted">Today's weight (lb)</span>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="185.0" className={`${field} min-h-14 text-center text-[28px] font-bold`} />
        </label>
        {error && <p className="text-[15px] text-red-600 dark:text-red-400">{error}</p>}
        <button disabled={saving} className={primaryButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Sheet>
  )
}
