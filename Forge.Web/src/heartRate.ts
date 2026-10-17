import type { HeartRatePoint } from './api'
import { RING } from './colors'

/** Max heart rate by the usual 220 − age estimate, at your age in `year` (the workout's). */
export const maxHeartRate = (birthYear: number, year: number) => 220 - (year - birthYear)

/** One hue, faint to full, so a higher zone reads hotter; mixed with the card color, it works in light and dark mode. */
const tint = (percent: number) => `color-mix(in oklab, ${RING.move} ${percent}%, var(--surface))`

/** The five zones, by where each starts as a share of max; each runs up to the next, and Z5 has no top. */
export const ZONES = [
  { name: 'Z1', label: 'Warm-up', from: 0.5, color: tint(50) },
  { name: 'Z2', label: 'Easy', from: 0.6, color: tint(62) },
  { name: 'Z3', label: 'Aerobic', from: 0.7, color: tint(75) },
  { name: 'Z4', label: 'Threshold', from: 0.8, color: tint(88) },
  { name: 'Z5', label: 'Max', from: 0.9, color: tint(100) },
]

/** The bpm where each zone starts, rounded to whole beats as a watch shows them: max 187 → [94, 112, 131, 150, 168]. */
export const zoneFloors = (max: number) => ZONES.map((zone) => Math.round(zone.from * max))

/**
 * Seconds in each zone. A reading lasts until the next one (the last for 30 s, the Watch's step); readings under Z1
 * count in no zone.
 */
export function timeInZones(points: HeartRatePoint[], max: number): number[] {
  const floors = zoneFloors(max)
  const seconds = ZONES.map(() => 0)
  points.forEach((p, i) => {
    const zone = floors.findLastIndex((floor) => p.bpm >= floor)
    if (zone >= 0) seconds[zone] += (points[i + 1]?.s ?? p.s + 30) - p.s
  })
  return seconds
}
