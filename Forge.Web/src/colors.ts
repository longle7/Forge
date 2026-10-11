// Chart colors for graphics drawn in code (rings, bars, lines). They're CSS variables (index.css) so light and dark
// mode each get their own validated steps; use them through `style`, which SVG presentation attributes don't support.

/** The ring colors: Move (workout), Eat (calories), Unlock (Time Out goals). */
export const RING = { move: 'var(--chart-move)', eat: 'var(--chart-eat)', unlock: 'var(--chart-unlock)' }

/** The fat macro bar (protein and carbs use Move and Eat). */
export const FAT = 'var(--chart-fat)'
