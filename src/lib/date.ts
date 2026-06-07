export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isFriday(dateString: string): boolean {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 5
}

export function activeProgramQuery(): string {
  const now = new Date()
  return `?dow=${now.getDay()}&date=${localDateKey(now)}`
}

/** Monday-anchored start of the local week containing `d` (default: today). */
export function startOfWeekKey(d: Date = new Date()): string {
  const dow = d.getDay() // 0=Sun
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday))
}

/** All YYYY-MM-DD keys in the `len`-day window starting at `startKey`. */
export function weekWindowKeys(startKey: string, len: number): string[] {
  const [y, m, d] = startKey.split('-').map(Number)
  return Array.from({ length: len }, (_, i) => localDateKey(new Date(y, m - 1, d + i)))
}
