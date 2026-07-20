/**
 * Design tokens as importable JS constants. Every value matches the --pp-*
 * CSS custom properties in globals.css (one source of truth; both reference
 * the same hex). Pages use these in inline style objects; components that can
 * use Tailwind can reference the CSS vars directly.
 *
 * Previously these were raw hex literals repeated ~250× across the codebase.
 */
export const C = {
  bg: '#0d0d0d',
  surface: '#0f0f0f',
  border: '#181818',
  borderHover: '#333',
  text: '#d0d0d0',
  muted: '#666',
  mutedDark: '#444',
  mutedDarker: '#555',

  accentLift: '#e8ff47',
  accentRun: '#47c8ff',
  accentCombo: '#c47fff',

  success: '#4aff91',
  warning: '#f0a500',
  danger: '#ff6b47',
  deload: '#ff8c47',
} as const

/** Font family strings. With body-level font rules these are rarely needed
 * (body inherits DM Mono, h1-h3 inherit Bebas), but explicit inline overrides
 * can reference them rather than hand-typing the full fallback chain. */
export const FONT = {
  mono: "'DM Mono', monospace",
  heading: "'Bebas Neue', sans-serif",
} as const
