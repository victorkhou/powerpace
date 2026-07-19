'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { activeProgramQuery, localDateKey } from '@/lib/date'

/**
 * The single owner of the activeProgram fetch/cache/refresh protocol.
 *
 * Four pages previously hand-rolled this against app-store with drifted
 * behavior: settings and weights served a persisted localStorage blob from
 * yesterday indefinitely (no staleness check), and six mutation handlers each
 * copy-pasted the "refetch /api/programs/active then setActiveProgram" ritual.
 *
 * Policy:
 * - Serve the cached blob when it was fetched for TODAY (todayWorkout /
 *   todaySession are date-bound, so yesterday's cache is stale by definition).
 * - 401 → redirect to /login (previously only the Today page did this).
 * - refresh() refetches unconditionally — call it after any mutation that
 *   changes program state (week, settings, weights, swaps, logging).
 */
export function useActiveProgram() {
  const router = useRouter()
  const { activeProgram, loadedDate, setActiveProgram } = useAppStore()
  const today = localDateKey()
  const cacheFresh = activeProgram !== null && loadedDate === today
  const [loading, setLoading] = useState(!cacheFresh)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      const res = await fetch(`/api/programs/active${activeProgramQuery()}`)
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        setError('Failed to load program')
        return
      }
      setActiveProgram(await res.json(), localDateKey())
    } catch {
      setError('Failed to load program')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [router, setActiveProgram])

  useEffect(() => {
    if (!cacheFresh) {
      setLoading(true)
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheFresh])

  return {
    activeProgram,
    program: activeProgram?.program ?? null,
    weights: activeProgram?.weights ?? {},
    // The local date the payload was fetched for (null until first load).
    loadedDate,
    loading,
    error,
    refresh,
  }
}
