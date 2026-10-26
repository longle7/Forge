import type { SetKind } from './api'
import { PrBadge } from './components'
import { Icon } from './icons'
import { SET_KINDS } from './workouts'

// The logger's menus are the phone's own picker under an invisible <select>, like the rest-length chip: a tap anywhere
// on the label or button opens it, and VoiceOver reads the select's name and what's chosen.

/**
 * A set's label (W, D, F, or its number; the PR badge for a PR) over a menu: Normal, Warm-up, Drop set, Failure, or
 * Delete set. Cardio sets have no kinds, so only Delete. `name` is what screen readers call the set ("Set 2", "Warm-up").
 */
export function SetMenu({ label, name, kind, pr, cardio, onKind, onDelete }: {
  label: string
  name: string
  kind: SetKind | undefined
  pr: boolean
  cardio: boolean
  onKind: (kind: SetKind | undefined) => void
  onDelete: () => void
}) {
  const choose = (value: string) => (value === 'delete' ? onDelete() : onKind(value === 'normal' ? undefined : (value as SetKind)))
  return (
    <label className="relative grid min-h-11 place-items-center rounded-lg font-semibold focus-within:ring-2 focus-within:ring-coral">
      {pr ? <PrBadge /> : <span className={kind ? 'text-coral-ink' : ''}>{label}</span>}
      <select value={kind ?? 'normal'} onChange={(event) => choose(event.target.value)} aria-label={name} className="absolute inset-0 opacity-0">
        {cardio ? (
          <option value="normal" disabled>
            {name}
          </option>
        ) : (
          <>
            <option value="normal">Normal</option>
            {Object.entries(SET_KINDS).map(([value, { name: kindName }]) => (
              <option key={value} value={value}>
                {kindName}
              </option>
            ))}
          </>
        )}
        <option value="delete">Delete set</option>
      </select>
    </label>
  )
}

export type ExerciseAction = 'up' | 'down' | 'replace' | 'superset' | 'leave' | 'remove'

/** The ⋯ button on an exercise: move it, replace it, put it in a superset with the next one or take it out, or remove it. */
export function ExerciseMenu({ name, canMoveUp, canMoveDown, canSupersetWithNext, inSuperset, onChoose }: {
  name: string
  canMoveUp: boolean
  canMoveDown: boolean
  canSupersetWithNext: boolean // there's a next exercise, and it isn't in this one's superset already
  inSuperset: boolean
  onChoose: (action: ExerciseAction) => void
}) {
  return (
    <label className="relative -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-coral-ink focus-within:ring-2 focus-within:ring-coral">
      <Icon name="more" className="size-6 stroke-[3]" />
      {/* Always showing the disabled first option, so choosing the same action twice still counts as a change. */}
      <select value="" onChange={(event) => onChoose(event.target.value as ExerciseAction)} aria-label={`${name} options`} className="absolute inset-0 opacity-0">
        <option value="" disabled>
          {name}
        </option>
        {canMoveUp && <option value="up">Move up</option>}
        {canMoveDown && <option value="down">Move down</option>}
        <option value="replace">Replace</option>
        {canSupersetWithNext && <option value="superset">Superset with next</option>}
        {inSuperset && <option value="leave">Leave superset</option>}
        <option value="remove">Remove</option>
      </select>
    </label>
  )
}
