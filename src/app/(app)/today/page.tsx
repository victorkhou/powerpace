'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { ExerciseCard } from '@/components/today/exercise-card'
import { SessionSummaryModal } from '@/components/today/session-summary-modal'
import { PartialConfirmModal } from '@/components/today/partial-confirm-modal'
import { Textarea } from '@/components/ui/textarea'
import type { ChangeEntry } from '@/app/api/sessions/log/route'
import type { ActiveProgram } from '@/store/app-store'

export default function TodayPage() {
  const router = useRouter()
  const { activeProgram, setActiveProgram } = useAppStore()
  const { sets, paceInputs, notes, setNotes, sessionLogged, sessionId, markLogged, reset } = useSessionStore()
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showPartialConfirm, setShowPartialConfirm] = useState(false)
  const [changes, setChanges] = useState<ChangeEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadProgram = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/programs/active')
      if (res.status === 401) { router.push('/login'); return }
      const data: ActiveProgram & { todaySession: { id: string; status: string } | null } = await res.json()
      setActiveProgram(data)
      // If today is already logged and not undone, mark state
      if (data.todaySession && data.todaySession.status !== 'undone' && data.todaySession.status !== 'skipped') {
        markLogged(data.todaySession.id)
      }
    } finally {
      setLoading(false)
    }
  }, [router, setActiveProgram, markLogged])

  useEffect(() => {
    loadProgram()
  }, [loadProgram])

  const program = activeProgram?.program
  const todayWorkout = activeProgram?.todayWorkout
  const exercises = activeProgram?.exercises ?? []
  const weights = activeProgram?.weights ?? {}
  const dow = todayWorkout?.day_of_week
  const isWeekA = program?.week_type === 'A'
  const isVariantDay = (dow === 2 || dow === 5) && isWeekA
  const isVolumeDay = todayWorkout?.is_volume === true

  // Compute total sets and completed sets across progressable exercises
  const allExSets = exercises.flatMap((ex) => {
    const exState = sets[ex.id] ?? {}
    return Object.values(exState)
  })
  const totalSets = allExSets.length
  const completedSets = allExSets.filter((s) => s.completed).length
  const allComplete = totalSets > 0 && completedSets === totalSets

  // Live volume
  const liveVolume = exercises.reduce((acc, ex) => {
    const w = ex.weight_key ? weights[ex.weight_key]?.weight_lbs ?? 0 : 0
    const exState = sets[ex.id] ?? {}
    const done = Object.values(exState).filter((s) => s.completed).length
    return acc + done * ex.reps * w
  }, 0)

  // Completion counter (exercises fully done / total exercises with sets)
  const exercisesDone = exercises.filter((ex) => {
    const exState = sets[ex.id] ?? {}
    const total = ex.sets
    const done = Object.values(exState).filter((s) => s.completed).length
    return done === total && total > 0
  }).length

  async function doLogSession(isPartial: boolean) {
    if (!program || !todayWorkout) return
    setLogging(true)
    setError(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const setsPayload = exercises.flatMap((ex) => {
        const exState = sets[ex.id] ?? {}
        return Object.entries(exState).map(([setNum, s]) => ({
          exerciseId: ex.id,
          weightKey: ex.weight_key,
          setNumber: parseInt(setNum),
          completed: s.completed,
          weightLbs: ex.weight_key ? (weights[ex.weight_key]?.weight_lbs ?? null) : null,
          repsTarget: ex.reps,
          repsActual: null,
          progressionType: ex.progression_type,
        }))
      })

      const runLogsPayload = exercises
        .filter((ex) => ex.is_run && paceInputs[ex.id])
        .map((ex) => ({
          exerciseId: ex.id,
          paceActual: paceInputs[ex.id] ?? null,
          paceTarget: null,
        }))

      const res = await fetch('/api/sessions/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: program.id,
          workoutDayId: todayWorkout.id,
          date: today,
          weekNumber: program.week_number,
          weekType: program.week_type,
          fridayAlt: isVariantDay ? program.friday_alt : null,
          sets: setsPayload,
          runLogs: runLogsPayload,
          notes,
          isPartial,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Failed to log session')
        return
      }

      const data = await res.json()
      markLogged(data.sessionId)
      setChanges(data.changes)
      setShowSummary(true)
    } finally {
      setLogging(false)
    }
  }

  function handleLogSessionClick() {
    if (allComplete) {
      doLogSession(false)
    } else {
      setShowPartialConfirm(true)
    }
  }

  async function handleSkip() {
    if (!program || !todayWorkout) return
    setSkipping(true)
    const today = new Date().toISOString().split('T')[0]
    await fetch('/api/sessions/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programId: program.id,
        workoutDayId: todayWorkout.id,
        date: today,
        weekNumber: program.week_number,
        weekType: program.week_type,
      }),
    })
    setSkipping(false)
    reset()
    loadProgram()
  }

  async function handleUndo() {
    if (!sessionId) return
    setUndoing(true)
    const res = await fetch('/api/sessions/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    setUndoing(false)
    if (res.ok) {
      setShowSummary(false)
      reset()
      loadProgram()
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'DM Mono', monospace", color: '#666', fontSize: '0.8rem' }}>loading...</span>
      </div>
    )
  }

  // Rest day
  if (todayWorkout?.type === 'rest') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '4rem', color: '#4aff91', letterSpacing: '0.05em', marginBottom: 8 }}>
          REST DAY
        </h1>
        <p style={{ fontFamily: "'DM Mono', monospace", color: '#666', fontSize: '0.8rem' }}>
          Recovery. You earned it.
        </p>
      </div>
    )
  }

  const accentColor = todayWorkout?.type === 'run' ? '#47c8ff' : todayWorkout?.type === 'combo' ? '#c47fff' : '#e8ff47'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', paddingBottom: 140 }}>
      {/* Header */}
      <div
        style={{
          padding: '20px 16px 14px',
          borderBottom: '1px solid #181818',
          position: 'sticky',
          top: 0,
          backgroundColor: '#0d0d0d',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '2rem',
                color: accentColor,
                letterSpacing: '0.05em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              {todayWorkout?.name ?? 'Today'}
            </h1>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#666', marginTop: 3 }}>
              {todayWorkout?.tag && <span style={{ marginRight: 8 }}>{todayWorkout.tag}</span>}
              <span style={{ color: program?.week_type === 'A' ? '#e8ff47' : '#47c8ff' }}>
                week {program?.week_type}
              </span>
              <span style={{ marginLeft: 6 }}>#{program?.week_number ?? 1}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: '#d0d0d0' }}>
              {exercisesDone}/{exercises.length}
            </div>
            {liveVolume > 0 && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#666' }}>
                {Math.round(liveVolume).toLocaleString()} lbs
              </div>
            )}
          </div>
        </div>
        {isVariantDay && (
          <div style={{ marginTop: 8, padding: '5px 10px', backgroundColor: 'rgba(232,255,71,0.05)', border: '1px solid #333', borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#888' }}>
            {dow === 5 ? 'Friday' : 'Tuesday'} {program?.friday_alt} active · next: {program?.friday_alt === 'A1' ? 'A2' : 'A1'}
          </div>
        )}
        {todayWorkout && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 10px',
              backgroundColor: isVolumeDay ? 'rgba(71,200,255,0.06)' : 'rgba(232,255,71,0.06)',
              border: `1px solid ${isVolumeDay ? '#47c8ff' : '#e8ff47'}`,
              borderRadius: 4,
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.65rem',
              color: isVolumeDay ? '#47c8ff' : '#e8ff47',
              letterSpacing: '0.05em',
            }}
          >
            {isVolumeDay ? '5×5 @ 87.5% — VOLUME' : '3×5 — PR ATTEMPT'}
          </div>
        )}
      </div>

      {/* Exercise list */}
      <div style={{ padding: '14px 16px 0' }}>
        {exercises.length === 0 ? (
          <p style={{ fontFamily: "'DM Mono', monospace", color: '#444', fontSize: '0.8rem', textAlign: 'center', paddingTop: 40 }}>
            No exercises for today.
          </p>
        ) : (
          exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              weight={ex.weight_key ? (weights[ex.weight_key] ?? null) : null}
              disabled={sessionLogged}
            />
          ))
        )}

        {/* Session notes */}
        {!sessionLogged && exercises.length > 0 && (
          <Textarea
            placeholder="session notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{
              backgroundColor: '#0f0f0f',
              border: '1px solid #181818',
              color: '#d0d0d0',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.75rem',
              marginTop: 8,
              resize: 'none',
            }}
          />
        )}

        {error && (
          <p style={{ fontFamily: "'DM Mono', monospace", color: '#ff6b47', fontSize: '0.7rem', marginTop: 8 }}>
            {error}
          </p>
        )}
      </div>

      {/* Sticky bottom bar — sits above bottom nav */}
      <div
        style={{
          position: 'fixed',
          bottom: 56,
          left: 0,
          right: 0,
          backgroundColor: '#0d0d0d',
          borderTop: '1px solid #181818',
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
          zIndex: 20,
        }}
      >
        {!sessionLogged ? (
          <>
            <button
              onClick={handleSkip}
              disabled={skipping}
              style={{
                flex: '0 0 auto',
                padding: '0 16px',
                height: 48,
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: 4,
                color: '#666',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.7rem',
                cursor: 'pointer',
                minWidth: 64,
              }}
            >
              {skipping ? '...' : 'skip'}
            </button>
            <button
              onClick={handleLogSessionClick}
              disabled={logging || exercises.length === 0}
              style={{
                flex: 1,
                height: 48,
                backgroundColor: allComplete ? '#e8ff47' : '#181818',
                border: allComplete ? 'none' : '1px solid #333',
                borderRadius: 4,
                color: allComplete ? '#000' : '#555',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: logging ? 'default' : 'pointer',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              {logging ? 'logging...' : 'LOG SESSION'}
            </button>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              height: 48,
              backgroundColor: 'rgba(74,255,145,0.08)',
              border: '1px solid #4aff91',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
            }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: '#4aff91' }}>
              SESSION LOGGED
            </span>
            <button
              onClick={handleUndo}
              disabled={undoing}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ff6b47',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.7rem',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              {undoing ? '...' : 'undo'}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <SessionSummaryModal
        open={showSummary}
        changes={changes}
        onUndo={handleUndo}
        onDone={() => setShowSummary(false)}
        undoing={undoing}
      />
      <PartialConfirmModal
        open={showPartialConfirm}
        onClose={() => setShowPartialConfirm(false)}
        onSkip={async () => {
          setShowPartialConfirm(false)
          await handleSkip()
        }}
        onLogPartial={async () => {
          setShowPartialConfirm(false)
          await doLogSession(true)
        }}
      />
    </div>
  )
}
