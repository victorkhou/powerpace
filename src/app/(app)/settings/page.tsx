'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { activeProgramQuery } from '@/lib/date'
import { TemplatesSection } from '@/components/settings/templates-section'

export default function SettingsPage() {
  const { activeProgram, setActiveProgram, clearProgram } = useAppStore()
  const resetSession = useSessionStore((s) => s.reset)
  const router = useRouter()
  const [weekInput, setWeekInput] = useState('')
  const [deloadInput, setDeloadInput] = useState('')
  const [volumeInput, setVolumeInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!activeProgram)

  const program = activeProgram?.program

  useEffect(() => {
    if (activeProgram) { setLoading(false); return }
    async function load() {
      const res = await fetch(`/api/programs/active${activeProgramQuery()}`)
      if (res.ok) setActiveProgram(await res.json())
      setLoading(false)
    }
    load()
  }, [activeProgram, setActiveProgram])

  useEffect(() => {
    if (program) {
      setWeekInput(String(program.week_number))
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
    await fetch('/api/programs/week', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: program.id, weekNumber: val }),
    })
    const res = await fetch(`/api/programs/active${activeProgramQuery()}`)
    if (res.ok) setActiveProgram(await res.json())
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
    const res = await fetch(`/api/programs/active${activeProgramQuery()}`)
    if (res.ok) setActiveProgram(await res.json())
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
    const res = await fetch(`/api/programs/active${activeProgramQuery()}`)
    if (res.ok) setActiveProgram(await res.json())
    setSaving(false)
  }

  async function toggleWeekType() {
    if (!program) return
    setSaving(true)
    const newType = program.week_type === 'A' ? 'B' : 'A'
    await fetch('/api/programs/week', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: program.id, weekType: newType }),
    })
    // Today's workout will change — clear any in-progress set state
    resetSession()
    const res = await fetch(`/api/programs/active${activeProgramQuery()}`)
    if (res.ok) setActiveProgram(await res.json())
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
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'DM Mono', monospace", color: '#666', fontSize: '0.8rem' }}>loading...</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #181818' }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: '#e8ff47', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
          SETTINGS
        </h1>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* Program info */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          program
        </div>
        <div style={{ backgroundColor: '#0f0f0f', border: '1px solid #181818', borderRadius: 4, padding: '14px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', color: '#d0d0d0', marginBottom: 12 }}>
            {program?.name ?? 'Power + Pace'}
          </div>
          {/* Week type toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              week type:
            </label>
            <button
              onClick={toggleWeekType}
              disabled={saving}
              style={{
                padding: '8px 20px',
                borderRadius: 4,
                border: `1px solid ${program?.week_type === 'A' ? '#e8ff47' : '#47c8ff'}`,
                backgroundColor: program?.week_type === 'A' ? '#e8ff47' : '#47c8ff',
                color: '#000',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              {program?.week_type ?? 'A'}
            </button>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#555' }}>tap to toggle</span>
          </div>

          {/* Week number */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              week #:
            </label>
            <input
              type="number"
              value={weekInput}
              onChange={(e) => setWeekInput(e.target.value)}
              min={1}
              style={{ width: 56, height: 36, textAlign: 'center', backgroundColor: '#181818', border: '1px solid #333', borderRadius: 4, color: '#d0d0d0', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem' }}
            />
            <button
              onClick={saveWeek}
              disabled={saving}
              style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#d0d0d0', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', cursor: 'pointer', minHeight: 36 }}
            >
              {saving ? '...' : 'save'}
            </button>
          </div>

          {/* Deload week */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              deload wk:
            </label>
            <input
              type="number"
              value={deloadInput}
              onChange={(e) => setDeloadInput(e.target.value)}
              min={1}
              placeholder="none"
              style={{ width: 56, height: 36, textAlign: 'center', backgroundColor: '#181818', border: '1px solid #333', borderRadius: 4, color: '#d0d0d0', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem' }}
            />
            <button
              onClick={saveDeloadWeek}
              disabled={saving}
              style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#d0d0d0', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', cursor: 'pointer', minHeight: 36 }}
            >
              {saving ? '...' : 'save'}
            </button>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#555' }}>
              (blank = none)
            </span>
          </div>

          {/* Volume % — multiplier for auto-derived volume weights */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              volume %:
            </label>
            <input
              type="number"
              value={volumeInput}
              onChange={(e) => setVolumeInput(e.target.value)}
              min={1}
              max={100}
              step={0.5}
              style={{ width: 56, height: 36, textAlign: 'center', backgroundColor: '#181818', border: '1px solid #333', borderRadius: 4, color: '#d0d0d0', fontFamily: "'DM Mono', monospace", fontSize: '0.85rem' }}
            />
            <button
              onClick={saveVolumePct}
              disabled={saving}
              style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #333', backgroundColor: '#181818', color: '#d0d0d0', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', cursor: 'pointer', minHeight: 36 }}
            >
              {saving ? '...' : 'save'}
            </button>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#555' }}>
              (of intensity; recalcs now)
            </span>
          </div>

          {/* Friday alternation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#888', flexShrink: 0 }}>
              friday alt:
            </label>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', color: '#c47fff' }}>
              {program?.friday_alt ?? 'A1'}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#555' }}>
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
              fontFamily: "'DM Mono', monospace",
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
