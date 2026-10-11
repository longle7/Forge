import { expect, it } from 'vitest'
import type { Habit } from './api'
import { completion, countOn, daysLabel, doneOn, habitStreak, scheduledOn, today } from './habits'

// Made Thursday, Oct 1, 2026. Water: 8 a day, every day. Gym-days stretch: Mon/Wed/Fri.
const water: Habit = {
  id: 'w',
  name: 'Water',
  emoji: '💧',
  dailyTarget: 8,
  days: 127,
  archived: false,
  createdAt: new Date(2026, 9, 1, 8).toISOString(),
  checks: [
    { date: '2026-10-06', count: 8 },
    { date: '2026-10-07', count: 8 },
    { date: '2026-10-08', count: 8 },
    { date: '2026-10-09', count: 5 }, // short of 8
    { date: '2026-10-10', count: 8 },
    { date: '2026-10-11', count: 8 },
  ],
}
const stretch: Habit = { ...water, id: 's', name: 'Stretch', dailyTarget: 1, days: 0b0101010, checks: [{ date: '2026-10-05', count: 1 }, { date: '2026-10-07', count: 1 }] }

it('counts and done-ness per day, against the daily target', () => {
  expect(countOn(water, '2026-10-09')).toBe(5)
  expect(doneOn(water, '2026-10-09')).toBe(false)
  expect(doneOn(water, '2026-10-10')).toBe(true)
  expect(countOn(water, '2026-10-12')).toBe(0)
})

it('is scheduled on its weekdays, from the day it was made', () => {
  expect(scheduledOn(stretch, '2026-10-05')).toBe(true) // Monday
  expect(scheduledOn(stretch, '2026-10-06')).toBe(false) // Tuesday
  expect(scheduledOn(water, '2026-09-30')).toBe(false) // before it existed
})

it('streaks count back from today, waiting on today, skipping unscheduled days', () => {
  expect(habitStreak(water, '2026-10-11')).toBe(2) // 10/10 and 10/11; 10/9 fell short
  expect(habitStreak(water, '2026-10-12')).toBe(2) // today not done yet: doesn't break it
  // Stretch: Wed 10/7 ✓, Fri 10/9 ✗ → on Sat the streak is 0; Mon 10/5 and Wed 10/7 count back from Thursday.
  expect(habitStreak(stretch, '2026-10-08')).toBe(2)
  expect(habitStreak(stretch, '2026-10-10')).toBe(0)
})

it('today lists active scheduled habits and how many are done', () => {
  expect(today([water, stretch, { ...water, id: 'old', archived: true }], '2026-10-12')).toMatchObject({ due: [water, stretch], done: 0 })
  expect(today([water, stretch], '2026-10-11').done).toBe(1) // Sunday: only water is due, and it's done
})

it('completion is done of scheduled days in a range', () => {
  expect(completion(water, '2026-10-06', '2026-10-11')).toEqual({ done: 5, scheduled: 6 })
  expect(completion(water, '2026-10-06', '2026-10-12')).toEqual({ done: 5, scheduled: 6 }) // today, not done yet, left out
})

it('daysLabel names the schedule', () => {
  expect(daysLabel(127)).toBe('Every day')
  expect(daysLabel(0b0111110)).toBe('Weekdays')
  expect(daysLabel(0b0101010)).toBe('Mon, Wed, Fri')
})
