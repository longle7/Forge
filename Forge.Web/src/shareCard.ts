import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { HeartRatePoint, Workout } from './api'
import { formatDay, formatDuration, formatMiles, formatTime, formatWeight, isCardioSet, isWarmup, plural, volume, workoutLength } from './workouts'

// A finished workout as an image to post or send: 1080 × 1350 (4:5, the tallest a photo shows in Instagram's feed),
// drawn on a canvas in the app's light Sunrise colors (index.css) whatever mode the phone is in.

const W = 1080
const H = 1350
const PAD = 88
const INNER = W - 2 * PAD

const COLOR = {
  canvas: '#fff7f0',
  surface: '#ffffff',
  ink: '#2a1f1a',
  muted: '#7d675b',
  coral: '#ff6b4a',
  pink: '#ff4f8b',
  amber: '#ffb238',
  amberInk: '#9a5b00',
  heart: '#e2306f', // Progress's pink chart color, validated on white
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The largest font size from `largest` down to `smallest` (4 px steps) at which `text` fits `width`, cut short with
 * "…" when it doesn't fit even at the smallest. `measure` is the drawn width of some text at a size.
 */
export function fitText(text: string, width: number, largest: number, smallest: number, measure: (text: string, size: number) => number): { text: string; size: number } {
  let size = largest
  while (size > smallest && measure(text, size) > width) size -= 4
  const cut = (end: number) => (end < text.length ? `${text.slice(0, end).trimEnd()}…` : text)
  let end = text.length
  while (end > 1 && measure(cut(end), size) > width) end--
  return { text: cut(end), size }
}

/** Names joined with " · ", as many as `fits`, then "+2 more" for the rest. */
export function fitList(items: string[], fits: (text: string) => boolean): string {
  const line = (n: number) => items.slice(0, n).join(' · ') + (n < items.length ? ` +${items.length - n} more` : '')
  let n = items.length
  while (n > 1 && !fits(line(n))) n--
  return line(n)
}

/** Heart rate as points in `box`: time across, the lowest reading at the bottom and the highest at the top. */
export function heartRateLine(points: HeartRatePoint[], box: Box): [number, number][] {
  const [first, last] = [points[0].s, points.at(-1)!.s]
  const bpms = points.map((p) => p.bpm)
  const [low, high] = [Math.min(...bpms), Math.max(...bpms)]
  return points.map((p) => [
    box.x + (last === first ? box.width / 2 : ((p.s - first) / (last - first)) * box.width),
    box.y + (high === low ? box.height / 2 : (1 - (p.bpm - low) / (high - low)) * box.height),
  ])
}

type Stat = { label: string; value: string }

/**
 * The card's tiles, at most four (two rows): its time, what it added up to, then the Watch's numbers. An average heart
 * rate that doesn't fit is still on the heart rate chart.
 */
export function cardStats(workout: Workout): Stat[] {
  const miles = workout.sets.reduce((sum, s) => sum + (s.distance ?? 0), 0)
  const lifts = workout.sets.filter((s) => !isCardioSet(s) && !isWarmup(s)).length
  const stats: (Stat | false | null | undefined | 0)[] = [
    { label: 'Time', value: formatDuration(workoutLength(workout)) },
    miles > 0 && { label: 'Distance', value: `${formatMiles(miles)} mi` },
    volume(workout) > 0 && { label: 'Volume', value: `${formatWeight(volume(workout))} lb` },
    lifts > 0 && { label: 'Sets', value: String(lifts) },
    workout.activeCalories && { label: 'Active calories', value: `${Math.round(workout.activeCalories).toLocaleString()} kcal` },
    workout.avgHeartRate && { label: 'Avg heart rate', value: `${workout.avgHeartRate} bpm` },
  ]
  return stats.filter((s): s is Stat => !!s).slice(0, 4)
}

/** A rounded rectangle as a path (ctx.roundRect needs iOS 16; the app runs on iOS 15). */
const rounded = ({ x, y, width: w, height: h }: Box, r: number) =>
  new Path2D(`M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${2 * r - w}a${r},${r} 0 0 1 ${-r},${-r}v${2 * r - h}a${r},${r} 0 0 1 ${r},${-r}z`)

/** The workout as a PNG: its name, date, time and totals, the Watch's calories and heart rate, its PRs, and Forge's mark. */
export async function drawShareCard(workout: Workout, { prCount, names }: { prCount: number; names: Map<number, string> }): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const family = getComputedStyle(document.body).fontFamily // index.css's system font stack
  const font = (size: number, weight: number) => (ctx.font = `${weight} ${size}px ${family}`)
  const measure = (weight: number) => (text: string, size: number) => (font(size, weight), ctx.measureText(text).width)
  // Text sits on its baseline at `y`.
  const text = (value: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = 'left') => {
    font(size, weight)
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(value, x, y)
  }
  // A white card, lifted off the cream like the app's.
  const panel = (box: Box) => {
    ctx.save()
    ctx.shadowColor = 'rgba(42, 31, 26, 0.08)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 6
    ctx.fillStyle = COLOR.surface
    ctx.fill(rounded(box, 40))
    ctx.restore()
  }

  // The cream canvas, with the sunrise glowing in from the top right.
  ctx.fillStyle = COLOR.canvas
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 900)
  glow.addColorStop(0, 'rgba(255, 107, 74, 0.28)')
  glow.addColorStop(0.5, 'rgba(255, 79, 139, 0.10)')
  glow.addColorStop(1, 'rgba(255, 79, 139, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Top to bottom: when, the name, its exercises, the numbers (two to a row), then the heart rate chart filling the
  // space down to Forge's mark. With no chart, the rest sits in the middle of that space instead.
  const stats = cardStats(workout)
  const points = workout.heartRate ?? []
  const [gap, tileH] = [24, 172]
  const tileW = (INNER - gap) / 2
  const footer = H - PAD - 80
  const tilesEnd = 364 + Math.ceil(stats.length / 2) * (tileH + gap) - gap
  const top = points.length > 1 ? 0 : (footer - 48 - tilesEnd) / 2

  text(`${formatDay(workout.startedAt)} · ${formatTime(workout.startedAt)}`.toUpperCase(), PAD, top + 132, 32, 700, COLOR.muted)
  const name = fitText(workout.name, INNER, 104, 64, measure(700))
  text(name.text, PAD, top + 248, name.size, 700, COLOR.ink)
  const exercises = [...new Set(workout.sets.flatMap((s) => names.get(s.exerciseId) ?? []))] // each once, in the order first done
  const fitsLine = (line: string) => measure(500)(line, 40) <= INNER
  const subtitle = exercises.length ? fitList(exercises, fitsLine) : workout.source === 'health' ? 'From Apple Health' : ''
  text(fitText(subtitle, INNER, 40, 40, measure(500)).text, PAD, top + 312, 40, 500, COLOR.muted)

  // An odd last tile takes the whole row.
  stats.forEach((stat, i) => {
    const box = { x: PAD + (i % 2) * (tileW + gap), y: top + 364 + Math.floor(i / 2) * (tileH + gap), width: i === stats.length - 1 && i % 2 === 0 ? INNER : tileW, height: tileH }
    panel(box)
    text(stat.label, box.x + 40, box.y + 62, 30, 600, COLOR.muted)
    const value = fitText(stat.value, box.width - 80, 68, 44, measure(700))
    text(value.text, box.x + 40, box.y + 138, value.size, 700, COLOR.ink)
  })

  // Heart rate over the workout: a 2 pt line (as the app draws it) over a light wash, with its average and max.
  if (points.length > 1) {
    const chart = { x: PAD, y: tilesEnd + 40, width: INNER, height: footer - 48 - tilesEnd - 40 }
    panel(chart)
    text('Heart rate', chart.x + 40, chart.y + 70, 32, 700, COLOR.ink)
    const summary = [workout.avgHeartRate && `avg ${workout.avgHeartRate}`, workout.maxHeartRate && `max ${workout.maxHeartRate}`].filter(Boolean).join(' · ')
    if (summary) text(`${summary} bpm`, chart.x + chart.width - 40, chart.y + 70, 30, 600, COLOR.muted, 'right')
    const plot = { x: chart.x + 40, y: chart.y + 112, width: chart.width - 80, height: chart.height - 152 }
    const line = heartRateLine(points, plot)
    const path = new Path2D(line.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(''))
    const wash = new Path2D(path)
    wash.lineTo(line.at(-1)![0], plot.y + plot.height)
    wash.lineTo(line[0][0], plot.y + plot.height)
    ctx.fillStyle = COLOR.heart
    ctx.globalAlpha = 0.1
    ctx.fill(wash)
    ctx.globalAlpha = 1
    ctx.strokeStyle = COLOR.heart
    ctx.lineWidth = 6
    ctx.lineCap = ctx.lineJoin = 'round'
    ctx.stroke(path)
  }

  // Forge's mark: the app icon (a white dumbbell on the sunrise gradient, as in favicon.svg) and the name.
  const icon = { x: PAD, y: footer, width: 80, height: 80 }
  const sunrise = ctx.createLinearGradient(icon.x, icon.y, icon.x + icon.width, icon.y + icon.height)
  sunrise.addColorStop(0, COLOR.coral)
  sunrise.addColorStop(1, COLOR.pink)
  ctx.fillStyle = sunrise
  ctx.fill(rounded(icon, 18))
  ctx.fillStyle = '#fff'
  const unit = icon.width / 64
  for (const [x, y, width, height, r] of [[9, 23, 6, 18, 2], [16, 16, 8, 32, 2], [24, 29, 16, 6, 0], [40, 16, 8, 32, 2], [49, 23, 6, 18, 2]]) {
    ctx.fill(rounded({ x: icon.x + x * unit, y: icon.y + y * unit, width: width * unit, height: height * unit }, r * unit))
  }
  text('Forge', icon.x + icon.width + 24, icon.y + 58, 52, 800, COLOR.ink)

  // PRs across from it: an amber pill, like the app's PR badge.
  if (prCount > 0) {
    const label = plural(prCount, 'new PR')
    const width = measure(700)(label, 38) + 80
    const pill = { x: W - PAD - width, y: footer, width, height: 80 }
    ctx.fillStyle = 'rgba(255, 178, 56, 0.22)'
    ctx.fill(rounded(pill, 40))
    text(label, pill.x + 40, pill.y + 54, 38, 700, COLOR.amberInk)
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image. Please try again."))), 'image/png'))
}

/** A Blob's bytes as base64, which is how Filesystem takes them on the iPhone. */
const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/**
 * In the iPhone app, the share sheet with the image (Messages, Instagram, Save Image, …); on the website, a download.
 * Closing the share sheet without sharing isn't an error.
 */
export async function shareImage(image: Blob, fileName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(image)
    Object.assign(document.createElement('a'), { href: url, download: fileName }).click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000) // once the download has surely started
    return
  }
  try {
    // The share sheet takes files by URL, so the image goes in the app's cache first (iOS empties it as needed).
    const { uri } = await Filesystem.writeFile({ path: fileName, data: await base64(image), directory: Directory.Cache })
    await Share.share({ files: [uri] })
  } catch (error) {
    if ((error as Error).message !== 'Share canceled') throw new Error("Couldn't share this workout. Please try again.")
  }
}
