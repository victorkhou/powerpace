'use client'

import { useCallback, useEffect, useState } from 'react'
import { startOfWeekKey } from '@/lib/date'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TYPE_COLOR: Record<string, string> = {
  lift: '#e8ff47',
  run: '#47c8ff',
  combo: '#c47fff',
  rest: '#333',
}

type TemplateDay = {
  id: string
  day_of_week: number
  week_type: string
  variant: string | null
  name: string
  type: string
  tag: string | null
  is_volume: boolean
}

type ScheduleRow = {
  date: string
  dayOfWeek: number
  naturalWorkoutDayId: string | null
  resolvedWorkoutDayId: string | null
  isOverridden: boolean
  sessionStatus: string | null
  locked: boolean
}

export function WeekSwap({ onChanged }: { onChanged?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [daysById, setDaysById] = useState<Map<string, TemplateDay>>(new Map())
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const start = startOfWeekKey()
    try {
      const res = await fetch(`/api/schedule/overrides?start=${start}&days=7`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Failed to load week')
        return
      }
      const data = await res.json()
      setDaysById(new Map((data.days as TemplateDay[]).map((d) => [d.id, d])))
      setSchedule(data.schedule as ScheduleRow[])
      setLoadedWeek(start)
      setSelected([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on expand, and reload whenever the panel is open but the loaded data
  // belongs to a previous week (e.g. left open across a midnight/week boundary).
  useEffect(() => {
    if (expanded && loadedWeek !== startOfWeekKey()) load()
  }, [expanded, loadedWeek, load])

  function toggleSelect(date: string, locked: boolean) {
    if (locked) return
    setError(null)
    setSelected((cur) => {
      if (cur.includes(date)) return cur.filter((d) => d !== date)
      if (cur.length === 2) return [cur[1], date]
      return [...cur, date]
    })
  }

  async function doSwap() {
    if (selected.length !== 2) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/schedule/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateA: selected[0], dateB: selected[1] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Swap failed')
        return
      }
      setSelected([])
      await load()
      onChanged?.()
    } catch {
      setError('Network error during swap')
    } finally {
      setBusy(false)
    }
  }

  async function clearOverride(date: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule/overrides?date=${date}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Could not clear')
        return
      }
      await load()
      onChanged?.()
    } catch {
      setError('Network error clearing override')
    } finally {
      setBusy(false)
    }
  }

  const anyOverride = schedule.some((s) => s.isOverridden)

  return (
    <div style={{ padding: '0 16px', marginBottom: 8 }}>
      <button
        onClick={() => setExpanded((s) => !s)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 12px',
          backgroundColor: '#0f0f0f',
          border: '1px solid #181818',
          borderRadius: 4,
          color: '#d0d0d0',
          fontSize: '0.75rem',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <span>swap this week{anyOverride ? ' ·' : ''}{anyOverride ? <span style={{ color: '#47c8ff' }}> active</span> : ''}</span>
        <span style={{ color: '#555' }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {loading && <p style={{ color: '#555', fontSize: '0.7rem' }}>loading...</p>}
          {error && (
            <p style={{ color: '#ff6b47', fontSize: '0.7rem', marginBottom: 8 }}>
              {error}
            </p>
          )}

          <p style={{ color: '#555', fontSize: '0.62rem', marginBottom: 8, lineHeight: 1.4 }}>
            pick two days to swap their workouts for this week. logged days are locked.
          </p>

          {schedule.map((row) => {
            const wd = row.resolvedWorkoutDayId ? daysById.get(row.resolvedWorkoutDayId) : null
            const isSelected = selected.includes(row.date)
            const accent = wd ? TYPE_COLOR[wd.type] ?? '#444' : '#444'
            const [, mm, dd] = row.date.split('-')
            return (
              <div
                key={row.date}
                onClick={() => toggleSelect(row.date, row.locked)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  marginBottom: 6,
                  borderRadius: 4,
                  border: `1px solid ${isSelected ? '#e8ff47' : '#181818'}`,
                  backgroundColor: isSelected ? 'rgba(232,255,71,0.06)' : '#0d0d0d',
                  cursor: row.locked ? 'not-allowed' : 'pointer',
                  opacity: row.locked ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.62rem', color: '#555', minWidth: 54 }}>
                    {DAY_NAMES[row.dayOfWeek]} {mm}/{dd}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: wd ? '#d0d0d0' : '#444', borderLeft: `2px solid ${accent}`, paddingLeft: 8 }}>
                    {wd?.name ?? 'Rest'}
                  </span>
                  {wd?.variant && (
                    <span style={{ fontSize: '0.55rem', color: '#c47fff', border: '1px solid #c47fff', borderRadius: 3, padding: '1px 4px' }}>
                      {wd.variant}
                    </span>
                  )}
                  {row.isOverridden && (
                    <span style={{ fontSize: '0.55rem', color: '#47c8ff', border: '1px solid #47c8ff', borderRadius: 3, padding: '1px 4px' }}>
                      moved
                    </span>
                  )}
                  {row.locked && (
                    <span style={{ fontSize: '0.55rem', color: '#888' }}>
                      logged
                    </span>
                  )}
                </div>
                {row.isOverridden && !row.locked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); clearOverride(row.date) }}
                    disabled={busy}
                    style={{
                      background: 'none',
                      border: '1px solid #333',
                      borderRadius: 3,
                      color: '#888',
                              fontSize: '0.6rem',
                      padding: '3px 7px',
                      cursor: 'pointer',
                    }}
                  >
                    reset
                  </button>
                )}
              </div>
            )
          })}

          <button
            onClick={doSwap}
            disabled={selected.length !== 2 || busy}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '10px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: selected.length === 2 && !busy ? '#e8ff47' : '#1a1a1a',
              color: selected.length === 2 && !busy ? '#000' : '#555',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: selected.length === 2 && !busy ? 'pointer' : 'default',
              minHeight: 44,
            }}
          >
            {busy ? '...' : selected.length === 2 ? 'swap selected days' : `select ${2 - selected.length} more`}
          </button>
        </div>
      )}
    </div>
  )
}
