import { Capacitor, registerPlugin } from '@capacitor/core'
import { forgetRemembered, read, write } from './cache'

// Types mirror the Forge API responses (camelCase JSON).

export interface Exercise {
  id: number
  name: string // "Bench Press (Barbell)"
  muscleGroup: string // one of MUSCLE_GROUPS
  isCustom: boolean // added by you, not built in
}

export interface WorkoutSet {
  exerciseId: number
  weight: number // pounds; 0 for bodyweight and cardio
  reps: number // 0 for cardio
  distance?: number | null // cardio only: miles
  durationSeconds?: number | null // cardio only; a cardio set has a distance, a time, or both
}

export interface Workout {
  id: string // made up by the app when the workout starts (see draft.ts); Apple Health's own ID for a Watch workout
  name: string
  startedAt: string // ISO, UTC
  finishedAt: string
  sets: WorkoutSet[] // in the order they were done; none for a Watch strength session (the Watch doesn't record sets)
  source?: 'forge' | 'health' // 'health': brought in from Apple Health (see health.ts)
  activity?: string | null // Apple Health's kind of workout: 'running', 'strength', …
  // From Apple Health, for a Watch workout or a Forge one the Watch recorded too.
  activeCalories?: number | null
  avgHeartRate?: number | null
  maxHeartRate?: number | null
  heartRate?: HeartRatePoint[]
}

/** Heart rate `s` seconds into a workout, in beats a minute (30-second steps). */
export interface HeartRatePoint {
  s: number
  bpm: number
}

/** Apple Health's numbers for a workout: see saveWorkoutHealth. */
export type WorkoutHealth = Pick<Workout, 'activeCalories' | 'avgHeartRate' | 'maxHeartRate' | 'heartRate'>

export type WorkoutInput = Omit<Workout, 'id'>

// The API's ExercisesController.MuscleGroups, in the order the exercise list shows them.
export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other']

/** Cardio exercises (Running, Cycling, …) log a distance and time instead of weight and reps. */
export const isCardio = (exercise: Exercise) => exercise.muscleGroup === 'Cardio'

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'active' | 'very-active'
export type Goal = 'lose' | 'maintain' | 'gain'

/** Your goals, what they were worked out from (Setup), and the Time Out unlock rules. */
export interface Profile {
  sex: Sex
  birthYear: number
  heightIn: number
  startWeight: number // pounds, when the goals were set
  activity: Activity // outside workouts
  goal: Goal
  pace: number // pounds a week
  goalWeight?: number | null // pounds; null or missing = none set
  calorieGoal: number
  proteinGoal: number // grams
  carbsGoal: number
  fatGoal: number
  fiberGoal?: number | null // at least this many grams a day; null = not tracked
  sugarLimit?: number | null // at most this many grams
  sodiumLimit?: number | null // at most this many mg
  unlockAfterWorkout: boolean
  unlockAfterMeals: number // 0 = no rule
  unlockAfterWeighIn: boolean
  unlockAfterHabits?: boolean // every habit scheduled today done
  restDayCalorieAdjust?: number // 0 or less: calories off the goal on rest days in the weekly plan, from carbs
}

/** A daily habit and its check-offs (the last 400 days). */
export interface Habit {
  id: string // made up by the app
  name: string
  emoji: string
  dailyTarget: number // 1 = a check-off; 8 = "8 glasses"
  days: number // bitmask: bit 0 = Sunday … bit 6 = Saturday
  archived: boolean
  createdAt: string
  checks: { date: string; count: number }[]
}

export type HabitInput = Pick<Habit, 'name' | 'emoji' | 'dailyTarget' | 'days' | 'archived'>

/** One weekday of the weekly plan (0 = Sunday … 6 = Saturday). A weekday without one is a rest day. */
export interface PlanDay {
  dayOfWeek: number
  name: string // "Push Day"
  createdAt: string // when it was first planned
  exercises: PlanExercise[]
}

export interface PlanExercise {
  exerciseId: number
  sets: number
  reps: number
}

export interface WeighIn {
  date: string // YYYY-MM-DD, your time zone
  weight: number // pounds
}

/** A max you tested outside a logged workout: a weight for 1 to 10 reps on a day. */
export interface TestedMax {
  id: string // made up by the app
  exerciseId: number
  date: string // YYYY-MM-DD, your time zone
  weight: number // pounds
  reps: number
}

export type TestedMaxInput = Omit<TestedMax, 'id'>

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
]

/** Nutrition per serving: kcal, then grams. */
export interface Nutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** Fiber and sugar (grams) and sodium (mg) per serving: null or missing when unknown, which isn't the same as 0. */
export interface Micros {
  fiber?: number | null
  sugar?: number | null
  sodium?: number | null
}

/** Something you ate: a food, its serving, how many servings, and its nutrition per serving. */
export interface FoodEntry extends Nutrition, Micros {
  id: string // made up by the app, like a workout's
  date: string // YYYY-MM-DD it counts toward
  meal: Meal
  name: string
  serving: string // "1 cup (227 g)"
  servings: number
  source: 'manual' | 'search' | 'label' | 'photo'
}

export type FoodEntryInput = Omit<FoodEntry, 'id'>

/** A food from search, per one serving. */
export interface FoodResult extends Nutrition, Micros {
  name: string
  brand: string | null
  serving: string
}

/** A day's calories and protein (what Progress charts). */
export interface DayTotals {
  date: string
  calories: number
  protein: number
}

/**
 * A failed request: an HTTP error with the API's own message (e.g. a validation error) when it sent one, or
 * status 0 when there was no answer at all (timed out, or no connection), with a message to show as is.
 */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// The website is served next to the API at /api in development (Vite's proxy). The Azure build points at the hosted
// API instead: VITE_API_URL=https://api.example.com npm run build
const API_URL = import.meta.env.VITE_API_URL ?? '/api'

/** Give up on a request after this long, so a stalled connection (weak gym signal) shows an error, not a spinner forever. */
export const REQUEST_TIMEOUT_MS = 15_000
export const TIMEOUT_MESSAGE = 'Forge is taking too long to respond. Check your connection and try again.'
export const NETWORK_MESSAGE = "Couldn't reach Forge. Check your connection and try again."

// fetch with a timeout; a request that gets no answer becomes an ApiError with status 0 and a message to show.
async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch (error) {
    throw new ApiError(0, (error as Error).name === 'TimeoutError' ? TIMEOUT_MESSAGE : NETWORK_MESSAGE)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const signedIn = token()
  const response = await request(`${API_URL}${path}`, {
    ...init,
    headers: {
      // JSON bodies say so; a FormData body (a photo) lets the browser set its own multipart type.
      ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(signedIn ? { Authorization: `Bearer ${signedIn}` } : isNative ? {} : { 'X-User-Id': userId() }),
      ...init?.headers,
    },
  })
  if (response.status === 401 && signedIn) signOut() // the token stopped working: Welcome asks you to sign in again
  if (!response.ok) {
    // ASP.NET problem details: { title, errors: { Field: ["message"] } }
    const problem = await response.json().catch(() => undefined)
    const firstError = Object.values(problem?.errors ?? {}).flat()[0] as string | undefined
    throw new ApiError(response.status, firstError ?? problem?.title ?? response.statusText)
  }
  return (response.status === 204 ? undefined : response.json()) as Promise<T>
}

export const getExercises = () => api<Exercise[]>('/exercises')
export const addExercise = (name: string, muscleGroup: string) =>
  api<Exercise>('/exercises', { method: 'POST', body: JSON.stringify({ name, muscleGroup }) })

export const getWorkouts = () => api<Workout[]>('/workouts')
/** Creates or replaces: saving the same workout twice (a retry, an edit) never makes a copy. */
export const saveWorkout = (id: string, workout: WorkoutInput) =>
  api<Workout>(`/workouts/${id}`, { method: 'PUT', body: JSON.stringify(workout) })
export const deleteWorkout = (id: string) => api<void>(`/workouts/${id}`, { method: 'DELETE' })
/** Adds Apple Health's calories and heart rate to a workout you logged in Forge (the Watch recorded it too). */
export const saveWorkoutHealth = (id: string, health: WorkoutHealth) =>
  api<Workout>(`/workouts/${id}/health`, { method: 'PUT', body: JSON.stringify(health) })

const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) })

/** Your profile, or null before you've set your goals (the API answers 404). */
export const getProfile = () => api<Profile>('/profile').catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)))
export const saveProfile = (profile: Profile) => api<Profile>('/profile', put(profile))

export const getPlan = () => api<PlanDay[]>('/plan')
export const savePlanDay = (day: number, plan: { name: string; exercises: PlanExercise[] }) => api<PlanDay>(`/plan/${day}`, put(plan))
export const makeRestDay = (day: number) => api<void>(`/plan/${day}`, { method: 'DELETE' })

export const getHabits = () => api<Habit[]>('/habits')
export const saveHabit = (id: string, habit: HabitInput) => api<Habit>(`/habits/${id}`, put(habit))
export const deleteHabit = (id: string) => api<void>(`/habits/${id}`, { method: 'DELETE' })
export const checkHabit = (id: string, date: string, count: number) => api<void>(`/habits/${id}/checks/${date}`, put({ count }))

export const getWeighIns = () => api<WeighIn[]>('/weigh-ins')
export const saveWeighIn = (date: string, weight: number) => api<WeighIn>(`/weigh-ins/${date}`, put({ weight }))

export const getMaxes = () => api<TestedMax[]>('/maxes')
export const saveMax = (id: string, max: TestedMaxInput) => api<TestedMax>(`/maxes/${id}`, put(max))
export const deleteMax = (id: string) => api<void>(`/maxes/${id}`, { method: 'DELETE' })

export const foodLogPath = (date: string) => `/food-log?date=${date}`
export const getFoodLog = (date: string) => api<FoodEntry[]>(foodLogPath(date))
export const foodDaysPath = (from: string, to: string) => `/food-log/days?from=${from}&to=${to}`
export const getFoodDays = (from: string, to: string) => api<DayTotals[]>(foodDaysPath(from, to))
export const getRecentFoods = () => api<FoodEntry[]>('/food-log/recent')
/** Logs an entry, or replaces it: like saveWorkout, a retry never logs it twice. */
export const saveFoodEntry = (id: string, entry: FoodEntryInput) => api<FoodEntry>(`/food-log/${id}`, put(entry))
export const deleteFoodEntry = (id: string) => api<void>(`/food-log/${id}`, { method: 'DELETE' })

/** A meal you eat often, saved to log again in one tap. */
export interface SavedMeal {
  id: string // made up by the app
  name: string // "Usual breakfast"
  items: MealItem[]
}

/** A food in a saved meal: a food log entry without its day and meal. */
export type MealItem = Pick<FoodEntry, 'name' | 'serving' | 'servings' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium'>

export const getSavedMeals = () => api<SavedMeal[]>('/saved-meals')
export const saveSavedMeal = (id: string, meal: Omit<SavedMeal, 'id'>) => api<SavedMeal>(`/saved-meals/${id}`, put(meal))
export const deleteSavedMeal = (id: string) => api<void>(`/saved-meals/${id}`, { method: 'DELETE' })

export const searchFoods = (query: string, signal?: AbortSignal) => api<FoodResult[]>(`/foods?q=${encodeURIComponent(query)}`, { signal })

/** A food read from a photo, per one serving, for you to check before logging. */
export interface ScannedFood extends Nutrition, Micros {
  name: string // "" when the label doesn't show the product's name
  serving: string // "1/2 cup (40 g)", or "150 g" for a food on a plate
}

// Claude takes a few seconds to read a photo: allow longer than ordinary requests.
const SCAN_TIMEOUT_MS = 60_000
const photoForm = (photo: Blob) => {
  const form = new FormData()
  form.append('image', photo, 'photo.jpg')
  return { method: 'POST', body: form, signal: AbortSignal.timeout(SCAN_TIMEOUT_MS) }
}

/** One serving of a packaged food, read from a photo of its Nutrition Facts label. */
export const scanLabel = (photo: Blob) => api<ScannedFood>('/scan/label', photoForm(photo))

/** Each food on a plate, with an estimated portion, read from a photo. */
export const scanMeal = (photo: Blob) => api<ScannedFood[]>('/scan/meal', photoForm(photo))

// Who you are. On the iPhone: Sign in with Apple, traded for Forge's token for your account (sent as "Authorization:
// Bearer"), so your data follows you to a new phone, or back after deleting the app. In a browser (development only):
// an anonymous ID made up on this device, sent as X-User-Id.
export const isNative = Capacitor.isNativePlatform()
const TOKEN_KEY = 'forge.token'
const USER_ID_KEY = 'forge.userId' // also what beta builds kept on the iPhone, before sign-in existed
let sessionToken: string | null = null
let sessionUserId: string | undefined
const signInListeners = new Set<() => void>()

// sessionToken covers this visit when storage is blocked.
const token = (): string | null => read(TOKEN_KEY) ?? sessionToken

function setToken(value: string | null) {
  sessionToken = value
  write(TOKEN_KEY, value)
  signInListeners.forEach((listener) => listener())
}

/** Whether Forge can load your data: always in a browser; on the iPhone, once you've signed in. */
export const isSignedIn = () => !isNative || !!token()

/** For useSyncExternalStore: calls back when you sign in or out. */
export function onSignInChange(listener: () => void) {
  signInListeners.add(listener)
  return () => void signInListeners.delete(listener)
}

// The native side: plugins/apple-sign-in. Rejects with code 'CANCELED' when you close Apple's sheet.
const AppleSignIn = registerPlugin<{ signIn(): Promise<{ identityToken: string; authorizationCode: string }> }>('AppleSignIn')
export const appleSignIn = () => AppleSignIn.signIn()
export const isCancel = (error: unknown) => (error as { code?: string }).code === 'CANCELED'

/**
 * Sign in with Apple. The first time, the anonymous ID a beta build gave this phone goes along, so everything logged
 * on the beta stays yours.
 */
export async function signIn() {
  const { identityToken } = await appleSignIn()
  const legacyUserId = read(USER_ID_KEY)
  const session = await api<{ token: string }>('/auth/apple', { method: 'POST', body: JSON.stringify({ identityToken, legacyUserId }) })
  forgetRemembered() // last-known data may be another account's
  forgetUserId() // carried over now (or someone else's already)
  setToken(session.token)
}

/** Settings → Sign Out, or a token that stopped working. Your data stays on the server for when you sign in again. */
export function signOut() {
  forgetRemembered()
  setToken(null)
}

// Storage blocked: the made-up ID (and so the data) lasts for this visit only.
function userId(): string {
  if (!sessionUserId) {
    sessionUserId = read(USER_ID_KEY) ?? randomId()
    write(USER_ID_KEY, sessionUserId)
  }
  return sessionUserId
}

/**
 * Settings → Delete Account: everything saved for you, gone from the server. On the iPhone, `appleCode` (from a fresh
 * Sign in with Apple) lets the server revoke Forge's access at Apple too.
 */
export const deleteMyData = (appleCode?: string) => api<void>('/me', { method: 'DELETE', headers: appleCode ? { 'X-Apple-Code': appleCode } : {} })

/** After Delete my data in a browser: the next request starts a fresh anonymous ID. */
export function forgetUserId() {
  sessionUserId = undefined
  write(USER_ID_KEY, null)
}

// randomUUID needs HTTPS; getRandomValues also works over plain HTTP (e.g. testing on a phone over Wi-Fi).
export const randomId = () =>
  crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
