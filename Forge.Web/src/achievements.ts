import type { PlanDay, Workout } from './api'
import { addDays, weekday, workoutDay } from './dates'
import type { IconName } from './icons'
import { BIG_THREE } from './maxes'
import { byStart, formatWeight, isLift, personalRecords, volume } from './workouts'

/** What badges are earned from: totals over your workouts. */
export interface AchievementStats {
  workouts: number
  volume: number // lb, warm-ups aside
  prs: number
  heaviest: Map<number, number> // exerciseId → the heaviest weight lifted, warm-ups aside (a lifting set has a rep or more)
  longestStreak: number // the most weeks in a row you trained enough (see weeklyStreak), so a streak badge stays earned
}

/** A badge, earned once its progress reaches the goal. Nothing is stored: every badge is worked out from your workouts. */
export interface Badge {
  id: string
  title: string // "225 lb bench"
  description: string // how to earn it
  icon: IconName
  unit: string // what progress counts, as in "187,450 of 500,000 lb"
  progress: (stats: AchievementStats) => { value: number; goal: number }
}

// The weight to lift for a rep on each of the big three: 135 lb is a 45 lb plate on each side, 225 two, and so on.
const PLATE_GOALS: Record<string, number[]> = { Squat: [225, 315, 405], Bench: [135, 225, 315], Deadlift: [315, 405, 495] }

// The badges, a track at a time, each easiest first: workouts finished, plate milestones, pounds lifted, PRs, streaks.
const TRACKS: Badge[][] = [
  [1, 10, 25, 50, 100, 250].map((goal): Badge => ({
    id: `workouts-${goal}`,
    title: goal === 1 ? 'First workout' : `${goal} workouts`,
    description: goal === 1 ? 'Finish your first workout' : `Finish ${goal} workouts`,
    icon: 'dumbbell',
    unit: goal === 1 ? 'workout' : 'workouts',
    progress: (stats) => ({ value: stats.workouts, goal }),
  })),
  ...BIG_THREE.map((lift) =>
    PLATE_GOALS[lift.label].map((goal): Badge => ({
      id: `${lift.label.toLowerCase()}-${goal}`,
      title: `${goal} lb ${lift.label.toLowerCase()}`,
      description: `${lift.label} ${goal} lb for a rep or more`,
      icon: 'plates',
      unit: 'lb',
      progress: (stats) => ({ value: stats.heaviest.get(lift.id) ?? 0, goal }),
    })),
  ),
  [100_000, 500_000, 1_000_000].map((goal): Badge => ({
    id: `volume-${goal}`,
    title: `${formatWeight(goal)} lb lifted`,
    description: `Lift ${formatWeight(goal)} lb in all, weight × reps`,
    icon: 'bolt',
    unit: 'lb',
    // Whole pounds, so it never reads "187,450.5 of 500,000 lb".
    progress: (stats) => ({ value: Math.floor(stats.volume), goal }),
  })),
  [10, 50, 100].map((goal): Badge => ({
    id: `prs-${goal}`,
    title: `${goal} PRs`,
    description: `Set ${goal} personal records`,
    icon: 'trophy',
    unit: 'PRs',
    progress: (stats) => ({ value: stats.prs, goal }),
  })),
  [4, 12, 26, 52].map((goal): Badge => ({
    id: `streak-${goal}`,
    title: `${goal}-week streak`,
    description: `Train as many days a week as you plan, ${goal} weeks in a row`,
    icon: 'calendar',
    unit: 'weeks',
    progress: (stats) => ({ value: stats.longestStreak, goal }),
  })),
]

/** Every badge, in table order. */
export const BADGES = TRACKS.flat()

/** Days to train each week: as many as your plan has, or 2 with no plan. */
const weeklyGoal = (plan: PlanDay[]) => plan.length || 2

/** The Monday of `day`'s week: weeks run Monday to Sunday. */
const weekOf = (day: string) => addDays(day, -((weekday(day) + 6) % 7))

/**
 * Weeks in a row, Monday to Sunday, that you trained on enough days: as many as your plan has (any days), or 2 with no
 * plan. This week counts once it's met; until then the streak runs through last week, since this one isn't over.
 * ponytail: past weeks are judged by today's plan, as in plannedDays; keep plan history if changing plans should
 * rewrite less.
 */
export function weeklyStreak(workouts: Workout[], plan: PlanDay[], today: string): number {
  const daysByWeek = new Map<string, Set<string>>() // Monday → the days you trained that week
  for (const day of workouts.map(workoutDay)) {
    const monday = weekOf(day)
    daysByWeek.set(monday, (daysByWeek.get(monday) ?? new Set<string>()).add(day))
  }
  const met = (monday: string) => (daysByWeek.get(monday)?.size ?? 0) >= weeklyGoal(plan)

  let monday = weekOf(today)
  if (!met(monday)) monday = addDays(monday, -7)
  let weeks = 0
  for (; met(monday); monday = addDays(monday, -7)) weeks++
  return weeks
}

const NO_STATS: AchievementStats = { workouts: 0, volume: 0, prs: 0, heaviest: new Map(), longestStreak: 0 }

/**
 * Your stats after each workout, oldest first. Replaying your workouts is how a badge knows which one earned it, with
 * nothing stored. Weeks count as in weeklyStreak.
 */
function statsAfterEach(workouts: Workout[], plan: PlanDay[]): AchievementStats[] {
  const prs = personalRecords(workouts)
  const daysByWeek = new Map<string, Set<string>>() // Monday → the days you trained that week, so far
  const streaks = new Map<string, number>() // Monday → weeks in a row trained enough, through that week
  let stats = NO_STATS
  return [...workouts].sort(byStart).map((workout) => {
    const day = workoutDay(workout)
    const monday = weekOf(day)
    const days = (daysByWeek.get(monday) ?? new Set<string>()).add(day)
    daysByWeek.set(monday, days)
    // Workouts come oldest first, so last week's streak is final by the time this week is met.
    if (days.size === weeklyGoal(plan)) streaks.set(monday, (streaks.get(addDays(monday, -7)) ?? 0) + 1)

    const heaviest = new Map(stats.heaviest) // a copy: the stats before this workout must stay as they were
    for (const set of workout.sets) {
      if (isLift(set)) heaviest.set(set.exerciseId, Math.max(set.weight, heaviest.get(set.exerciseId) ?? 0))
    }
    stats = {
      workouts: stats.workouts + 1,
      volume: stats.volume + volume(workout),
      prs: stats.prs + (prs.get(workout.id)?.size ?? 0),
      heaviest,
      longestStreak: Math.max(stats.longestStreak, streaks.get(monday) ?? 0),
    }
    return stats
  })
}

/** Your stats over all of `workouts`. */
export const achievementStats = (workouts: Workout[], plan: PlanDay[]) => statsAfterEach(workouts, plan).at(-1) ?? NO_STATS

/** How far along a badge is: 0 to 1, or more once it's earned. */
export function progressShare(badge: Badge, stats: AchievementStats): number {
  const { value, goal } = badge.progress(stats)
  return value / goal
}

/** How far along a badge is, in words: "187,450 of 500,000 lb". */
export function progressText(badge: Badge, stats: AchievementStats): string {
  const { value, goal } = badge.progress(stats)
  return `${formatWeight(value)} of ${formatWeight(goal)} ${badge.unit}`
}

/** The badges `stats` have earned, in table order. */
export const earnedBadges = (stats: AchievementStats) => BADGES.filter((badge) => progressShare(badge, stats) >= 1)

/** The badges earned between `before` and `after`: what a workout earned, from your stats without it and with it. */
export const newlyEarned = (before: AchievementStats, after: AchievementStats) => earnedBadges(after).filter((badge) => progressShare(badge, before) < 1)

/** Your earned badges, newest first. */
export function badgesNewestFirst(workouts: Workout[], plan: PlanDay[]): Badge[] {
  const timeline = statsAfterEach(workouts, plan)
  return timeline.flatMap((stats, i) => newlyEarned(timeline[i - 1] ?? NO_STATS, stats)).reverse()
}

/** The unearned badges you're closest to, closest first: the next one on each track, so never two of a kind. */
export function nextUp(stats: AchievementStats, count = 3): Badge[] {
  return TRACKS.map((track) => track.find((badge) => progressShare(badge, stats) < 1))
    .filter((badge) => badge !== undefined)
    .sort((a, b) => progressShare(b, stats) - progressShare(a, stats))
    .slice(0, count)
}
