import { describe, expect, it } from 'vitest'
import type { PlanDay, Workout, WorkoutSet } from './api'
import { achievementStats, BADGES, badgesNewestFirst, earnedBadges, newlyEarned, nextUp, progressText, weeklyStreak, type AchievementStats, type Badge } from './achievements'

const BENCH = 1
const SQUAT = 14

const set = (exerciseId: number, weight: number, reps: number): WorkoutSet => ({ exerciseId, weight, reps })
// A workout at `hour` local time, so its day is the same in any time zone.
const trainedOn = (day: string, sets = [set(BENCH, 135, 8)], hour = 18): Workout => {
  const [y, m, d] = day.split('-').map(Number)
  return { id: `${day} ${hour}`, name: 'Workout', startedAt: new Date(y, m - 1, d, hour).toISOString(), finishedAt: new Date(y, m - 1, d, hour + 1).toISOString(), sets }
}
const onDays = (...days: string[]) => days.map((day) => trainedOn(day))
const planned = (dayOfWeek: number): PlanDay => ({ dayOfWeek, name: 'Workout', createdAt: new Date(2026, 8, 1).toISOString(), exercises: [] })
const mondayWednesdayFriday = [1, 3, 5].map(planned)

const titles = (badges: Badge[]) => badges.map((b) => b.title)
const stats = (totals: Partial<AchievementStats>): AchievementStats => ({ workouts: 0, volume: 0, prs: 0, heaviest: new Map(), longestStreak: 0, ...totals })

// Today is Wednesday, Oct 21, 2026, in the week of Monday, Oct 19.
it.each([
  { name: 'none without workouts', workouts: [], plan: [], weeks: 0 },
  { name: 'two days a week with no plan; this week, not met yet, doesn’t break it', workouts: onDays('2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15', '2026-10-19'), plan: [], weeks: 2 },
  { name: 'this week counts once it’s met', workouts: onDays('2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15', '2026-10-19', '2026-10-20'), plan: [], weeks: 3 },
  { name: 'a week short of the goal breaks it', workouts: onDays('2026-09-28', '2026-09-30', '2026-10-12', '2026-10-15', '2026-10-19', '2026-10-20'), plan: [], weeks: 2 },
  { name: 'weeks run Monday to Sunday', workouts: onDays('2026-10-11', '2026-10-12', '2026-10-17', '2026-10-18'), plan: [], weeks: 1 },
  { name: 'two workouts on one day are one day', workouts: [trainedOn('2026-10-19', undefined, 7), trainedOn('2026-10-19')], plan: [], weeks: 0 },
  { name: 'with a plan, as many days as it has, on any days', workouts: onDays('2026-10-12', '2026-10-13', '2026-10-14', '2026-10-19', '2026-10-20'), plan: mondayWednesdayFriday, weeks: 1 },
])('weeklyStreak: $name', ({ workouts, plan, weeks }) => {
  expect(weeklyStreak(workouts, plan, '2026-10-21')).toBe(weeks)
})

describe('badges', () => {
  // Nine workouts over four weeks, bench 135 × 8 each time, then a 225 single that makes the fourth week two days.
  const nine = onDays('2026-09-28', '2026-09-29', '2026-10-01', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-12', '2026-10-15', '2026-10-19')
  const tenth = trainedOn('2026-10-22', [set(BENCH, 225, 1)])
  const all = [tenth, ...[...nine].reverse()] // newest first, as the API sends them

  it('achievementStats adds up workouts, pounds lifted, PRs, heaviest lifts, and the longest weekly streak', () => {
    const { heaviest, ...totals } = achievementStats(all, [])
    expect(totals).toEqual({ workouts: 10, volume: 9 * 1080 + 225, prs: 1, longestStreak: 4 })
    expect([...heaviest]).toEqual([[BENCH, 225]])
    expect(achievementStats(all, mondayWednesdayFriday).longestStreak).toBe(2) // three days a week: the first two weeks
  })

  it('newlyEarned is what one workout earned: your stats without it and with it', () => {
    expect(titles(newlyEarned(achievementStats(nine, []), achievementStats(all, [])))).toEqual(['10 workouts', '225 lb bench', '4-week streak'])
  })

  it('badgesNewestFirst replays the workouts to order what each one earned', () => {
    expect(titles(badgesNewestFirst(all, []))).toEqual(['4-week streak', '225 lb bench', '10 workouts', '135 lb bench', 'First workout'])
  })

  it('a streak badge stays earned once the streak ends', () => {
    expect(weeklyStreak(all, [], '2026-11-09')).toBe(0)
    expect(titles(earnedBadges(achievementStats(all, [])))).toContain('4-week streak')
  })

  it('plate milestones go by the heaviest working set, never a warm-up', () => {
    const workout = trainedOn('2026-10-19', [{ ...set(BENCH, 315, 3), kind: 'warmup' }, set(BENCH, 225, 1), set(SQUAT, 225, 5)])
    expect(titles(earnedBadges(achievementStats([workout], [])).filter((b) => b.icon === 'plates'))).toEqual(['225 lb squat', '135 lb bench', '225 lb bench'])
  })
})

it.each([
  { name: 'a new account: each track’s first badge, in table order on a tie', totals: {}, next: ['First workout', '225 lb squat', '135 lb bench'] },
  { name: 'the closest first, never two of a kind', totals: { workouts: 9, prs: 9, volume: 80_000, heaviest: new Map([[BENCH, 205]]) }, next: ['225 lb bench', '10 workouts', '10 PRs'] },
])('nextUp: $name', ({ totals, next }) => {
  expect(titles(nextUp(stats(totals)))).toEqual(next)
})

it.each([
  { title: '500,000 lb lifted', totals: { volume: 187_450.5 }, text: '187,450 of 500,000 lb' },
  { title: '225 lb bench', totals: { heaviest: new Map([[BENCH, 137.5]]) }, text: '137.5 of 225 lb' },
  { title: 'First workout', totals: {}, text: '0 of 1 workout' },
  { title: '4-week streak', totals: { longestStreak: 2 }, text: '2 of 4 weeks' },
])('progressText: $title, $text', ({ title, totals, text }) => {
  expect(progressText(BADGES.find((b) => b.title === title)!, stats(totals))).toBe(text)
})
