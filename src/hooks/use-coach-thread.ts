'use client'

import { useEffect, useState } from 'react'
import { localDateKey } from '@/lib/date'

const STORAGE_KEY = 'pp-coach-thread'

/**
 * A conversation id scoped to the local date, persisted in localStorage.
 *
 * The coach sidecar keys its LangGraph checkpointer by thread_id, so reusing an
 * id continues that conversation's memory. Scoping to the date means the chat
 * survives navigating away and back, but starts fresh each day — consistent
 * with the rest of the app, whose state (today's workout, session, set
 * progress) is all date-bound.
 *
 * Returns null on the first render (localStorage is unavailable during SSR),
 * then the resolved id. Callers should not send a request until it is non-null.
 */
export function useCoachThread(): { threadId: string | null; resetThread: () => void } {
  const [threadId, setThreadId] = useState<string | null>(null)

  useEffect(() => {
    const today = localDateKey()
    let stored: { date: string; id: string } | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) stored = JSON.parse(raw)
    } catch {
      stored = null
    }

    if (stored && stored.date === today && stored.id) {
      setThreadId(stored.id)
      return
    }
    const fresh = { date: today, id: `coach-${today}-${crypto.randomUUID()}` }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    } catch {
      // Private-mode / quota failure: still use the id for this session.
    }
    setThreadId(fresh.id)
  }, [])

  function resetThread() {
    const today = localDateKey()
    const fresh = { date: today, id: `coach-${today}-${crypto.randomUUID()}` }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    } catch {
      // ignore
    }
    setThreadId(fresh.id)
  }

  return { threadId, resetThread }
}
