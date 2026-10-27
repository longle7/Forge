import type { Pose } from './lifts'

// Each lift's pose for LiftFigure.tsx: a stick figure's joints in a 48 × 48 box. Side views face right, with the floor
// at y = 45. Lifts share a pose with their variants (lifts.ts).

export type Point = [number, number]
/** A pair of joints: [near, far] in a side view, where the far limb is drawn faintly behind; [left, right] facing you. */
export type Pair = [Point, Point]
/** The same joint for both sides, as in a side view where one limb hides the other. */
const both = (point: Point): Pair => [point, point]

export interface Figure {
  head: Point
  neck: Point // the top of the spine, where the arms join
  hips: Point
  elbows: Pair
  hands: Pair
  knees: Pair
  feet: Pair
  toes?: Pair // on tiptoe: the feet run on from the ankles (feet) down to the toes
  front?: boolean // facing you: both sides drawn alike, and a barbell runs across between the hands
  support?: string // a path: the bench, bar, seat or floor the pose always has
  machine?: string // a path: what a machine lift adds, like a pad or a frame
  pulleys?: Point[] // where the cable from each hand runs; straight up from the first hand when not given
}

export const POSES: Record<Pose, Figure> = {
  // Lying on a bench, arms locked out over the chest.
  bench: {
    head: [7.5, 31.5], neck: [12, 33.5], hips: [26, 33.5],
    elbows: both([12.5, 26]), hands: both([13, 19]), knees: both([34.5, 34]), feet: both([36, 45]),
    support: 'M4 37H32M8 37V45M28 37V45',
    machine: 'M3 45V12H13',
  },
  // Facing you, the bar locked out overhead.
  overheadPress: {
    front: true, head: [24, 12], neck: [24, 17.5], hips: [24, 30],
    elbows: [[17, 12.5], [31, 12.5]], hands: [[15, 5.5], [33, 5.5]], knees: [[21, 37.5], [27, 37.5]], feet: [[20, 45], [28, 45]],
    machine: 'M6 45V5.5H15M42 45V5.5H33',
  },
  // At the bottom, thighs level, the bar on the upper back.
  squat: {
    head: [30.5, 19], neck: [27.5, 23.5], hips: [20.5, 35],
    elbows: both([20, 28]), hands: both([22.5, 23]), knees: both([30.5, 35.5]), feet: both([28.5, 45]),
    machine: 'M17.5 33L24.5 21.5',
  },
  // Deadlifts, Romanian deadlifts and swings: hips back, flat back, arms hanging.
  hinge: {
    head: [33.5, 19], neck: [29.5, 22.5], hips: [19, 30],
    elbows: both([30.5, 30]), hands: both([31, 37.5]), knees: both([24.5, 37]), feet: both([23, 45]),
  },
  // Bent over, pulling the weight to the waist.
  row: {
    head: [36, 23], neck: [31, 25], hips: [18, 29],
    elbows: both([25, 20.5]), hands: both([26.5, 28]), knees: both([25, 37]), feet: both([23, 45]),
  },
  // Standing tall, elbows high, hands at the face: face pulls and upright rows.
  highPull: {
    head: [25, 8.5], neck: [24, 14.5], hips: [23.5, 27.5],
    elbows: both([28, 12.5]), hands: both([32.5, 17]), knees: [[25, 36.5], [22.5, 36.5]], feet: [[25.5, 45], [21.5, 45]],
    pulleys: [[45, 15]],
  },
  // Hanging under a bar, body straight from the heels.
  invertedRow: {
    head: [9.5, 24.5], neck: [14, 27], hips: [25.5, 33.5],
    elbows: both([15, 20.5]), hands: both([16, 14]), knees: both([33.5, 38.5]), feet: both([41, 44.5]),
    support: 'M8 14H26',
  },
  // Facing you, hanging from the bar, chin up to it.
  pullUp: {
    front: true, head: [24, 11.5], neck: [24, 17], hips: [24, 30],
    elbows: [[14.5, 14.5], [33.5, 14.5]], hands: [[13, 6], [35, 6]], knees: [[22, 37.5], [26, 37.5]], feet: [[20.5, 44], [27.5, 44]],
    support: 'M4 6H44',
  },
  // Seated under a knee pad, reaching up to the bar.
  pulldown: {
    head: [18, 15.5], neck: [19, 21], hips: [20, 34.5],
    elbows: both([22.5, 14]), hands: both([23, 6.5]), knees: both([29.5, 34]), feet: both([30.5, 45]),
    support: 'M13 38H27M20 38V45M26 30H33',
    pulleys: [[23, 2]],
  },
  // Standing, arms pushing down in front: pushdowns, straight-arm pulldowns and woodchops, from a high pulley.
  pushdown: {
    head: [27, 9], neck: [25.5, 14.5], hips: [23, 27.5],
    elbows: both([24.5, 22.5]), hands: both([30, 27.5]), knees: [[24.5, 36.5], [22, 36.5]], feet: [[24.5, 45], [20.5, 45]],
    pulleys: [[34, 2]],
  },
  // Standing, elbows at the sides, halfway up.
  curl: {
    head: [24.5, 8.5], neck: [24, 14.5], hips: [24, 27.5],
    elbows: both([23.5, 22.5]), hands: both([30, 18]), knees: [[24.5, 36.5], [23, 36.5]], feet: [[25, 45], [22, 45]],
    pulleys: [[42, 45]],
  },
  // Standing, elbows up by the head, the weight lowered behind it.
  tricepsExtension: {
    head: [22.5, 11.5], neck: [24, 16.5], hips: [24, 28.5],
    elbows: both([28.5, 9.5]), hands: both([22, 4.5]), knees: [[24.5, 37], [23, 37]], feet: [[25, 45], [22, 45]],
    pulleys: [[4, 34]],
  },
  // Facing you, arms out to the sides at shoulder height.
  lateralRaise: {
    front: true, head: [24, 11.5], neck: [24, 17], hips: [24, 29.5],
    elbows: [[16, 18], [32, 18]], hands: [[8.5, 19], [39.5, 19]], knees: [[21, 37.5], [27, 37.5]], feet: [[20, 45], [28, 45]],
    pulleys: [[6, 45], [42, 45]],
  },
  // Facing you, arms rounded as if hugging a tree, hands meeting in front.
  fly: {
    front: true, head: [24, 11.5], neck: [24, 17], hips: [24, 29.5],
    elbows: [[15.5, 22.5], [32.5, 22.5]], hands: [[21.5, 26.5], [26.5, 26.5]], knees: [[21, 37.5], [27, 37.5]], feet: [[20, 45], [28, 45]],
    machine: 'M9 45V14H15.5M39 45V14H32.5',
    pulleys: [[3, 3], [45, 3]],
  },
  // A long step, the back knee toward the floor.
  lunge: {
    head: [22, 14.5], neck: [21.5, 20], hips: [21, 33],
    elbows: both([21.5, 27]), hands: both([22, 34]), knees: [[30, 34], [16.5, 41.5]], feet: [[30.5, 45], [8.5, 44.5]],
  },
  // Leaning back in the seat, pushing the platform away.
  legPress: {
    head: [5.5, 22], neck: [8, 27], hips: [16, 37.5],
    elbows: both([11, 33.5]), hands: both([17, 34.5]), knees: both([23, 29]), feet: both([32, 22]),
    support: 'M3 27L13 41H23M29 17.5L35.5 26.5',
  },
  // Lying face down on the bench, curling the heels up under the pad.
  legCurl: {
    head: [9, 28.5], neck: [13.5, 31], hips: [26.5, 31],
    elbows: both([8.5, 36.5]), hands: both([8, 43.5]), knees: both([35, 31]), feet: both([33.5, 22]),
    support: 'M10 34.5H38M14 34.5V45M34 34.5V45M31 19.5H36',
  },
  // Seated, straightening the legs against the pad.
  legExtension: {
    head: [12, 15.5], neck: [12.5, 21], hips: [15, 34],
    elbows: both([13.5, 28]), hands: both([18, 33]), knees: both([25, 34]), feet: both([34.5, 30]),
    support: 'M12 37H27M10 22L13 37M20 37V45M33 33L35 37',
  },
  // Facing you, seated, pushing the knees apart against the pads.
  hipAbduction: {
    front: true, head: [24, 13], neck: [24, 18.5], hips: [24, 31],
    elbows: [[18.5, 24.5], [29.5, 24.5]], hands: [[17, 31], [31, 31]], knees: [[13, 33], [35, 33]], feet: [[15, 44], [33, 44]],
    support: 'M10 29V37M38 29V37M24 34V45',
  },
  // Up on the toes on a step, under the shoulder pad.
  calfRaise: {
    head: [24.5, 8.5], neck: [24, 14], hips: [24, 26.5],
    elbows: both([20.5, 18.5]), hands: both([21, 13]), knees: both([24.5, 34.5]), feet: both([24.5, 40]), toes: both([28, 43.5]),
    support: 'M17 13H29M17 13V45M26 45.5H38',
  },
  // On the back, knees up, shoulders curling off the floor.
  crunch: {
    head: [8, 31], neck: [11.5, 36], hips: [22, 43],
    elbows: both([15, 31]), hands: both([9, 28.5]), knees: both([31, 34]), feet: both([36.5, 44.5]),
    support: 'M3 46.5H45',
    pulleys: [[9, 2]],
  },
  // Kneeling, rolled out with the arms straight to the wheel.
  rollout: {
    head: [34.5, 30], neck: [30.5, 33], hips: [18, 36],
    elbows: both([37, 36]), hands: both([42, 40]), knees: both([13, 43.5]), feet: both([5, 44.5]),
    support: 'M39 42a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3 46.5H45',
  },
  // Hanging from the bar, legs raised level.
  legRaise: {
    head: [23.5, 13], neck: [19.5, 17.5], hips: [19.5, 30.5],
    elbows: both([18.5, 10.5]), hands: both([18.5, 4]), knees: both([28.5, 30.5]), feet: both([37.5, 30.5]),
    support: 'M11 4H27',
  },
  // A straight plank on the hands.
  pushUp: {
    head: [40, 30], neck: [35, 32], hips: [23, 37],
    elbows: both([35, 38]), hands: both([35, 44.5]), knees: both([14.5, 40.5]), feet: both([6, 44]),
    support: 'M3 46.5H45',
  },
  // Between the bars, elbows bent back, knees bent behind.
  dip: {
    head: [27, 9.5], neck: [25, 15], hips: [23, 28],
    elbows: both([19.5, 19.5]), hands: both([24, 24]), knees: both([25, 36.5]), feet: both([18, 40.5]),
    support: 'M10 24H38M10 24V45M38 24V45',
  },
  // Shoulders on the bench, hips driven up level with the knees.
  hipThrust: {
    head: [9, 29.5], neck: [13, 33], hips: [26, 32.5],
    elbows: both([18, 37.5]), hands: both([25.5, 30]), knees: both([36, 32.5]), feet: both([36, 44.5]),
    support: 'M2 36.5H14M5 36.5V45M11 36.5V45',
  },
  // Seated, legs out to the footplate, the handle pulled to the stomach: cable rows and the rowing machine.
  seatedRow: {
    head: [11, 19], neck: [11.5, 24.5], hips: [14, 37.5],
    elbows: both([8, 31]), hands: both([15, 31]), knees: both([24.5, 33]), feet: both([35, 37.5]),
    support: 'M6 41H38M37.5 31V41',
    machine: 'M38 33a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    pulleys: [[38, 33]],
  },
  run: {
    head: [27, 10], neck: [25, 15.5], hips: [22, 28],
    elbows: [[19.5, 21], [30, 21]], hands: [[15.5, 25], [34, 17]], knees: [[30, 31.5], [18.5, 36]], feet: [[28, 40.5], [11, 41]],
  },
  // Walking, and the farmer's carry and elliptical.
  walk: {
    head: [26, 9], neck: [25, 14.5], hips: [24, 27.5],
    elbows: [[22.5, 22], [27.5, 21.5]], hands: [[21, 28.5], [30.5, 27.5]], knees: [[27, 36], [22, 36]], feet: [[29.5, 44.5], [18.5, 44.5]],
    machine: 'M30.5 27.5L33 6M14 46H36',
  },
  // On a bike, leaning to the handlebars, one pedal down.
  cycle: {
    head: [32, 12], neck: [28, 16], hips: [17.5, 24],
    elbows: both([30.5, 20]), hands: both([33, 24]), knees: [[25.5, 29], [24, 25.5]], feet: [[22.5, 40], [19.5, 35]],
    support: 'M4 38a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0M31 38a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0M10.5 38H21L33 24L37.5 38M21 38L17 25M15 24.5H20',
  },
}
