'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Program, WorkoutDay, Exercise, WorkingWeight } from '@/types/database'

export type ActiveProgram = {
  program: Program
  todayWorkout: WorkoutDay | null
  exercises: Exercise[]
  weights: Record<string, WorkingWeight>
  todaySession: { id: string; status: string } | null
}

export type { Program }

type AppState = {
  activeProgram: ActiveProgram | null
  setActiveProgram: (data: ActiveProgram | null) => void
  updateWeight: (key: string, weight: WorkingWeight) => void
  clearProgram: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProgram: null,

      setActiveProgram(data) {
        set({ activeProgram: data })
      },

      updateWeight(key, weight) {
        set((s) => {
          if (!s.activeProgram) return s
          return {
            activeProgram: {
              ...s.activeProgram,
              weights: { ...s.activeProgram.weights, [key]: weight },
            },
          }
        })
      },

      clearProgram() {
        set({ activeProgram: null })
      },
    }),
    {
      name: 'pp-app',
    }
  )
)
