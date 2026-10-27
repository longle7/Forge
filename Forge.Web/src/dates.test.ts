import { expect, it } from 'vitest'
import { localTime, monthStart, parseDateTime } from './dates'

it.each([
  { day: '2026-10-24', months: 0, start: '2026-10-01' },
  { day: '2026-10-31', months: 1, start: '2026-11-01' }, // into a shorter month
  { day: '2026-01-15', months: -1, start: '2025-12-01' }, // back across the new year
  { day: '2026-12-01', months: 1, start: '2027-01-01' },
])('monthStart($day, $months) is $start', ({ day, months, start }) => {
  expect(monthStart(day, months)).toBe(start)
})

it('localTime and parseDateTime write and read a time field in local time', () => {
  const morning = new Date(2026, 9, 24, 7, 5)
  expect(localTime(morning)).toBe('07:05')
  expect(parseDateTime('2026-10-24', '07:05')).toEqual(morning)
  expect(parseDateTime('2026-10-24', '').getTime()).toBeNaN()
})
