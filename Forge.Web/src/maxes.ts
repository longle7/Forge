import type { TestedMax, Workout } from './api'
import { workoutDay } from './dates'
import { isCardioSet, oneRepMax, platesPerSide } from './workouts'

/** The lifts in a powerlifting total, by their built-in IDs (BuiltInExercises.cs). */
export const BIG_THREE = [
  { id: 14, label: 'Squat' },
  { id: 1, label: 'Bench' },
  { id: 7, label: 'Deadlift' },
]

/** The rep counts a rep-max table shows: your best single, triple, five, and ten. */
export const REP_COUNTS = [1, 3, 5, 10]

/** A lift: a weight for some reps on a day, from a logged set or a tested max. */
interface Lift {
  weight: number
  reps: number
  date: string
  tested: boolean
}

// Every weighted lift of one exercise, logged or tested. Bodyweight and cardio sets have no weight to go on.
function lifts(workouts: Workout[], tested: TestedMax[], exerciseId: number): Lift[] {
  const logged = workouts.flatMap((w) =>
    w.sets
      .filter((s) => s.exerciseId === exerciseId && s.weight > 0 && s.reps > 0 && !isCardioSet(s))
      .map((s) => ({ weight: s.weight, reps: s.reps, date: workoutDay(w), tested: false })),
  )
  return [...logged, ...tested.filter((m) => m.exerciseId === exerciseId).map((m) => ({ weight: m.weight, reps: m.reps, date: m.date, tested: true }))]
}

/** For 1, 3, 5, and 10 reps: the heaviest weight you've lifted for at least that many, logged or tested. */
export function repMaxes(workouts: Workout[], tested: TestedMax[], exerciseId: number): { reps: number; best: Lift | undefined }[] {
  const all = lifts(workouts, tested, exerciseId)
  return REP_COUNTS.map((reps) => ({
    reps,
    best: all.filter((l) => l.reps >= reps).reduce<Lift | undefined>((top, l) => (!top || l.weight > top.weight ? l : top), undefined),
  }))
}

/**
 * Your best estimated 1-rep max (Epley) from `since` (YYYY-MM-DD) on, and the lift it came from.
 * ponytail: tested maxes count here but not for PR badges (personalRecords), so a set can be a "PR" below a tested
 * max; feed tested maxes into personalRecords if that confuses people.
 */
export function estimatedMax(workouts: Workout[], tested: TestedMax[], exerciseId: number, since = ''): (Lift & { value: number }) | undefined {
  let best: (Lift & { value: number }) | undefined
  for (const lift of lifts(workouts, tested, exerciseId)) {
    const value = oneRepMax(lift.weight, lift.reps)
    if (lift.date >= since && (!best || value > best.value)) best = { ...lift, value }
  }
  return best
}

/** 95% down to 50% of `max`, each rounded to the nearest 5 lb, with the plates for each side of a 45 lb bar. */
export function percentTable(max: number): { percent: number; weight: number; plates: number[] }[] {
  return [95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map((percent) => {
    const weight = Math.round((max * percent) / 100 / 5) * 5
    return { percent, weight, plates: platesPerSide(weight).plates }
  })
}

/** The exercises you have a weighted set or a tested max for, most recently lifted first. */
export function liftedExercises(workouts: Workout[], tested: TestedMax[]): number[] {
  const latest = new Map<number, string>()
  const see = (id: number, date: string) => {
    if ((latest.get(id) ?? '') < date) latest.set(id, date)
  }
  for (const w of workouts) for (const s of w.sets) if (s.weight > 0 && !isCardioSet(s)) see(s.exerciseId, workoutDay(w))
  for (const m of tested) see(m.exerciseId, m.date)
  return [...latest].sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0)).map(([id]) => id)
}

/** Squat, bench, and deadlift estimated maxes from `since` on, and their total once all three have one. */
export function bigThree(workouts: Workout[], tested: TestedMax[], since = ''): { lifts: { id: number; label: string; value: number | undefined }[]; total: number | undefined } {
  const lifts = BIG_THREE.map((l) => ({ ...l, value: estimatedMax(workouts, tested, l.id, since)?.value }))
  return { lifts, total: lifts.every((l) => l.value !== undefined) ? lifts.reduce((sum, l) => sum + l.value!, 0) : undefined }
}
