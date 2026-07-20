'use client'

import { useState } from 'react'
import { useActiveProgram } from '@/hooks/use-active-program'
import { INCREMENTS, LIFT_LABELS, formatVolumePct } from '@/lib/progression'
import type { WorkingWeight } from '@/types/database'
import { PlateCalculatorSheet } from '@/components/today/plate-calculator-sheet'
import { LoadingScreen } from '@/components/layout/page-shell'

const LINEAR_ORDER = ['squat', 'bench', 'incline', 'ohp', 'deadlift', 'row', 'cgbp', 'rdl', 'goodMornings']
const AUTO_ORDER = ['squatVol', 'benchVol', 'inclineVol', 'ohpVol', 'rowVol']

export default function WeightsPage() {
  const { program, weights, loading, refresh } = useActiveProgram()
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [plateOpenKey, setPlateOpenKey] = useState<string | null>(null)

  function startEditing() {
    const vals: Record<string, number> = {}
    for (const key of LINEAR_ORDER) {
      if (weights[key]) vals[key] = weights[key].weight_lbs
    }
    setEditValues(vals)
    setEditing(true)
  }

  async function saveWeight(key: string, value: number) {
    if (!program) return
    setSaving(key)
    try {
      const res = await fetch(`/api/weights/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: program.id, weightLbs: value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Save failed: ${err.error ?? res.statusText}`)
        return
      }
      await refresh()
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : 'network error'}`)
    } finally {
      setSaving(null)
    }
  }

  function handleDoneEditing() {
    setEditing(false)
  }

  if (loading) {
    return <LoadingScreen />
  }

  function renderWeightRow(key: string, ww: WorkingWeight | undefined, type: 'linear' | 'auto') {
    if (!ww) return null
    const isEditable = type === 'linear' && editing
    const inc = INCREMENTS[key]

    return (
      <div
        key={key}
        style={{
          padding: '12px 14px',
          backgroundColor: '#0f0f0f',
          border: `1px solid ${ww.failures >= 2 ? '#f0a500' : '#181818'}`,
          borderLeftWidth: ww.failures >= 2 ? 3 : 1,
          borderLeftColor: ww.failures >= 2 ? '#f0a500' : '#181818',
          borderRadius: 4,
          marginBottom: 8,
          opacity: type === 'auto' ? 0.7 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.8rem', color: '#d0d0d0' }}>
                {LIFT_LABELS[key] ?? key}
              </span>
              {type === 'auto' && (
                <span style={{ fontSize: '0.55rem', color: '#47c8ff', border: '1px solid #47c8ff', borderRadius: 3, padding: '1px 4px' }}>auto @ {formatVolumePct(program?.volume_pct)}</span>
              )}
              {ww.weight_lbs >= (ww.pr_lbs ?? 0) && ww.pr_lbs != null && ww.pr_lbs > 0 && (
                <span style={{ fontSize: '0.55rem', color: '#4aff91', border: '1px solid #4aff91', borderRadius: 3, padding: '1px 4px' }}>PR</span>
              )}
            </div>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {ww.streak > 0 && (
                <span style={{ fontSize: '0.6rem', color: '#4aff91' }}>
                  streak {ww.streak}
                </span>
              )}
              {ww.failures > 0 && (
                <span style={{ fontSize: '0.6rem', color: ww.failures >= 2 ? '#f0a500' : '#666' }}>
                  {ww.failures} fail{ww.failures > 1 ? 's' : ''}
                </span>
              )}
              {ww.pr_lbs != null && ww.pr_lbs > 0 && (
                <span style={{ fontSize: '0.6rem', color: '#555' }}>
                  PR {ww.pr_lbs}
                </span>
              )}
            </div>
            {inc && (
              <div style={{ fontSize: '0.6rem', marginTop: 3, color: '#444' }}>
                +{inc} lbs/session
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', marginLeft: 12 }}>
            {isEditable ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  disabled={saving === key}
                  onClick={() => {
                    const step = INCREMENTS[key] ?? 2.5
                    const newVal = (editValues[key] ?? ww.weight_lbs) - step
                    setEditValues({ ...editValues, [key]: newVal })
                    saveWeight(key, newVal)
                  }}
                  style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#d0d0d0', fontSize: '0.9rem', cursor: 'pointer' }}
                >−</button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editValues[key] ?? ww.weight_lbs}
                  onChange={(e) => setEditValues({ ...editValues, [key]: parseFloat(e.target.value) || 0 })}
                  onBlur={() => {
                    const val = editValues[key]
                    if (val !== undefined && val !== ww.weight_lbs) saveWeight(key, val)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = editValues[key]
                      if (val !== undefined && val !== ww.weight_lbs) saveWeight(key, val)
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                  style={{ width: 64, height: 32, textAlign: 'center', backgroundColor: '#181818', border: '1px solid #333', borderRadius: 4, color: '#d0d0d0', fontSize: '0.85rem' }}
                />
                <button
                  disabled={saving === key}
                  onClick={() => {
                    const step = INCREMENTS[key] ?? 2.5
                    const newVal = (editValues[key] ?? ww.weight_lbs) + step
                    setEditValues({ ...editValues, [key]: newVal })
                    saveWeight(key, newVal)
                  }}
                  style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#d0d0d0', fontSize: '0.9rem', cursor: 'pointer' }}
                >+</button>
                {saving === key && <span style={{ fontSize: '0.6rem', color: '#666' }}>...</span>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPlateOpenKey(key)}
                aria-label={`Calculate plates for ${LIFT_LABELS[key] ?? key}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '1.8rem',
                  color: '#d0d0d0',
                  lineHeight: 1,
                  cursor: 'pointer',
                  textDecoration: 'underline dotted',
                  textUnderlineOffset: 4,
                  textDecorationColor: '#555',
                }}
              >
                {ww.weight_lbs}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #181818', position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: '#e8ff47', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
            WEIGHTS
          </h1>
          <div style={{ fontSize: '0.65rem', color: '#666', marginTop: 3 }}>
            week {program?.week_type} #{program?.week_number ?? 1}
          </div>
        </div>
        <button
          onClick={editing ? handleDoneEditing : startEditing}
          style={{
            padding: '6px 14px',
            borderRadius: 4,
            border: `1px solid ${editing ? '#4aff91' : '#333'}`,
            backgroundColor: editing ? 'rgba(74,255,145,0.08)' : '#181818',
            color: editing ? '#4aff91' : '#d0d0d0',
            fontSize: '0.7rem',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {editing ? 'done' : 'edit'}
        </button>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* Linear lifts */}
        <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          progressable
        </div>
        {LINEAR_ORDER.map((key) => renderWeightRow(key, weights[key], 'linear'))}

        {/* Auto-derived */}
        <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 8, marginTop: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          auto-derived
        </div>
        {AUTO_ORDER.map((key) => renderWeightRow(key, weights[key], 'auto'))}
      </div>

      {plateOpenKey && weights[plateOpenKey] && (
        <PlateCalculatorSheet
          weightLbs={weights[plateOpenKey].weight_lbs}
          open={plateOpenKey !== null}
          onClose={() => setPlateOpenKey(null)}
          label={LIFT_LABELS[plateOpenKey] ?? plateOpenKey}
        />
      )}
    </div>
  )
}
