// Two figures, front and back, each drawn around x = 50 from half a body (the viewer's left) and its mirror image.
// Every region is shaded by its muscle group's working sets a week against the 10–20 guide.

/** Not a muscle group (head, hands, feet), or one with no sets. */
const NEUTRAL = 'var(--fill)'

/**
 * Coral, faint to full, mixed with the card color. It's the ink shade, deep in light mode and light in dark mode, so
 * the strongest step stands out most from the card in both.
 */
const coral = (percent: number) => `color-mix(in oklab, var(--coral-ink) ${percent}%, var(--surface))`

/** The shades, by the fewest sets a week each starts at. */
const LEVELS = [
  { label: 'None', from: 0, color: NEUTRAL },
  { label: 'Under 10', from: 1, color: coral(55) },
  { label: '10–20', from: 10, color: coral(75) },
  { label: 'Over 20', from: 21, color: coral(100) },
]

type Shade = (group: string) => string

/** Front and back figures shaded by each muscle group's working sets a week, with a key to the shades. */
export function BodyMap({ groups }: { groups: { group: string; weeklySets: number }[] }) {
  const weekly = new Map(groups.map((g) => [g.group, g.weeklySets]))
  const shade: Shade = (group) => LEVELS.findLast((level) => (weekly.get(group) ?? 0) >= level.from)!.color
  const label = `Working sets a week: ${groups.map((g) => `${g.group} ${g.weeklySets}`).join(', ')}`
  return (
    <>
      <div className="mt-3 flex items-center gap-5">
        <svg viewBox="20 0 122 202" className="w-36 shrink-0" role="img" aria-label={label}>
          <Figure side="front" shade={shade} />
          <g transform="translate(62 0)">
            <Figure side="back" shade={shade} />
          </g>
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

/** One figure: the neck and head, then half a body and its mirror image. A thin card-colored outline parts regions. */
function Figure({ side, shade }: { side: 'front' | 'back'; shade: Shade }) {
  const half = <Half side={side} shade={shade} />
  return (
    <g strokeWidth={1.5} style={{ stroke: 'var(--surface)' }}>
      <rect x={45.5} y={20} width={9} height={13} rx={3} style={{ fill: NEUTRAL }} />
      <ellipse cx={50} cy={13} rx={8.5} ry={10.5} style={{ fill: NEUTRAL }} />
      {half}
      <g transform="matrix(-1 0 0 1 100 0)">{half}</g>
    </g>
  )
}

/** Half a figure, the viewer's left. */
function Half({ side, shade }: { side: 'front' | 'back'; shade: Shade }) {
  return (
    <>
      {side === 'front' ? (
        <>
          {/* Chest: one pec, from the breastbone out under the shoulder. */}
          <path d="M50 33V55C45.5 58 40.5 57 38 53L37.5 39C40 34.5 44.5 33 50 33Z" style={{ fill: shade('Chest') }} />
          {/* Core: half the abs, narrowing to the waist. */}
          <path d="M50 58V92H45C42.5 92 41.3 90.5 41 88L39.8 61C39.8 59.2 41 58 43 58Z" style={{ fill: shade('Core') }} />
        </>
      ) : (
        // Back: traps, lats, and lower back in one piece, from the neck down to the waist.
        <path d="M50 29L43 31.5C39 33 38 36 38 40L38.5 58C39.5 75 42 86 44 91L50 93Z" style={{ fill: shade('Back') }} />
      )}
      {/* Arms: the upper arm (biceps in front, triceps behind), then the forearm. */}
      <path d={limb([30, 46, 8.5], [29.5, 76, 6.5])} style={{ fill: shade('Arms') }} />
      <path d={limb([28.5, 77.5, 7], [26.5, 104, 5])} style={{ fill: shade('Arms') }} />
      {/* Shoulders: the deltoid, capping the upper arm. */}
      <ellipse cx={33.5} cy={40} rx={7.5} ry={9} style={{ fill: shade('Shoulders') }} />
      {/* Legs: the thigh (quads in front, hamstrings behind) and the calf; from behind, the glute over the thigh. */}
      <path d={limb([43.5, 95, 12.5], [44.5, 143, 8.5])} style={{ fill: shade('Legs') }} />
      <path d={limb([44.5, 145.5, 8.5], [44.5, 184, 5])} style={{ fill: shade('Legs') }} />
      {side === 'back' && <ellipse cx={44} cy={100} rx={6.5} ry={6.5} style={{ fill: shade('Legs') }} />}
      {/* The hand and foot. */}
      <ellipse cx={26.3} cy={108.5} rx={3.8} ry={5} style={{ fill: NEUTRAL }} />
      <ellipse cx={44} cy={187.5} rx={5.5} ry={3} style={{ fill: NEUTRAL }} />
    </>
  )
}

/** A limb from its top end down to its bottom end, each [x, y, width]: round at both ends, tapering between them. */
function limb([x1, y1, w1]: [number, number, number], [x2, y2, w2]: [number, number, number]) {
  const [r1, r2] = [w1 / 2, w2 / 2]
  return `M${x1 - r1} ${y1 + r1}A${r1} ${r1} 0 0 1 ${x1 + r1} ${y1 + r1}L${x2 + r2} ${y2 - r2}A${r2} ${r2} 0 0 1 ${x2 - r2} ${y2 - r2}Z`
}
