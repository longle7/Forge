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
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId(), ...init?.headers },
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
