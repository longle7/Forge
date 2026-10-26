import type { Exercise } from './api'

// What Forge knows about each built-in lift, by its exact name: the muscles it works, its equipment, the movement, the
// drawing (LiftFigure.tsx), and form cues. Built-ins are matched by name, not ID, since IDs after the first 35 differ
// from one database to the next (Forge.Api/Data/BuiltInExercises.cs). A lift you add gets its muscle group's defaults.

export type Muscle =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'lats'
  | 'upperBack'
  | 'lowerBack'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'kettlebell' | 'bodyweight'

export type Pattern =
  | 'horizontalPush'
  | 'verticalPush'
  | 'horizontalPull'
  | 'verticalPull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'curl'
  | 'extension'
  | 'raise'
  | 'fly'
  | 'calf'
  | 'core'
  | 'carry'
  | 'cardio'

/** A drawing in LiftFigure.tsx's POSES. Variants of a lift share one. */
export type Pose =
  | 'bench'
  | 'overheadPress'
  | 'squat'
  | 'hinge'
  | 'row'
  | 'highPull'
  | 'invertedRow'
  | 'pullUp'
  | 'pulldown'
  | 'pushdown'
  | 'curl'
  | 'tricepsExtension'
  | 'lateralRaise'
  | 'fly'
  | 'lunge'
  | 'legPress'
  | 'legCurl'
  | 'legExtension'
  | 'hipAbduction'
  | 'calfRaise'
  | 'crunch'
  | 'rollout'
  | 'legRaise'
  | 'pushUp'
  | 'dip'
  | 'hipThrust'
  | 'seatedRow'
  | 'run'
  | 'walk'
  | 'cycle'

export interface LiftInfo {
  primary: Muscle[] // the muscles it's for
  secondary: Muscle[] // the ones that help
  equipment: Equipment
  pattern: Pattern
  pose: Pose
  cues: string[] // form cues, a few words each
}

/** Each muscle's group, one of the six on the body map (api.ts MUSCLE_GROUPS without Cardio and Other). */
export const MUSCLE_GROUP: Record<Muscle, string> = {
  chest: 'Chest',
  frontDelts: 'Shoulders',
  sideDelts: 'Shoulders',
  rearDelts: 'Shoulders',
  biceps: 'Arms',
  triceps: 'Arms',
  forearms: 'Arms',
  lats: 'Back',
  upperBack: 'Back',
  lowerBack: 'Back',
  abs: 'Core',
  obliques: 'Core',
  glutes: 'Legs',
  quads: 'Legs',
  hamstrings: 'Legs',
  calves: 'Legs',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
}

export const LIFTS: Record<string, LiftInfo> = {
  // Chest
  'Bench Press (Barbell)': {
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], equipment: 'barbell', pattern: 'horizontalPush', pose: 'bench',
    cues: ['Shoulder blades pinned back', 'Bar to mid-chest', 'Feet planted, drive through the floor'],
  },
  'Incline Bench Press (Barbell)': {
    primary: ['chest', 'frontDelts'], secondary: ['triceps'], equipment: 'barbell', pattern: 'horizontalPush', pose: 'bench',
    cues: ['Bench at 30 to 45 degrees', 'Bar to the upper chest', 'Shoulder blades pinned back'],
  },
  'Decline Bench Press (Barbell)': {
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], equipment: 'barbell', pattern: 'horizontalPush', pose: 'bench',
    cues: ['Legs locked under the pads', 'Bar to the lower chest', 'Shoulder blades pinned back'],
  },
  'Bench Press (Dumbbell)': {
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], equipment: 'dumbbell', pattern: 'horizontalPush', pose: 'bench',
    cues: ['Shoulder blades pinned back', 'Lower until the dumbbells reach the chest', 'Press up and slightly in'],
  },
  'Incline Bench Press (Dumbbell)': {
    primary: ['chest', 'frontDelts'], secondary: ['triceps'], equipment: 'dumbbell', pattern: 'horizontalPush', pose: 'bench',
    cues: ['Bench at 30 to 45 degrees', 'Elbows about 45 degrees from your sides', 'Press up over the upper chest'],
  },
  'Chest Press (Machine)': {
    primary: ['chest'], secondary: ['triceps', 'frontDelts'], equipment: 'machine', pattern: 'horizontalPush', pose: 'bench',
    cues: ['Handles level with mid-chest', 'Back flat against the pad', 'Press out, then return slowly'],
  },
  'Chest Fly (Cable)': {
    primary: ['chest'], secondary: ['frontDelts'], equipment: 'cable', pattern: 'fly', pose: 'fly',
    cues: ['Slight bend in the elbows, kept fixed', 'Hug a big tree', 'Squeeze the hands together'],
  },
  'Chest Fly (Dumbbell)': {
    primary: ['chest'], secondary: ['frontDelts'], equipment: 'dumbbell', pattern: 'fly', pose: 'fly',
    cues: ['Slight bend in the elbows, kept fixed', 'Lower until the chest stretches', 'Bring the dumbbells together over the chest'],
  },
  'Pec Deck (Machine)': {
    primary: ['chest'], secondary: ['frontDelts'], equipment: 'machine', pattern: 'fly', pose: 'fly',
    cues: ['Seat set so the handles are at chest height', 'Slight bend in the elbows', 'Squeeze, then open slowly'],
  },
  'Push Up': {
    primary: ['chest'], secondary: ['triceps', 'frontDelts', 'abs'], equipment: 'bodyweight', pattern: 'horizontalPush', pose: 'pushUp',
    cues: ['Body in one straight line', 'Hands just wider than the shoulders', 'Chest to an inch off the floor'],
  },

  // Back
  'Deadlift (Barbell)': {
    primary: ['hamstrings', 'glutes', 'lowerBack'], secondary: ['lats', 'upperBack', 'quads', 'forearms'], equipment: 'barbell', pattern: 'hinge', pose: 'hinge',
    cues: ['Bar over mid-foot', 'Flat back, chest up', 'Push the floor away', 'Lock out with the hips, not by leaning back'],
  },
  'Pull Up': {
    primary: ['lats'], secondary: ['biceps', 'upperBack', 'forearms'], equipment: 'bodyweight', pattern: 'verticalPull', pose: 'pullUp',
    cues: ['Hands just wider than the shoulders, palms away', 'Pull the elbows down to your sides', 'Chin over the bar', 'Lower all the way down'],
  },
  'Chin Up': {
    primary: ['lats', 'biceps'], secondary: ['upperBack', 'forearms'], equipment: 'bodyweight', pattern: 'verticalPull', pose: 'pullUp',
    cues: ['Palms facing you, shoulder-width apart', 'Chest to the bar', 'Lower all the way down'],
  },
  'Lat Pulldown (Cable)': {
    primary: ['lats'], secondary: ['biceps', 'upperBack'], equipment: 'cable', pattern: 'verticalPull', pose: 'pulldown',
    cues: ['Thighs locked under the pad', 'Pull the bar to the upper chest', 'Elbows down and back', 'Lean back only slightly'],
  },
  'Straight Arm Pulldown (Cable)': {
    primary: ['lats'], secondary: ['triceps', 'abs'], equipment: 'cable', pattern: 'verticalPull', pose: 'pushdown',
    cues: ['Arms straight, a slight bend in the elbows', 'Hinge a little at the hips', 'Sweep the bar down to the thighs'],
  },
  'Bent Over Row (Barbell)': {
    primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelts', 'lowerBack'], equipment: 'barbell', pattern: 'horizontalPull', pose: 'row',
    cues: ['Hinge until the torso is near 45 degrees', 'Flat back', 'Pull the bar to the lower ribs'],
  },
  'T-Bar Row (Barbell)': {
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelts', 'lowerBack'], equipment: 'barbell', pattern: 'horizontalPull', pose: 'row',
    cues: ['Hinge with a flat back', 'Pull the handles to the chest', 'Squeeze the shoulder blades together'],
  },
  'Row (Dumbbell)': {
    primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelts'], equipment: 'dumbbell', pattern: 'horizontalPull', pose: 'row',
    cues: ['Hand and knee on the bench, back flat', 'Pull the dumbbell to the hip', 'Elbow close to the body'],
  },
  'Seated Row (Cable)': {
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelts'], equipment: 'cable', pattern: 'horizontalPull', pose: 'seatedRow',
    cues: ['Sit tall, chest up', 'Pull the handle to the stomach', 'Squeeze the shoulder blades together'],
  },
  'Single Arm Row (Cable)': {
    primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelts'], equipment: 'cable', pattern: 'horizontalPull', pose: 'seatedRow',
    cues: ['Sit or stand tall', 'Let the shoulder reach forward at the start', 'Pull the elbow back past the body'],
  },
  'Inverted Row': {
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelts'], equipment: 'bodyweight', pattern: 'horizontalPull', pose: 'invertedRow',
    cues: ['Body straight from heels to head', 'Pull the chest to the bar', 'Squeeze the shoulder blades together'],
  },

  // Legs
  'Squat (Barbell)': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerBack'], equipment: 'barbell', pattern: 'squat', pose: 'squat',
    cues: ['Bar on the upper back, chest up', 'Knees track over the toes', 'Hips to just below the knees', 'Drive up through the whole foot'],
  },
  'Front Squat (Barbell)': {
    primary: ['quads'], secondary: ['glutes', 'upperBack', 'abs'], equipment: 'barbell', pattern: 'squat', pose: 'squat',
    cues: ['Elbows high, bar on the front of the shoulders', 'Sit straight down between the heels', 'Chest up the whole way'],
  },
  'Goblet Squat (Dumbbell)': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'abs'], equipment: 'dumbbell', pattern: 'squat', pose: 'squat',
    cues: ['Hold the dumbbell at the chest', 'Elbows inside the knees at the bottom', 'Chest up'],
  },
  'Hack Squat (Machine)': {
    primary: ['quads'], secondary: ['glutes'], equipment: 'machine', pattern: 'squat', pose: 'squat',
    cues: ['Back and hips against the pad', 'Feet shoulder-width on the platform', 'Knees track over the toes'],
  },
  'Bodyweight Squat': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'bodyweight', pattern: 'squat', pose: 'squat',
    cues: ['Feet shoulder-width, toes slightly out', 'Sit back and down', 'Knees track over the toes'],
  },
  'Leg Press (Machine)': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'machine', pattern: 'squat', pose: 'legPress',
    cues: ['Feet shoulder-width on the platform', 'Lower until the knees reach about 90 degrees', 'Lower back stays on the pad'],
  },
  'Romanian Deadlift (Barbell)': {
    primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'forearms'], equipment: 'barbell', pattern: 'hinge', pose: 'hinge',
    cues: ['Soft knees, hips back', 'Bar slides down the thighs', 'Stop when the hamstrings stretch, back flat'],
  },
  'Romanian Deadlift (Dumbbell)': {
    primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'forearms'], equipment: 'dumbbell', pattern: 'hinge', pose: 'hinge',
    cues: ['Soft knees, hips back', 'Dumbbells close to the legs', 'Stop when the hamstrings stretch, back flat'],
  },
  'Sumo Deadlift (Barbell)': {
    primary: ['glutes', 'quads', 'hamstrings'], secondary: ['lowerBack', 'upperBack', 'forearms'], equipment: 'barbell', pattern: 'hinge', pose: 'hinge',
    cues: ['Wide stance, toes turned out', 'Hands inside the knees', 'Knees out, push the floor away'],
  },
  'Kettlebell Swing (Kettlebell)': {
    primary: ['glutes', 'hamstrings'], secondary: ['lowerBack', 'abs', 'forearms'], equipment: 'kettlebell', pattern: 'hinge', pose: 'hinge',
    cues: ['Hinge, don’t squat', 'Snap the hips forward', 'Arms only guide the bell to chest height'],
  },
  'Hip Thrust (Barbell)': {
    primary: ['glutes'], secondary: ['hamstrings', 'quads'], equipment: 'barbell', pattern: 'hinge', pose: 'hipThrust',
    cues: ['Upper back on the bench edge', 'Shins vertical at the top', 'Chin tucked, ribs down', 'Squeeze the glutes at the top'],
  },
  'Glute Bridge': {
    primary: ['glutes'], secondary: ['hamstrings'], equipment: 'bodyweight', pattern: 'hinge', pose: 'hipThrust',
    cues: ['Feet flat, close to the glutes', 'Drive through the heels', 'Squeeze the glutes at the top, ribs down'],
  },
  'Lunge (Dumbbell)': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'dumbbell', pattern: 'lunge', pose: 'lunge',
    cues: ['Long step, torso upright', 'Back knee toward the floor', 'Push up through the front heel'],
  },
  'Bulgarian Split Squat (Dumbbell)': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'dumbbell', pattern: 'lunge', pose: 'lunge',
    cues: ['Rear foot up on a bench', 'Front foot far enough out to keep the heel down', 'Lower straight down'],
  },
  'Step Up (Dumbbell)': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'], equipment: 'dumbbell', pattern: 'lunge', pose: 'lunge',
    cues: ['Whole foot on the box', 'Drive up through the front heel', 'Don’t push off the back foot'],
  },
  'Leg Extension (Machine)': {
    primary: ['quads'], secondary: [], equipment: 'machine', pattern: 'extension', pose: 'legExtension',
    cues: ['Knees in line with the pivot', 'Straighten the legs fully', 'Lower slowly'],
  },
  'Leg Curl (Machine)': {
    primary: ['hamstrings'], secondary: ['calves'], equipment: 'machine', pattern: 'curl', pose: 'legCurl',
    cues: ['Hips pressed into the pad', 'Curl the heels toward the glutes', 'Lower slowly'],
  },
  'Hip Abduction (Machine)': {
    primary: ['glutes'], secondary: [], equipment: 'machine', pattern: 'raise', pose: 'hipAbduction',
    cues: ['Sit tall against the back pad', 'Push the knees out', 'Return slowly'],
  },
  'Calf Raise (Machine)': {
    primary: ['calves'], secondary: [], equipment: 'machine', pattern: 'calf', pose: 'calfRaise',
    cues: ['Balls of the feet on the edge', 'Full stretch at the bottom', 'Rise as high as you can and pause'],
  },
  'Seated Calf Raise (Machine)': {
    primary: ['calves'], secondary: [], equipment: 'machine', pattern: 'calf', pose: 'calfRaise',
    cues: ['Pad snug on the lower thighs', 'Full stretch at the bottom', 'Rise high and pause'],
  },

  // Shoulders
  'Overhead Press (Barbell)': {
    primary: ['frontDelts'], secondary: ['sideDelts', 'triceps'], equipment: 'barbell', pattern: 'verticalPush', pose: 'overheadPress',
    cues: ['Glutes and abs tight', 'Head back, then through once the bar passes', 'Press straight up over mid-foot'],
  },
  'Shoulder Press (Dumbbell)': {
    primary: ['frontDelts'], secondary: ['sideDelts', 'triceps'], equipment: 'dumbbell', pattern: 'verticalPush', pose: 'overheadPress',
    cues: ['Dumbbells at ear height to start', 'Press up and slightly in', 'Ribs down, no arching'],
  },
  'Shoulder Press (Machine)': {
    primary: ['frontDelts'], secondary: ['sideDelts', 'triceps'], equipment: 'machine', pattern: 'verticalPush', pose: 'overheadPress',
    cues: ['Handles at shoulder height to start', 'Back flat against the pad', 'Press up, then lower slowly'],
  },
  'Arnold Press (Dumbbell)': {
    primary: ['frontDelts', 'sideDelts'], secondary: ['triceps'], equipment: 'dumbbell', pattern: 'verticalPush', pose: 'overheadPress',
    cues: ['Start with the palms facing you at the chin', 'Turn the palms out as you press', 'Reverse it on the way down'],
  },
  'Lateral Raise (Dumbbell)': {
    primary: ['sideDelts'], secondary: ['upperBack'], equipment: 'dumbbell', pattern: 'raise', pose: 'lateralRaise',
    cues: ['Slight bend in the elbows', 'Lead with the elbows', 'Raise to shoulder height, no higher'],
  },
  'Lateral Raise (Cable)': {
    primary: ['sideDelts'], secondary: ['upperBack'], equipment: 'cable', pattern: 'raise', pose: 'lateralRaise',
    cues: ['Pulley at the lowest setting', 'Lead with the elbow', 'Raise to shoulder height'],
  },
  'Rear Delt Fly (Dumbbell)': {
    primary: ['rearDelts'], secondary: ['upperBack'], equipment: 'dumbbell', pattern: 'fly', pose: 'lateralRaise',
    cues: ['Hinge forward, back flat', 'Slight bend in the elbows', 'Raise out to the sides, not back'],
  },
  'Face Pull (Cable)': {
    primary: ['rearDelts'], secondary: ['upperBack'], equipment: 'cable', pattern: 'horizontalPull', pose: 'highPull',
    cues: ['Rope at face height', 'Pull toward the forehead, hands apart', 'Elbows high'],
  },
  'Upright Row (Barbell)': {
    primary: ['sideDelts', 'upperBack'], secondary: ['frontDelts', 'biceps'], equipment: 'barbell', pattern: 'verticalPull', pose: 'highPull',
    cues: ['Hands about shoulder-width', 'Lead with the elbows', 'Elbows no higher than the shoulders'],
  },

  // Arms
  'Bicep Curl (Barbell)': {
    primary: ['biceps'], secondary: ['forearms'], equipment: 'barbell', pattern: 'curl', pose: 'curl',
    cues: ['Elbows pinned to your sides', 'No swinging', 'Lower all the way'],
  },
  'Bicep Curl (Dumbbell)': {
    primary: ['biceps'], secondary: ['forearms'], equipment: 'dumbbell', pattern: 'curl', pose: 'curl',
    cues: ['Elbows pinned to your sides', 'Turn the palms up as you curl', 'Lower all the way'],
  },
  'Bicep Curl (Cable)': {
    primary: ['biceps'], secondary: ['forearms'], equipment: 'cable', pattern: 'curl', pose: 'curl',
    cues: ['Elbows pinned to your sides', 'Curl to the shoulders', 'Lower slowly'],
  },
  'Hammer Curl (Dumbbell)': {
    primary: ['biceps', 'forearms'], secondary: [], equipment: 'dumbbell', pattern: 'curl', pose: 'curl',
    cues: ['Palms facing each other', 'Elbows pinned to your sides', 'No swinging'],
  },
  'Preacher Curl (Barbell)': {
    primary: ['biceps'], secondary: ['forearms'], equipment: 'barbell', pattern: 'curl', pose: 'curl',
    cues: ['Armpits snug on the pad', 'Lower until the arms are almost straight', 'Curl without lifting the elbows'],
  },
  'Triceps Pushdown (Cable)': {
    primary: ['triceps'], secondary: [], equipment: 'cable', pattern: 'extension', pose: 'pushdown',
    cues: ['Elbows pinned to your sides', 'Push down until the arms are straight', 'Only the forearms move'],
  },
  'Overhead Triceps Extension (Cable)': {
    primary: ['triceps'], secondary: [], equipment: 'cable', pattern: 'extension', pose: 'tricepsExtension',
    cues: ['Face away from the pulley', 'Elbows forward, close to the head', 'Straighten the arms fully'],
  },
  'Overhead Triceps Extension (Dumbbell)': {
    primary: ['triceps'], secondary: [], equipment: 'dumbbell', pattern: 'extension', pose: 'tricepsExtension',
    cues: ['One dumbbell, both hands', 'Elbows close to the head', 'Lower behind the head, then straighten'],
  },
  'Skullcrusher (Barbell)': {
    primary: ['triceps'], secondary: [], equipment: 'barbell', pattern: 'extension', pose: 'tricepsExtension',
    cues: ['Upper arms still, angled slightly back', 'Lower the bar to the forehead', 'Straighten the elbows'],
  },
  'Close Grip Bench Press (Barbell)': {
    primary: ['triceps', 'chest'], secondary: ['frontDelts'], equipment: 'barbell', pattern: 'horizontalPush', pose: 'bench',
    cues: ['Hands about shoulder-width', 'Elbows close to the body', 'Bar to the lower chest'],
  },
  Dip: {
    primary: ['triceps', 'chest'], secondary: ['frontDelts'], equipment: 'bodyweight', pattern: 'verticalPush', pose: 'dip',
    cues: ['Shoulders down, away from the ears', 'Lower until the upper arms are level', 'Lean forward for chest, stay upright for triceps'],
  },

  // Core
  Crunch: {
    primary: ['abs'], secondary: [], equipment: 'bodyweight', pattern: 'core', pose: 'crunch',
    cues: ['Lower back stays on the floor', 'Curl the ribs toward the hips', 'Hands by the head, no pulling'],
  },
  'Cable Crunch (Cable)': {
    primary: ['abs'], secondary: ['obliques'], equipment: 'cable', pattern: 'core', pose: 'crunch',
    cues: ['Kneel with the rope by your head', 'Curl the ribs toward the hips', 'Hips stay still'],
  },
  'Russian Twist': {
    primary: ['obliques'], secondary: ['abs'], equipment: 'bodyweight', pattern: 'core', pose: 'crunch',
    cues: ['Lean back with a straight back', 'Turn the shoulders, not just the arms', 'Feet down to make it easier'],
  },
  'Hanging Leg Raise': {
    primary: ['abs'], secondary: ['obliques', 'forearms'], equipment: 'bodyweight', pattern: 'core', pose: 'legRaise',
    cues: ['Hang still, no swinging', 'Curl the pelvis up as the legs rise', 'Lower slowly'],
  },
  'Ab Wheel Rollout': {
    primary: ['abs'], secondary: ['lats', 'obliques'], equipment: 'bodyweight', pattern: 'core', pose: 'rollout',
    cues: ['Start on the knees, hips tucked', 'Roll out with the back flat', 'Pull back with the abs, not the hips'],
  },
  'Woodchop (Cable)': {
    primary: ['obliques'], secondary: ['abs'], equipment: 'cable', pattern: 'core', pose: 'pushdown',
    cues: ['Arms nearly straight', 'Turn through the torso and hips', 'Pivot the back foot'],
  },
  "Farmer's Carry (Dumbbell)": {
    primary: ['forearms', 'upperBack'], secondary: ['abs', 'obliques'], equipment: 'dumbbell', pattern: 'carry', pose: 'walk',
    cues: ['Heavy dumbbells at your sides', 'Stand tall, shoulders back', 'Short, quick steps'],
  },

  // Cardio
  Running: {
    primary: ['quads', 'hamstrings', 'calves'], secondary: ['glutes'], equipment: 'bodyweight', pattern: 'cardio', pose: 'run',
    cues: ['Land under your hips', 'Short, quick steps', 'Relaxed shoulders'],
  },
  Walking: {
    primary: ['quads', 'calves'], secondary: ['glutes', 'hamstrings'], equipment: 'bodyweight', pattern: 'cardio', pose: 'walk',
    cues: ['Stand tall', 'Heel, then toe', 'Let the arms swing'],
  },
  Cycling: {
    primary: ['quads'], secondary: ['glutes', 'hamstrings', 'calves'], equipment: 'bodyweight', pattern: 'cardio', pose: 'cycle',
    cues: ['Saddle high enough for a slight knee bend at the bottom', 'Smooth circles', 'Relaxed grip and shoulders'],
  },
  'Rowing (Machine)': {
    primary: ['upperBack', 'lats', 'quads'], secondary: ['glutes', 'hamstrings', 'biceps'], equipment: 'machine', pattern: 'cardio', pose: 'seatedRow',
    cues: ['Drive with the legs first', 'Then lean back and pull to the lower ribs', 'Arms, body, then legs on the way back'],
  },
  'Elliptical (Machine)': {
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'], equipment: 'machine', pattern: 'cardio', pose: 'walk',
    cues: ['Stand tall, don’t lean on the handles', 'Push through the whole foot', 'Push and pull the handles'],
  },
}

/** A lift you added: its muscle group's muscles, movement and drawing. */
const GROUP_DEFAULTS: Record<string, Pick<LiftInfo, 'primary' | 'secondary' | 'pattern' | 'pose'>> = {
  Chest: { primary: ['chest'], secondary: ['triceps', 'frontDelts'], pattern: 'horizontalPush', pose: 'bench' },
  Back: { primary: ['lats', 'upperBack'], secondary: ['biceps'], pattern: 'horizontalPull', pose: 'row' },
  Legs: { primary: ['quads', 'glutes'], secondary: ['hamstrings'], pattern: 'squat', pose: 'squat' },
  Shoulders: { primary: ['frontDelts', 'sideDelts'], secondary: ['triceps'], pattern: 'verticalPush', pose: 'overheadPress' },
  Arms: { primary: ['biceps', 'triceps'], secondary: ['forearms'], pattern: 'curl', pose: 'curl' },
  Core: { primary: ['abs'], secondary: ['obliques'], pattern: 'core', pose: 'crunch' },
  Cardio: { primary: ['quads'], secondary: ['glutes', 'hamstrings', 'calves'], pattern: 'cardio', pose: 'run' },
  Other: { primary: [], secondary: [], pattern: 'carry', pose: 'walk' },
}

/** The equipment in a lift's name, like the built-ins: "Squat (Barbell)" → barbell; none named → bodyweight. */
export const equipmentOf = (name: string): Equipment =>
  (name.match(/\((barbell|dumbbell|cable|machine|kettlebell)\)/i)?.[1].toLowerCase() as Equipment | undefined) ?? 'bodyweight'

/** A built-in's catalog entry, or for a lift you added, its group's defaults and the equipment in its name. */
export function liftInfo(exercise: Pick<Exercise, 'name' | 'muscleGroup'>): LiftInfo {
  // hasOwn, so a lift you named "constructor" isn't taken for the object's own property.
  if (Object.hasOwn(LIFTS, exercise.name)) return LIFTS[exercise.name]
  return { ...(GROUP_DEFAULTS[exercise.muscleGroup] ?? GROUP_DEFAULTS.Other), equipment: equipmentOf(exercise.name), cues: [] }
}

/** A new lift's name with its equipment in parentheses, like the built-ins, unless it's bodyweight or already named. */
export const nameWithEquipment = (name: string, equipment: Equipment) =>
  equipment === 'bodyweight' || equipmentOf(name) !== 'bodyweight' ? name : `${name} (${EQUIPMENT_LABELS[equipment]})`

/** "front delts" for frontDelts. */
const muscleName = (muscle: Muscle) => muscle.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)

/** "Works chest · helps triceps, front delts"; empty when nothing is known (a lift you added under Other). */
export function musclesWorked({ primary, secondary }: Pick<LiftInfo, 'primary' | 'secondary'>): string {
  const parts: string[] = []
  if (primary.length) parts.push(`Works ${primary.map(muscleName).join(', ')}`)
  if (secondary.length) parts.push(`helps ${secondary.map(muscleName).join(', ')}`)
  return parts.join(' · ')
}
