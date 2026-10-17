import { expect, it } from 'vitest'
import { maxHeartRate, timeInZones, zoneFloors } from './heartRate'

it('maxHeartRate is 220 minus your age that year', () => {
  expect(maxHeartRate(1994, 2026)).toBe(188)
  expect(maxHeartRate(1994, 2027)).toBe(187)
})

it.each([
  { max: 188, floors: [94, 113, 132, 150, 169] }, // 112.8 rounds up, 150.4 down
  { max: 187, floors: [94, 112, 131, 150, 168] }, // 93.5 rounds up
  { max: 200, floors: [100, 120, 140, 160, 180] },
])('zoneFloors($max) rounds to whole beats', ({ max, floors }) => {
  expect(zoneFloors(max)).toEqual(floors)
})

// Max 188: Z1 94–112, Z2 113–131, Z3 132–149, Z4 150–168, Z5 169 and up.
it.each([
  { name: 'nothing', points: [], seconds: [0, 0, 0, 0, 0] },
  { name: 'only readings under Z1', points: [{ s: 0, bpm: 80 }, { s: 30, bpm: 93 }], seconds: [0, 0, 0, 0, 0] },
  { name: 'one reading, counted for 30 s', points: [{ s: 0, bpm: 94 }], seconds: [30, 0, 0, 0, 0] },
  { name: 'each zone floor starts that zone', points: [{ s: 0, bpm: 112 }, { s: 30, bpm: 113 }, { s: 60, bpm: 131 }, { s: 90, bpm: 132 }, { s: 120, bpm: 150 }, { s: 150, bpm: 169 }], seconds: [30, 60, 30, 30, 30] },
  { name: 'a reading lasts until the next one', points: [{ s: 0, bpm: 90 }, { s: 30, bpm: 140 }, { s: 90, bpm: 175 }, { s: 150, bpm: 200 }], seconds: [0, 0, 60, 0, 90] },
])('timeInZones: $name', ({ points, seconds }) => {
  expect(timeInZones(points, 188)).toEqual(seconds)
})
