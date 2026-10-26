import { useState } from 'react'
import { checkHabit, getHabits, randomId, saveHabit, type Habit } from './api'
import { Card, Notice, SectionTitle, Status, tapArea } from './components'
import { localDate } from './dates'
import { countOn, EVERY_DAY, habitStreak, SUGGESTIONS, today as todayOf } from './habits'
import { Icon } from './icons'
import { haptic } from './notify'
import { useNow, usePolling } from './usePolling'

/**
 * Home's habits: today's, each a tap to check off (or count up, like 3 of 8 glasses; at the target a tap starts
 * over; − takes one back). Taps show at once and save in the background.
 */
export function HabitsCard() {
  const day = localDate(useNow(60_000))
  const habits = usePolling(getHabits, '/habits')
  const [taps, setTaps] = useState<Record<string, number>>({}) // habit id → today's count, before the reload
  const [error, setError] = useState<string>()
  const { due } = todayOf(habits.data, day)
  const count = (h: Habit) => taps[h.id] ?? countOn(h, day)

  // A tap counts up (at the target, starts over); `next` sets the count, for the − on counted habits.
  const tap = async (habit: Habit, next = count(habit) >= habit.dailyTarget ? 0 : count(habit) + 1) => {
    setTaps((t) => ({ ...t, [habit.id]: next }))
    setError(undefined)
    void haptic('tap')
    try {
      await checkHabit(habit.id, day, next)
    } catch (e) {
      setTaps((t) => ({ ...t, [habit.id]: countOn(habit, day) }))
      setError((e as Error).message)
    }
  }

  const start = async (s: (typeof SUGGESTIONS)[number]) => {
    try {
      await saveHabit(randomId(), { ...s, days: EVERY_DAY, archived: false })
      habits.reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // First visit, before habits load: hold the card's place. Offline with nothing remembered, it stays hidden.
  if (!habits.data) return <Status loading={!habits.error} rows={1} />
  return (
    <>
      <SectionTitle title="Habits" link={{ to: '/habits', label: habits.data.length ? 'Edit' : 'Add' }} />
      {habits.data.filter((h) => !h.archived).length === 0 ? (
        <Card>
          <p className="font-semibold">Build a daily habit</p>
          <p className="text-[15px] text-muted">Small things, checked off each day. Pick one to start:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button key={s.name} onClick={() => start(s)} className={`${tapArea} min-h-9 rounded-full bg-coral/12 px-3 text-[15px] text-coral-ink active:opacity-70`}>
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </Card>
      ) : due.length === 0 ? (
        <p className="px-1 text-muted">No habits due today.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {due.map((habit) => {
            const n = count(habit)
            const done = n >= habit.dailyTarget
            const streak = habitStreak({ ...habit, checks: [...habit.checks.filter((c) => c.date !== day), { date: day, count: n }] }, day)
            return (
              <div key={habit.id} className="flex items-center">
                <button
                  onClick={() => tap(habit)}
                  aria-label={`${habit.name}: ${habit.dailyTarget > 1 ? `${n} of ${habit.dailyTarget}` : done ? 'done' : 'not done'}. ${done ? 'Tap to start over.' : 'Tap to check off.'}`}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left active:bg-fill"
                >
                  {/* Progress as a ring around the emoji: the Unlock green, since habits can unlock apps. */}
                  <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--chart-unlock) ${(Math.min(n, habit.dailyTarget) / habit.dailyTarget) * 360}deg, var(--fill) 0)` }}>
                    <span className="grid size-8 place-items-center rounded-full bg-surface text-[17px]">{done ? <Icon name="check" className="size-5 stroke-[3] text-green-ink" /> : habit.emoji || '•'}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${done ? 'text-muted' : 'font-medium'}`}>{habit.name}</span>
                    <span className="block text-[13px] text-muted">
                      {habit.dailyTarget > 1 ? `${n} of ${habit.dailyTarget}` : done ? 'Done' : 'Tap when done'}
                      {streak > 1 && ` · ${streak}-day streak`}
                    </span>
                  </span>
                </button>
                {habit.dailyTarget > 1 && n > 0 && (
                  <button onClick={() => tap(habit, n - 1)} aria-label={`One less ${habit.name}`} className="mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted active:bg-fill">
                    <Icon name="minus" className="size-5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </>
  )
}
