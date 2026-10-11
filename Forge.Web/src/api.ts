// Types mirror the Forge API responses (camelCase JSON).

export interface Exercise {
  id: number
  name: string // "Bench Press (Barbell)"
  muscleGroup: string // one of MUSCLE_GROUPS
  isCustom: boolean // added by you, not built in
}

export interface WorkoutSet {
  exerciseId: number
  weight: number // pounds; 0 for bodyweight
  reps: number
}

export interface Workout {
  id: string // made up by the app when the workout starts (see draft.ts)
  name: string
  startedAt: string // ISO, UTC
  finishedAt: string
  sets: WorkoutSet[] // in the order they were done
}

export type WorkoutInput = Omit<Workout, 'id'>

// The API's ExercisesController.MuscleGroups, in the order the exercise list shows them.
export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other']

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
  calorieGoal: number
  proteinGoal: number // grams
  carbsGoal: number
  fatGoal: number
  unlockAfterWorkout: boolean
  unlockAfterMeals: number // 0 = no rule
  unlockAfterWeighIn: boolean
  unlockAfterHabits?: boolean // every habit scheduled today done
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

/** Something you ate: a food, its serving, how many servings, and its nutrition per serving. */
export interface FoodEntry extends Nutrition {
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
export interface FoodResult extends Nutrition {
  name: string
  brand: string | null
  serving: string
}

/** A day's food totals. */
export interface DayTotals extends Nutrition {
  date: string
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
  const response = await request(`${API_URL}${path}`, {
    ...init,
    // JSON bodies say so; a FormData body (a photo) lets the browser set its own multipart type.
    headers: { ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}), 'X-User-Id': userId(), ...init?.headers },
  })
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

export const foodLogPath = (date: string) => `/food-log?date=${date}`
export const getFoodLog = (date: string) => api<FoodEntry[]>(foodLogPath(date))
export const foodDaysPath = (from: string, to: string) => `/food-log/days?from=${from}&to=${to}`
export const getFoodDays = (from: string, to: string) => api<DayTotals[]>(foodDaysPath(from, to))
export const getRecentFoods = () => api<FoodEntry[]>('/food-log/recent')
/** Logs an entry, or replaces it: like saveWorkout, a retry never logs it twice. */
export const saveFoodEntry = (id: string, entry: FoodEntryInput) => api<FoodEntry>(`/food-log/${id}`, put(entry))
export const deleteFoodEntry = (id: string) => api<void>(`/food-log/${id}`, { method: 'DELETE' })

export const searchFoods = (query: string, signal?: AbortSignal) => api<FoodResult[]>(`/foods?q=${encodeURIComponent(query)}`, { signal })

/** A food read from a photo, per one serving, for you to check before logging. */
export interface ScannedFood extends Nutrition {
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

// Anonymous per-device ID that owns your workouts. Settings shows it as your restore code.
// ponytail: whoever knows the ID can read its workouts; replace with real sign-in (e.g. Sign in with Apple) before launch.
const USER_ID_KEY = 'forge.userId'
let sessionUserId: string | undefined
export function userId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) {
      id = randomId()
      localStorage.setItem(USER_ID_KEY, id)
    }
    return id
  } catch {
    return (sessionUserId ??= randomId()) // storage blocked: workouts are reachable for this visit only
  }
}

/** A restore code as typed or pasted, cleaned up; undefined if it can't be one (randomId's two shapes). */
export function parseRestoreCode(text: string): string | undefined {
  const code = text.trim().toLowerCase()
  return /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/.test(code) ? code : undefined
}

/** Settings → Use a restore code: from now on this device shows the workouts saved under that code. */
export function switchUserId(code: string) {
  sessionUserId = code
  try {
    localStorage.setItem(USER_ID_KEY, code)
  } catch {
    // storage blocked: the code lasts for this visit (sessionUserId)
  }
}

// randomUUID needs HTTPS; getRandomValues also works over plain HTTP (e.g. testing on a phone over Wi-Fi).
export const randomId = () =>
  crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
