import type { Exercise } from './api'
import { readJson, write } from './cache'
import { EQUIPMENT_LABELS, liftInfo, type Equipment, type LiftInfo } from './lifts'

// The equipment you have, so the exercise picker can hide lifts you can't do and swaps suggest ones you can. Bodyweight
// lifts need none, so they're always available.

export const FULL_GYM = Object.keys(EQUIPMENT_LABELS) as Equipment[]
/** A bench counts as part of dumbbells: the dumbbell bench press and row need one. */
export const HOME_DUMBBELLS: Equipment[] = ['dumbbell', 'bodyweight']
export const BODYWEIGHT: Equipment[] = ['bodyweight']

// ponytail: kept on this phone only, so another phone starts with a full gym; move it to Profile if that matters.
export const EQUIPMENT_KEY = 'forge.equipment'

/** Your equipment, as you last set it in Settings; a full gym until then. */
export const loadEquipment = () => readJson<Equipment[]>(EQUIPMENT_KEY) ?? FULL_GYM

export const saveEquipment = (equipment: Equipment[]) => write(EQUIPMENT_KEY, JSON.stringify(equipment))

/** Whether two lists have the same equipment, in any order. */
export const sameEquipment = (a: Equipment[], b: Equipment[]) => a.length === b.length && a.every((item) => b.includes(item))

/** Whether you can do a lift with your equipment. */
export function available(exercise: Pick<Exercise, 'name' | 'muscleGroup'>, equipment: Equipment[]): boolean {
  const needs = liftInfo(exercise).equipment
  return needs === 'bodyweight' || equipment.includes(needs)
}

/**
 * Lifts to do instead of `exercise`, from `exercises`: the same movement for at least one of the same main muscles,
 * with your equipment. Different equipment comes first, since that's usually why you swap, then the closest match.
 * Cardio has no swaps.
 */
export function swapsFor(exercise: Exercise, exercises: Exercise[], equipment: Equipment[]): Exercise[] {
  const lift = liftInfo(exercise)
  if (lift.pattern === 'cardio') return []
  const shared = (other: LiftInfo) => other.primary.filter((muscle) => lift.primary.includes(muscle)).length
  const sameGear = (other: LiftInfo) => Number(other.equipment === lift.equipment) // 0 sorts first
  return exercises
    .filter((other) => other.id !== exercise.id && available(other, equipment))
    .map((other) => ({ other, info: liftInfo(other) }))
    .filter(({ info }) => info.pattern === lift.pattern && shared(info) > 0)
    .sort((a, b) => sameGear(a.info) - sameGear(b.info) || shared(b.info) - shared(a.info))
    .map(({ other }) => other)
}
