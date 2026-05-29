'use client'

import { SetBox } from './set-box'
import type { Exercise, WorkingWeight } from '@/types/database'
import { useSessionStore } from '@/store/session-store'
import { Input } from '@/components/ui/input'
import { useEffect } from 'react'

type Props = {
  exercise: Exercise
  weight: WorkingWeight | null
  disabled?: boolean
}

export function ExerciseCard({ exercise, weight, disabled }: Props) {
  const { sets, toggleSet, initExercise, setPace, paceInputs } = useSessionStore()

  useEffect(() => {
    initExercise(exercise.id, exercise.sets)
  }, [exercise.id, exercise.sets, initExercise])

  const exSets = sets[exercise.id] ?? {}
  const completedCount = Object.values(exSets).filter((s) => s.completed).length
  const totalSets = exercise.sets
  const isSingleSet = totalSets === 1
  const hasFailures = weight?.failures && weight.failures > 0
  const hasStreak = weight?.streak && weight.streak >= 3
  const isPR = weight?.weight_lbs != null && weight.pr_lbs != null && weight.weight_lbs >= weight.pr_lbs

  const borderLeft = weight?.failures === 2 ? '3px solid #f0a500' : weight?.failures && weight.failures >= 3 ? '3px solid #ff6b47' : '1px solid #181818'

  return (
    <div
      style={{
        backgroundColor: '#0f0f0f',
        border: '1px solid #181818',
        borderLeft,
        borderRadius: 4,
        padding: '12px 14px',
        marginBottom: 10,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.85rem',
                fontWeight: 500,
                color: '#d0d0d0',
              }}
            >
              {exercise.name}
            </span>
            {exercise.is_auto_volume && (
              <span
                style={{
                  fontSize: '0.55rem',
                  fontFamily: "'DM Mono', monospace",
                  color: '#47c8ff',
                  border: '1px solid #47c8ff',
                  borderRadius: 3,
                  padding: '1px 5px',
                  letterSpacing: '0.05em',
                }}
              >
                AUTO @ 87.5%
              </span>
            )}
            {isPR && !exercise.is_auto_volume && (
              <span
                style={{
                  fontSize: '0.6rem',
                  fontFamily: "'DM Mono', monospace",
                  color: '#4aff91',
                  border: '1px solid #4aff91',
                  borderRadius: 3,
                  padding: '1px 5px',
                  letterSpacing: '0.05em',
                }}
              >
                PR
              </span>
            )}
            {hasStreak && !exercise.is_auto_volume && (
              <span
                style={{
                  fontSize: '0.6rem',
                  fontFamily: "'DM Mono', monospace",
                  color: '#e8ff47',
                  border: '1px solid #e8ff47',
                  borderRadius: 3,
                  padding: '1px 5px',
                }}
              >
                {weight!.streak}×
              </span>
            )}
            {hasFailures && !exercise.is_auto_volume && (
              <span
                style={{
                  fontSize: '0.6rem',
                  fontFamily: "'DM Mono', monospace",
                  color: weight!.failures >= 3 ? '#ff6b47' : '#f0a500',
                  border: `1px solid ${weight!.failures >= 3 ? '#ff6b47' : '#f0a500'}`,
                  borderRadius: 3,
                  padding: '1px 5px',
                }}
              >
                {weight!.failures}×miss
              </span>
            )}
          </div>

          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.7rem',
              color: '#666',
              marginTop: 2,
            }}
          >
            {exercise.weight_key && weight ? (
              <span style={{ color: '#d0d0d0', fontWeight: 500 }}>
                {weight.weight_lbs} lbs
              </span>
            ) : exercise.progression_type === 'auto' ? (
              <span style={{ color: '#555' }}>auto · {weight?.weight_lbs ?? '—'} lbs</span>
            ) : null}
            {exercise.weight_key && (
              <span style={{ marginLeft: 8 }}>
                {totalSets}×{exercise.reps}
              </span>
            )}
            {!exercise.weight_key && exercise.progression_type !== 'run' && (
              <span>{totalSets}×{exercise.reps}</span>
            )}
          </div>
        </div>

        {/* Set boxes or single checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isSingleSet ? (
            <SetBox
              setNumber={1}
              completed={exSets[1]?.completed ?? false}
              disabled={disabled}
              onToggle={() => toggleSet(exercise.id, 1)}
            />
          ) : (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {Array.from({ length: totalSets }, (_, i) => i + 1).map((n) => (
                <SetBox
                  key={n}
                  setNumber={n}
                  completed={exSets[n]?.completed ?? false}
                  disabled={disabled}
                  onToggle={() => toggleSet(exercise.id, n)}
                />
              ))}
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '0.7rem',
                  color: completedCount === totalSets ? '#4aff91' : '#666',
                  minWidth: 28,
                  textAlign: 'right',
                }}
              >
                {completedCount}/{totalSets}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pace input for run exercises */}
      {exercise.is_run && (
        <div style={{ marginTop: 8 }}>
          <Input
            placeholder="actual pace (e.g. 9:32/mi)"
            value={paceInputs[exercise.id] ?? ''}
            onChange={(e) => setPace(exercise.id, e.target.value)}
            disabled={disabled}
            style={{
              backgroundColor: '#111',
              border: '1px solid #333',
              color: '#d0d0d0',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.75rem',
              height: 36,
            }}
          />
        </div>
      )}

    </div>
  )
}
