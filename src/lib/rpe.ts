// Returns the design-token hex color for an RPE value (1-10).
// Buckets:
//   1-4  → green  (#4aff91) — easy
//   5-7  → yellow (#e8ff47) — moderate
//   8-9  → orange (#f0a500) — hard
//   10   → red    (#ff6b47) — max
// Out-of-range inputs fall back to muted text.
export function RPE_COLOR(rpe: number): string {
  if (rpe >= 1 && rpe <= 4) return '#4aff91'
  if (rpe >= 5 && rpe <= 7) return '#e8ff47'
  if (rpe >= 8 && rpe <= 9) return '#f0a500'
  if (rpe === 10) return '#ff6b47'
  return '#666'
}
