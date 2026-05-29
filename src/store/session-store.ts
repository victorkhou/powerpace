'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SetState = {
  completed: boolean
  pace?: string
}

type ExerciseSets = Record<number, SetState> // set_number → state

type SessionState = {
  // Keyed by exercise id
  sets: Record<string, ExerciseSets>
  paceInputs: Record<string, string> // exercise_id → pace string
  notes: string
  sessionLogged: boolean
  sessionId: string | null

  toggleSet: (exerciseId: string, setNumber: number) => void
  setPace: (exerciseId: string, pace: string) => void
  setNotes: (notes: string) => void
  markLogged: (sessionId: string) => void
  reset: () => void
  initExercise: (exerciseId: string, sets: number) => void
}

const initialState = {
  sets: {},
  paceInputs: {},
  notes: '',
  sessionLogged: false,
  sessionId: null,
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      initExercise(exerciseId, numSets) {
        const existing = get().sets[exerciseId]
        if (existing && Object.keys(existing).length === numSets) return
        set((s) => ({
          sets: {
            ...s.sets,
            [exerciseId]: Object.fromEntries(
              Array.from({ length: numSets }, (_, i) => [i + 1, { completed: false }])
            ),
          },
        }))
      },

      toggleSet(exerciseId, setNumber) {
        set((s) => {
          const exSets = s.sets[exerciseId] ?? {}
          const current = exSets[setNumber]?.completed ?? false
          return {
            sets: {
              ...s.sets,
              [exerciseId]: {
                ...exSets,
                [setNumber]: { ...exSets[setNumber], completed: !current },
              },
            },
          }
        })
      },

      setPace(exerciseId, pace) {
        set((s) => ({ paceInputs: { ...s.paceInputs, [exerciseId]: pace } }))
      },

      setNotes(notes) {
        set({ notes })
      },

      markLogged(sessionId) {
        set({ sessionLogged: true, sessionId })
      },

      reset() {
        set(initialState)
      },
    }),
    {
      name: 'pp-session',
    }
  )
)
