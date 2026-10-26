import { expect, it } from 'vitest'
import { monthStart } from './dates'

it.each([
  { day: '2026-10-24', months: 0, start: '2026-10-01' },
  { day: '2026-10-31', months: 1, start: '2026-11-01' }, // into a shorter month
  { day: '2026-01-15', months: -1, start: '2025-12-01' }, // back across the new year
  { day: '2026-12-01', months: 1, start: '2027-01-01' },
])('monthStart($day, $months) is $start', ({ day, months, start }) => {
  expect(monthStart(day, months)).toBe(start)
})
