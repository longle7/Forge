import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { parseDate } from './dates'
import { niceTicks, shortDate, type Bucket } from './progress'

// Hand-drawn SVG charts for Progress, after the dataviz guide: 2 px lines, bars ≤ 24 px with 4 px rounded tops and a
// 2 px gap, hairline solid gridlines, a crosshair (or per-bar) readout on pointer and keyboard, text in text colors
// (never the series color), and a table view under each chart. Colors come in as CSS variables (see colors.ts).

const W = 320
const H = 170
const PAD = { top: 18, right: 10, bottom: 22, left: 38 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const BASE = H - PAD.bottom

/** Arrow keys walk the points; Home/End jump to the ends; Escape (or leaving) hides the readout. */
function useReadout(count: number) {
  const [active, setActive] = useState<number>()
  const onKeyDown = (e: KeyboardEvent) => {
    const at = active ?? count - 1
    const next = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: count - 1 }[e.key]
    if (e.key === 'Escape') setActive(undefined)
    if (next === undefined) return
    e.preventDefault()
    setActive(Math.max(0, Math.min(count - 1, next)))
  }
  return { active, setActive, onKeyDown, clear: () => setActive(undefined) }
}

/** Where the pointer is, in chart units (0..W). */
const pointerX = (e: PointerEvent<SVGElement>) => {
  const box = (e.currentTarget.ownerSVGElement ?? (e.currentTarget as SVGSVGElement)).getBoundingClientRect()
  return ((e.clientX - box.left) / box.width) * W
}

function Frame({ label, readout, children, onKeyDown, onBlur }: { label: string; readout?: { x: number; value: string; detail: string }; children: ReactNode; onKeyDown: (e: KeyboardEvent) => void; onBlur: () => void }) {
  return (
    <div className="relative mt-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-coral" tabIndex={0} role="group" aria-label={`${label}. Use the arrow keys to read each value.`} onKeyDown={onKeyDown} onBlur={onBlur}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible select-none" aria-hidden>
        {children}
      </svg>
      {readout && (
        // Values lead, labels follow: the number is what you came for.
        <div
          role="status"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-center text-[13px] leading-tight whitespace-nowrap text-canvas shadow-md"
          style={{ left: `${Math.min(84, Math.max(16, (readout.x / W) * 100))}%` }}
        >
          <span className="block font-semibold">{readout.value}</span>
          <span className="block opacity-75">{readout.detail}</span>
        </div>
      )}
    </div>
  )
}

function YAxis({ ticks, y, format }: { ticks: number[]; y: (v: number) => number; format: (v: number) => string }) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} strokeWidth={1} style={{ stroke: 'var(--line)' }} />
          <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} style={{ fill: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {format(t)}
          </text>
        </g>
      ))}
    </>
  )
}

function XLabels({ first, last }: { first: string; last: string }) {
  return (
    <>
      <text x={PAD.left} y={H - 5} fontSize={11} style={{ fill: 'var(--muted)' }}>
        {first}
      </text>
      <text x={W - PAD.right} y={H - 5} textAnchor="end" fontSize={11} style={{ fill: 'var(--muted)' }}>
        {last}
      </text>
    </>
  )
}

/** One series over time (e.g. body weight): a 2 px line, a 10% wash under it, the latest value labeled at its end. */
export function LineChart({ points, label, color, format, axis = format }: {
  points: { day: string; value: number }[]
  label: string
  color: string
  format: (value: number) => string
  axis?: (value: number) => string
}) {
  const { active, setActive, onKeyDown, clear } = useReadout(points.length)
  const times = points.map((p) => parseDate(p.day).getTime())
  const [t0, t1] = [times[0], times.at(-1)!]
  const ticks = niceTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)))
  const [v0, v1] = [ticks[0], ticks.at(-1)!]
  const x = (t: number) => PAD.left + (t1 === t0 ? PLOT_W / 2 : ((t - t0) / (t1 - t0)) * PLOT_W)
  const y = (v: number) => PAD.top + (1 - (v - v0) / (v1 - v0)) * PLOT_H
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const shown = active ?? points.length - 1
  const end = points.at(-1)!

  return (
    <Frame
      label={label}
      onKeyDown={onKeyDown}
      onBlur={clear}
      readout={active === undefined ? undefined : { x: x(times[active]), value: format(points[active].value), detail: shortDate(points[active].day) }}
    >
      <YAxis ticks={ticks} y={y} format={axis} />
      <XLabels first={shortDate(points[0].day)} last={shortDate(end.day)} />
      <path d={`${line}L${x(t1).toFixed(1)},${BASE}L${x(t0).toFixed(1)},${BASE}Z`} style={{ fill: color }} fillOpacity={0.1} />
      <path d={line} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }} />
      {active !== undefined && <line x1={x(times[active])} x2={x(times[active])} y1={PAD.top} y2={BASE} strokeWidth={1} style={{ stroke: 'var(--muted)' }} />}
      <circle cx={x(times[shown])} cy={y(points[shown].value)} r={4.5} strokeWidth={2} style={{ fill: color, stroke: 'var(--surface)' }} />
      {active === undefined && (
        // Below the point when the line comes down into it, above when it climbs, so the label sits clear of the line;
        // a halo in the card's color keeps it readable wherever it lands.
        <text
          x={Math.min(x(t1), W - PAD.right)}
          y={points.length > 1 && points.at(-2)!.value > end.value ? y(end.value) + 20 : y(end.value) - 10}
          textAnchor="end"
          fontSize={13}
          fontWeight={600}
          strokeWidth={4}
          strokeLinejoin="round"
          style={{ fill: 'var(--ink)', stroke: 'var(--surface)', paintOrder: 'stroke' }}
        >
          {format(end.value)}
        </text>
      )}
      {/* The hit area is the whole plot: the crosshair snaps to the nearest point, so nobody has to aim at a 2 px line. */}
      <rect
        x={PAD.left}
        y={0}
        width={PLOT_W}
        height={BASE}
        fill="transparent"
        onPointerMove={(e) => {
          const px = pointerX(e)
          setActive(times.reduce((best, t, i) => (Math.abs(x(t) - px) < Math.abs(x(times[best]) - px) ? i : best), 0))
        }}
        onPointerLeave={clear}
      />
    </Frame>
  )
}

/** A bar's path: 4 px rounded top, square at the baseline. */
const topRounded = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},${-r}H${x + w - r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`
}

/** One value per day, week, or month (e.g. calories), with an optional goal line. Empty periods stay empty. */
export function BarChart({ bars, bucket, goal, label, color, format }: {
  bars: { start: string; value: number | undefined }[]
  bucket: Bucket
  goal?: number
  label: string
  color: string
  format: (value: number) => string
}) {
  const { active, setActive, onKeyDown, clear } = useReadout(bars.length)
  const ticks = niceTicks(0, Math.max(goal ?? 0, ...bars.map((b) => b.value ?? 0), 1))
  const top = ticks.at(-1)!
  const y = (v: number) => PAD.top + (1 - v / top) * PLOT_H
  const slot = PLOT_W / bars.length
  const width = Math.max(2, Math.min(24, slot - 2)) // never wider than 24 px, and a 2 px surface gap between neighbors
  const center = (i: number) => PAD.left + slot * i + slot / 2
  const period = (start: string) => (bucket === 'day' ? shortDate(start) : bucket === 'week' ? `Week of ${shortDate(start)}` : shortDate(start, 'month'))

  return (
    <Frame
      label={label}
      onKeyDown={onKeyDown}
      onBlur={clear}
      readout={
        active === undefined ? undefined
        : { x: center(active), value: bars[active].value === undefined ? 'Nothing logged' : format(bars[active].value!), detail: period(bars[active].start) }
      }
    >
      <YAxis ticks={ticks} y={y} format={(v) => (v >= 1000 ? `${v / 1000}K` : String(v))} />
      <XLabels first={shortDate(bars[0].start, bucket)} last={shortDate(bars.at(-1)!.start, bucket)} />
      {bars.map((bar, i) =>
        bar.value === undefined || bar.value <= 0 ? null : (
          <path
            key={bar.start}
            d={topRounded(center(i) - width / 2, y(bar.value), width, BASE - y(bar.value))}
            style={{ fill: color }}
            opacity={active === undefined || active === i ? 1 : 0.45}
          />
        ),
      )}
      {goal !== undefined && goal > 0 && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(goal)} y2={y(goal)} strokeWidth={1} style={{ stroke: 'var(--ink)' }} strokeOpacity={0.55} />
          <text
            x={W - PAD.right}
            y={y(goal) - 5}
            textAnchor="end"
            fontSize={11}
            fontWeight={600}
            strokeWidth={4}
            strokeLinejoin="round"
            style={{ fill: 'var(--ink)', stroke: 'var(--surface)', paintOrder: 'stroke' }}
          >
            Goal {format(goal)}
          </text>
        </g>
      )}
      {/* Each slot is its bar's hit area: taller and wider than the bar itself. */}
      {bars.map((bar, i) => (
        <rect key={bar.start} x={PAD.left + slot * i} y={0} width={slot} height={BASE} fill="transparent" onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)} onPointerLeave={clear} />
      ))}
    </Frame>
  )
}

/** A small trend inside a stat tile: the line in a quiet gray, the latest point in the accent. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const [w, h, pad] = [96, 32, 5]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (i: number) => (values.length < 2 ? w / 2 : pad + (i / (values.length - 1)) * (w - 2 * pad))
  const y = (v: number) => (max === min ? h / 2 : pad + (1 - (v - min) / (max - min)) * (h - 2 * pad))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      {values.length > 1 && (
        <path d={values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--muted)' }} strokeOpacity={0.6} />
      )}
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={4} strokeWidth={2} style={{ fill: color, stroke: 'var(--surface)' }} />
    </svg>
  )
}

/** Every chart's values as a plain table, for screen readers and anyone who'd rather read the numbers. */
export function ChartTable({ caption, rows }: { caption: string; rows: [string, string][] }) {
  return (
    <details className="mt-2 text-[13px]">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-coral-ink">Show as a table</summary>
      <table className="w-full tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {rows.map(([name, value]) => (
            <tr key={name} className="border-t border-line">
              <td className="py-1.5 text-muted">{name}</td>
              <td className="py-1.5 text-right">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
