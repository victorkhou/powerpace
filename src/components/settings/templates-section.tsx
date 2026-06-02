'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Exercise, WorkoutDay } from '@/types/database'
import { LIFT_LABELS, PROGRESSABLE, AUTO_KEYS, AUTO_PARENT } from '@/lib/progression'
import { optimisticMutate } from '@/lib/optimistic'

type DayWithExercises = WorkoutDay & { exercises: Exercise[] }

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_TYPES: Array<WorkoutDay['type']> = ['lift', 'run', 'combo', 'rest']
const PROGRESSION_TYPES: Array<Exercise['progression_type']> = ['linear', 'auto', 'bodyweight', 'run']
const PROGRESSABLE_KEYS = [...PROGRESSABLE].sort()
const AUTO_VOLUME_KEYS = [...AUTO_KEYS].sort()

const PANEL_BG = '#0f0f0f'
const PANEL_BORDER = '#181818'
const FIELD_BG = '#181818'
const FIELD_BORDER = '#333'
const TEXT_PRIMARY = '#d0d0d0'
const TEXT_MUTED = '#888'
const TEXT_FAINT = '#555'
const ACCENT = '#e8ff47'

const fieldStyle = {
  height: 32,
  padding: '0 8px',
  backgroundColor: FIELD_BG,
  border: `1px solid ${FIELD_BORDER}`,
  borderRadius: 4,
  color: TEXT_PRIMARY,
  fontFamily: "'DM Mono', monospace",
  fontSize: '0.75rem',
} as const

const buttonStyle = {
  padding: '6px 10px',
  backgroundColor: FIELD_BG,
  border: `1px solid ${FIELD_BORDER}`,
  borderRadius: 4,
  color: TEXT_PRIMARY,
  fontFamily: "'DM Mono', monospace",
  fontSize: '0.7rem',
  cursor: 'pointer',
  minHeight: 32,
} as const

export function TemplatesSection() {
  const [days, setDays] = useState<DayWithExercises[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [openDayIds, setOpenDayIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/programs/template')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Failed to load template')
        return
      }
      const data = await res.json()
      setDays(data.days)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (expanded && !days) load()
  }, [expanded, days, load])

  function toggleDay(id: string) {
    setOpenDayIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function patchDay(id: string, patch: Partial<WorkoutDay>) {
    if (!days) return
    const prev = days
    await optimisticMutate({
      onLocalChange: () =>
        setDays((cur) =>
          cur ? cur.map((d) => (d.id === id ? { ...d, ...patch } : d)) : cur
        ),
      onLocalRollback: () => setDays(prev),
      mutation: () =>
        fetch(`/api/workout-days/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }),
      errorMessage: 'Could not save day',
      onError: (msg) => setError(msg),
    })
  }

  async function patchExercise(dayId: string, exerciseId: string, patch: Partial<Exercise>) {
    if (!days) return
    const prev = days
    await optimisticMutate({
      onLocalChange: () =>
        setDays((cur) =>
          cur
            ? cur.map((d) =>
                d.id === dayId
                  ? {
                      ...d,
                      exercises: d.exercises.map((e) =>
                        e.id === exerciseId ? { ...e, ...patch } : e
                      ),
                    }
                  : d
              )
            : cur
        ),
      onLocalRollback: () => setDays(prev),
      mutation: () =>
        fetch(`/api/exercises/${exerciseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }),
      errorMessage: 'Could not save exercise',
      onError: (msg) => setError(msg),
    })
  }

  async function deleteExercise(dayId: string, exerciseId: string) {
    if (!days) return
    if (!confirm('Delete this exercise?')) return
    const prev = days
    setDays((cur) =>
      cur
        ? cur.map((d) =>
            d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseId) } : d
          )
        : cur
    )
    try {
      const res = await fetch(`/api/exercises/${exerciseId}`, { method: 'DELETE' })
      if (!res.ok) {
        setDays(prev)
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Could not delete')
      }
    } catch {
      setDays(prev)
      setError('Network error deleting exercise')
    }
  }

  async function addExercise(dayId: string) {
    if (!days) return
    const day = days.find((d) => d.id === dayId)
    if (!day) return
    const nextSort = day.exercises.length
    const draft = {
      name: 'New exercise',
      sets: 3,
      reps: 5,
      weight_key: null,
      progression_type: 'bodyweight' as const,
      increment_lbs: null,
      is_auto_volume: false,
      parent_key: null,
      is_run: false,
      sort_order: nextSort,
    }
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutDayId: dayId, exercise: draft }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Could not add exercise')
        return
      }
      const data = await res.json()
      setDays((cur) =>
        cur
          ? cur.map((d) =>
              d.id === dayId ? { ...d, exercises: [...d.exercises, data.exercise as Exercise] } : d
            )
          : cur
      )
    } catch {
      setError('Network error adding exercise')
    }
  }

  async function moveExercise(dayId: string, exerciseId: string, dir: -1 | 1) {
    if (!days) return
    const day = days.find((d) => d.id === dayId)
    if (!day) return
    const idx = day.exercises.findIndex((e) => e.id === exerciseId)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= day.exercises.length) return

    const reordered = [...day.exercises]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(newIdx, 0, moved)

    const prev = days
    setDays((cur) =>
      cur
        ? cur.map((d) =>
            d.id === dayId
              ? { ...d, exercises: reordered.map((e, i) => ({ ...e, sort_order: i })) }
              : d
          )
        : cur
    )

    try {
      const res = await fetch('/api/exercises/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutDayId: dayId, orderedIds: reordered.map((e) => e.id) }),
      })
      if (!res.ok) {
        setDays(prev)
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Could not reorder')
      }
    } catch {
      setDays(prev)
      setError('Network error reordering')
    }
  }

  async function resetDay(dayId: string) {
    if (!confirm('Reset this day to defaults? Custom exercises in this day will be deleted.')) return
    try {
      const res = await fetch(`/api/workout-days/${dayId}/reset`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Could not reset')
        return
      }
      await load()
    } catch {
      setError('Network error resetting day')
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setExpanded((s) => !s)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 12px',
          backgroundColor: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 4,
          color: TEXT_PRIMARY,
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.75rem',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <span>workout templates</span>
        <span style={{ color: TEXT_FAINT }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {loading && <p style={{ fontFamily: "'DM Mono', monospace", color: TEXT_FAINT, fontSize: '0.7rem' }}>loading...</p>}
          {error && (
            <p style={{ fontFamily: "'DM Mono', monospace", color: '#ff6b47', fontSize: '0.7rem', marginBottom: 8 }}>
              {error}
            </p>
          )}
          {days?.map((d) => {
            const isOpen = openDayIds.has(d.id)
            const dayLabel = `${DAY_NAMES[d.day_of_week]} · ${d.week_type === 'both' ? 'A+B' : `Week ${d.week_type}`}${d.variant ? ` · ${d.variant}` : ''}`
            return (
              <div
                key={d.id}
                style={{
                  backgroundColor: PANEL_BG,
                  border: `1px solid ${PANEL_BORDER}`,
                  borderRadius: 4,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <button
                  onClick={() => toggleDay(d.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: TEXT_PRIMARY,
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: TEXT_FAINT, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {dayLabel}
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', color: ACCENT, letterSpacing: '0.05em', lineHeight: 1.1 }}>
                      {d.name}
                    </div>
                    {d.tag && (
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: TEXT_MUTED, marginTop: 2 }}>
                        {d.tag}
                      </div>
                    )}
                  </div>
                  <span style={{ color: TEXT_FAINT, fontFamily: "'DM Mono', monospace", fontSize: '0.7rem' }}>{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 12 }}>
                    {/* Day-level fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 10px', alignItems: 'center', marginBottom: 12 }}>
                      <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: TEXT_MUTED }}>name</label>
                      <input
                        type="text"
                        defaultValue={d.name}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== d.name) patchDay(d.id, { name: v }) }}
                        style={{ ...fieldStyle, width: '100%' }}
                      />
                      <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: TEXT_MUTED }}>tag</label>
                      <input
                        type="text"
                        defaultValue={d.tag ?? ''}
                        onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== d.tag) patchDay(d.id, { tag: v }) }}
                        style={{ ...fieldStyle, width: '100%' }}
                      />
                      <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: TEXT_MUTED }}>type</label>
                      <select
                        value={d.type}
                        onChange={(e) => patchDay(d.id, { type: e.target.value as WorkoutDay['type'] })}
                        style={{ ...fieldStyle, width: 120 }}
                      >
                        {DAY_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: TEXT_MUTED }}>volume day</label>
                      <input
                        type="checkbox"
                        checked={d.is_volume}
                        onChange={(e) => patchDay(d.id, { is_volume: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: ACCENT, justifySelf: 'start' }}
                      />
                    </div>

                    {/* Exercises */}
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: TEXT_FAINT, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                      exercises
                    </div>
                    {d.exercises.length === 0 && (
                      <p style={{ fontFamily: "'DM Mono', monospace", color: TEXT_FAINT, fontSize: '0.7rem' }}>(none)</p>
                    )}
                    {d.exercises.map((e, idx) => (
                      <ExerciseRow
                        key={e.id}
                        ex={e}
                        index={idx}
                        total={d.exercises.length}
                        onPatch={(patch) => patchExercise(d.id, e.id, patch)}
                        onDelete={() => deleteExercise(d.id, e.id)}
                        onMove={(dir) => moveExercise(d.id, e.id, dir)}
                      />
                    ))}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => addExercise(d.id)} style={buttonStyle}>+ add exercise</button>
                      <button onClick={() => resetDay(d.id)} style={{ ...buttonStyle, color: '#ff6b47' }}>reset to defaults</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExerciseRow({
  ex,
  index,
  total,
  onPatch,
  onDelete,
  onMove,
}: {
  ex: Exercise
  index: number
  total: number
  onPatch: (patch: Partial<Exercise>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  function changeProgression(next: Exercise['progression_type']) {
    const patch: Partial<Exercise> = { progression_type: next }
    if (next === 'bodyweight' || next === 'run') {
      patch.weight_key = null
      patch.parent_key = null
      patch.increment_lbs = null
      patch.is_auto_volume = false
      patch.is_run = next === 'run'
    } else if (next === 'linear') {
      const fallback = PROGRESSABLE_KEYS[0] ?? null
      patch.weight_key = PROGRESSABLE.has(ex.weight_key ?? '') ? ex.weight_key : fallback
      patch.parent_key = null
      patch.is_auto_volume = false
      patch.is_run = false
      patch.increment_lbs = ex.increment_lbs ?? 5
    } else if (next === 'auto') {
      const fallback = AUTO_VOLUME_KEYS[0] ?? null
      const wk = AUTO_KEYS.has(ex.weight_key ?? '') ? ex.weight_key : fallback
      patch.weight_key = wk
      patch.parent_key = wk ? AUTO_PARENT[wk] ?? null : null
      patch.is_auto_volume = true
      patch.is_run = false
      patch.increment_lbs = null
    }
    onPatch(patch)
  }

  function changeAutoWeightKey(wk: string) {
    onPatch({ weight_key: wk, parent_key: AUTO_PARENT[wk] ?? null })
  }

  return (
    <div
      style={{
        backgroundColor: '#0d0d0d',
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 4,
        padding: 10,
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text"
          defaultValue={ex.name}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== ex.name) onPatch({ name: v }) }}
          style={{ ...fieldStyle, flex: 1, minWidth: 100 }}
        />
        <button onClick={() => onMove(-1)} disabled={index === 0} style={{ ...buttonStyle, padding: '6px 8px', opacity: index === 0 ? 0.3 : 1 }}>↑</button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} style={{ ...buttonStyle, padding: '6px 8px', opacity: index === total - 1 ? 0.3 : 1 }}>↓</button>
        <button onClick={onDelete} style={{ ...buttonStyle, padding: '6px 8px', color: '#ff6b47' }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Field label="sets">
          <input
            type="number"
            min={1}
            max={20}
            defaultValue={ex.sets}
            onBlur={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 20 && v !== ex.sets) onPatch({ sets: v }) }}
            style={{ ...fieldStyle, width: 56 }}
          />
        </Field>
        <Field label="reps">
          <input
            type="number"
            min={1}
            max={50}
            defaultValue={ex.reps}
            onBlur={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 50 && v !== ex.reps) onPatch({ reps: v }) }}
            style={{ ...fieldStyle, width: 56 }}
          />
        </Field>
        <Field label="progression">
          <select
            value={ex.progression_type}
            onChange={(e) => changeProgression(e.target.value as Exercise['progression_type'])}
            style={{ ...fieldStyle, width: 110 }}
          >
            {PROGRESSION_TYPES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        {ex.progression_type === 'linear' && (
          <>
            <Field label="lift">
              <select
                value={ex.weight_key ?? ''}
                onChange={(e) => onPatch({ weight_key: e.target.value || null })}
                style={{ ...fieldStyle, width: 130 }}
              >
                {PROGRESSABLE_KEYS.map((k) => (
                  <option key={k} value={k}>{LIFT_LABELS[k] ?? k}</option>
                ))}
              </select>
            </Field>
            <Field label="incr (lb)">
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                defaultValue={ex.increment_lbs ?? 5}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0 && v <= 50 && v !== ex.increment_lbs) onPatch({ increment_lbs: v }) }}
                style={{ ...fieldStyle, width: 70 }}
              />
            </Field>
          </>
        )}
        {ex.progression_type === 'auto' && (
          <Field label="volume key">
            <select
              value={ex.weight_key ?? ''}
              onChange={(e) => changeAutoWeightKey(e.target.value)}
              style={{ ...fieldStyle, width: 140 }}
            >
              {AUTO_VOLUME_KEYS.map((k) => (
                <option key={k} value={k}>{LIFT_LABELS[k] ?? k}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: TEXT_FAINT, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  )
}
