import { useEffect, useEffectEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ApiError, getExercises, getMaxes, getWorkouts, isCardio, saveWorkout, type Exercise, type TestedMax, type Workout } from '../api'
import { readJson, write } from '../cache'
import { Card, dangerButton, field, Notice, plainButton, PrBadge, primaryButton, Sheet, tintedButton } from '../components'
import { loadDraft, saveDraft, toSet, toWorkout, type Draft, type DraftExercise, type DraftSet } from '../draft'
import { ExercisePicker } from '../ExercisePicker'
import { notifyRestEnd } from '../notify'
import { Icon } from '../icons'
import { useNow, usePolling, useTitle } from '../usePolling'
import { BAR, formatCardio, formatClock, formatDay, formatMiles, formatWeight, livePr, oneRepMax, parseDuration, platesPerSide, plural, previousSets, progressionStep, recentExercises } from '../workouts'
import { estimatedMax } from '../maxes'

/** Rest after a checked-off set: 90 seconds, unless you choose another length for the exercise (kept on this device). */
const REST_SECONDS = 90
const REST_CHOICES = [0, 30, 60, 90, 120, 180, 300]
const REST_KEY = 'forge.rest'
const restEndsAt = (seconds: number) => Date.now() + seconds * 1000

const loadRests = () => readJson<Record<number, number>>(REST_KEY) ?? {}

// The chime when a rest is up. Browsers only let a page play sound after a tap, so checking off a set wakes it up.
let audio: AudioContext | undefined
function wakeAudio() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    // no Web Audio: the timer still shows
  }
}
function chime() {
  const ctx = audio
  if (ctx?.state !== 'running') return
  for (const [i, frequency] of [880, 1175].entries()) {
    const start = ctx.currentTime + i * 0.2
    const tone = ctx.createOscillator()
    const volume = ctx.createGain()
    tone.frequency.value = frequency
    volume.gain.setValueAtTime(0.0001, start)
    volume.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.6)
    tone.connect(volume).connect(ctx.destination)
    tone.start(start)
    tone.stop(start + 0.6)
  }
}

const chip = 'flex min-h-9 items-center gap-1.5 rounded-full bg-fill px-3 text-[15px] font-medium active:opacity-70'

/** The workout in progress (/workouts/active). Started from Home or the Workouts tab, which put it on this phone. */
export default function LoggerPage() {
  const [draft, setDraft] = useState(loadDraft)
  const workouts = usePolling(getWorkouts, '/workouts')
  const exercises = usePolling(getExercises, '/exercises')
  const maxes = usePolling(getMaxes, '/maxes')

  // Every change is kept on this device at once, so a reload or a closed tab loses nothing.
  const update = (next: Draft) => {
    saveDraft(next)
    setDraft(next)
  }

  if (!draft) return <Navigate to="/workouts" replace />
  return <Logger draft={draft} update={update} workouts={workouts.data ?? []} exercises={exercises.data ?? []} tested={maxes.data ?? []} />
}

function Logger({ draft, update, workouts, exercises, tested }: {
  draft: Draft
  update: (draft: Draft) => void
  workouts: Workout[]
  exercises: Exercise[]
  tested: TestedMax[]
}) {
  const navigate = useNavigate()
  const now = useNow()
  const [picking, setPicking] = useState(false)
  const [added, setAdded] = useState<Exercise[]>([]) // made in the picker, before the list reloads
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const [rests, setRests] = useState(loadRests)
  const [plateWeight, setPlateWeight] = useState<string>() // the plate calculator is open, starting at this weight
  const all = [...exercises, ...added]
  const names = new Map(all.map((e) => [e.id, e.name]))
  const cardio = new Set(all.filter(isCardio).map((e) => e.id))
  const legs = new Set(all.filter((e) => e.muscleGroup === 'Legs').map((e) => e.id))
  useTitle(draft.name || 'Workout')

  // The workout is done with this page: leave it, and stop keeping it on the phone.
  // `finished`: a new workout just saved, for the detail page to say so.
  const close = (to: string, finished = false) => {
    saveDraft(undefined)
    void notifyRestEnd(undefined)
    navigate(to, { replace: true, state: finished ? { finished } : undefined })
  }

  // A change to the sets means the workout isn't over yet: a new Finish sets the end time again.
  const setExercises = (list: DraftExercise[], rest?: Pick<Draft, 'restEndsAt' | 'restTotal'>) =>
    update({ ...draft, exercises: list, ...rest, finishedAt: draft.editing ? draft.finishedAt : undefined })
  const withSet = (e: number, s: number, change: Partial<DraftSet>) =>
    draft.exercises.map((ex, i) => (i !== e ? ex : { ...ex, sets: ex.sets.map((set, j) => (j !== s ? set : { ...set, ...change })) }))

  const previous = (exerciseId: number) => previousSets(workouts, exerciseId, draft.editing ? draft.id : undefined)
  // Weight to add this time: 5 lb (10 for legs) when you hit every target rep last time.
  const stepFor = (ex: DraftExercise) =>
    cardio.has(ex.exerciseId) ? 0 : progressionStep(previous(ex.exerciseId), ex.sets.map((s) => Number(s.reps)), legs.has(ex.exerciseId))
  const restFor = (exerciseId: number) => rests[exerciseId] ?? REST_SECONDS
  const changeRest = (exerciseId: number, seconds: number) => {
    const next = { ...rests, [exerciseId]: seconds }
    setRests(next)
    write(REST_KEY, JSON.stringify(next))
  }

  // Checking off a set fills empty fields from last time (like Strong), with the weight raised when you hit every rep
  // last time, and starts the rest timer. Cardio has no rest timer, and fills in last time's only when both are empty.
  const toggleDone = (e: number, s: number) => {
    const ex = draft.exercises[e]
    const set = ex.sets[s]
    if (set.done) return setExercises(withSet(e, s, { done: false }))
    wakeAudio()
    const prev = previous(ex.exerciseId)
    const hint = prev[s] ?? prev.at(-1)
    if (cardio.has(ex.exerciseId)) {
      const last = !set.distance && !set.time ? hint : undefined
      const distance = last ? (last.distance ? String(last.distance) : '') : (set.distance ?? '')
      const time = last ? (last.durationSeconds ? formatClock(last.durationSeconds * 1000) : '') : (set.time ?? '')
      if (!(Number(distance) > 0) && !(parseDuration(time) > 0)) return setMessage('Enter a distance or time first, then check it off.')
      setMessage(undefined)
      return setExercises(withSet(e, s, { distance, time, done: true }))
    }
    const reps = set.reps || (hint ? String(hint.reps) : '')
    if (!(Number(reps) > 0)) return setMessage('Enter the reps first, then check the set off.')
    setMessage(undefined)
    const weight = set.weight || (hint ? String(hint.weight + stepFor(ex)) : '')
    const rest = restFor(ex.exerciseId)
    setExercises(withSet(e, s, { weight, reps, done: true }), draft.editing || !rest ? undefined : { restEndsAt: restEndsAt(rest), restTotal: rest })
  }

  const addSet = (e: number) => {
    const last = draft.exercises[e].sets.at(-1)
    setExercises(draft.exercises.map((ex, i) => (i !== e ? ex : { ...ex, sets: [...ex.sets, last ? { ...last, done: false } : { weight: '', reps: '', done: false }] })))
  }
  const removeSet = (e: number) => setExercises(draft.exercises.map((ex, i) => (i !== e ? ex : { ...ex, sets: ex.sets.slice(0, -1) })))
  const removeExercise = (e: number) => {
    if (draft.exercises[e].sets.some((s) => s.done) && !confirm(`Remove ${names.get(draft.exercises[e].exerciseId) ?? 'this exercise'} and its sets?`)) return
    setExercises(draft.exercises.filter((_, i) => i !== e))
  }
  const pick = (exercise: Exercise) => {
    setPicking(false)
    if (!names.has(exercise.id)) setAdded((list) => [...list, exercise])
    setExercises([...draft.exercises, { exerciseId: exercise.id, sets: [{ weight: '', reps: '', done: false }] }])
  }

  const finish = async () => {
    if (saving) return
    const finishedAt = draft.finishedAt ?? new Date().toISOString()
    const workout = toWorkout(draft, finishedAt)
    if (workout.sets.length === 0) return setMessage('Check off at least one set (✓) to save this workout.')
    // Keep the end time with the workout on this phone, so a later retry saves the real one.
    const pending = { ...draft, finishedAt }
    update(pending)
    setSaving(true)
    setMessage(undefined)
    try {
      await saveWorkout(pending.id, workout)
      close(`/workouts/history/${pending.id}`, !pending.editing)
    } catch (error) {
      setSaving(false)
      setMessage(
        error instanceof ApiError && error.status === 0
          ? "Saved on this phone. It uploads when you're back online, or tap Finish to try again."
          : (error as Error).message,
      )
    }
  }

  // A finished workout that couldn't upload goes up by itself once the phone is back online.
  const retry = useEffectEvent(() => void finish())
  const waiting = !!draft.finishedAt && !draft.editing
  useEffect(() => {
    if (!waiting) return
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [waiting])

  const discard = () => {
    if (!confirm(draft.editing ? 'Discard your changes to this workout?' : "Discard this workout? Its sets won't be saved.")) return
    close(draft.editing ? `/workouts/history/${draft.id}` : '/workouts')
  }

  const totalSets = draft.exercises.reduce((n, ex) => n + ex.sets.length, 0)
  const doneSets = draft.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0)

  const restLeft = draft.restEndsAt ? Math.ceil((draft.restEndsAt - now.getTime()) / 1000) : 0
  // When the rest is up: a chime, and a buzz on phones that allow it (iPhone Safari doesn't). Then the timer goes away.
  // Coming back long after (the page was closed or in the background) only clears it.
  const restOver = !!draft.restEndsAt && restLeft <= 0
  const endRest = useEffectEvent(() => {
    if (Date.now() - (draft.restEndsAt ?? 0) < 5000) {
      chime()
      navigator.vibrate?.([200, 100, 200])
    }
    update({ ...draft, restEndsAt: undefined, restTotal: undefined })
  })
  useEffect(() => {
    if (restOver) endRest()
  }, [restOver])
  // In the iPhone app, the end of the rest also comes as a notification, for a locked phone.
  useEffect(() => {
    void notifyRestEnd(draft.restEndsAt)
  }, [draft.restEndsAt])

  const finishLabel = saving ? 'Saving…' : draft.editing ? 'Save' : 'Finish'

  return (
    <>
      {/* Like an iOS nav bar: Back keeps the workout going (it stays on this phone); Finish saves it. */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-canvas/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <button onClick={() => navigate('/workouts')} className={plainButton}>
          <Icon name="chevronLeft" className="size-7" />
          Workouts
        </button>
        <button onClick={finish} disabled={saving} className={`${plainButton} px-3 font-semibold`}>
          {finishLabel}
        </button>
      </div>

      <div>
        <input
          value={draft.name}
          onChange={(e) => update({ ...draft, name: e.target.value })}
          aria-label="Workout name"
          maxLength={100}
          className="w-full rounded-lg bg-transparent text-[34px] leading-tight font-bold tracking-tight outline-none focus:ring-2 focus:ring-coral"
        />
        <p className="text-muted tabular-nums">
          {draft.editing ? `Editing · ${formatDay(draft.startedAt)}` : formatClock(now.getTime() - Date.parse(draft.startedAt))}
          {totalSets > 0 && ` · ${doneSets} of ${plural(totalSets, 'set')}`}
        </p>
      </div>

      {draft.exercises.length === 0 && <p className="text-muted">Add your first exercise to get going.</p>}

      {draft.exercises.map((ex, e) => {
        const prev = previous(ex.exerciseId)
        const name = names.get(ex.exerciseId) ?? 'Exercise'
        const isCardioExercise = cardio.has(ex.exerciseId)
        const step = stepFor(ex)
        const rest = restFor(ex.exerciseId)
        const done = ex.sets.map((s) => toSet(ex.exerciseId, s))
        const pr = livePr(workouts, ex.exerciseId, done, draft.editing ? draft.id : undefined)
        // The best estimated 1-rep max checked off so far, next to your best before this workout.
        const bestToday = Math.max(0, ...done.filter((s) => s && s.weight > 0).map((s) => oneRepMax(s!.weight, s!.reps)))
        const bestBefore = bestToday ? estimatedMax(workouts.filter((w) => w.id !== draft.id), tested, ex.exerciseId)?.value : undefined
        return (
          <Card key={`${ex.exerciseId}-${e}`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="flex items-center gap-1.5 pt-2.5 font-semibold text-coral-ink">
                {name}
                {ex.sets.length > 0 && ex.sets.every((s) => s.done) && (
                  <>
                    <Icon name="check" className="size-5 shrink-0 stroke-[3] text-green-ink" />
                    <span className="sr-only">, all sets done</span>
                  </>
                )}
              </h2>
              <button onClick={() => removeExercise(e)} className={`-mr-1 text-[15px] ${plainButton}`}>
                Remove
              </button>
            </div>
            {!isCardioExercise && (
              <div className="mt-1 flex flex-wrap gap-2">
                {/* The phone's own picker under a chip: a tap anywhere on the chip opens it. */}
                <label className={`relative ${chip} focus-within:ring-2 focus-within:ring-coral`}>
                  <Icon name="clock" className="size-4 text-muted" />
                  {rest ? `Rest ${formatClock(rest * 1000)}` : 'No rest timer'}
                  <select
                    value={rest}
                    onChange={(event) => changeRest(ex.exerciseId, Number(event.target.value))}
                    aria-label={`Rest after each set of ${name}`}
                    className="absolute inset-0 opacity-0"
                  >
                    {REST_CHOICES.map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds ? `Rest ${formatClock(seconds * 1000)}` : 'No rest timer'}
                      </option>
                    ))}
                  </select>
                </label>
                {/* ponytail: shown for exercises with "Barbell" in the name, so a custom barbell lift needs it there. */}
                {/barbell/i.test(name) && (
                  <button
                    onClick={() => {
                      const next = Math.max(0, ex.sets.findIndex((x) => !x.done))
                      const hint = prev[next] ?? prev.at(-1)
                      setPlateWeight(ex.sets[next]?.weight || (hint ? String(hint.weight + step) : ''))
                    }}
                    className={chip}
                  >
                    <Icon name="plates" className="size-4 text-muted" />
                    Plates
                  </button>
                )}
              </div>
            )}
            {step > 0 && <p className="mt-2 text-[15px] text-green-ink">↑ You hit every rep last time. Try {step} lb more.</p>}
            <div className="mt-2 grid grid-cols-[2rem_1fr_4.5rem_4rem_2.75rem] items-center gap-x-2 gap-y-1.5 text-center text-[15px]">
              <span className="text-[13px] font-semibold text-muted">SET</span>
              <span className="text-[13px] font-semibold text-muted">PREVIOUS</span>
              <span className="text-[13px] font-semibold text-muted">{isCardioExercise ? 'MI' : 'LB'}</span>
              <span className="text-[13px] font-semibold text-muted">{isCardioExercise ? 'TIME' : 'REPS'}</span>
              {/* A real cell: an sr-only element alone is taken out of the grid and would shift every row. */}
              <span>
                <span className="sr-only">Done</span>
              </span>
              {ex.sets.map((set, s) => {
                const hint = prev[s] ?? prev.at(-1)
                const n = s + 1
                const change = (patch: Partial<DraftSet>) => setExercises(withSet(e, s, patch))
                return (
                  <SetRow
                    key={s}
                    number={n}
                    done={set.done}
                    pr={s === pr}
                    previous={hint && (isCardioExercise ? formatCardio(hint) : hint.weight > 0 ? `${formatWeight(hint.weight)} × ${hint.reps}` : `${hint.reps} reps`)}
                    fields={
                      isCardioExercise
                        ? [
                            { label: `Set ${n} distance in miles`, value: set.distance ?? '', placeholder: hint?.distance ? formatMiles(hint.distance) : undefined, mode: 'decimal', onChange: (distance) => change({ distance }) },
                            { label: `Set ${n} time, in minutes or minutes:seconds`, value: set.time ?? '', placeholder: hint?.durationSeconds ? formatClock(hint.durationSeconds * 1000) : 'min', mode: 'decimal', onChange: (time) => change({ time }) },
                          ]
                        : [
                            { label: `Set ${n} weight in pounds`, value: set.weight, placeholder: hint && `${step ? '↑' : ''}${formatWeight(hint.weight + step)}`, mode: 'decimal', onChange: (weight) => change({ weight }) },
                            { label: `Set ${n} reps`, value: set.reps, placeholder: hint && String(hint.reps), mode: 'numeric', onChange: (reps) => change({ reps }) },
                          ]
                    }
                    onToggle={() => toggleDone(e, s)}
                  />
                )
              })}
            </div>
            {bestToday > 0 && (
              <p className="mt-2 text-[13px] text-muted tabular-nums">
                Est. 1-rep max today {formatWeight(Math.round(bestToday))} lb{bestBefore ? ` · best ${formatWeight(Math.round(bestBefore))} lb` : ''}
              </p>
            )}
            <div className="mt-2 flex justify-between">
              <button onClick={() => addSet(e)} className={plainButton}>
                <Icon name="plus" className="size-5" />
                Add Set
              </button>
              <button onClick={() => removeSet(e)} disabled={ex.sets.length <= 1} className={`text-[15px] ${plainButton}`}>
                Remove Set
              </button>
            </div>
          </Card>
        )
      })}

      <button onClick={() => setPicking(true)} className={`w-full ${tintedButton}`}>
        <Icon name="plus" className="size-5" />
        Add Exercise
      </button>

      {message && <Notice>{message}</Notice>}

      <button onClick={finish} disabled={saving} className={primaryButton}>
        {saving ? 'Saving…' : draft.editing ? 'Save Changes' : 'Finish Workout'}
      </button>
      <button onClick={discard} className={dangerButton}>
        {draft.editing ? 'Cancel Editing' : 'Discard Workout'}
      </button>

      {restLeft > 0 && (
        <>
          <div className="h-16" aria-hidden />
          <RestTimer
            seconds={restLeft}
            total={draft.restTotal ?? REST_SECONDS}
            onAdjust={(by) => update({ ...draft, restEndsAt: Math.max(Date.now(), draft.restEndsAt! + by * 1000) })}
            onSkip={() => update({ ...draft, restEndsAt: undefined, restTotal: undefined })}
          />
        </>
      )}

      {picking && <ExercisePicker exercises={all} recent={recentExercises(workouts)} onPick={pick} onClose={() => setPicking(false)} />}
      {plateWeight !== undefined && <PlateSheet initial={plateWeight} onClose={() => setPlateWeight(undefined)} />}
    </>
  )
}

/** One input in a set row: weight and reps, or a cardio distance and time. */
interface SetField {
  label: string
  value: string
  placeholder: string | undefined
  mode: 'decimal' | 'numeric'
  onChange: (value: string) => void
}

function SetRow({ number, done, pr, previous, fields, onToggle }: {
  number: number
  done: boolean
  pr: boolean // beats every earlier workout: the badge stands in for the set number
  previous: string | undefined
  fields: SetField[]
  onToggle: () => void
}) {
  const input = `${field} px-1 text-center ${done ? 'bg-green/15' : ''}`
  return (
    <>
      {pr ? (
        <span>
          <span className="sr-only">{number} </span>
          <PrBadge />
        </span>
      ) : (
        <span className="font-semibold">{number}</span>
      )}
      <span className="truncate text-muted">{previous ?? '–'}</span>
      {fields.map((f) => (
        <input key={f.label} value={f.value} onChange={(e) => f.onChange(e.target.value)} inputMode={f.mode} placeholder={f.placeholder} aria-label={f.label} className={input} />
      ))}
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={done}
        aria-label={`Set ${number} done`}
        className={`grid size-11 place-items-center rounded-xl transition ${done ? 'bg-green-strong text-white' : 'bg-fill text-muted'}`}
      >
        <Icon name="check" className="size-5 stroke-[3]" />
      </button>
    </>
  )
}

/** Counts down above the tab bar. It counts to a saved end time, so it stays right across reloads and backgrounding. */
function RestTimer({ seconds, total, onAdjust, onSkip }: { seconds: number; total: number; onAdjust: (by: number) => void; onSkip: () => void }) {
  const button = 'min-h-11 rounded-xl bg-coral/12 px-3 text-[15px] font-semibold text-coral-ink active:opacity-70'
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 backdrop-blur-md">
      {/* How much rest is left, as a thin Sunrise bar along the top. */}
      <div className="h-0.5 bg-linear-to-r from-coral to-pink transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }} />
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2">
        <p role="timer" aria-live="off" className="text-[20px] font-semibold tabular-nums">
          Rest {formatClock(seconds * 1000)}
        </p>
        <div className="flex gap-2">
          <button onClick={() => onAdjust(-15)} className={button} aria-label="15 seconds less">
            −15s
          </button>
          <button onClick={() => onAdjust(15)} className={button} aria-label="15 seconds more">
            +15s
          </button>
          <button onClick={onSkip} className={button}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

/** Plate heights, as a share of a 45's. */
const PLATE_HEIGHT: Record<number, number> = { 45: 100, 35: 88, 25: 76, 10: 58, 5: 46, 2.5: 36 }

/** Which plates go on each side of the bar for a total weight (Plates, on a barbell exercise). */
function PlateSheet({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [weight, setWeight] = useState(initial)
  const total = Number(weight) || 0
  const { plates, loaded } = platesPerSide(total)
  return (
    <Sheet title="Plates" onClose={onClose}>
      <input
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        inputMode="decimal"
        placeholder="Total weight, lb"
        aria-label="Total weight in pounds"
        className={`${field} text-center text-[22px] font-semibold`}
      />
      <Card>
        <p className="text-[13px] font-semibold text-muted uppercase">Each side of a {BAR} lb bar</p>
        {plates.length > 0 ? (
          <>
            {/* One end of the bar: its middle on the left, plates loaded heaviest first from the inside out. */}
            <div className="mt-3 flex h-24 items-center" aria-hidden>
              <span className="h-2.5 flex-1 rounded-l-full bg-line" />
              {plates.map((plate, i) => (
                <span key={i} className="ml-0.5 w-3.5 rounded-[4px] bg-linear-to-b from-coral to-pink" style={{ height: `${PLATE_HEIGHT[plate]}%` }} />
              ))}
              <span className="h-2.5 w-6 rounded-r-full bg-line" />
            </div>
            <p className="mt-2 text-[22px] font-bold">{plates.map(formatWeight).join(' + ')}</p>
          </>
        ) : (
          <p className="mt-1">{total === 0 ? 'Enter the total weight.' : total < BAR ? `That's less than the bar alone (${BAR} lb).` : 'Just the bar.'}</p>
        )}
        {total > BAR && loaded !== total && <p className="mt-1 text-[15px] text-muted">That can't be loaded exactly with standard plates. This makes {formatWeight(loaded)} lb.</p>}
      </Card>
    </Sheet>
  )
}
