'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { useSessionStore } from '@/store/session-store'
import { useTimerStore } from '@/store/timer-store'
import { ExerciseCard } from '@/components/today/exercise-card'
import { RestTimerPill } from '@/components/today/rest-timer-pill'
import { SessionSummaryModal } from '@/components/today/session-summary-modal'
import { PartialConfirmModal } from '@/components/today/partial-confirm-modal'
import { RpePicker } from '@/components/today/rpe-picker'
import { Textarea } from '@/components/ui/textarea'
import type { ChangeEntry } from '@/app/api/sessions/log/route'
import type { ActiveProgram } from '@/store/app-store'
import { localDateKey } from '@/lib/date'
import { optimisticMutate } from '@/lib/optimistic'
import { formatVolumePct, sessionVolume } from '@/lib/progression'

export default function TodayPage() {
  const router = useRouter()
  const { activeProgram, setActiveProgram } = useAppStore()
  const { sets, paceInputs, notes, setNotes, sessionLogged, sessionId, markLogged, clearLogged, reset, resetIfStale } = useSessionStore()
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showPartialConfirm, setShowPartialConfirm] = useState(false)
  const [changes, setChanges] = useState<ChangeEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [rpe, setRpe] = useState<number | null>(null)
  const [rpeError, setRpeError] = useState<string | null>(null)
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const rpeReqIdRef = useRef(0)
  const mountedRef = useRef(true)

  const loadProgram = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      const dow = now.getDay()
      const date = localDateKey(now)
      const res = await fetch(`/api/programs/active?dow=${dow}&date=${date}`)
      if (res.status === 401) { router.push('/login'); return }
      const data: ActiveProgram = await res.json()
      setActiveProgram(data)
      setLoadedDate(date)
      // Reset persisted set state if it's bound to a different day or workout
      if (data.todayWorkout) {
        resetIfStale(date, data.todayWorkout.id)
      }
      // Sync sessionLogged flag with server truth
      if (data.todaySession && data.todaySession.status !== 'undone' && data.todaySession.status !== 'skipped') {
        markLogged(data.todaySession.id)
        setRpe(data.todaySession.rpe ?? null)
      } else {
        clearLogged()
        setRpe(null)
      }
    } finally {
      setLoading(false)
    }
  }, [router, setActiveProgram, markLogged, clearLogged, resetIfStale])

  useEffect(() => {
    loadProgram()
  }, [loadProgram])

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const program = activeProgram?.program
  const todayWorkout = activeProgram?.todayWorkout
  const exercises = activeProgram?.exercises ?? []
  const weights = activeProgram?.weights ?? {}
  const isWeekA = program?.week_type === 'A'
  // friday_alt is anchored to the real calendar date on the server (a swapped
  // workout does not move the alternation), so derive these from loadedDate —
  // not the resolved workout's template slot — to stay consistent.
  const calendarDow = loadedDate ? new Date(`${loadedDate}T00:00:00`).getDay() : null
  const willAdvanceFridayAlt = calendarDow === 5 && isWeekA
  // The variant the user is actually performing comes from the resolved workout.
  const performedVariant = todayWorkout?.variant ?? null
  const isVolumeDay = todayWorkout?.is_volume === true

  // Compute total sets and completed sets across progressable exercises
  const allExSets = exercises.flatMap((ex) => {
    const exState = sets[ex.id] ?? {}
    return Object.values(exState)
  })
  const totalSets = allExSets.length
  const completedSets = allExSets.filter((s) => s.completed).length
  const allComplete = totalSets > 0 && completedSets === totalSets

  // Live volume — same rule as the server (sessionVolume excludes auto-derived
  // volume keys), so the header number always matches what logging will persist.
  const liveVolume = sessionVolume(
    exercises.flatMap((ex) =>
      Object.values(sets[ex.id] ?? {}).map((s) => ({
        weightKey: ex.weight_key,
        weightLbs: ex.weight_key ? weights[ex.weight_key]?.weight_lbs ?? null : null,
        reps: ex.reps,
        completed: s.completed,
      }))
    )
  )

  // Completion counter (exercises fully done / total exercises with sets)
  const exercisesDone = exercises.filter((ex) => {
    const exState = sets[ex.id] ?? {}
    const total = ex.sets
    const done = Object.values(exState).filter((s) => s.completed).length
    return done === total && total > 0
  }).length

  async function doLogSession(isPartial: boolean) {
    if (!program || !todayWorkout || !loadedDate) return
    setLogging(true)
    setError(null)
    setRpe(null)
    try {
      const today = loadedDate
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
          fridayAlt: performedVariant,
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
      useTimerStore.getState().stop()
      setChanges(data.changes)
      setShowSummary(true)
    } finally {
      setLogging(false)
    }
  }

  function handleLogSessionClick() {
    if (allComplete) {
      doLogSession(false)
    } else if (completedSets === 0) {
      // Nothing checked — treat as a skip directly. Avoids creating an
      // empty 'partial' session row indistinguishable from a skip.
      handleSkip()
    } else {
      setShowPartialConfirm(true)
    }
  }

  async function handleSkip() {
    if (!program || !todayWorkout || !loadedDate) return
    setSkipping(true)
    const today = loadedDate
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
    useTimerStore.getState().stop()
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
      setRpe(null)
      rpeReqIdRef.current++
      reset()
      loadProgram()
    }
  }

  async function handleRpeChange(v: number | null) {
    if (!sessionId) return
    const myId = ++rpeReqIdRef.current
    const prev = rpe
    setRpeError(null)
    await optimisticMutate({
      onLocalChange: () => setRpe(v),
      onLocalRollback: () => setRpe(prev),
      mutation: () =>
        fetch(`/api/sessions/${sessionId}/rpe`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rpe: v }),
        }),
      errorMessage: 'Could not save RPE',
      shouldApply: () => mountedRef.current && rpeReqIdRef.current === myId,
      onError: (msg) => setRpeError(msg),
    })
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
        {performedVariant && (
          <div style={{ marginTop: 8, padding: '5px 10px', backgroundColor: 'rgba(232,255,71,0.05)', border: '1px solid #333', borderRadius: 4, fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#888' }}>
            {performedVariant} active{willAdvanceFridayAlt ? ` · next: ${program?.friday_alt === 'A1' ? 'A2' : 'A1'}` : ''}
          </div>
        )}
        {todayWorkout && (todayWorkout.type === 'lift' || todayWorkout.type === 'combo') && (
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
            {isVolumeDay ? `VOLUME @ ${formatVolumePct(program?.volume_pct)}` : 'PR ATTEMPT'}
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
              isVolumeDay={isVolumeDay}
              volumePct={program?.volume_pct}
            />
          ))
        )}

        {/* Inline RPE picker (post-log, persists across reloads) */}
        {sessionLogged && sessionId && !showSummary && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: '#0f0f0f',
              border: '1px solid #181818',
              borderRadius: 4,
            }}
          >
            <RpePicker value={rpe} onChange={handleRpeChange} disabled={undoing} />
            {rpeError && (
              <p style={{ fontFamily: "'DM Mono', monospace", color: '#ff6b47', fontSize: '0.7rem', marginTop: 8 }}>
                {rpeError}
              </p>
            )}
          </div>
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

      {/* Rest timer pill (positions itself fixed) */}
      <RestTimerPill />

      {/* Modals */}
      <SessionSummaryModal
        open={showSummary}
        changes={changes}
        onUndo={handleUndo}
        onDone={() => setShowSummary(false)}
        undoing={undoing}
        sessionId={sessionId ?? undefined}
        rpe={rpe}
        onRpeChange={handleRpeChange}
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
