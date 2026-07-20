'use client'

import { SetBox } from './set-box'
import type { Exercise, WorkingWeight } from '@/types/database'
import { useSessionStore } from '@/store/session-store'
import { useTimerStore } from '@/store/timer-store'
import { getRestSeconds, formatVolumePct } from '@/lib/progression'
import { Input } from '@/components/ui/input'
import { PlateCalculatorSheet } from './plate-calculator-sheet'
import { useEffect, useState } from 'react'

type Props = {
  exercise: Exercise
  weight: WorkingWeight | null
  disabled?: boolean
  isVolumeDay: boolean
  volumePct?: number
}

export function ExerciseCard({ exercise, weight, disabled, isVolumeDay, volumePct }: Props) {
  const { sets, toggleSet, initExercise, setPace, paceInputs } = useSessionStore()
  const [plateSheetOpen, setPlateSheetOpen] = useState(false)

  function handleToggle(setNumber: number) {
    const wasCompleted = sets[exercise.id]?.[setNumber]?.completed ?? false
    const becomingCompleted = !wasCompleted
    const setKey = `${exercise.id}-${setNumber}`
    toggleSet(exercise.id, setNumber)
    if (becomingCompleted) {
      const sec = getRestSeconds(exercise, isVolumeDay)
      if (sec != null) {
        useTimerStore.getState().start(setKey, sec)
      }
    } else {
      useTimerStore.getState().stopIfMatch(setKey)
    }
  }

  useEffect(() => {
    initExercise(exercise.id, exercise.sets)
  }, [exercise.id, exercise.sets, initExercise])

  const showPlateButton =
    !!exercise.weight_key &&
    exercise.progression_type !== 'bodyweight' &&
    !exercise.is_run &&
    !!weight

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
                      color: '#47c8ff',
                  border: '1px solid #47c8ff',
                  borderRadius: 3,
                  padding: '1px 5px',
                  letterSpacing: '0.05em',
                }}
              >
                AUTO @ {formatVolumePct(volumePct)}
              </span>
            )}
            {isPR && !exercise.is_auto_volume && (
              <span
                style={{
                  fontSize: '0.6rem',
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
              fontSize: '0.7rem',
              color: '#666',
              marginTop: 2,
            }}
          >
            {exercise.weight_key && weight ? (
              showPlateButton ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPlateSheetOpen(true) }}
                  style={{
                    display: 'inline-block',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    color: '#d0d0d0',
                    fontWeight: 500,
                          fontSize: '0.7rem',
                    cursor: 'pointer',
                    textDecoration: 'underline dotted',
                    textUnderlineOffset: 3,
                    textDecorationColor: '#444',
                  }}
                >
                  {weight.weight_lbs} lbs
                </button>
              ) : (
                <span style={{ color: '#d0d0d0', fontWeight: 500 }}>
                  {weight.weight_lbs} lbs
                </span>
              )
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
              onToggle={() => handleToggle(1)}
            />
          ) : (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {Array.from({ length: totalSets }, (_, i) => i + 1).map((n) => (
                <SetBox
                  key={n}
                  setNumber={n}
                  completed={exSets[n]?.completed ?? false}
                  disabled={disabled}
                  onToggle={() => handleToggle(n)}
                />
              ))}
              <span
                style={{
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

      {showPlateButton && (
        <PlateCalculatorSheet
          weightLbs={weight!.weight_lbs}
          open={plateSheetOpen}
          onClose={() => setPlateSheetOpen(false)}
          label={exercise.name}
        />
      )}

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
              fontSize: '0.75rem',
              height: 36,
            }}
          />
        </div>
      )}

    </div>
  )
}
