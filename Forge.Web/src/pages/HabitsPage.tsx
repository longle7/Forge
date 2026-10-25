import { useState } from 'react'
import { deleteHabit, getHabits, randomId, saveHabit, type Habit, type HabitInput } from '../api'
import { dangerButton, field, Group, Notice, Page, plainButton, Sheet, Status, Stepper, tintedButton } from '../components'
import { addDays, DAY_NAMES, localDate } from '../dates'
import { completion, daysLabel, EVERY_DAY, habitStreak, SUGGESTIONS } from '../habits'
import { Icon } from '../icons'
import { haptic } from '../notify'
import { failure, useNow, usePolling, useAction } from '../usePolling'
import { plural } from '../workouts'


/** Your habits (/habits): add, edit, archive, or delete them, with each one's streak and last 4 weeks. */
export default function HabitsPage() {
  const today = localDate(useNow(60_000))
  const habits = usePolling(getHabits, '/habits')
  const [editing, setEditing] = useState<{ id: string; habit: HabitInput; isNew: boolean }>()
  const active = habits.data?.filter((h) => !h.archived) ?? []
  const archived = habits.data?.filter((h) => h.archived) ?? []

  const row = (habit: Habit) => {
    const { done, scheduled } = completion(habit, addDays(today, -27), today)
    const streak = habitStreak(habit, today)
    return (
      <button key={habit.id} onClick={() => setEditing({ id: habit.id, habit, isNew: false })} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-fill">
        <span className="grid size-9 place-items-center rounded-full bg-fill text-[17px]">{habit.emoji || '•'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{habit.name}</span>
          <span className="block text-[13px] text-muted">
            {habit.dailyTarget > 1 ? `${habit.dailyTarget} a day` : 'Once a day'} · {daysLabel(habit.days)}
          </span>
        </span>
        {!habit.archived && (
          <span className="shrink-0 text-right text-[13px] text-muted">
            <span className="block font-semibold text-ink">{streak ? `${streak}-day streak` : 'No streak yet'}</span>
            {scheduled > 0 && `${done} of ${plural(scheduled, 'day')}`}
          </span>
        )}
        <Icon name="chevronRight" className="size-5 text-muted/60" />
      </button>
    )
  }

  return (
    <Page title="Habits" back={{ to: '/', label: 'Home' }}>
      <Status loading={habits.data === undefined && !habits.error} error={failure(habits)} rows={3} />
      {active.length > 0 && <Group footer="Streaks count the days each habit is scheduled. Last 4 weeks shown.">{active.map(row)}</Group>}
      <button onClick={() => setEditing({ id: randomId(), habit: { name: '', emoji: '', dailyTarget: 1, days: EVERY_DAY, archived: false }, isNew: true })} className={`w-full ${tintedButton}`}>
        <Icon name="plus" className="size-5" />
        New Habit
      </button>
      {archived.length > 0 && <Group title="Archived">{archived.map(row)}</Group>}

      {editing && (
        <HabitSheet
          {...editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            habits.reload()
          }}
        />
      )}
    </Page>
  )
}

function HabitSheet({ id, habit, isNew, onSaved, onClose }: { id: string; habit: HabitInput; isNew: boolean; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState(habit)
  const action = useAction()
  const { busy, error, setError } = action
  const set = (change: Partial<HabitInput>) => setForm({ ...form, ...change })
  const run = (save: () => Promise<unknown>) =>
    action.run(async () => {
      await save()
      void haptic('success')
      onSaved()
    })
  const submit = () => (form.days ? run(() => saveHabit(id, { ...form, name: form.name.trim() })) : setError('Pick at least one day.'))

  return (
    <Sheet
      title={isNew ? 'New Habit' : 'Edit Habit'}
      onClose={onClose}
      action={
        <button onClick={submit} disabled={busy || !form.name.trim()} className={plainButton}>
          {isNew ? 'Add' : 'Save'}
        </button>
      }
    >
      {isNew && !form.name && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s.name} onClick={() => set(s)} className="min-h-9 rounded-full bg-surface px-3 text-[15px] text-coral-ink active:opacity-70">
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[4rem_1fr] gap-2">
        <input value={form.emoji} onChange={(e) => set({ emoji: e.target.value })} placeholder="🙂" aria-label="Emoji" maxLength={8} className={`${field} text-center`} />
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name, like Stretch" aria-label="Habit name" maxLength={50} className={field} />
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2">
        <span>
          Times a day
          <span className="block text-[13px] text-muted">{form.dailyTarget === 1 ? 'A simple check-off' : `Counts up to ${form.dailyTarget}`}</span>
        </span>
        <Stepper value={form.dailyTarget} onChange={(dailyTarget) => set({ dailyTarget })} min={1} max={20} label="times a day" />
      </div>
      <div>
        <p className="mb-1 text-[15px] text-muted">Days · {daysLabel(form.days) || 'none'}</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_NAMES.map((name, i) => {
            const on = (form.days & (1 << i)) !== 0
            return (
              <button
                key={i}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={name}
                onClick={() => set({ days: form.days ^ (1 << i) })}
                className={`min-h-11 rounded-xl font-semibold ${on ? 'bg-coral/15 text-coral-ink' : 'bg-surface text-muted'}`}
              >
                {name[0]}
              </button>
            )
          })}
        </div>
      </div>
      {error && <Notice>{error}</Notice>}
      {!isNew && (
        <>
          <button onClick={() => run(() => saveHabit(id, { ...habit, archived: !habit.archived }))} disabled={busy} className={`w-full ${tintedButton}`}>
            {habit.archived ? 'Bring Back' : 'Archive (keeps its history)'}
          </button>
          <button onClick={() => confirm(`Delete ${habit.name} and its history?`) && run(() => deleteHabit(id))} disabled={busy} className={dangerButton}>
            Delete
          </button>
        </>
      )}
    </Sheet>
  )
}
