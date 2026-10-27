import { coral, UNWORKED } from './colors'
import { MUSCLE_GROUP } from './lifts'
import { MuscleFigure } from './MuscleFigure'

// Every muscle on the figures is shaded by its group's working sets a week against the 10–20 guide.

/** The shades, by the fewest sets a week each starts at. */
const LEVELS = [
  { label: 'None', from: 0, color: UNWORKED },
  { label: 'Under 10', from: 1, color: coral(55) },
  { label: '10–20', from: 10, color: coral(75) },
  { label: 'Over 20', from: 21, color: coral(100) },
]

/** Front and back figures shaded by each muscle group's working sets a week, with a key to the shades. */
export function BodyMap({ groups }: { groups: { group: string; weeklySets: number }[] }) {
  const weekly = new Map(groups.map((g) => [g.group, g.weeklySets]))
  const shade = (group: string) => LEVELS.findLast((level) => (weekly.get(group) ?? 0) >= level.from)!.color
  const label = `Working sets a week: ${groups.map((g) => `${g.group} ${g.weeklySets}`).join(', ')}`
  return (
    <>
      <div className="mt-3 flex items-center gap-5">
        <svg viewBox="20 0 122 202" className="w-36 shrink-0" role="img" aria-label={label}>
          <MuscleFigure shade={(muscle) => shade(MUSCLE_GROUP[muscle])} />
          <text x={50} y={200} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)' }}>
            Front
          </text>
          <text x={112} y={200} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)' }}>
            Back
          </text>
        </svg>
        <div className="space-y-1.5 text-[13px] text-muted">
          <p className="font-semibold text-ink">Sets a week</p>
          {LEVELS.map((level) => (
            <p key={level.label} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: level.color }} />
              {level.label}
            </p>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">Most lifters aim for 10 to 20 working sets a week for each muscle group.</p>
    </>
  )
}
