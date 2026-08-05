'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActiveProgram } from '@/hooks/use-active-program'
import { localDateKey } from '@/lib/date'
import { TemplatesSection } from '@/components/settings/templates-section'
import { LoadingScreen } from '@/components/layout/page-shell'

export default function SettingsPage() {
  const { program, loading, refresh } = useActiveProgram()
  const clearProgram = useAppStore((s) => s.clearProgram)
  const resetSession = useSessionStore((s) => s.reset)
  const router = useRouter()
  const [weekInput, setWeekInput] = useState('')
  const [typeInput, setTypeInput] = useState<'A' | 'B'>('A')
  const [correcting, setCorrecting] = useState(false)
  const [deloadInput, setDeloadInput] = useState('')
  const [volumeInput, setVolumeInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (program) {
      setWeekInput(String(program.week_number))
      setTypeInput(program.week_type === 'B' ? 'B' : 'A')
      setDeloadInput(program.deload_week != null ? String(program.deload_week) : '')
      // Stored as a fraction (0.875); shown as a percentage (87.5).
      setVolumeInput(String(Math.round(program.volume_pct * 1000) / 10))
    }
  }, [program])

  async function saveWeek() {
    if (!program) return
    const val = parseInt(weekInput)
    if (isNaN(val) || val < 1) return
    setSaving(true)
    // Rewrites the week ANCHOR ("this week is N/T"); the week keeps
    // auto-advancing from the corrected point. `today` is our LOCAL date so
    // "this week" means the user's Monday, not the server's.
    await fetch('/api/programs/week', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programId: program.id,
        weekNumber: val,
        weekType: typeInput,
        today: localDateKey(),
      }),
    })
    // The resolved workout can change with week type — drop in-progress sets.
    resetSession()
    await refresh()
    setCorrecting(false)
    setSaving(false)
  }

  async function saveDeloadWeek() {
    if (!program) return
    const trimmed = deloadInput.trim()
    const deloadWeek = trimmed === '' ? null : parseInt(trimmed)
    if (deloadWeek !== null && (isNaN(deloadWeek) || deloadWeek < 1)) return
    setSaving(true)
    await fetch('/api/programs/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: program.id, deloadWeek }),
    })
    await refresh()
    setSaving(false)
  }

  async function saveVolumePct() {
    if (!program) return
    const pct = parseFloat(volumeInput)
    if (isNaN(pct) || pct <= 0 || pct > 100) return
    setSaving(true)
    await fetch('/api/programs/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: program.id, volumePct: pct / 100 }),
    })
    await refresh()
    setSaving(false)
  }


  async function handleSignOut() {
    resetSession()
    const supabase = createClient()
    await supabase.auth.signOut()
    clearProgram()
    router.push('/login')
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #181818' }}>
        <h1 style={{ fontSize: '2rem', color: '#e8ff47', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
          SETTINGS
        </h1>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* Program info */}
        <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          program
        </div>
        <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #181818', borderRadius: 4, padding: '14px' }}>
          <div style={{ fontSize: '0.85rem', color: '#d0d0d0', marginBottom: 12 }}>
            {program?.name ?? 'Power + Pace'}
          </div>
          {/* Current week — DERIVED from the program's anchor and today's date,
              so it advances on its own each Monday. Correction is deliberately
              secondary: it's only needed if the anchor is off. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              this week:
            </label>
            <span
              style={{
                padding: '6px 14px',
                borderRadius: 4,
                border: `1px solid ${program?.week_type === 'A' ? '#e8ff47' : '#47c8ff'}`,
                color: program?.week_type === 'A' ? '#e8ff47' : '#47c8ff',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              week {program?.week_number ?? 1} · {program?.week_type ?? 'A'}
            </span>
            <span style={{ fontSize: '0.6rem', color: '#555' }}>auto · rolls over Monday</span>
          </div>

          {!correcting ? (
            <button
              onClick={() => {
                setWeekInput(String(program?.week_number ?? 1))
                setTypeInput(program?.week_type ?? 'A')
                setCorrecting(true)
              }}
              style={{ marginTop: 8, background: 'none', border: 'none', color: '#555', fontSize: '0.65rem', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline dotted' }}
            >
              correct current week
            </button>
          ) : (
            <div style={{ marginTop: 10, padding: 10, backgroundColor: '#0d0d0d', border: '1px solid #333', borderRadius: 4 }}>
              <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                Set what THIS week should be. Later weeks continue automatically
                from here.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="number"
                  value={weekInput}
                  onChange={(e) => setWeekInput(e.target.value)}
                  min={1}
                  aria-label="week number"
                  style={{ width: 56, height: 36, textAlign: 'center', backgroundColor: '#181818', border: '1px solid #333', borderRadius: 4, color: '#d0d0d0', fontSize: '0.85rem' }}
                />
                <button
                  onClick={() => setTypeInput(typeInput === 'A' ? 'B' : 'A')}
                  style={{
                    width: 44,
                    height: 36,
                    borderRadius: 4,
                    border: `1px solid ${typeInput === 'A' ? '#e8ff47' : '#47c8ff'}`,
                    backgroundColor: typeInput === 'A' ? '#e8ff47' : '#47c8ff',
                    color: '#000',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {typeInput}
                </button>
                <button
                  onClick={saveWeek}
                  disabled={saving}
                  style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #4aff91', backgroundColor: '#181818', color: '#4aff91', fontSize: '0.7rem', cursor: 'pointer', minHeight: 36 }}
                >
                  {saving ? '...' : 'apply'}
                </button>
                <button
                  onClick={() => setCorrecting(false)}
                  disabled={saving}
                  style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#888', fontSize: '0.7rem', cursor: 'pointer', minHeight: 36 }}
                >
                  cancel
                </button>
              </div>
            </div>
          )}

          {/* Deload week */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              deload wk:
            </label>
            <input
              type="number"
              value={deloadInput}
              onChange={(e) => setDeloadInput(e.target.value)}
              min={1}
              placeholder="none"
              style={{ width: 56, height: 36, textAlign: 'center', backgroundColor: '#181818', border: '1px solid #333', borderRadius: 4, color: '#d0d0d0', fontSize: '0.85rem' }}
            />
            <button
              onClick={saveDeloadWeek}
              disabled={saving}
              style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#d0d0d0', fontSize: '0.7rem', cursor: 'pointer', minHeight: 36 }}
            >
              {saving ? '...' : 'save'}
            </button>
            <span style={{ fontSize: '0.6rem', color: '#555' }}>
              (blank = none)
            </span>
          </div>

          {/* Volume % — multiplier for auto-derived volume weights */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              volume %:
            </label>
            <input
              type="number"
              value={volumeInput}
              onChange={(e) => setVolumeInput(e.target.value)}
              min={1}
              max={100}
              step={0.5}
              style={{ width: 56, height: 36, textAlign: 'center', backgroundColor: '#181818', border: '1px solid #333', borderRadius: 4, color: '#d0d0d0', fontSize: '0.85rem' }}
            />
            <button
              onClick={saveVolumePct}
              disabled={saving}
              style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#d0d0d0', fontSize: '0.7rem', cursor: 'pointer', minHeight: 36 }}
            >
              {saving ? '...' : 'save'}
            </button>
            <span style={{ fontSize: '0.6rem', color: '#555' }}>
              (of intensity; recalcs now)
            </span>
          </div>

          {/* Friday alternation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              friday alt:
            </label>
            <span style={{ fontSize: '0.85rem', color: '#c47fff' }}>
              {program?.friday_alt ?? 'A1'}
            </span>
            <span style={{ fontSize: '0.6rem', color: '#555' }}>
              (auto-advances on log)
            </span>
          </div>
        </div>

        {/* Workout templates editor */}
        <TemplatesSection />

        {/* Sign out */}
        <div style={{ marginTop: 40 }}>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 4,
              border: '1px solid #333',
              backgroundColor: '#0f0f0f',
              color: '#ff6b47',
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: 48,
            }}
          >
            sign out
          </button>
        </div>
      </div>
    </div>
  )
}
