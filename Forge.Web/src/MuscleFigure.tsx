import { coral, UNWORKED } from './colors'
import type { LiftInfo, Muscle } from './lifts'

// Two figures, front and back, each drawn around x = 50 from half a body (the viewer's left) and its mirror image, with
// the back one 62 to the right: together they fill the box 20 0 122 192. Every muscle is its own region, so each can
// be shaded: by a lift's muscles (LiftMuscles), or by its group's working sets a week (BodyMap).

type Shade = (muscle: Muscle) => string

/** The front figure, then the back one beside it. A thin card-colored outline parts the regions. */
export function MuscleFigure({ shade }: { shade: Shade }) {
  return (
    <>
      <Figure side="front" shade={shade} />
      <g transform="translate(62 0)">
        <Figure side="back" shade={shade} />
      </g>
    </>
  )
}

/** A lift's muscles on both figures: the ones it's for in full coral, the ones that help faintly. Decorative. */
export function LiftMuscles({ lift, className }: { lift: Pick<LiftInfo, 'primary' | 'secondary'>; className: string }) {
  const shade: Shade = (muscle) => (lift.primary.includes(muscle) ? coral(100) : lift.secondary.includes(muscle) ? coral(35) : UNWORKED)
  return (
    <svg viewBox="20 0 122 192" className={`shrink-0 ${className}`} aria-hidden>
      <MuscleFigure shade={shade} />
    </svg>
  )
}

/** One figure: the neck and head, then half a body and its mirror image. */
function Figure({ side, shade }: { side: 'front' | 'back'; shade: Shade }) {
  const half = <Half side={side} shade={shade} />
  return (
    <g strokeWidth={1.5} style={{ stroke: 'var(--surface)' }}>
      <rect x={45.5} y={20} width={9} height={13} rx={3} style={{ fill: UNWORKED }} />
      <ellipse cx={50} cy={13} rx={8.5} ry={10.5} style={{ fill: UNWORKED }} />
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
          {/* One pec, from the breastbone out under the shoulder. */}
          <path d="M50 33V55C45.5 58 40.5 57 38 53L37.5 39C40 34.5 44.5 33 50 33Z" style={{ fill: shade('chest') }} />
          {/* Half the abs, and the oblique beside them, narrowing to the waist. */}
          <path d="M50 58V92H45V58Z" style={{ fill: shade('abs') }} />
          <path d="M45 58H43C41 58 39.8 59.2 39.8 61L41 88C41.3 90.5 42.5 92 45 92Z" style={{ fill: shade('obliques') }} />
        </>
      ) : (
        <>
          {/* The back, from the neck down to the waist: the upper back (traps and rhomboids) down to the shoulder
              blades, the lat's wing below it, and the lower back over the spine. */}
          <path d="M50 29L43 31.5C39 33 38 36 38 40L38.2 47L50 55Z" style={{ fill: shade('upperBack') }} />
          <path d="M38.2 47L50 55V68L40.9 79C39.9 73.5 39 66.5 38.5 58Z" style={{ fill: shade('lats') }} />
          <path d="M50 68V93L44 91C43 88.5 41.9 84.5 40.9 79Z" style={{ fill: shade('lowerBack') }} />
        </>
      )}
      {/* The upper arm (biceps in front, triceps behind), then the forearm. */}
      <path d={limb([30, 46, 8.5], [29.5, 76, 6.5])} style={{ fill: shade(side === 'front' ? 'biceps' : 'triceps') }} />
      <path d={limb([28.5, 77.5, 7], [26.5, 104, 5])} style={{ fill: shade('forearms') }} />
      {/* The deltoid, capping the upper arm: its outer half is the side delt, its inner half the front or rear delt. */}
      <path d="M33.5 31A7.5 9 0 0 0 33.5 49Z" style={{ fill: shade('sideDelts') }} />
      <path d="M33.5 31A7.5 9 0 0 1 33.5 49Z" style={{ fill: shade(side === 'front' ? 'frontDelts' : 'rearDelts') }} />
      {/* The thigh (quads in front, hamstrings behind), then the lower leg: the calves, which show from the front too.
          From behind, the glute over the thigh. */}
      <path d={limb([43.5, 95, 12.5], [44.5, 143, 8.5])} style={{ fill: shade(side === 'front' ? 'quads' : 'hamstrings') }} />
      <path d={limb([44.5, 145.5, 8.5], [44.5, 184, 5])} style={{ fill: shade('calves') }} />
      {side === 'back' && <ellipse cx={44} cy={100} rx={6.5} ry={6.5} style={{ fill: shade('glutes') }} />}
      {/* The hand and foot. */}
      <ellipse cx={26.3} cy={108.5} rx={3.8} ry={5} style={{ fill: UNWORKED }} />
      <ellipse cx={44} cy={187.5} rx={5.5} ry={3} style={{ fill: UNWORKED }} />
    </>
  )
}

/** A limb from its top end down to its bottom end, each [x, y, width]: round at both ends, tapering between them. */
function limb([x1, y1, w1]: [number, number, number], [x2, y2, w2]: [number, number, number]) {
  const [r1, r2] = [w1 / 2, w2 / 2]
  return `M${x1 - r1} ${y1 + r1}A${r1} ${r1} 0 0 1 ${x1 + r1} ${y1 + r1}L${x2 + r2} ${y2 - r2}A${r2} ${r2} 0 0 1 ${x2 - r2} ${y2 - r2}Z`
}
