'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Program, WorkoutDay, Exercise, WorkingWeight } from '@/types/database'

export type ActiveProgram = {
  program: Program
  todayWorkout: WorkoutDay | null
  exercises: Exercise[]
  weights: Record<string, WorkingWeight>
  todaySession: { id: string; status: string; rpe: number | null } | null
}

export type { Program }

type AppState = {
  activeProgram: ActiveProgram | null
  // The local date key the payload was fetched for. todayWorkout/todaySession
  // are date-bound, so a persisted blob from yesterday must be refetched —
  // useActiveProgram() uses this as its staleness signal.
  loadedDate: string | null
  setActiveProgram: (data: ActiveProgram | null, dateKey?: string | null) => void
  clearProgram: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProgram: null,
      loadedDate: null,

      setActiveProgram(data, dateKey = null) {
        set({ activeProgram: data, loadedDate: dateKey })
      },

      clearProgram() {
        set({ activeProgram: null, loadedDate: null })
      },
    }),
    {
      name: 'pp-app',
    }
  )
)
