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
