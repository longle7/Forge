import { useState, type FormEvent } from 'react'
import { deleteMax, randomId, saveMax, type TestedMax } from './api'
import { dangerButton, field, Notice, primaryButton, Sheet, Stepper } from './components'
import { haptic } from './notify'
import { oneRepMax, formatWeight } from './workouts'
import { useAction } from './usePolling'

/**
 * Add a max you tested outside a logged workout (a meet, a test day), or change or delete one (`max`). Calls
 * `onSaved` once it's saved or deleted; the owner closes the sheet.
 */
export function TestedMaxSheet({ exerciseId, max, today, onSaved, onClose }: {
  exerciseId: number
  max?: TestedMax
  today: string
  onSaved: () => void
  onClose: () => void
}) {
  const [weight, setWeight] = useState(max ? String(max.weight) : '')
  const [reps, setReps] = useState(max?.reps ?? 1)
  const [date, setDate] = useState(max?.date ?? today)
  const { busy, error, setError, run } = useAction()
  const pounds = Number(weight)

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!(pounds >= 1 && pounds <= 2000)) return setError('Enter the weight in pounds.')
    if (!date || date > today) return setError('Pick the day you lifted it.')
    void run(async () => {
      await saveMax(max?.id ?? randomId(), { exerciseId, date, weight: Math.round(pounds * 10) / 10, reps })
      void haptic('success')
      onSaved()
    })
  }
  const remove = () => {
    if (!confirm('Delete this max?')) return
    void run(async () => {
      await deleteMax(max!.id)
      void haptic('success')
      onSaved()
    })
  }

  return (
    <Sheet title={max ? 'Tested Max' : 'Add Tested Max'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="text-[15px] text-muted">Weight (lb)</span>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="225" className={`${field} min-h-14 text-center text-[28px] font-bold`} />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-muted">Reps</span>
          <div className="flex items-center gap-3">
            <span className="w-6 text-center font-semibold tabular-nums">{reps}</span>
            <Stepper value={reps} onChange={setReps} min={1} max={10} label="reps" />
          </div>
        </div>
        <label className="block">
          <span className="text-[15px] text-muted">Day</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        {pounds > 0 && reps > 1 && <p className="text-[15px] text-muted">That's about {formatWeight(Math.round(oneRepMax(pounds, reps)))} lb for one rep.</p>}
        {error && <Notice>{error}</Notice>}
        <button disabled={busy} className={primaryButton}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {max && (
          <button type="button" onClick={remove} disabled={busy} className={dangerButton}>
            Delete
          </button>
        )}
      </form>
    </Sheet>
  )
}
