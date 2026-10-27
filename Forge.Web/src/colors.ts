// Chart colors for graphics drawn in code (rings, bars, lines). They're CSS variables (index.css) so light and dark
// mode each get their own validated steps; use them through `style`, which SVG presentation attributes don't support.

/** The ring colors: Move (workout), Eat (calories), Unlock (Time Out goals). */
export const RING = { move: 'var(--chart-move)', eat: 'var(--chart-eat)', unlock: 'var(--chart-unlock)' }

/** The fat macro bar (protein and carbs use Move and Eat). */
export const FAT = 'var(--chart-fat)'

/** The muscle figures' head, hands and feet, and any muscle not worked (MuscleFigure.tsx). */
export const UNWORKED = 'var(--fill)'

/**
 * Coral, faint to full, mixed with the card color, for worked muscles. It's the ink shade, deep in light mode and light
 * in dark mode, so the strongest step stands out most from the card in both.
 */
export const coral = (percent: number) => `color-mix(in oklab, var(--coral-ink) ${percent}%, var(--surface))`
