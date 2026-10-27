import type { Exercise } from './api'
import { liftInfo, type Equipment, type Pose } from './lifts'
import { LiftMuscles } from './MuscleFigure'
import { POSES, type Figure, type Pair, type Point } from './poses'

// A lift as a line drawing in the style of icons.tsx: a stick figure in its pose (poses.ts), holding the lift's
// equipment, in round strokes of the current text color.

/** How faint a far limb is. */
const FAR = 0.45

/** A lift's pose, holding its equipment. Decorative: the lift's name is always next to it. */
export function LiftFigure({ pose, equipment, className }: { pose: Pose; equipment: Equipment; className: string }) {
  const figure = POSES[pose]
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {figure.support && <path d={figure.support} strokeWidth={2} />}
      <Body figure={figure} />
      <Gear figure={figure} equipment={equipment} />
    </svg>
  )
}

/** A lift's figure and, beside it, the muscles it works: for lists and headers, next to the lift's name. */
export function LiftIcon({ exercise }: { exercise: Pick<Exercise, 'name' | 'muscleGroup'> }) {
  const lift = liftInfo(exercise)
  return (
    <span className="flex shrink-0 items-center gap-1">
      <LiftFigure pose={lift.pose} equipment={lift.equipment} className="size-10" />
      <LiftMuscles lift={lift} className="h-10" />
    </span>
  )
}

/** The far limbs, faintly, then the spine, the near limbs, and the head. */
function Body({ figure: { head, neck, hips, elbows, hands, knees, feet, toes, front } }: { figure: Figure }) {
  const limbs = (side: 0 | 1) => `M${neck}L${elbows[side]}L${hands[side]}M${hips}L${knees[side]}L${feet[side]}${toes ? `L${toes[side]}` : ''}`
  return (
    <g strokeWidth={3}>
      <path d={limbs(1)} opacity={front ? 1 : FAR} />
      <path d={`M${neck}L${hips}`} />
      <path d={limbs(0)} />
      <circle cx={head[0]} cy={head[1]} r={3.6} fill="currentColor" stroke="none" />
    </g>
  )
}

/** The equipment, at the hands. */
function Gear({ figure, equipment }: { figure: Figure; equipment: Equipment }) {
  const { hands, elbows, front } = figure
  switch (equipment) {
    case 'barbell':
      return front ? <BarAcross hands={hands} /> : <Plate at={hands[0]} />
    case 'dumbbell':
      return hands.map((hand, i) => <Dumbbell key={i} hand={hand} elbow={elbows[i]} opacity={front || i === 0 ? 1 : FAR} />)
    case 'kettlebell':
      return <Kettlebell hand={hands[0]} />
    case 'cable':
      return (figure.pulleys ?? [[hands[0][0], 2]]).map((pulley, i) => <Cable key={i} from={hands[i]} to={pulley} />)
    case 'machine':
      return figure.machine ? <path d={figure.machine} strokeWidth={2} /> : null
    case 'bodyweight':
      return null
  }
}

/** A barbell seen end on, from the side: a plate on the bar. */
function Plate({ at: [x, y] }: { at: Point }) {
  return (
    <>
      <circle cx={x} cy={y} r={4.75} strokeWidth={2.5} />
      <circle cx={x} cy={y} r={1} fill="currentColor" stroke="none" />
    </>
  )
}

/** A barbell facing you: the bar through both hands, a plate at each end. */
function BarAcross({ hands: [[left], [right, y]] }: { hands: Pair }) {
  const [start, end] = [left - 7, right + 7]
  return (
    <>
      <path d={`M${start} ${y}H${end}`} strokeWidth={2} />
      <path d={`M${start + 1.5} ${y - 4.5}v9M${end - 1.5} ${y - 4.5}v9`} strokeWidth={3} />
    </>
  )
}

/** A dumbbell across the hand, square to the forearm: the handle, and a head at each end. */
function Dumbbell({ hand: [x, y], elbow: [ex, ey], opacity }: { hand: Point; elbow: Point; opacity: number }) {
  const length = Math.hypot(x - ex, y - ey)
  const [ax, ay] = [(x - ex) / length, (y - ey) / length] // along the forearm
  const [hx, hy] = [-ay * 3.5, ax * 3.5] // half the handle, across it
  const head = (sign: number) => `M${x + sign * hx - ax * 2} ${y + sign * hy - ay * 2}l${ax * 4} ${ay * 4}`
  return (
    <g opacity={opacity}>
      <path d={`M${x - hx} ${y - hy}L${x + hx} ${y + hy}`} strokeWidth={1.5} />
      <path d={`${head(1)}${head(-1)}`} strokeWidth={3} />
    </g>
  )
}

/** A kettlebell hanging from the hand: the handle, and the bell under it. */
function Kettlebell({ hand: [x, y] }: { hand: Point }) {
  return (
    <>
      <path d={`M${x - 2} ${y + 2.5}V${y + 1}A2 2 0 0 1 ${x + 2} ${y + 1}V${y + 2.5}`} strokeWidth={1.5} />
      <circle cx={x} cy={y + 5.5} r={3.4} fill="currentColor" stroke="none" />
    </>
  )
}

/** A cable from the hand to its pulley. */
function Cable({ from: [x1, y1], to: [x2, y2] }: { from: Point; to: Point }) {
  return (
    <>
      <path d={`M${x1} ${y1}L${x2} ${y2}`} strokeWidth={1.25} />
      <circle cx={x2} cy={y2} r={1.6} strokeWidth={1.25} />
    </>
  )
}
