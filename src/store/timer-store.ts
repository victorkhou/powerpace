'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_REST_SEC = 600

type TimerState = {
  endsAt: number | null
  lastSetKey: string | null

  start: (setKey: string, sec: number) => void
  stop: () => void
  stopIfMatch: (setKey: string) => void
}

const initialState = {
  endsAt: null,
  lastSetKey: null,
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      ...initialState,

      start(setKey, sec) {
        const clamped = Math.max(0, Math.min(MAX_REST_SEC, sec))
        set({
          endsAt: Date.now() + clamped * 1000,
          lastSetKey: setKey,
        })
      },

      stop() {
        set({ ...initialState })
      },

      stopIfMatch(setKey) {
        if (get().lastSetKey === setKey) {
          set({ ...initialState })
        }
      },
    }),
    {
      name: 'pp-timer',
      partialize: (s) => ({ endsAt: s.endsAt, lastSetKey: s.lastSetKey }),
      onRehydrateStorage: () => (state) => {
        if (state?.endsAt != null && state.endsAt <= Date.now()) {
          state.endsAt = null
          state.lastSetKey = null
        }
      },
    }
  )
)
